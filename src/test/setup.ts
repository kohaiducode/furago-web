import { beforeEach } from "vitest";

// Ensure clean localStorage for every test
beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    // ignore if localStorage is unavailable
  }
});

// Provide standard window mocks if running in jsdom
if (typeof window !== "undefined") {
  window.scrollTo = () => {};

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number;
  }

  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (id: number) => clearTimeout(id);
  }

  if (!("speechSynthesis" in window)) {
    // Minimal mock for speech synthesis
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        getVoices: () => [],
        speak: () => {},
        cancel: () => {},
        pause: () => {},
        resume: () => {},
      },
      writable: true,
    });
  }
}
