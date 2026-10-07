/**
 * Pure, React-free selection helpers for the Home screen.
 * They only READ existing user data (UserState / SRS / catalogue) and never persist anything.
 */
import type { LearnedWord } from "./userState";

/** Minimal structural shape of an article needed by the Home helpers. */
export interface HomeArticleLike {
  id: number | string;
  date?: string;
  levels: Record<string, { paragraphs?: unknown[]; segments?: unknown[] } | undefined>;
}

/** Same threshold as the historical "Continue reading" rule (ignore accidental scrolls). */
export const CONTINUE_MIN_RATIO = 0.05;

/** Key format used by UserState.articleProgress. */
export const articleProgressKey = (id: number | string, level: string) => `${id}::${level}`;

/** An article is readable at a level only if that level has real text (same rule as the catalogue filter). */
export const hasReadableLevel = (article: HomeArticleLike, level: string): boolean => {
  const lvl = article.levels?.[level];
  return !!lvl && (!!lvl.paragraphs?.length || !!lvl.segments?.length);
};

/**
 * Picks the article to resume: started (> CONTINUE_MIN_RATIO), readable at the level, not completed.
 * Prefers the last opened article, then the most advanced one (ties broken by id → deterministic).
 */
export function selectContinueArticle<A extends HomeArticleLike>(
  articles: A[],
  level: string,
  completedArticles: string[],
  articleProgress: Record<string, number>,
  lastOpenedArticleId: string
): { article: A; ratio: number } | null {
  const completed = new Set(completedArticles.map(String));
  const candidates = articles
    .filter((a) => hasReadableLevel(a, level) && !completed.has(String(a.id)))
    .map((a) => ({ article: a, ratio: Math.min(1, Math.max(0, articleProgress[articleProgressKey(a.id, level)] ?? 0)) }))
    .filter((c) => c.ratio > CONTINUE_MIN_RATIO);

  if (candidates.length === 0) return null;

  const last = candidates.find((c) => String(c.article.id) === String(lastOpenedArticleId));
  if (last) return last;

  return [...candidates].sort(
    (x, y) => y.ratio - x.ratio || String(x.article.id).localeCompare(String(y.article.id))
  )[0];
}

const dateValue = (d?: string) => {
  const t = d ? Date.parse(d) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Simple deterministic recommendation:
 * not completed, not excluded, newest first, one article per category first, then fill.
 * `articles` is expected to already be filtered by level/content/category (catalogue filter).
 */
export function selectRecommendedArticles<A extends HomeArticleLike>(
  articles: A[],
  completedArticles: string[],
  excludeIds: Array<string | number>,
  getCategoryKey: (a: A) => string,
  limit = 3
): A[] {
  const completed = new Set(completedArticles.map(String));
  const excluded = new Set(excludeIds.map(String));
  const pool = articles
    .filter((a) => !completed.has(String(a.id)) && !excluded.has(String(a.id)))
    .sort((a, b) => dateValue(b.date) - dateValue(a.date) || String(a.id).localeCompare(String(b.id)));

  const picked: A[] = [];
  const seenCategories = new Set<string>();
  for (const a of pool) {
    if (picked.length >= limit) break;
    const cat = getCategoryKey(a);
    if (!seenCategories.has(cat)) {
      seenCategories.add(cat);
      picked.push(a);
    }
  }
  for (const a of pool) {
    if (picked.length >= limit) break;
    if (!picked.includes(a)) picked.push(a);
  }
  return picked;
}

const ymdToDayIndex = (ymd: string): number => {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return Date.UTC(y, m - 1, d) / 86400000;
};

const localDayIndex = (ms: number): number => {
  const d = new Date(ms);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
};

export type StreakState = "none" | "done_today" | "at_risk" | "broken";

/**
 * Display-only view of the existing streak (nothing is written).
 * Mirrors updateStreak(): a gap > 1 day means the next completion restarts at 1,
 * so the stored value is shown as 0 ("broken") instead of a misleading stale number.
 */
export const getStreakStatus = (
  currentStreak: number,
  lastStreakDate: string,
  todayYmd: string
): { display: number; state: StreakState } => {
  if (!lastStreakDate || !currentStreak || currentStreak <= 0) return { display: 0, state: "none" };
  const diff = ymdToDayIndex(todayYmd) - ymdToDayIndex(lastStreakDate);
  if (Number.isNaN(diff)) return { display: currentStreak, state: "at_risk" };
  if (diff <= 0) return { display: currentStreak, state: "done_today" };
  if (diff === 1) return { display: currentStreak, state: "at_risk" };
  return { display: 0, state: "broken" };
};

/**
 * Calendar-day offset of the next SRS review that is NOT yet due
 * (0 = later today, 1 = tomorrow, …). null if no future review exists.
 */
export const getNextReviewDayOffset = (vocabulary: LearnedWord[], now: number): number | null => {
  let next = Infinity;
  for (const w of vocabulary) {
    if (typeof w.dueAt === "number" && w.dueAt > now && w.dueAt < next) next = w.dueAt;
  }
  if (next === Infinity) return null;
  return Math.max(0, Math.round(localDayIndex(next) - localDayIndex(now)));
};
