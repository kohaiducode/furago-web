import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NewsletterModal, { type NewsletterModalProps } from "./NewsletterModal";

const newsletterMocks = vi.hoisted(() => ({
  checkEmailAvailability: vi.fn(),
  submitNewsletterSubscription: vi.fn(),
}));

vi.mock("../lib/newsletter", () => ({
  checkEmailAvailability: newsletterMocks.checkEmailAvailability,
  submitNewsletterSubscription: newsletterMocks.submitNewsletterSubscription,
  validateEmail: (email: string) => {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    return valid ? { valid: true } : { valid: false, error: "Enter a valid email address." };
  },
}));

const makeProps = (overrides: Partial<NewsletterModalProps> = {}): NewsletterModalProps => ({
  isOpen: true,
  onClose: vi.fn(),
  appLang: "en",
  availableCategories: ["Culture", "Travel"],
  ...overrides,
});

const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;

beforeEach(() => {
  newsletterMocks.checkEmailAvailability.mockReset();
  newsletterMocks.submitNewsletterSubscription.mockReset();
  newsletterMocks.checkEmailAvailability.mockResolvedValue({ available: true });
  newsletterMocks.submitNewsletterSubscription.mockResolvedValue({ success: true, status: "ok" });

  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    }),
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    }),
  });
});

afterEach(() => {
  if (originalShowModal) {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: originalShowModal,
    });
  } else {
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  }

  if (originalClose) {
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: originalClose,
    });
  } else {
    Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  }
});

describe("NewsletterModal", () => {
  it("keeps the dialog closed when isOpen is false", () => {
    const { container } = render(<NewsletterModal {...makeProps({ isOpen: false })} />);
    const dialog = container.querySelector("dialog");

    expect(dialog).not.toBeNull();
    expect(dialog?.open).toBe(false);
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
  });

  it("renders step one with the name and email fields and initial email", () => {
    const { container } = render(
      <NewsletterModal {...makeProps({ initialEmail: "learner@example.com" })} />
    );
    const dialog = container.querySelector("dialog");

    expect(dialog?.open).toBe(true);
    expect(dialog?.getAttribute("aria-labelledby")).toBe("newsletter-modal-title");
    expect(screen.getByLabelText("Name")).toBeDefined();
    expect(screen.getByLabelText("Email")).toHaveProperty("value", "learner@example.com");
  });

  it("advances to step two after a valid email is available", async () => {
    render(<NewsletterModal {...makeProps()} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Marie" } });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "marie@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByText("What is your current French level?")).toBeDefined();
    });
    expect(newsletterMocks.checkEmailAvailability).toHaveBeenCalledWith("marie@example.com");
    expect(screen.getByRole("button", { name: "Culture" })).toBeDefined();
  });

  it("shows an error when the email is invalid", async () => {
    const { container } = render(<NewsletterModal {...makeProps()} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Marie" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "invalid" } });
    const form = container.querySelector("form");
    if (!form) throw new Error("Newsletter form was not rendered");
    fireEvent.submit(form);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Enter a valid email address."
    );
    expect(newsletterMocks.checkEmailAvailability).not.toHaveBeenCalled();
  });

  it("shows an error when the email is already registered", async () => {
    newsletterMocks.checkEmailAvailability.mockResolvedValue({ available: false });
    render(<NewsletterModal {...makeProps()} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Marie" } });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "marie@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "This email is already registered."
    );
  });

  it("calls onClose when the close button is clicked", () => {
    const props = makeProps();
    render(<NewsletterModal {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("notifies the parent when the dialog is cancelled with Escape", () => {
    const props = makeProps();
    const { container } = render(<NewsletterModal {...props} />);
    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("Newsletter dialog was not rendered");

    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("shows French labels when appLang is fr", () => {
    render(<NewsletterModal {...makeProps({ appLang: "fr" })} />);

    expect(screen.getByRole("heading", { name: "Inscription à la newsletter Furago" })).toBeDefined();
    expect(screen.getByLabelText("Prénom et nom")).toBeDefined();
    expect(screen.getByLabelText("Adresse e-mail")).toBeDefined();
    expect(screen.getByRole("button", { name: "Suivant" })).toBeDefined();
  });

  it("shows the success confirmation and notifies the parent after submission", async () => {
    const onSuccess = vi.fn();
    render(<NewsletterModal {...makeProps({ onSuccess })} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Marie" } });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "Marie@Example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("What is your current French level?");
    fireEvent.click(screen.getByRole("button", { name: "Culture" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect((await screen.findByRole("status")).textContent).toContain(
      "Thank you for registering! A confirmation email has been sent."
    );
    expect(newsletterMocks.submitNewsletterSubscription).toHaveBeenCalledWith({
      email: "marie@example.com",
      name: "Marie",
      level: "LVL_1",
      categories: ["Culture"],
    });
    expect(onSuccess).toHaveBeenCalledWith("marie@example.com");
  });
});
