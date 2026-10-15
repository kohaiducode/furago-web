import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import FuragoApp from "./FuragoApp";
import ProgressDashboard from "./ProgressDashboard";
import * as userStateMock from "../lib/userState";
import { UserState } from "../lib/userState";

vi.mock("../lib/userState", () => {
  const actual = vi.importActual("../lib/userState");
  return {
    ...actual,
    loadUserState: vi.fn(),
    updateUserState: vi.fn(),
    saveUserState: vi.fn(),
    mergeLearnedVocabulary: vi.fn((existing, newVocab) => [
      ...existing,
      ...newVocab.map((w: { word: string }) => ({ word: w })),
    ]),
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
  articleProgress: {},
});

describe("Home / Progress localization (6.3-D.2-A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/");
    localStorage.clear();
  });

  const renderHome = (lang: "ja" | "en") => {
    localStorage.setItem("furago_app_lang", lang);
    vi.mocked(userStateMock.loadUserState).mockReturnValue(getEmptyUserState());
    return render(<FuragoApp initialArticles={[]} />);
  };

  it("LOC-01: English Home contains no French UI strings and uses the localized goal copy.", () => {
    const { container } = renderHome("en");

    expect(screen.getByText("My Progress")).toBeDefined();
    expect(screen.getByText("Build a vocabulary foundation")).toBeDefined();
    expect(screen.getByText("Progress")).toBeDefined();

    const frenchStrings = [
      "Ma Progression",
      "Voir ma progression",
      "Mots consolidés",
      "Non renseigné",
      "Contenu travaillé",
      "Objectif actuel",
      "Réviser mes mots",
      "Lire un article",
      "Commencez votre première lecture pour construire votre progression.",
      "Continuez à apprendre pour construire votre progression.",
      "Consolider le vocabulaire",
      "Progression",
    ];
    for (const fr of frenchStrings) {
      expect(screen.queryByText(fr)).toBeNull();
      expect(container.textContent).not.toContain(fr);
    }
  });

  it("LOC-02: Japanese Home uses the localized copy (no French, no English leftovers).", () => {
    const { container } = renderHome("ja");

    expect(screen.getByText("マイプログレス")).toBeDefined();
    expect(screen.getByText("語彙を定着させる")).toBeDefined();
    expect(screen.getByText("進捗")).toBeDefined();
    expect(screen.queryByText(/Consolider|Je peux|Ma Progression/)).toBeNull();
    expect(container.textContent).not.toContain("My Progress");
  });

  it("LOC-03: English accessibility labels replace the hardcoded French/Japanese ones.", () => {
    const { container } = renderHome("en");

    expect(container.querySelector('[aria-label="Email address"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Close"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="メールアドレス"]')).toBeNull();
    expect(container.querySelector('[aria-label="Adresse email"]')).toBeNull();
    expect(container.querySelector('[aria-label="Fermer"]')).toBeNull();
    expect(container.querySelector('[aria-label="閉じる"]')).toBeNull();
  });

  it("LOC-04: Japanese accessibility labels are used when the app language is Japanese.", () => {
    const { container } = renderHome("ja");

    expect(container.querySelector('[aria-label="メールアドレス"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="閉じる"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Close"]')).toBeNull();
    expect(container.querySelector('[aria-label="Email address"]')).toBeNull();
    expect(container.querySelector('[aria-label="Fermer"]')).toBeNull();
  });

  it("LOC-05: Progress dashboard localizes goals, can-dos and labels in English.", () => {
    render(<ProgressDashboard userState={getEmptyUserState()} appLang="en" onGoalClick={vi.fn()} />);

    expect(screen.getByText("My Progress")).toBeDefined();
    expect(screen.getByText("Build a vocabulary foundation")).toBeDefined();
    expect(screen.getByText("Consolidate 10 words to build a solid base.")).toBeDefined();
    expect(screen.getByText("I can understand the general idea of short texts.")).toBeDefined();
    expect(screen.queryByText(/Consolider|Nécessite|Je peux/)).toBeNull();
  });

  it("LOC-06: Progress dashboard localizes goals, can-dos and labels in Japanese.", () => {
    render(<ProgressDashboard userState={getEmptyUserState()} appLang="ja" onGoalClick={vi.fn()} />);

    expect(screen.getByText("語彙を定着させる")).toBeDefined();
    expect(screen.getByText("10語を定着させて、しっかりした基礎をつくりましょう。")).toBeDefined();
    expect(screen.getByText("短い文章の要旨を理解できます。")).toBeDefined();
    expect(screen.queryByText(/Consolider|Nécessite|Je peux/)).toBeNull();
  });

  it("STREAK-01: Progress dashboard never presents a stale streak as the current one.", () => {
    const state = getEmptyUserState();
    state.currentStreak = 4;
    state.lastStreakDate = ymd(-3); // broken: Home reports "broken" / 0
    state.longestStreak = 7;
    const { container } = render(
      <ProgressDashboard userState={state} appLang="ja" onGoalClick={vi.fn()} />
    );

    expect(container.textContent).not.toContain("4 日");
    expect(screen.getByText("7 日")).toBeDefined();
    expect(screen.getAllByText("0 日").length).toBe(1);
  });

  it("STREAK-02: Progress dashboard shows the live streak while it is still active.", () => {
    const state = getEmptyUserState();
    state.currentStreak = 5;
    state.lastStreakDate = ymd(-1); // at_risk: the stored number is still current
    render(<ProgressDashboard userState={state} appLang="ja" onGoalClick={vi.fn()} />);

    expect(screen.getByText("5 日")).toBeDefined();
  });
});
