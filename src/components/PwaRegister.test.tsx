import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PwaRegister from "./PwaRegister";

describe("PwaRegister", () => {
  const originalServiceWorker = navigator.serviceWorker;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: originalServiceWorker,
      configurable: true,
      writable: true,
    });
  });

  it("calls navigator.serviceWorker.register('/sw.js') when serviceWorker is available", () => {
    const registerMock = vi.fn().mockResolvedValue({} as ServiceWorkerRegistration);
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: registerMock,
      },
      configurable: true,
      writable: true,
    });

    render(<PwaRegister />);

    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith("/sw.js");
  });

  it("does not crash when serviceWorker registration rejects", async () => {
    const registerMock = vi.fn().mockRejectedValue(new Error("Registration failed"));
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: registerMock,
      },
      configurable: true,
      writable: true,
    });

    expect(() => render(<PwaRegister />)).not.toThrow();
    expect(registerMock).toHaveBeenCalledWith("/sw.js");
  });

  it("does not crash when serviceWorker is absent from navigator", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    expect(() => render(<PwaRegister />)).not.toThrow();
  });
});
