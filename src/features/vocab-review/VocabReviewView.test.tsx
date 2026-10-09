import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import VocabReviewView, { type VocabReviewViewProps } from "./VocabReviewView";
import type { SavedWord } from "@/lib/userState";

const word: SavedWord = {
  fr: "bonjour",
  ja: "",
  conciseDef: "Définition A",
  listId: "learned",
  date: "2026-01-01",
};

const makeProps = (overrides: Partial<VocabReviewViewProps> = {}): VocabReviewViewProps => ({
  appLang: "en",
  words: [],
  answers: [],
  index: 0,
  selectedAnswer: null,
  dueRemaining: 0,
  onBack: vi.fn(),
  onMarkKnown: vi.fn(),
  onAnswer: vi.fn(),
  primaryAction: { label: "Primary action", onClick: vi.fn() },
  secondaryAction: null,
  ...overrides,
});

describe("VocabReviewView (6.3-D.2-G)", () => {
  it("VOCAB-VIEW-01: empty session renders the empty state and delegates back navigation", () => {
    const props = makeProps();
    render(<VocabReviewView {...props} />);

    expect(screen.getByText("No words to review yet")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onMarkKnown).not.toHaveBeenCalled();
    expect(props.onAnswer).not.toHaveBeenCalled();
  });

  it("VOCAB-VIEW-02: session without choices marks the word as known without asking for an answer", () => {
    const props = makeProps({ words: [word], answers: [[]] });
    render(<VocabReviewView {...props} />);

    expect(screen.getByText("bonjour")).toBeDefined();
    expect(screen.getByText("Définition A")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "I know this" }));

    expect(props.onMarkKnown).toHaveBeenCalledTimes(1);
    expect(props.onMarkKnown).toHaveBeenCalledWith(word);
    expect(props.onAnswer).not.toHaveBeenCalled();
  });

  it("VOCAB-VIEW-03: an incorrect QCM answer is reported as incorrect and locks every choice", () => {
    const props = makeProps({
      words: [word],
      answers: [["Définition A", "Définition B"]],
    });
    const { rerender } = render(<VocabReviewView {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Définition B" }));

    expect(props.onAnswer).toHaveBeenCalledTimes(1);
    expect(props.onAnswer).toHaveBeenCalledWith(word, "Définition B", false);
    expect(props.onMarkKnown).not.toHaveBeenCalled();

    rerender(<VocabReviewView {...props} selectedAnswer="Définition B" />);
    expect((screen.getByRole("button", { name: "Définition B" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Définition A" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("VOCAB-VIEW-04: a correct QCM answer is reported as correct", () => {
    const props = makeProps({
      words: [word],
      answers: [["Définition A", "Définition B"]],
    });
    render(<VocabReviewView {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Définition A" }));

    expect(props.onAnswer).toHaveBeenCalledTimes(1);
    expect(props.onAnswer).toHaveBeenCalledWith(word, "Définition A", true);
  });

  it("VOCAB-VIEW-05: session completion renders due-remaining copy and invokes resolved destinations", () => {
    const primary = vi.fn();
    const secondary = vi.fn();
    const props = makeProps({
      words: [word],
      answers: [[]],
      index: 1,
      dueRemaining: 2,
      primaryAction: { label: "🔄 Continue review (+2)", onClick: primary },
      secondaryAction: { label: "🏠 Back to Home", onClick: secondary },
    });
    render(<VocabReviewView {...props} />);

    expect(screen.getByText("Session Completed!")).toBeDefined();
    expect(screen.getByText("You have 2 words left to review")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "🔄 Continue review (+2)" }));
    expect(primary).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "🏠 Back to Home" }));
    expect(secondary).toHaveBeenCalledTimes(1);
    expect(props.onMarkKnown).not.toHaveBeenCalled();
  });

  it("VOCAB-VIEW-06: final completion omits the secondary action when no destination is resolved", () => {
    const props = makeProps({
      words: [word],
      answers: [[]],
      index: 1,
      dueRemaining: 0,
      primaryAction: { label: "🏠 Back to Home", onClick: vi.fn() },
      secondaryAction: null,
    });
    render(<VocabReviewView {...props} />);

    expect(screen.getByText("Review Completed!")).toBeDefined();
    expect(screen.getByText("🎉 All reviews are up to date!")).toBeDefined();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
