import React from 'react';
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProgressDashboard from "./ProgressDashboard";
import { UserState } from "../lib/userState";
import * as analytics from "../lib/analytics";

describe("ProgressDashboard", () => {
  const getEmptyUserState = (): UserState => ({
    level: "LVL_1",
    savedVocabulary: [],
    learnedVocabulary: [],
    wordLists: [],
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
    articleProgress: {}
  });

  const getPopulatedUserState = (): UserState => ({
    ...getEmptyUserState(),
    learnedVocabulary: [
      { word: "chat", articleIds: ["art1"], firstLearnedAt: 0, lastReviewedAt: 0, dueAt: 0, interval: 30, difficulty: "normal", correctCount: 5, wrongCount: 0, reviewStreak: 4 },
      { word: "chien", articleIds: ["art1"], firstLearnedAt: 0, lastReviewedAt: 0, dueAt: 0, interval: 14, difficulty: "normal", correctCount: 3, wrongCount: 0, reviewStreak: 3 },
      { word: "oiseau", articleIds: ["art1"], firstLearnedAt: 0, lastReviewedAt: 0, dueAt: 0, interval: 5, difficulty: "normal", correctCount: 2, wrongCount: 0, reviewStreak: 2 },
    ],
    completedArticles: ["art1::LVL_1", "art2::LVL_2"],
    perfectQuizResults: ["art1", "art2"],
    currentStreak: 3,
    longestStreak: 5,
  });

  it("PROGRESS-UI-01: Dashboard avec state vide.", () => {
    render(<ProgressDashboard userState={getEmptyUserState()} appLang="ja" onGoalClick={vi.fn()} />);
    
    expect(screen.getByText("まだ学習した単語がありません。記事を読んで単語を追加しましょう。")).toBeDefined();
    expect(screen.getByText("最初の記事を読み終えると、ここに記録が表示されます。")).toBeDefined();
    
    const overviewZeroes = screen.getAllByText("0");
    expect(overviewZeroes.length).toBeGreaterThan(0);
  });

  it("PROGRESS-UI-02: Dashboard affiche vocabulaire correctement.", () => {
    render(<ProgressDashboard userState={getPopulatedUserState()} appLang="ja" onGoalClick={vi.fn()} />);
    expect(screen.getByText("定着した単語")).toBeDefined();
    const counts = screen.getAllByText("1");
    expect(counts.length).toBeGreaterThanOrEqual(3);
  });

  it("PROGRESS-UI-03: Dashboard affiche articles par niveau.", () => {
    render(<ProgressDashboard userState={getPopulatedUserState()} appLang="ja" onGoalClick={vi.fn()} />);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText("超初級: 1")).toBeDefined();
    expect(screen.getByText("初級: 1")).toBeDefined();
  });

  it("PROGRESS-UI-04: Dashboard distingue niveau connu et niveau inconnu.", () => {
    const state = getPopulatedUserState();
    state.completedArticles = ["art1::LVL_1", "art2"]; 
    render(<ProgressDashboard userState={state} appLang="ja" onGoalClick={vi.fn()} />);
    expect(screen.getByText("レベル未設定: 1")).toBeDefined();
  });

  it("PROGRESS-UI-05: Dashboard affiche les Can-Do débloqués.", () => {
    const state = getPopulatedUserState();
    state.completedArticles = ["art1", "art2", "art3", "art4", "art5"]; 
    render(<ProgressDashboard userState={state} appLang="ja" onGoalClick={vi.fn()} />);
    const unlockedIcon = screen.getAllByText("✓");
    expect(unlockedIcon.length).toBeGreaterThan(0);
  });

  it("PROGRESS-UI-06: Dashboard affiche les Can-Do verrouillés.", () => {
    render(<ProgressDashboard userState={getEmptyUserState()} appLang="ja" onGoalClick={vi.fn()} />);
    const lockedIcon = screen.getAllByText("🔒");
    expect(lockedIcon.length).toBe(5); 
  });

  it("PROGRESS-UI-07: Goal CTA déclenche l'action attendue.", () => {
    const mockOnClick = vi.fn();
    render(<ProgressDashboard userState={getEmptyUserState()} appLang="ja" onGoalClick={mockOnClick} />);
    const cta = screen.getByText("学習を続ける");
    fireEvent.click(cta);
    expect(mockOnClick).toHaveBeenCalledWith("VOCABULARY");
  });

  it("PROGRESS-UI-08: Streak est présenté comme HABIT et non compétence.", () => {
    render(<ProgressDashboard userState={getEmptyUserState()} appLang="ja" onGoalClick={vi.fn()} />);
    expect(screen.getByText("学習の習慣")).toBeDefined();
    expect(screen.getByText("連続学習")).toBeDefined();
    expect(screen.getByText("最長記録")).toBeDefined();
  });
});

describe("ProgressDashboard Analytics", () => {
  const getEmptyUserState = (): UserState => ({
    level: "LVL_1",
    savedVocabulary: [],
    learnedVocabulary: [],
    wordLists: [],
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
    articleProgress: {}
  });

  const getGoalCompletionState = (): UserState => ({
    ...getEmptyUserState(),
    learnedVocabulary: Array.from({ length: 10 }, (_, i) => ({ 
      word: `word${i}`, 
      articleIds: ["art1"], 
      firstLearnedAt: 0, 
      lastReviewedAt: 0, 
      dueAt: 0, 
      interval: 30, 
      difficulty: "normal", 
      correctCount: 5, 
      wrongCount: 0, 
      reviewStreak: 4 
    })),
    completedArticles: ["art1", "art2", "art3"],
    perfectQuizResults: ["art1", "art2"],
    currentStreak: 3,
    longestStreak: 5,
  });

  let trackEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    trackEventSpy = vi.spyOn(analytics, "trackEvent").mockImplementation(() => {});
  });

  it("ANALYTICS-PROGRESS-01: Opening dashboard fires progress_dashboard_opened", () => {
    render(<ProgressDashboard userState={getEmptyUserState()} appLang="ja" onGoalClick={vi.fn()} />);
    
    expect(trackEventSpy).toHaveBeenCalledWith("progress_dashboard_opened", {});
  });

  it("ANALYTICS-PROGRESS-01: progress_dashboard_opened fires only once on re-renders", () => {
    const countOpened = () =>
      trackEventSpy.mock.calls.filter((call: unknown[]) => call[0] === "progress_dashboard_opened").length;

    const { rerender } = render(<ProgressDashboard userState={getEmptyUserState()} appLang="ja" onGoalClick={vi.fn()} />);
    
    expect(countOpened()).toBe(1);
    
    rerender(<ProgressDashboard userState={getEmptyUserState()} appLang="ja" onGoalClick={vi.fn()} />);
    
    expect(countOpened()).toBe(1);
  });

  it("ANALYTICS-PROGRESS-02: Clicking goal CTA fires progress_goal_clicked with correct params", () => {
    render(<ProgressDashboard userState={getEmptyUserState()} appLang="ja" onGoalClick={vi.fn()} />);
    
    const cta = screen.getByText("学習を続ける");
    fireEvent.click(cta);
    
    expect(trackEventSpy).toHaveBeenCalledWith("progress_goal_clicked", {
      goal_id: "GOAL_VOCAB_START",
      goal_category: "VOCABULARY",
    });
  });

  it("ANALYTICS-PROGRESS-03: Can-Do section visible fires cando_viewed once", () => {
    const state = getEmptyUserState();
    state.completedArticles = ["art1", "art2", "art3", "art4", "art5"];
    
    // The IntersectionObserver test polyfill reports the section as visible on observe()
    const { rerender } = render(<ProgressDashboard userState={state} appLang="ja" onGoalClick={vi.fn()} />);
    
    expect(trackEventSpy).toHaveBeenCalledWith("cando_viewed", {
      unlocked_count: 1,
      total_count: 5,
    });
    
    // Re-render with an equivalent new state: observer recreated, but no duplicate event
    const state2 = { ...state, completedArticles: [...state.completedArticles] };
    rerender(<ProgressDashboard userState={state2} appLang="ja" onGoalClick={vi.fn()} />);
    
    const candoCalls = trackEventSpy.mock.calls.filter((call: unknown[]) => call[0] === "cando_viewed");
    expect(candoCalls.length).toBe(1);
  });

  it("ANALYTICS-PROGRESS-04: Dashboard does not emit pedagogical_goal_completed", () => {
    const { rerender } = render(<ProgressDashboard userState={getEmptyUserState()} appLang="ja" onGoalClick={vi.fn()} />);
    
    expect(trackEventSpy).not.toHaveBeenCalledWith("pedagogical_goal_completed", expect.anything());
    
    const completedState = getGoalCompletionState();
    rerender(<ProgressDashboard userState={completedState} appLang="ja" onGoalClick={vi.fn()} />);
    
    rerender(<ProgressDashboard userState={completedState} appLang="ja" onGoalClick={vi.fn()} />);
    const goalCompletedCalls = trackEventSpy.mock.calls.filter((call: unknown[]) => call[0] === "pedagogical_goal_completed");
    expect(goalCompletedCalls.length).toBe(0);
  });

  it("ANALYTICS-PROGRESS-05: No PII in progress events", () => {
    render(<ProgressDashboard userState={getEmptyUserState()} appLang="ja" onGoalClick={vi.fn()} />);
    
    const cta = screen.getByText("学習を続ける");
    fireEvent.click(cta);
    
    // Check all calls for PII
    trackEventSpy.mock.calls.forEach((call: unknown[]) => {
      const eventName = String(call[0]);
      const params = call[1];
      
      if (["progress_dashboard_opened", "progress_goal_clicked", "cando_viewed", "pedagogical_goal_completed"].includes(eventName)) {
        expect(params).not.toHaveProperty("email");
        expect(params).not.toHaveProperty("name");
        expect(params).not.toHaveProperty("userId");
        expect(params).not.toHaveProperty("user_id");
      }
    });
  });

  it("ANALYTICS-PROGRESS-06: New unachieved state does not fire goal_completed", () => {
    const { rerender } = render(<ProgressDashboard userState={getEmptyUserState()} appLang="ja" onGoalClick={vi.fn()} />);
    
    // State with different but still unachieved goal (5 consolidated words, still < 10)
    const partialState: UserState = {
      ...getEmptyUserState(),
      learnedVocabulary: Array.from({ length: 5 }, (_, i) => ({ 
        word: `word${i}`, 
        articleIds: ["art1"], 
        firstLearnedAt: 0, 
        lastReviewedAt: 0, 
        dueAt: 0, 
        interval: 30, 
        difficulty: "normal", 
        correctCount: 5, 
        wrongCount: 0, 
        reviewStreak: 4 
      })),
    };
    
    rerender(<ProgressDashboard userState={partialState} appLang="ja" onGoalClick={vi.fn()} />);
    
    // Should not fire goal_completed for unachieved goal
    expect(trackEventSpy).not.toHaveBeenCalledWith("pedagogical_goal_completed", expect.anything());
  });
});