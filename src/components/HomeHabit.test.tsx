import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, within, fireEvent } from "@testing-library/react";
import React from "react";
import FuragoApp from "./FuragoApp";
import * as userStateMock from "../lib/userState";
import * as analytics from "../lib/analytics";
import { UserState } from "../lib/userState";

vi.mock("../lib/userState", () => {
  const actual = vi.importActual("../lib/userState");
  return {
    ...actual,
    loadUserState: vi.fn(),
    updateUserState: vi.fn(),
    saveUserState: vi.fn(),
    mergeLearnedVocabulary: vi.fn((existing, newVocab) => [...existing, ...newVocab.map((w: { word: string }) => ({ word: w }))]),
  };
});

vi.mock("../lib/analytics", () => ({
  checkAndTrackSessionStart: vi.fn(),
  updateSessionActivity: vi.fn(),
  trackEvent: vi.fn(),
}));

const ymd = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA");

const getEmptyUserState = (): UserState => ({
  level: "LVL_1",
  savedVocabulary: [],
  learnedVocabulary: [],
  wordLists: [{ id: "default", name: "すべて" }],
  completedArticles: [],
  quizResults: [],
  perfectQuizResults: [],
  currentStreak: 0,
  longestStreak: 0,
  lastStreakDate: "",
  lastActivityDate: null,
  xp: 0,
  furagoLevel: 1,
  dailyMissionCompletedDate: "",
  dailyMissionXPDate: "",
  vocabReviewXPDate: "",
  lastOpenedArticleId: "",
  articleProgress: {},
});

const renderHome = (state: UserState) => {
  vi.mocked(userStateMock.loadUserState).mockReturnValue(state);
  return render(<FuragoApp initialArticles={[]} />);
};

describe("Home Habit Layer (6.3-B)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/");
    localStorage.clear();
  });

  it("HABIT-01: at_risk renders the streak reminder with a primary Next Best Action CTA.", () => {
    const state = getEmptyUserState();
    state.currentStreak = 5;
    state.lastStreakDate = ymd(-1);
    const { container } = renderHome(state);

    const nudge = container.querySelector('[data-testid="habit-nudge"]');
    expect(nudge).not.toBeNull();
    expect(nudge!.getAttribute("data-state")).toBe("at_risk");
    expect(nudge!.textContent).toContain("今日の学習でストリークをつなげましょう");
    expect(nudge!.textContent).toContain("5日連続");

    const buttons = within(nudge as HTMLElement).getAllByRole("button");
    expect(buttons.length).toBe(1);
    expect(buttons[0]).toBeDefined();
    expect(buttons[0].textContent?.length).toBeGreaterThan(0);
  });

  it("HABIT-02: done_today renders a subtle confirmation without a CTA.", () => {
    const state = getEmptyUserState();
    state.currentStreak = 3;
    state.lastStreakDate = ymd(0);
    const { container } = renderHome(state);

    const nudge = container.querySelector('[data-testid="habit-nudge"]');
    expect(nudge).not.toBeNull();
    expect(nudge!.getAttribute("data-state")).toBe("done_today");
    expect(nudge!.textContent).toContain("今日の学習日は完了しました");
    expect(nudge!.textContent).toContain("3日連続");

    expect(within(nudge as HTMLElement).queryAllByRole("button").length).toBe(0);
  });

  it("HABIT-03: broken renders a gentle recovery message with a CTA.", () => {
    const state = getEmptyUserState();
    state.currentStreak = 4;
    state.lastStreakDate = ymd(-3);
    const { container } = renderHome(state);

    const nudge = container.querySelector('[data-testid="habit-nudge"]');
    expect(nudge).not.toBeNull();
    expect(nudge!.getAttribute("data-state")).toBe("broken");
    expect(nudge!.textContent).toContain("新しいストリークを始めましょう");

    const buttons = within(nudge as HTMLElement).getAllByRole("button");
    expect(buttons.length).toBe(1);
  });

  it("HABIT-04: Mission pill is completed only when dailyMissionCompletedDate is today.", () => {
    const state = getEmptyUserState();
    state.dailyMissionCompletedDate = ymd(0);
    const { container } = renderHome(state);

    expect(container.querySelector('[data-habit="mission"]')?.getAttribute("data-done")).toBe("true");
    expect(container.querySelector('[data-habit="review"]')?.getAttribute("data-done")).toBe("false");
    expect(container.querySelector('[data-habit="learningDay"]')?.getAttribute("data-done")).toBe("false");
  });

  it("HABIT-05: Review bonus pill is completed only when vocabReviewXPDate is today.", () => {
    const state = getEmptyUserState();
    state.vocabReviewXPDate = ymd(0);
    state.lastStreakDate = ymd(-1);
    state.currentStreak = 2;
    const { container } = renderHome(state);

    expect(container.querySelector('[data-habit="review"]')?.getAttribute("data-done")).toBe("true");
    expect(container.querySelector('[data-habit="mission"]')?.getAttribute("data-done")).toBe("false");
    expect(container.querySelector('[data-habit="learningDay"]')?.getAttribute("data-done")).toBe("false");
  });

  it("HABIT-06: Learning day pill is completed when lastStreakDate is today.", () => {
    const state = getEmptyUserState();
    state.currentStreak = 1;
    state.lastStreakDate = ymd(0);
    const { container } = renderHome(state);

    expect(container.querySelector('[data-habit="learningDay"]')?.getAttribute("data-done")).toBe("true");
  });

  it("HABIT-07: Review bonus is never claimed from unrelated state (mission/learning day done).", () => {
    const state = getEmptyUserState();
    state.dailyMissionCompletedDate = ymd(0);
    state.currentStreak = 6;
    state.lastStreakDate = ymd(0);
    state.vocabReviewXPDate = ymd(-2);
    state.learnedVocabulary = [
      { word: "chat", articleIds: ["art1"], firstLearnedAt: 0, lastReviewedAt: 0, dueAt: 0, interval: 30, difficulty: "normal", correctCount: 5, wrongCount: 0, reviewStreak: 4 },
    ];
    const { container } = renderHome(state);

    expect(container.querySelector('[data-habit="mission"]')?.getAttribute("data-done")).toBe("true");
    expect(container.querySelector('[data-habit="learningDay"]')?.getAttribute("data-done")).toBe("true");
    expect(container.querySelector('[data-habit="review"]')?.getAttribute("data-done")).toBe("false");
  });

  it("HABIT-08: clicking the nudge CTA emits home_cta_clicked with cta_type habit_nudge.", () => {
    const state = getEmptyUserState();
    state.currentStreak = 5;
    state.lastStreakDate = ymd(-1);
    const { container } = renderHome(state);

    const nudge = container.querySelector('[data-testid="habit-nudge"]') as HTMLElement;
    expect(nudge).not.toBeNull();
    fireEvent.click(within(nudge).getAllByRole("button")[0]);

    expect(analytics.trackEvent).toHaveBeenCalledWith("home_cta_clicked", {
      cta_type: "habit_nudge",
      position: 0,
    });
  });

  it("HABIT-09: home_viewed carries the current streak_state.", () => {
    const state = getEmptyUserState();
    state.currentStreak = 5;
    state.lastStreakDate = ymd(-1);
    renderHome(state);

    expect(analytics.trackEvent).toHaveBeenCalledWith(
      "home_viewed",
      expect.objectContaining({ streak_state: "at_risk" })
    );
  });

  it("HABIT-10: broken streak — the header never shows the stale stored streak while Home reports broken.", () => {
    const state = getEmptyUserState();
    state.currentStreak = 4;
    state.lastStreakDate = ymd(-3);
    state.xp = 50; // header stats render, but the streak tile must be gone
    const { container } = renderHome(state);

    const nudge = container.querySelector('[data-testid="habit-nudge"]');
    expect(nudge!.getAttribute("data-state")).toBe("broken");

    const headerValues = Array.from(
      container.querySelectorAll(".header-stats-compact .stat-val")
    ).map((el) => el.textContent);
    expect(headerValues).not.toContain("4");
  });

  it("HABIT-11: at-risk streak — header and Home present the same number.", () => {
    const state = getEmptyUserState();
    state.currentStreak = 5;
    state.lastStreakDate = ymd(-1);
    const { container } = renderHome(state);

    const nudge = container.querySelector('[data-testid="habit-nudge"]');
    expect(nudge!.getAttribute("data-state")).toBe("at_risk");
    expect(nudge!.textContent).toContain("5日連続");

    const headerStreak = container.querySelector(".header-stats-compact .stat-val");
    expect(headerStreak?.textContent).toBe("5");
  });
});
