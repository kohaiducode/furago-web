export interface SavedWord {
  fr: string;
  originalWord?: string;
  ja: string;
  conciseDef?: string;
  nature?: string;
  gender?: string;
  phraseOriginale?: string;
  traductionPhrase?: string;
  definitions?: string[];
  listId: string;
  date: string;
}

export interface WordList {
  id: string;
  name: string;
}

/**
 * A word Furago considers learned from a genuinely completed article.
 * Intentionally minimal: definitions/translations stay in the global dictionary.
 */
export interface LearnedWord {
  word: string; // canonical French lemma
  articleIds: string[]; // articles that contributed this word
}

export interface UserState {
  level: string;
  savedVocabulary: SavedWord[];
  learnedVocabulary: LearnedWord[]; // auto-learned from completed articles; never mixed with savedVocabulary
  wordLists: WordList[];
  completedArticles: string[]; // previously furago_xp_articles
  quizResults: string[]; // previously furago_xp_quizzes
  perfectQuizResults: string[]; // previously furago_xp_perfects
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string; // "YYYY-MM-DD" or ""
  lastActivityDate: string | null;
  xp: number;
  furagoLevel: number;
  dailyMissionCompletedDate: string; // previously furago_daily_completed_date
  dailyMissionXPDate: string; // previously furago_xp_daily_date
  vocabReviewXPDate: string; // previously furago_xp_vocab_date
  lastOpenedArticleId: string; // previously furago_last_opened_articleId
  articleProgress: Record<string, number>;
}

const STATE_KEY = "furago:user-state:v1";

const DEFAULT_STATE: UserState = {
  level: "LVL_1",
  savedVocabulary: [],
  learnedVocabulary: [],
  wordLists: [
    { id: "default", name: "すべて" }
  ],
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
};

export const loadUserState = (): UserState => {
  if (typeof window === "undefined") return DEFAULT_STATE;

  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const s = { ...DEFAULT_STATE, ...parsed };
      if (!["LVL_1", "LVL_2", "LVL_3", "LVL_4"].includes(s.level)) {
        s.level = "LVL_1";
      }
      if (!Array.isArray(s.learnedVocabulary)) {
        s.learnedVocabulary = [];
      }
      return s;
    }

    // Migration
    const state = { ...DEFAULT_STATE };
    
    const readString = (key: string) => localStorage.getItem(key) || "";
    const readInt = (key: string, def = 0) => parseInt(localStorage.getItem(key) || String(def), 10);
    const readJSON = <T,>(key: string, def: T): T => {
      try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); }
      catch { return def; }
    };

    const legacyLevel = readString("furago_level");
    if (legacyLevel === "A1") state.level = "LVL_1";
    else if (legacyLevel === "A2") state.level = "LVL_2";
    else if (legacyLevel === "B1") state.level = "LVL_3";
    else if (legacyLevel === "B2" || legacyLevel === "C1") state.level = "LVL_4";
    else if (legacyLevel) state.level = legacyLevel;
    
    // Ensure normalization if someone manually tampered with it
    if (!["LVL_1", "LVL_2", "LVL_3", "LVL_4"].includes(state.level)) {
      state.level = "LVL_1";
    }

    state.dailyMissionCompletedDate = readString("furago_daily_completed_date");
    state.vocabReviewXPDate = readString("furago_xp_vocab_date");
    state.lastOpenedArticleId = readString("furago_last_opened_articleId");
    
    const cs = readInt("furago_current_streak", 0);
    state.currentStreak = isNaN(cs) ? 0 : cs;
    
    const ls = readInt("furago_longest_streak", 0);
    state.longestStreak = isNaN(ls) ? 0 : ls;
    
    state.lastStreakDate = readString("furago_last_streak_date");
    
    const xp = readInt("furago_xp", 0);
    state.xp = isNaN(xp) ? 0 : xp;
    
    state.completedArticles = readJSON("furago_xp_articles", []);
    state.quizResults = readJSON("furago_xp_quizzes", []);
    state.perfectQuizResults = readJSON("furago_xp_perfects", []);
    state.dailyMissionXPDate = readString("furago_xp_daily_date");
    
    state.wordLists = readJSON("furago_lists", [
      { id: "default", name: "すべて" }
    ]);
    state.savedVocabulary = readJSON("furago_words", []);

    state.furagoLevel = Math.max(1, Math.floor(state.xp / 100) + 1);

    // Save migrated state safely
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    return state;
  } catch (err) {
    console.error("Failed to load or migrate user state", err);
    return DEFAULT_STATE;
  }
};

export const saveUserState = (state: UserState) => {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("Failed to save user state", err);
    }
  }
};

export const updateUserState = (updates: Partial<UserState>): UserState => {
  const current = loadUserState();
  const next = { ...current, ...updates };
  saveUserState(next);
  return next;
};

/** Case-insensitive, Unicode-normalized key used to deduplicate learned words. */
export const learnedWordKey = (word: string): string =>
  word.normalize("NFC").trim().toLocaleLowerCase("fr");

/**
 * Pure helper: merges `words` learned from `articleId` into `existing`.
 * - The same lemma (case-insensitive) is never stored twice.
 * - If the lemma already exists, articleId is appended once to its articleIds.
 * Returns a new array; does not persist anything.
 */
export const mergeLearnedVocabulary = (
  existing: LearnedWord[],
  words: string[],
  articleId: string
): LearnedWord[] => {
  const result = existing.map((w) => ({ ...w, articleIds: [...w.articleIds] }));
  const index = new Map<string, number>();
  result.forEach((w, i) => index.set(learnedWordKey(w.word), i));

  for (const raw of words) {
    const word = raw.normalize("NFC").trim();
    if (!word) continue;
    const key = learnedWordKey(word);
    const at = index.get(key);
    if (at !== undefined) {
      if (!result[at].articleIds.includes(articleId)) {
        result[at].articleIds.push(articleId);
      }
    } else {
      index.set(key, result.length);
      result.push({ word, articleIds: [articleId] });
    }
  }
  return result;
};
