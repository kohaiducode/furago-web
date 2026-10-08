import type { StreakState } from "./home";

export type EventName =
  | "session_start"
  | "home_viewed"
  | "home_cta_clicked"
  | "article_started"
  | "article_completed"
  | "srs_session_started"
  | "srs_session_completed"
  | "mission_completed"
  | "progress_dashboard_opened"
  | "progress_goal_clicked"
  | "cando_viewed"
  | "pedagogical_goal_completed";

export interface AnalyticsEventParams {
  session_start: { streak: number; srs_due_count: number };
  home_viewed: {
    srs_due_count: number;
    has_daily_mission: boolean;
    has_continue_article: boolean;
    streak_state: StreakState;
  };
  home_cta_clicked: {
    cta_type: "continue" | "mission" | "srs" | "recommendation" | "habit_nudge";
    position: number;
  };
  article_started: {
    article_id: string;
    source: "home_continue" | "home_mission" | "catalog" | "recommendation" | "home_progress_widget";
  };
  article_completed: { article_id: string };
  srs_session_started: { due_count: number };
  srs_session_completed: { reviewed_count: number; correct_count: number };
  mission_completed: { article_id: string };
  progress_dashboard_opened: Record<string, never>;
  progress_goal_clicked: { goal_id: string; goal_category: string };
  cando_viewed: { unlocked_count: number; total_count: number };
  pedagogical_goal_completed: { goal_id: string; goal_category: string };
}

// Generate a simple UUID v4 (uses crypto API if available, fallback otherwise)
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (
      Number(c) ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))
    ).toString(16)
  );
}

const USER_ID_KEY = "furago_analytics_user_id";
const SESSION_ID_KEY = "furago_analytics_session_id";
const SESSION_LAST_ACTIVE_KEY = "furago_analytics_last_active";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function getOrCreateUserId(): string {
  if (typeof window === "undefined") return "server";
  let uid = localStorage.getItem(USER_ID_KEY);
  if (!uid) {
    uid = generateUUID();
    localStorage.setItem(USER_ID_KEY, uid);
  }
  return uid;
}

function getOrCreateSessionId(): { sid: string; isNew: boolean } {
  if (typeof window === "undefined") return { sid: "server", isNew: false };
  const now = Date.now();
  let sid = localStorage.getItem(SESSION_ID_KEY);
  const lastActive = localStorage.getItem(SESSION_LAST_ACTIVE_KEY);
  let isNew = false;

  if (!sid || !lastActive || now - Number(lastActive) > SESSION_TIMEOUT_MS) {
    sid = generateUUID();
    localStorage.setItem(SESSION_ID_KEY, sid);
    isNew = true;
  }

  // Update last active time
  localStorage.setItem(SESSION_LAST_ACTIVE_KEY, now.toString());
  return { sid, isNew };
}

export function updateSessionActivity() {
  if (typeof window === "undefined") return;
  const { isNew } = getOrCreateSessionId();
  if (isNew) {
    trackEvent("session_start", getSessionStartParams());
  }
}

export function checkAndTrackSessionStart(streak: number, srs_due_count: number) {
  if (typeof window === "undefined") return;
  const { isNew } = getOrCreateSessionId();
  if (isNew) {
    trackEvent("session_start", { streak, srs_due_count });
  }
}

function getSessionStartParams(): { streak: number; srs_due_count: number } {
  if (typeof window === "undefined") return { streak: 0, srs_due_count: 0 };
  try {
    const raw = localStorage.getItem("furago:user-state:v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      const streak = parsed.currentStreak || 0;
      const learned = Array.isArray(parsed.learnedVocabulary) ? parsed.learnedVocabulary : [];
      const now = Date.now();
      const srs_due_count = learned.filter((w: { dueAt?: number }) => (w.dueAt || 0) <= now).length;
      return { streak, srs_due_count };
    }
  } catch {
    // Ignore parse errors
  }
  return { streak: 0, srs_due_count: 0 };
}

export function trackEvent<T extends EventName>(
  eventName: T,
  ...args: T extends keyof AnalyticsEventParams
    ? [AnalyticsEventParams[T]]
    : [undefined?]
) {
  if (typeof window === "undefined") return;

  const params = args[0] || {};
  const userId = getOrCreateUserId();
  const { sid: sessionId, isNew } = getOrCreateSessionId();

  // If a new session was just created by this action, ensure we track session_start first
  if (isNew && eventName !== "session_start") {
    trackEvent("session_start", getSessionStartParams() as AnalyticsEventParams["session_start"] & AnalyticsEventParams[T]);
  }

  const payload = {
    action: "log_event",
    event: eventName,
    params,
    user_id: userId,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
  };

  const scriptUrl =
    process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL ||
    "https://script.google.com/macros/s/AKfycbxUb-hUABm9TodggnQgnxrXjhmFzhxQxo-7beGqTdTLAlkI_kdEjQUXGeLMrq9Lhvg1QQ/exec";

  // Fire and forget (non-blocking)
  if (scriptUrl) {
    fetch(scriptUrl, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Fail silently to never block UI
    });
  }
}
