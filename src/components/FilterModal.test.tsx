import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import FilterModal, { type FilterModalProps } from "./FilterModal";
import { getTranslation } from "../lib/i18n";

const makeProps = (overrides: Partial<FilterModalProps> = {}): FilterModalProps => ({
  isOpen: true,
  onClose: vi.fn(),
  modalType: "level",
  selectedLevel: "LVL_1",
  onSelectLevel: vi.fn(),
  availableCategories: ["Culture", "Travel"],
  selectedCategories: ["Culture"],
  onToggleCategory: vi.fn(),
  appLang: "en",
  ...overrides,
});

const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;

beforeEach(() => {
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

describe("FilterModal", () => {
  it("keeps the dialog closed and hides its contents when isOpen is false", () => {
    const { container } = render(<FilterModal {...makeProps({ isOpen: false })} />);
    const dialog = container.querySelector("dialog");

    expect(dialog).not.toBeNull();
    expect(dialog?.open).toBe(false);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
  });

  it("shows the level choices and calls onSelectLevel when one is selected", () => {
    const props = makeProps();
    const t = getTranslation("en");
    render(<FilterModal {...props} />);

    expect(screen.getByRole("heading", { name: t.reading.selectLevel })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: t.levels.LVL_2 }));

    expect(props.onSelectLevel).toHaveBeenCalledWith("LVL_2");
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the category grid and calls onToggleCategory when a category is clicked", () => {
    const props = makeProps({ modalType: "category" });
    const { container } = render(<FilterModal {...props} />);
    const grid = container.querySelector(".filter-grid");

    expect(screen.getByRole("heading", { name: getTranslation("en").reading.selectCategory })).toBeDefined();
    expect(grid).not.toBeNull();
    expect(screen.getByRole("button", { name: "Culture" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Travel" }));
    expect(props.onToggleCategory).toHaveBeenCalledWith("Travel");
  });

  it("displays localized labels for category values", () => {
    render(
      <FilterModal
        {...makeProps({
          modalType: "category",
          availableCategories: ["culture-key"],
          categoryValues: { "culture-key": { ja: "文化", en: "Culture" } },
        })}
      />
    );

    expect(screen.getByRole("button", { name: "Culture" })).toBeDefined();
  });

  it("calls onClose when the close button is clicked", () => {
    const props = makeProps();
    render(<FilterModal {...props} />);

    fireEvent.click(screen.getByRole("button", { name: getTranslation("en").common.close }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the dialog is cancelled with Escape", () => {
    const props = makeProps();
    const { container } = render(<FilterModal {...props} />);
    const dialog = container.querySelector("dialog");

    if (!dialog) throw new Error("Filter dialog was not rendered");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
