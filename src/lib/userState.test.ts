import { describe, it, expect, beforeEach } from "vitest";
import {
  loadUserState,
  mergeLearnedVocabulary,
  LearnedWord,
} from "./userState";

describe("userState module", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // STATE-01: loadUserState returns valid default state when localStorage is empty
  it("STATE-01: loadUserState returns valid default state when localStorage is empty", () => {
    const state = loadUserState();

    expect(state).toBeDefined();
    expect(state.level).toBe("LVL_1");
    expect(state.savedVocabulary).toEqual([]);
    expect(state.learnedVocabulary).toEqual([]);
    expect(state.wordLists).toEqual([{ id: "default", name: "すべて" }]);
    expect(state.completedArticles).toEqual([]);
    expect(state.quizResults).toEqual([]);
    expect(state.perfectQuizResults).toEqual([]);
    expect(state.currentStreak).toBe(0);
    expect(state.longestStreak).toBe(0);
    expect(state.lastStreakDate).toBe("");
    expect(state.lastActivityDate).toBeNull();
    expect(state.xp).toBe(0);
    expect(state.furagoLevel).toBe(1);
    expect(state.articleProgress).toEqual({});
  });

  it("STATE-04: loading a saved state preserves user data and its daily mission target", () => {
    const saved = loadUserState();
    saved.xp = 137;
    saved.savedVocabulary = [
      { fr: "bonjour", ja: "こんにちは", listId: "default", date: "2026-10-09" },
    ];
    saved.completedArticles = ["article-7::LVL_2"];
    saved.dailyMissionTarget = {
      date: "2026-10-09",
      articleId: "article-8",
      level: "LVL_2",
    };
    saved.articleProgress = { "article-7::LVL_2": 0.6 };
    localStorage.setItem("furago:user-state:v1", JSON.stringify(saved));

    const restored = loadUserState();

    expect(restored.xp).toBe(137);
    expect(restored.savedVocabulary).toEqual(saved.savedVocabulary);
    expect(restored.completedArticles).toEqual(saved.completedArticles);
    expect(restored.dailyMissionTarget).toEqual(saved.dailyMissionTarget);
    expect(restored.articleProgress).toEqual(saved.articleProgress);
  });

  // STATE-02: Legacy migration works for xp, level, words, and CEFR levels (A1/A2/B1/B2/C1)
  it("STATE-02: Legacy migration converts CEFR levels to LVL_X and restores legacy fields", () => {
    const testCases: Array<{ legacyLevel: string; expectedLevel: string }> = [
      { legacyLevel: "A1", expectedLevel: "LVL_1" },
      { legacyLevel: "A2", expectedLevel: "LVL_2" },
      { legacyLevel: "B1", expectedLevel: "LVL_3" },
      { legacyLevel: "B2", expectedLevel: "LVL_4" },
      { legacyLevel: "C1", expectedLevel: "LVL_4" },
      { legacyLevel: "INVALID", expectedLevel: "LVL_1" },
    ];

    for (const { legacyLevel, expectedLevel } of testCases) {
      localStorage.clear();
      localStorage.setItem("furago_level", legacyLevel);
      localStorage.setItem("furago_xp", "250");
      localStorage.setItem("furago_current_streak", "5");
      localStorage.setItem("furago_longest_streak", "10");
      localStorage.setItem(
        "furago_words",
        JSON.stringify([
          { fr: "pomme", ja: "りんご", listId: "default", date: "2026-01-01" },
        ])
      );
      localStorage.setItem("furago_xp_articles", JSON.stringify(["art-1", "art-2"]));

      const migrated = loadUserState();

      expect(migrated.level).toBe(expectedLevel);
      expect(migrated.xp).toBe(250);
      expect(migrated.furagoLevel).toBe(3); // Math.floor(250 / 100) + 1 = 3
      expect(migrated.currentStreak).toBe(5);
      expect(migrated.longestStreak).toBe(10);
      expect(migrated.savedVocabulary).toHaveLength(1);
      expect(migrated.savedVocabulary[0].fr).toBe("pomme");
      expect(migrated.completedArticles).toEqual(["art-1", "art-2"]);

      // Verify that the migrated state was persisted under the new key
      const persistedRaw = localStorage.getItem("furago:user-state:v1");
      expect(persistedRaw).not.toBeNull();
      const persisted = JSON.parse(persistedRaw!);
      expect(persisted.level).toBe(expectedLevel);
      expect(persisted.xp).toBe(250);
    }
  });

  // STATE-03: mergeLearnedVocabulary normalizes words, creates SRS metadata for new words,
  // preserves existing SRS progression, and appends articleId uniquely.
  it("STATE-03: mergeLearnedVocabulary normalizes words, inits new words, preserves existing SRS data, and deduplicates articleId", () => {
    const existing: LearnedWord[] = [
      {
        word: "bonjour",
        articleIds: ["art-1"],
        firstLearnedAt: 1000,
        lastReviewedAt: 2000,
        dueAt: 50000,
        interval: 7,
        difficulty: "easy",
        correctCount: 3,
        wrongCount: 0,
        reviewStreak: 3,
      },
    ];

    // 1. Merge a new word with accents and spacing, plus the existing word (different case/spacing)
    const result = mergeLearnedVocabulary(
      existing,
      ["  Bonjour  ", "  café  "],
      "art-2"
    );

    expect(result).toHaveLength(2);

    // Existing word preserved, articleId added once, SRS progression NOT overwritten
    const bonjour = result.find((w) => w.word.toLowerCase() === "bonjour");
    expect(bonjour).toBeDefined();
    expect(bonjour!.articleIds).toEqual(["art-1", "art-2"]);
    expect(bonjour!.interval).toBe(7);
    expect(bonjour!.dueAt).toBe(50000);
    expect(bonjour!.correctCount).toBe(3);
    expect(bonjour!.reviewStreak).toBe(3);
    expect(bonjour!.difficulty).toBe("easy");

    // New word initialized with default SRS properties
    const cafe = result.find((w) => w.word === "café");
    expect(cafe).toBeDefined();
    expect(cafe!.articleIds).toEqual(["art-2"]);
    expect(cafe!.interval).toBe(0);
    expect(cafe!.correctCount).toBe(0);
    expect(cafe!.wrongCount).toBe(0);
    expect(cafe!.reviewStreak).toBe(0);
    expect(cafe!.difficulty).toBe("normal");
    expect(typeof cafe!.dueAt).toBe("number");
    expect(typeof cafe!.firstLearnedAt).toBe("number");

    // 2. Merging same articleId again does not create duplicate in articleIds
    const result2 = mergeLearnedVocabulary(result, ["Bonjour"], "art-2");
    const bonjour2 = result2.find((w) => w.word.toLowerCase() === "bonjour");
    expect(bonjour2!.articleIds).toEqual(["art-1", "art-2"]);
  });
});
