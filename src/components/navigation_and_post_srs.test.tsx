import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import React, { act } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FuragoApp, { Article } from "./FuragoApp";
import { DictionaryService } from "@/lib/dictionary";
import { loadUserState, UserState, LearnedWord } from "@/lib/userState";

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

describe("Navigation and Post-SRS Integration", () => {
  beforeEach(() => {
    localStorage.clear();
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

  // NAV-01: Verify behavior of navigateTo / historyIdx / history.back according to current logic
  it("NAV-01: manages historyIdx on push/replace and delegates to history.back only when historyIdx > 0", async () => {
    const backSpy = vi.spyOn(window.history, "back");

    await act(async () => {
      render(<FuragoApp initialArticles={sampleArticles} />);
    });

    // 1. Initial state at root "/" replaces state with view="home", historyIdx=0
    expect(window.history.state).toMatchObject({
      furago: true,
      view: "home",
      historyIdx: 0,
    });

    // 2. Open an article from the catalogue / list
    const episodeLink = screen.getAllByText("Episode 1")[0];
    await act(async () => {
      fireEvent.click(episodeLink);
    });

    // Pushing view="reading" increments historyIdx to 1
    expect(window.history.state).toMatchObject({
      furago: true,
      view: "reading",
      historyIdx: 1,
      id: "art-1",
    });

    // 3. Click back button in reading header
    const backBtn = screen.getByLabelText("Back");
    await act(async () => {
      fireEvent.click(backBtn);
    });

    // Since historyIdx was 1 (> 0), window.history.back() must have been called
    expect(backSpy).toHaveBeenCalledTimes(1);

    // 4. Test root fallback: when historyIdx is 0, back button replaces to fallback without calling history.back()
    backSpy.mockClear();
    window.history.replaceState({ furago: true, view: "reading", historyIdx: 0, id: "art-1" }, "", "/?view=reading&id=art-1");

    await act(async () => {
      fireEvent.click(backBtn);
    });

    expect(backSpy).not.toHaveBeenCalled();
    expect(window.history.state).toMatchObject({
      furago: true,
      view: "home",
      historyIdx: 0,
    });
  });

  // POST-SRS-01: An answer given in an SRS session launched from Home or Reward properly updates learnedVocabulary
  it("POST-SRS-01: recording an answer during an SRS session updates learnedVocabulary in UserState", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const initialUserState: Partial<UserState> = {
      level: "LVL_1",
      learnedVocabulary: [
        {
          word: "bonjour",
          articleIds: ["art-1"],
          firstLearnedAt: now - 86400000,
          lastReviewedAt: null,
          dueAt: now - 3600000, // Due 1h ago
          interval: 0,
          difficulty: "normal",
          correctCount: 0,
          wrongCount: 0,
          reviewStreak: 0,
        },
      ],
    };
    localStorage.setItem("furago:user-state:v1", JSON.stringify(initialUserState));

    await act(async () => {
      render(<FuragoApp initialArticles={sampleArticles} />);
    });

    // Find and click Home SRS CTA button ("復習する" / "Review")
    const reviewCta = screen.getByRole("button", { name: /復習|Review/i });
    await act(async () => {
      fireEvent.click(reviewCta);
    });

    // Wait for the word to appear in the review screen
    await waitFor(() => {
      expect(screen.getByText("bonjour")).toBeDefined();
    });

    // Click "覚えた" / "I know this" to record correct answer
    const knowBtn = screen.getByRole("button", { name: /覚えた|I know this/i });
    await act(async () => {
      fireEvent.click(knowBtn);
    });

    // Verify UserState in localStorage was updated
    const saved = loadUserState();
    const updatedWord = saved.learnedVocabulary.find((w) => w.word === "bonjour");
    expect(updatedWord).toBeDefined();
    expect(updatedWord!.correctCount).toBe(1);
    expect(updatedWord!.reviewStreak).toBe(1);
    expect(updatedWord!.interval).toBe(1);
    expect(updatedWord!.lastReviewedAt).toBe(now);
    expect(updatedWord!.dueAt).toBe(now + 1 * 24 * 60 * 60 * 1000);

    vi.useRealTimers();
  });

  // POST-SRS-02: When words remain to review: dueRemaining is correct, and CTA "Continuer les révisions" appears
  it("POST-SRS-02: shows dueRemaining and 'Continue review' CTA when remaining due words exist", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    // Create 6 due words (session limit is 5, so 1 will remain)
    const dueWords: LearnedWord[] = Array.from({ length: 6 }, (_, i) => ({
      word: `mot_${i + 1}`,
      articleIds: ["art-1"],
      firstLearnedAt: now - 86400000,
      lastReviewedAt: null,
      dueAt: now - (6 - i) * 1000,
      interval: 0,
      difficulty: "normal",
      correctCount: 0,
      wrongCount: 0,
      reviewStreak: 0,
    }));

    const initialUserState: Partial<UserState> = {
      level: "LVL_1",
      learnedVocabulary: dueWords,
    };
    localStorage.setItem("furago:user-state:v1", JSON.stringify(initialUserState));

    await act(async () => {
      render(<FuragoApp initialArticles={sampleArticles} />);
    });

    // Launch review from Home
    const reviewCta = screen.getByRole("button", { name: /復習|Review/i });
    await act(async () => {
      fireEvent.click(reviewCta);
    });

    // Complete the 5 words in this session batch
    for (let i = 0; i < 5; i++) {
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /覚えた|I know this/i })).toBeDefined();
      });
      const knowBtn = screen.getByRole("button", { name: /覚えた|I know this/i });
      await act(async () => {
        fireEvent.click(knowBtn);
      });
    }

    // Now on post-SRS screen: exactly 1 word remains due
    await waitFor(() => {
      expect(
        screen.getByText(/あと1語の復習が残っています|You have 1 word left to review/i)
      ).toBeDefined();
    });

    // Primary CTA "復習を続ける (+1)" / "Continue review (+1)" appears
    const continueCta = screen.getByRole("button", {
      name: /復習を続ける|Continue review/i,
    });
    expect(continueCta).toBeDefined();

    vi.useRealTimers();
  });

  // POST-SRS-03: When dueRemaining = 0 from Reward, directs to next article/episode and does not loop in Reward
  it("POST-SRS-03: directs to next episode when dueRemaining = 0 from Reward without returning to completion screen", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const initialUserState: Partial<UserState> = {
      level: "LVL_1",
      learnedVocabulary: [
        {
          word: "bonjour",
          articleIds: ["art-1"],
          firstLearnedAt: now - 86400000,
          lastReviewedAt: null,
          dueAt: now - 1000,
          interval: 0,
          difficulty: "normal",
          correctCount: 0,
          wrongCount: 0,
          reviewStreak: 0,
        },
      ],
    };
    localStorage.setItem("furago:user-state:v1", JSON.stringify(initialUserState));

    await act(async () => {
      render(<FuragoApp initialArticles={sampleArticles} />);
    });
    // Flush macro tasks (like setTimeout in mount effect)
    await new Promise(r => setTimeout(r, 50));

    // 1. Open Episode 1
    const ep1 = screen.getAllByText("Episode 1")[0];
    await act(async () => {
      fireEvent.click(ep1);
    });

    // 2. Finish reading Episode 1 (clicks "🎉 読み終わった" / "Finished Reading")
    screen.debug();
    const finishBtn = await screen.findByRole("button", { name: /読み終わった|Finished Reading/i });
    await act(async () => {
      fireEvent.click(finishBtn);
    });

    // 3. Reward completion screen is displayed with SRS review button
    await waitFor(() => {
      expect(screen.getByText(/記事を完了しました|Article Completed/i)).toBeDefined();
    });

    const reviewFromRewardBtn = screen.getByRole("button", { name: /単語を復習する|Review Vocabulary/i });
    await act(async () => {
      fireEvent.click(reviewFromRewardBtn);
    });

    // 4. Review the 1 due word
    await waitFor(() => {
      expect(screen.getByText("bonjour")).toBeDefined();
    });

    const knowBtn = screen.getByRole("button", { name: /覚えた|I know this/i });
    await act(async () => {
      fireEvent.click(knowBtn);
    });

    // 5. Completion screen appears with dueRemaining = 0
    await waitFor(() => {
      expect(screen.getByText(/すべての復習が完了しました|All reviews are up to date/i)).toBeDefined();
    });

    // Primary CTA is next episode ("📖 次のエピソード" / "Next Episode")
    const nextEpBtn = screen.getByRole("button", { name: /次のエピソード|Next Episode/i });
    expect(nextEpBtn).toBeDefined();

    // 6. Click next episode button
    await act(async () => {
      fireEvent.click(nextEpBtn);
    });

    // 7. Verify we are now in Episode 2 in reading view, NOT back in Episode 1 completion screen
    await waitFor(() => {
      expect(screen.getAllByText("Episode 2").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/記事を完了しました|Article Completed/i)).toBeNull();

    vi.useRealTimers();
  });
});
