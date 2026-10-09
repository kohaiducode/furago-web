import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import FuragoApp, { Article } from "./FuragoApp";
import { loadUserState, UserState } from "../lib/userState";
import { deriveReadingProgress } from "../lib/progress";

vi.mock("../lib/analytics", () => ({
  checkAndTrackSessionStart: vi.fn(),
  updateSessionActivity: vi.fn(),
  trackEvent: vi.fn(),
}));

const articles: Article[] = [
  {
    id: 1,
    category: "Technology",
    levels: {
      LVL_1: {
        title: "Article 1",
        paragraphs: [{ id: "1", fr: "Test FR", ja: "Test JA", en: "Test EN" }],
        targetVocabulary: ["test"],
        quiz: [],
      },
    },
  } as unknown as Article,
];

const readPersisted = (): UserState => {
  const raw = localStorage.getItem("furago:user-state:v1");
  expect(raw).not.toBeNull();
  return JSON.parse(raw as string) as UserState;
};

describe("Article completion → progress level data (6.3-D.2-A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  const completeFirstArticle = async () => {
    window.history.replaceState(null, "", "/?view=reading&id=1");
    render(<FuragoApp initialArticles={articles} />);
    const finishBtn = await screen.findByText(/読み終わった|Finished Reading/i);
    fireEvent.click(finishBtn);
    await waitFor(() => {
      expect(screen.getByText(/記事を完了しました|Article Completed/i)).toBeDefined();
    });
  };

  it("PROGRESS-DATA-01: a completed article is persisted with its level and reported by the progress engine", async () => {
    await completeFirstArticle();

    const persisted = await waitFor(() => {
      const state = readPersisted();
      expect(state.completedArticles).toEqual(["1::LVL_1"]);
      return state;
    });

    const progress = deriveReadingProgress(persisted);
    expect(progress.completedArticles).toBe(1);
    expect(progress.completedByLevel).toEqual({ LVL_1: 1 });
    expect(progress.highestCompletedContentLevel).toBe("LVL_1");

    // The Home progress widget can now show a real level instead of "not set"
    fireEvent.click(screen.getByText(/ホームへ戻る|Back to Home/i));
    await waitFor(() => {
      expect(screen.queryByText("未設定")).toBeNull();
      expect(screen.getAllByText("超初級").length).toBeGreaterThan(0);
    });
  });

  it("PROGRESS-DATA-02: a legacy bare-id completion entry is preserved and never duplicated", async () => {
    const base = loadUserState();
    localStorage.setItem(
      "furago:user-state:v1",
      JSON.stringify({ ...base, completedArticles: ["1"], xp: 0 } as UserState)
    );

    await completeFirstArticle();

    await waitFor(() => {
      const state = readPersisted();
      const forArticleOne = state.completedArticles.filter((entry) => entry.split("::")[0] === "1");
      expect(forArticleOne).toHaveLength(1);
      // Legacy data is kept as-is: no migration is attempted
      expect(forArticleOne[0]).toBe("1");
    });
  });
});
