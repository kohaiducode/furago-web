import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import React from "react";
import FuragoApp from "./FuragoApp";
import type { Article } from "@/types/article";
import { DictionaryService } from "@/lib/dictionary";
import { loadUserState } from "@/lib/userState";

vi.mock("../lib/analytics", () => ({
  checkAndTrackSessionStart: vi.fn(),
  updateSessionActivity: vi.fn(),
  trackEvent: vi.fn(),
}));

const sampleArticles: Article[] = [
  {
    id: "art-1",
    date: "2026-03-01",
    seriesId: "series-alpha",
    seriesOrder: 1,
    levels: {
      LVL_1: {
        title: "Episode 1",
        paragraphs: [{ id: "p1", fr: "Bonjour le monde", ja: "こんにちは世界", en: "Hello world" }],
        quiz: [],
      },
    },
  },
  {
    id: "art-2",
    date: "2026-03-02",
    seriesId: "series-alpha",
    seriesOrder: 2,
    levels: {
      LVL_1: {
        title: "Episode 2",
        paragraphs: [{ id: "p2", fr: "Merci beaucoup", ja: "どうもありがとう", en: "Thank you very much" }],
        quiz: [],
      },
    },
  },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const makeDueWord = (word: string, dueAt: number) => ({
  word,
  articleIds: ["art-1"],
  firstLearnedAt: dueAt - MS_PER_DAY,
  lastReviewedAt: null,
  dueAt,
  interval: 0,
  difficulty: "normal",
  correctCount: 0,
  wrongCount: 0,
  reviewStreak: 0,
});

describe("VocabReview flow extraction (6.3-D.2-G)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("furago_app_lang", "en");
    window.history.replaceState(null, "", "/");

    vi.spyOn(DictionaryService, "lookupWord").mockImplementation(async (word) => ({
      mot: word,
      originalWord: word,
      matchedLemma: word,
      conciseDef: "Définition unique",
      phraseOriginale: "",
      traductionPhrase: "",
      nature: "nom",
      definitions: ["Définition unique"],
      gender: "m",
    }));

    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(sampleArticles)))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("VOCAB-ERR-01: an incorrect QCM answer records an SRS failure and advances after the feedback delay", async () => {
    const now = Date.now();
    localStorage.setItem(
      "furago:user-state:v1",
      JSON.stringify({
        level: "LVL_1",
        learnedVocabulary: [makeDueWord("bonjour", now - 1000)],
        savedVocabulary: [
          { fr: "chat", ja: "", conciseDef: "Chat — animal", listId: "default", date: "2026-01-01" },
        ],
      })
    );

    render(<FuragoApp initialArticles={sampleArticles} />);

    fireEvent.click(screen.getAllByRole("button", { name: /復習|Review/i })[0]);

    await screen.findByText("bonjour");
    const correct = await screen.findByRole("button", { name: "Définition unique" });
    const wrong = screen.getByRole("button", { name: "Chat — animal" });

    fireEvent.click(wrong);

    // Feedback state: every choice is locked immediately after the answer.
    expect((wrong as HTMLButtonElement).disabled).toBe(true);
    expect((correct as HTMLButtonElement).disabled).toBe(true);

    await waitFor(
      () => {
        const stored = loadUserState().learnedVocabulary.find((w) => w.word === "bonjour");
        expect(stored).toBeDefined();
        expect(stored!.wrongCount).toBe(1);
        expect(stored!.correctCount).toBe(0);
        expect(stored!.reviewStreak).toBe(0);
        expect(stored!.interval).toBe(1);
        expect(stored!.difficulty).toBe("hard");
        expect(stored!.lastReviewedAt).toBeGreaterThan(0);
        expect(stored!.dueAt).toBe(stored!.lastReviewedAt! + MS_PER_DAY);
      },
      { timeout: 3000 }
    );

    // The session only advances after the current 1200 ms feedback delay.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1300));
    });
    expect(screen.getByText("Review Completed!")).toBeDefined();
    expect(screen.getByText("🎉 All reviews are up to date!")).toBeDefined();
  });

  it("VOCAB-XP-01: the daily review XP bonus is awarded exactly once across sessions", async () => {
    const now = Date.now();
    const learnedVocabulary = Array.from({ length: 6 }, (_, i) =>
      makeDueWord(`mot_${i + 1}`, now - (6 - i) * 1000)
    );
    localStorage.setItem(
      "furago:user-state:v1",
      JSON.stringify({ level: "LVL_1", learnedVocabulary })
    );

    const { container } = render(<FuragoApp initialArticles={sampleArticles} />);

    fireEvent.click(screen.getAllByRole("button", { name: /復習|Review/i })[0]);

    // Session 1 holds the first 5 due words; the remaining word keeps dueRemaining = 1.
    for (let i = 0; i < 5; i++) {
      fireEvent.click(await screen.findByRole("button", { name: "I know this" }));
    }

    await screen.findByText("You have 1 word left to review");
    const sessionCard = screen.getByText("Session Completed!").parentElement!;
    const sessionButtons = within(sessionCard).getAllByRole("button");
    expect(sessionButtons[0].textContent).toContain("Continue review (+1)");
    expect(sessionButtons[1].textContent).toContain("Back to Home");

    fireEvent.click(sessionButtons[0]);

    // First award of the day: XP becomes 10.
    await waitFor(() => {
      expect(container.querySelector(".stat-xp")?.textContent).toContain("10");
    });

    // Session 2 reviews the last due word (session without choices).
    fireEvent.click(await screen.findByRole("button", { name: "I know this" }));
    await screen.findByText("🎉 All reviews are up to date!");

    const finalCard = screen.getByText("Review Completed!").parentElement!;
    const finalButtons = within(finalCard).getAllByRole("button");
    expect(finalButtons[0].textContent).toMatch(/Today's mission|Continue reading|Next episode|Back to Home/);

    fireEvent.click(finalButtons[0]);

    // Second award attempt on the same day must not increase XP.
    await waitFor(() => {
      const xp = container.querySelector(".stat-xp")?.textContent;
      expect(xp).toContain("10");
      expect(xp).not.toContain("20");
    });
  });
});
