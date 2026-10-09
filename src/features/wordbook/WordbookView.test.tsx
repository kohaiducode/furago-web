import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { getTranslation } from "@/lib/i18n";
import type { LearnedWord, SavedWord, WordList } from "@/lib/userState";
import WordbookView, { type WordbookViewProps } from "./WordbookView";

const t = getTranslation("en");
const learnedListId = "__furago_learned__";

const makeSavedWord = (fr: string, overrides: Partial<SavedWord> = {}): SavedWord => ({
  fr,
  ja: `${fr} meaning`,
  conciseDef: `${fr} definition`,
  listId: "default",
  date: "2026-01-01",
  ...overrides,
});

const learnedWord: LearnedWord = {
  word: "bonjour",
  articleIds: ["article-1", "article-2"],
  firstLearnedAt: 1,
  lastReviewedAt: null,
  dueAt: 0,
  interval: 0,
  difficulty: "normal",
  correctCount: 0,
  wrongCount: 0,
  reviewStreak: 0,
};

const wordLists: WordList[] = [
  { id: "default", name: "すべて" },
  { id: "travel", name: "Travel" },
];

const makeProps = (overrides: Partial<WordbookViewProps> = {}): WordbookViewProps => ({
  t,
  appLang: "en",
  savedWords: [],
  learnedWords: [],
  wordLists,
  currentListId: null,
  learnedListId,
  learnedDueCount: 0,
  onCreateList: vi.fn(),
  onSelectList: vi.fn(),
  onReviewLearned: vi.fn(),
  onWordClick: vi.fn(),
  onSpeakWord: vi.fn(),
  onDeleteWord: vi.fn(),
  ...overrides,
});

describe("WordbookView (6.3-D.2-I)", () => {
  it("renders the list index, counts, system list, and delegates list actions", () => {
    const props = makeProps({
      savedWords: [makeSavedWord("chat"), makeSavedWord("chien", { listId: "travel" })],
      learnedWords: [learnedWord],
    });
    render(<WordbookView {...props} />);

    expect(screen.getByRole("heading", { name: t.words.title })).toBeDefined();
    expect(screen.getByRole("button", { name: /Furago — Mots appris/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Travel.*1/ })).toBeDefined();

    const createButton = screen.getByRole("button", { name: `+ ${t.words.newList}` });
    fireEvent.click(createButton);
    expect(props.onCreateList).toHaveBeenCalledWith(expect.any(HTMLButtonElement));

    fireEvent.click(screen.getByRole("button", { name: /Travel.*1/ }));
    expect(props.onSelectList).toHaveBeenCalledWith("travel");
    fireEvent.click(screen.getByRole("button", { name: /Furago — Mots appris/ }));
    expect(props.onSelectList).toHaveBeenCalledWith(learnedListId);
  });

  it("renders saved words newest first and delegates pronunciation and deletion", () => {
    const props = makeProps({
      currentListId: "default",
      savedWords: [makeSavedWord("ancien"), makeSavedWord("récent", { date: "2026-06-01" })],
    });
    const { container } = render(<WordbookView {...props} />);

    const renderedWords = Array.from(container.querySelectorAll(".quiz-card h3"))
      .map((heading) => heading.textContent?.trim());
    expect(renderedWords).toEqual(["récent", "ancien"]);

    fireEvent.click(screen.getAllByRole("button", { name: t.words.listenPronunciation })[0]);
    expect(props.onSpeakWord).toHaveBeenCalledWith("récent");

    fireEvent.click(screen.getByRole("button", { name: `${t.words.delete} récent` }));
    expect(props.onDeleteWord).toHaveBeenCalledWith("récent", "default");
  });

  it("renders the empty saved-list state and delegates back to the index", () => {
    const props = makeProps({ currentListId: "travel" });
    const { container } = render(<WordbookView {...props} />);

    expect(container.querySelector("p")?.textContent).toContain(t.words.emptyList.split("\n")[0]);
    fireEvent.click(screen.getByRole("button", { name: "←" }));
    expect(props.onSelectList).toHaveBeenCalledWith(null);
  });

  it("renders learned words as read-only, opens the dictionary, pronounces, and starts review", () => {
    const props = makeProps({
      currentListId: learnedListId,
      learnedWords: [learnedWord],
      learnedDueCount: 2,
    });
    render(<WordbookView {...props} />);

    expect(screen.getByText("2 due")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(props.onReviewLearned).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "bonjour" }));
    expect(props.onWordClick).toHaveBeenCalledWith(expect.any(Object), "bonjour", "");
    fireEvent.click(screen.getByRole("button", { name: t.words.listenPronunciation }));
    expect(props.onSpeakWord).toHaveBeenCalledWith("bonjour");
    expect(screen.queryByRole("button", { name: new RegExp(t.words.delete) })).toBeNull();
  });

  it("renders the empty learned-list state and disables review when nothing is due", () => {
    const props = makeProps({ currentListId: learnedListId, learnedWords: [learnedWord] });
    const { unmount } = render(<WordbookView {...props} />);

    const reviewButton = screen.getByRole("button", { name: "Review" }) as HTMLButtonElement;
    expect(reviewButton.disabled).toBe(true);
    expect(screen.getByText("0 due")).toBeDefined();
    fireEvent.click(reviewButton);
    expect(props.onReviewLearned).not.toHaveBeenCalled();

    const emptyProps = makeProps({ currentListId: learnedListId });
    unmount();
    render(<WordbookView {...emptyProps} />);
    expect(screen.getByText(/You haven't learned any words yet/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Review" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "←" }));
    expect(emptyProps.onSelectList).toHaveBeenCalledWith(null);
  });
});
