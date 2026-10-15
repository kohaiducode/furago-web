import { LearnedWord } from "./userState";

export type SRSDifficulty = "easy" | "normal" | "hard";

export const createSRSWord = (word: string, articleId: string, now: number = Date.now()): LearnedWord => {
  return {
    word,
    articleIds: [articleId],
    firstLearnedAt: now,
    lastReviewedAt: null,
    dueAt: now, // Due immediately
    interval: 0,
    correctCount: 0,
    wrongCount: 0,
    difficulty: "normal",
    reviewStreak: 0,
  };
};

/** Legacy learned word (pre-SRS): only `word` is guaranteed. */
export type LegacyLearnedWord = Partial<LearnedWord> & { word: string };

export const migrateWordToSRS = (word: LegacyLearnedWord, now: number = Date.now()): LearnedWord => {
  const firstLearnedAt = typeof word.firstLearnedAt === "number" ? word.firstLearnedAt : now;
  const difficulty: SRSDifficulty =
    word.difficulty === "easy" || word.difficulty === "normal" || word.difficulty === "hard"
      ? word.difficulty
      : "normal";

  return {
    ...word,
    word: word.word,
    // Deduplicate articleIds
    articleIds: Array.from(new Set(Array.isArray(word.articleIds) ? word.articleIds : [])),
    firstLearnedAt,
    lastReviewedAt: typeof word.lastReviewedAt === "number" ? word.lastReviewedAt : null,
    dueAt: typeof word.dueAt === "number" ? word.dueAt : firstLearnedAt,
    interval: typeof word.interval === "number" ? word.interval : 0,
    correctCount: typeof word.correctCount === "number" ? word.correctCount : 0,
    wrongCount: typeof word.wrongCount === "number" ? word.wrongCount : 0,
    difficulty,
    reviewStreak: typeof word.reviewStreak === "number" ? word.reviewStreak : 0,
  };
};

// Intervals: 0, 1, 3, 7, 14, 30, 60
const INTERVALS = [0, 1, 3, 7, 14, 30, 60];
const MAX_INTERVAL = 60;

export const recordReviewResult = (
  word: LearnedWord,
  isCorrect: boolean,
  now: number = Date.now()
): LearnedWord => {
  const nextWord = { ...word, articleIds: [...word.articleIds] };
  nextWord.lastReviewedAt = now;
  
  if (isCorrect) {
    nextWord.correctCount += 1;
    nextWord.reviewStreak += 1;
    
    // Find next interval
    const currentIdx = INTERVALS.findIndex(i => i >= nextWord.interval);
    let nextInterval = MAX_INTERVAL;
    if (currentIdx !== -1 && currentIdx + 1 < INTERVALS.length) {
      nextInterval = INTERVALS[currentIdx + 1];
    }
    nextWord.interval = nextInterval;
    nextWord.difficulty = "easy";
  } else {
    nextWord.wrongCount += 1;
    nextWord.reviewStreak = 0;
    
    // Short deterministic interval on failure (e.g. tomorrow)
    nextWord.interval = 1;
    nextWord.difficulty = "hard";
  }
  
  // Calculate dueAt: now + interval in ms
  const msPerDay = 24 * 60 * 60 * 1000;
  nextWord.dueAt = now + nextWord.interval * msPerDay;
  
  return nextWord;
};

// Sorting:
// 1. Overdue first (dueAt ascending)
export const getWordsDueForReview = (
  vocabulary: LearnedWord[],
  now: number = Date.now()
): LearnedWord[] => {
  return vocabulary
    .filter(w => w.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt);
};

export const getReviewStats = (
  vocabulary: LearnedWord[],
  now: number = Date.now()
) => {
  let dueToday = 0;
  let overdue = 0;
  let mastered = 0;
  
  vocabulary.forEach(w => {
    if (w.dueAt <= now) overdue++;
    else if (new Date(w.dueAt).toDateString() === new Date(now).toDateString()) dueToday++;
    
    if (w.interval >= MAX_INTERVAL) mastered++;
  });
  
  // dueToday logically includes overdue for the user's daily quota,
  // but to be precise, overdue are in the past, dueToday are today.
  // Actually, overdue IS dueToday from a user's perspective.
  const totalDue = overdue + dueToday;
  
  return {
    totalWords: vocabulary.length,
    dueToday: totalDue, // Combine overdue and dueToday for simpler UX
    overdue,
    mastered
  };
};
