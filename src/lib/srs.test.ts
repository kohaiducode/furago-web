import { describe, it, expect } from "vitest";
import {
  createSRSWord,
  recordReviewResult,
  getWordsDueForReview,
} from "./srs";
import { LearnedWord } from "./userState";

describe("SRS module", () => {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  // SRS-01: createSRSWord initialises interval = 0 and dueAt = now
  it("SRS-01: createSRSWord initialises interval = 0 and dueAt = now", () => {
    const fixedNow = 1700000000000;
    const word = createSRSWord("bonjour", "art-1", fixedNow);

    expect(word.word).toBe("bonjour");
    expect(word.articleIds).toEqual(["art-1"]);
    expect(word.firstLearnedAt).toBe(fixedNow);
    expect(word.lastReviewedAt).toBeNull();
    expect(word.interval).toBe(0);
    expect(word.dueAt).toBe(fixedNow);
    expect(word.correctCount).toBe(0);
    expect(word.wrongCount).toBe(0);
    expect(word.reviewStreak).toBe(0);
    expect(word.difficulty).toBe("normal");
  });

  // SRS-02: recordReviewResult with correct answers
  // follows intervals 0 -> 1 -> 3 -> 7 -> 14 -> 30 -> 60
  // increments correctCount and reviewStreak
  it("SRS-02: recordReviewResult with correct answers follows interval progression and increments stats", () => {
    let now = 1700000000000;
    let word = createSRSWord("bonjour", "art-1", now);

    const expectedIntervals = [1, 3, 7, 14, 30, 60, 60];

    for (let i = 0; i < expectedIntervals.length; i++) {
      const prevCorrect = word.correctCount;
      const prevStreak = word.reviewStreak;
      now += MS_PER_DAY;

      word = recordReviewResult(word, true, now);

      expect(word.interval).toBe(expectedIntervals[i]);
      expect(word.correctCount).toBe(prevCorrect + 1);
      expect(word.reviewStreak).toBe(prevStreak + 1);
      expect(word.lastReviewedAt).toBe(now);
      expect(word.dueAt).toBe(now + expectedIntervals[i] * MS_PER_DAY);
      expect(word.difficulty).toBe("easy");
    }
  });

  // SRS-03: recordReviewResult with incorrect answer
  // interval = 1 day, wrongCount + 1, reviewStreak = 0
  it("SRS-03: recordReviewResult with incorrect answer resets streak and sets interval to 1 day", () => {
    const now = 1700000000000;
    const word: LearnedWord = {
      word: "merci",
      articleIds: ["art-1"],
      firstLearnedAt: now - 10 * MS_PER_DAY,
      lastReviewedAt: now - 5 * MS_PER_DAY,
      dueAt: now,
      interval: 14,
      correctCount: 4,
      wrongCount: 1,
      difficulty: "easy",
      reviewStreak: 4,
    };

    const reviewTime = now + 1000;
    const result = recordReviewResult(word, false, reviewTime);

    expect(result.interval).toBe(1);
    expect(result.wrongCount).toBe(word.wrongCount + 1);
    expect(result.reviewStreak).toBe(0);
    expect(result.difficulty).toBe("hard");
    expect(result.lastReviewedAt).toBe(reviewTime);
    expect(result.dueAt).toBe(reviewTime + 1 * MS_PER_DAY);
  });

  // SRS-04: getWordsDueForReview
  // returns only dueAt <= now, sorted oldest dueAt first
  it("SRS-04: getWordsDueForReview returns only due words sorted from oldest to newest dueAt", () => {
    const now = 1700000000000;

    const words: LearnedWord[] = [
      {
        ...createSRSWord("future", "art-1", now),
        dueAt: now + 5000, // Not due
      },
      {
        ...createSRSWord("due-recent", "art-1", now),
        dueAt: now - 1000, // Due 1 second ago
      },
      {
        ...createSRSWord("due-now", "art-1", now),
        dueAt: now, // Due right now
      },
      {
        ...createSRSWord("due-oldest", "art-1", now),
        dueAt: now - 50000, // Due 50 seconds ago (oldest overdue)
      },
      {
        ...createSRSWord("far-future", "art-1", now),
        dueAt: now + 86400000, // Not due
      },
    ];

    const due = getWordsDueForReview(words, now);

    expect(due.map((w) => w.word)).toEqual([
      "due-oldest",
      "due-recent",
      "due-now",
    ]);

    expect(due.every((w) => w.dueAt <= now)).toBe(true);
  });
});
