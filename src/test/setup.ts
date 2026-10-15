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

  // IntersectionObserver polyfill for tests: jsdom has no layout, so simulate
  // the observed element already being inside the viewport when observed.
  if (!window.IntersectionObserver) {
    class MockIntersectionObserver {
      root = null;
      rootMargin = "";
      thresholds: number[] = [];
      constructor(
        private callback: IntersectionObserverCallback,
        private options?: IntersectionObserverInit
      ) {}
      observe(target: Element): void {
        this.callback(
          [{ isIntersecting: true, target, intersectionRatio: 1 } as unknown as IntersectionObserverEntry],
          this as unknown as IntersectionObserver
        );
      }
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  }
}
