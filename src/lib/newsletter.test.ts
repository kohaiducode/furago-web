import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkEmailAvailability,
  DEFAULT_GAS_URL,
  getScriptUrl,
  submitNewsletterSubscription,
  validateEmail,
} from "./newsletter";

describe("newsletter client", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_SCRIPT_URL", "");
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("validateEmail", () => {
    it.each([
      "learner@example.com",
      "first.last+furago@example.co.jp",
      "  learner@example.com  ",
    ])("accepts a valid email: %s", (email) => {
      expect(validateEmail(email)).toEqual({ valid: true });
    });

    it.each(["", "   ", "not-an-email", "user@", "user@example", "a b@example.com"])(
      "rejects an invalid email: %s",
      (email) => {
        expect(validateEmail(email).valid).toBe(false);
      }
    );

    it("rejects an email shorter than five characters", () => {
      expect(validateEmail("a@b")).toMatchObject({ valid: false });
    });

    it("rejects an email longer than 254 characters", () => {
      const email = `${"a".repeat(243)}@example.com`;
      expect(email.length).toBeGreaterThan(254);
      expect(validateEmail(email)).toMatchObject({ valid: false });
    });
  });

  describe("getScriptUrl", () => {
    it("uses the configured public URL when available", () => {
      vi.stubEnv("NEXT_PUBLIC_GOOGLE_SCRIPT_URL", "https://example.com/gas");
      expect(getScriptUrl()).toBe("https://example.com/gas");
    });

    it("falls back to the configured Furago GAS URL", () => {
      expect(getScriptUrl()).toBe(DEFAULT_GAS_URL);
    });
  });

  describe("checkEmailAvailability", () => {
    it("returns available for an available response and posts the expected request", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ status: "available" })));

      await expect(checkEmailAvailability(" Learner@Example.com ")).resolves.toEqual({
        available: true,
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        DEFAULT_GAS_URL,
        expect.objectContaining({
          method: "POST",
          redirect: "follow",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "check_email",
            email: "learner@example.com",
          }),
        })
      );
    });

    it("returns unavailable when the email already exists", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ status: "already_exists" }))
      );

      await expect(checkEmailAvailability("learner@example.com")).resolves.toEqual({
        available: false,
      });
    });

    it("returns an error when fetch rejects", async () => {
      fetchSpy.mockRejectedValue(new Error("Network disconnected"));

      await expect(checkEmailAvailability("learner@example.com")).resolves.toEqual({
        available: false,
        error: "Network disconnected",
      });
    });

    it("does not call fetch for an invalid email", async () => {
      await expect(checkEmailAvailability("invalid")).resolves.toMatchObject({
        available: false,
        error: expect.any(String),
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("submitNewsletterSubscription", () => {
    const subscription = {
      email: "Learner@Example.com",
      name: "Marie",
      level: "LVL_2",
      categories: ["Culture", "Société"],
    };

    it("returns success and the user id for a successful GAS response", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ status: "ok", userId: "USR-0001" }))
      );

      await expect(submitNewsletterSubscription(subscription)).resolves.toEqual({
        success: true,
        status: "ok",
        userId: "USR-0001",
      });
    });

    it("sends the GAS registration payload with expected fetch options", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ status: "ok", userId: "USR-0001" }))
      );

      await submitNewsletterSubscription(subscription);

      expect(fetchSpy).toHaveBeenCalledWith(
        DEFAULT_GAS_URL,
        expect.objectContaining({
          method: "POST",
          redirect: "follow",
          keepalive: true,
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            email: "learner@example.com",
            name: "Marie",
            level: "LVL_2",
            categories: ["Culture", "Société"],
          }),
        })
      );
    });

    it("accepts firstName as the source for GAS name", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ status: "ok" }))
      );

      await submitNewsletterSubscription({
        email: "learner@example.com",
        firstName: "Kenji",
        level: "LVL_1",
        categories: ["Culture"],
      });

      expect(JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)).toEqual({
        email: "learner@example.com",
        name: "Kenji",
        level: "LVL_1",
        categories: ["Culture"],
      });
    });

    it("returns a controlled API error", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ status: "error", message: "Invalid payload." }))
      );

      await expect(submitNewsletterSubscription(subscription)).resolves.toEqual({
        success: false,
        status: "error",
        error: "Invalid payload.",
      });
    });

    it("handles network failures", async () => {
      fetchSpy.mockRejectedValue(new Error("Network disconnected"));

      await expect(submitNewsletterSubscription(subscription)).resolves.toEqual({
        success: false,
        status: "error",
        error: "Network disconnected",
      });
    });

    it("handles invalid JSON responses", async () => {
      fetchSpy.mockResolvedValue(new Response("not json"));

      await expect(submitNewsletterSubscription(subscription)).resolves.toMatchObject({
        success: false,
        status: "error",
        error: expect.any(String),
      });
    });

    it("handles request timeouts", async () => {
      vi.useFakeTimers();
      fetchSpy.mockImplementation(() => new Promise<Response>(() => {}));

      const resultPromise = submitNewsletterSubscription(subscription);
      await vi.advanceTimersByTimeAsync(10_000);

      await expect(resultPromise).resolves.toMatchObject({
        success: false,
        status: "error",
        error: "Newsletter request timed out.",
      });
      expect(fetchSpy.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    });
  });
});
