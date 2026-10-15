import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DictionaryModal, { type DictionaryModalProps } from "./DictionaryModal";
import type { DictLookupResult } from "../lib/dictionary";
import { getTranslation } from "../lib/i18n";

const dictionaryResult = (overrides: Partial<DictLookupResult> = {}): DictLookupResult => ({
  mot: "manger",
  originalWord: "mange",
  matchedLemma: "manger",
  conciseDef: "食べる",
  phraseOriginale: "Il mange une pomme.",
  traductionPhrase: "He eats an apple.",
  nature: "verbe",
  definitions: ["食べる"],
  gender: "",
  ...overrides,
});

const makeProps = (overrides: Partial<DictionaryModalProps> = {}): DictionaryModalProps => ({
  isOpen: true,
  loading: false,
  data: dictionaryResult(),
  popupStyle: { left: "120px", top: "30px" },
  arrowOrientation: "bottom",
  appLang: "en",
  dialogRef: React.createRef<HTMLDialogElement>(),
  onClose: vi.fn(),
  onSaveWord: vi.fn(),
  onSpeakWord: vi.fn(),
  ...overrides,
});

const originalShowModal = HTMLDialogElement.prototype.showModal;

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
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
});

describe("DictionaryModal", () => {
  it("does not render the dialog when closed", () => {
    render(<DictionaryModal {...makeProps({ isOpen: false })} />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the loading state and retains popup classes, style, and English controls", () => {
    const props = makeProps({ loading: true, data: null, arrowOrientation: "top" });
    const { container } = render(<DictionaryModal {...props} />);
    const dialog = container.querySelector("dialog");
    const t = getTranslation("en");

    expect(dialog).not.toBeNull();
    expect(dialog?.classList.contains("dict-popup")).toBe(true);
    expect(dialog?.classList.contains("arrow-top")).toBe(true);
    expect(dialog?.style.left).toBe("120px");
    expect(dialog?.style.top).toBe("30px");
    expect(dialog?.style.margin).toBe("0px");
    expect(screen.getByText("...")).toBeDefined();
    expect(screen.getByText(t.dict.loading)).toBeDefined();
    expect(screen.getByRole("button", { name: t.dict.saveToList })).toBeDefined();
    expect(screen.getByRole("button", { name: t.words.listenPronunciation })).toBeDefined();
    expect(screen.getByRole("button", { name: t.common.close })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: t.dict.saveToList }));
    fireEvent.click(screen.getByRole("button", { name: t.words.listenPronunciation }));
    expect(props.onSaveWord).not.toHaveBeenCalled();
    expect(props.onSpeakWord).not.toHaveBeenCalled();
  });

  it("renders the lemma, grammatical information, definition and context, and delegates actions", () => {
    const props = makeProps();
    const { container } = render(<DictionaryModal {...props} />);

    expect(container.querySelector(".dict-word")?.textContent).toBe("mange (manger)");
    expect(container.querySelector(".dict-word")?.getAttribute("lang")).toBe("fr");
    expect(container.querySelector(".dict-nature-tag")?.textContent).toBe("verbe");
    expect(container.querySelector(".dict-def-line")?.textContent).toBe("食べる");
    expect(container.querySelector(".dict-context-row")?.textContent).toContain("Context");
    expect(container.querySelector(".dict-context-row")?.textContent).toContain("He eats an apple.");

    fireEvent.click(screen.getByRole("button", { name: getTranslation("en").dict.saveToList }));
    fireEvent.click(screen.getByRole("button", { name: getTranslation("en").words.listenPronunciation }));
    fireEvent.click(screen.getByRole("button", { name: getTranslation("en").common.close }));

    expect(props.onSaveWord).toHaveBeenCalledTimes(1);
    expect(props.onSpeakWord).toHaveBeenCalledWith("manger");
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the no-definition message and Japanese controls", () => {
    const t = getTranslation("ja");
    const props = makeProps({
      appLang: "ja",
      data: dictionaryResult({
        mot: "mot",
        originalWord: "mot",
        matchedLemma: null,
        conciseDef: "",
        traductionPhrase: "",
        nature: "名詞",
        gender: "男性",
      }),
    });
    const { container } = render(<DictionaryModal {...props} />);

    expect(container.querySelector(".dict-word")?.textContent).toBe("mot");
    expect(container.querySelector(".dict-nature-tag")?.textContent).toBe("名詞 · 男性");
    expect(screen.getByText(t.dict.noDef)).toBeDefined();
    expect(screen.getByRole("button", { name: t.dict.saveToList })).toBeDefined();
    expect(screen.getByRole("button", { name: t.words.listenPronunciation })).toBeDefined();
    expect(screen.getByRole("button", { name: t.common.close })).toBeDefined();
  });

  it("closes when the dialog backdrop or native close event is activated", () => {
    const props = makeProps();
    const { container } = render(<DictionaryModal {...props} />);
    const dialog = container.querySelector("dialog");

    if (!dialog) throw new Error("Dictionary dialog was not rendered");
    fireEvent.click(dialog);
    expect(props.onClose).toHaveBeenCalledTimes(1);

    fireEvent(dialog, new Event("close"));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
});
