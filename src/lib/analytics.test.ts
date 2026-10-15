import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  trackEvent,
  updateSessionActivity,
  checkAndTrackSessionStart,
} from "./analytics";

describe("analytics module", () => {
  const SESSION_ID_KEY = "furago_analytics_session_id";
  const SESSION_LAST_ACTIVE_KEY = "furago_analytics_last_active";
  const USER_ID_KEY = "furago_analytics_user_id";

  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ status: "success" })))
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("ANALYTICS-01: Session lifecycle and timeout", () => {
    it("creates a new session initially, keeps it within 30 min, and generates a new session after >30 min inactivity", () => {
      const startTime = 1700000000000;
      vi.setSystemTime(startTime);

      // 1. Initial activity -> creates new session
      updateSessionActivity();
      const firstSessionId = localStorage.getItem(SESSION_ID_KEY);
      expect(firstSessionId).toBeTruthy();
      expect(Number(localStorage.getItem(SESSION_LAST_ACTIVE_KEY))).toBe(
        startTime
      );
      // Because isNew was true, session_start should be sent
      expect(fetchSpy).toHaveBeenCalled();
      const firstCallBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(firstCallBody.event).toBe("session_start");
      expect(firstCallBody.session_id).toBe(firstSessionId);

      fetchSpy.mockClear();

      // 2. Activity within 30 min (e.g. 15 min later) -> same session
      const midTime = startTime + 15 * 60 * 1000;
      vi.setSystemTime(midTime);

      updateSessionActivity();
      const currentSessionId = localStorage.getItem(SESSION_ID_KEY);
      expect(currentSessionId).toBe(firstSessionId);
      expect(Number(localStorage.getItem(SESSION_LAST_ACTIVE_KEY))).toBe(
        midTime
      );
      // isNew was false -> session_start is NOT sent again
      expect(fetchSpy).not.toHaveBeenCalled();

      // 3. Activity after >30 min of inactivity (e.g. 31 min after midTime) -> new session
      const afterTimeoutTime = midTime + 31 * 60 * 1000;
      vi.setSystemTime(afterTimeoutTime);

      updateSessionActivity();
      const newSessionId = localStorage.getItem(SESSION_ID_KEY);
      expect(newSessionId).toBeTruthy();
      expect(newSessionId).not.toBe(firstSessionId);
      expect(Number(localStorage.getItem(SESSION_LAST_ACTIVE_KEY))).toBe(
        afterTimeoutTime
      );
      // isNew was true again -> session_start is sent for the new session
      expect(fetchSpy).toHaveBeenCalled();
      const newCallBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(newCallBody.event).toBe("session_start");
      expect(newCallBody.session_id).toBe(newSessionId);
    });

    it("checkAndTrackSessionStart honors isNew flag", () => {
      const now = 1700000000000;
      vi.setSystemTime(now);

      // First check: new session -> sends event
      checkAndTrackSessionStart(3, 5);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const body1 = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(body1.event).toBe("session_start");
      expect(body1.params).toEqual({ streak: 3, srs_due_count: 5 });

      fetchSpy.mockClear();

      // Second check within timeout: not new -> no event
      checkAndTrackSessionStart(3, 5);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("ANALYTICS-02: trackEvent payload structure and resilience", () => {
    it("builds the expected payload with user_id, session_id, event, and params", () => {
      const now = 1700000000000;
      vi.setSystemTime(now);

      // Pre-set existing user and session so no implicit session_start is triggered
      localStorage.setItem(USER_ID_KEY, "usr_test_123");
      localStorage.setItem(SESSION_ID_KEY, "ses_test_456");
      localStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(now));

      trackEvent("article_started", {
        article_id: "art_42",
        source: "catalog",
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toContain("https://script.google.com");
      expect(options?.method).toBe("POST");
      expect(options?.headers).toEqual({
        "Content-Type": "text/plain;charset=utf-8",
      });

      const payload = JSON.parse(options?.body as string);
      expect(payload).toMatchObject({
        action: "log_event",
        event: "article_started",
        params: {
          article_id: "art_42",
          source: "catalog",
        },
        user_id: "usr_test_123",
        session_id: "ses_test_456",
      });
      expect(payload.timestamp).toBe(new Date(now).toISOString());
    });

    it("does not crash the application in case of network failure", async () => {
      fetchSpy.mockImplementation(() =>
        Promise.reject(new Error("Network disconnected"))
      );

      expect(() => {
        trackEvent("article_completed", { article_id: "art_99" });
      }).not.toThrow();

      // Let microtasks run to ensure uncaught rejection doesn't bubble up
      await Promise.resolve();
    });
  });
});
