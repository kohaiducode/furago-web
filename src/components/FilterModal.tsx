"use client";

import { useEffect, useRef } from "react";
import { getCategoryFilterLabel, getCategoryLabel, type CategoryValue } from "../lib/category";
import { getTranslation } from "../lib/i18n";

export interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  modalType: "level" | "category" | "all";
  onSetModalType?: (type: "level" | "category") => void;
  selectedLevel: string;
  onSelectLevel: (level: string) => void;
  availableCategories: string[];
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;
  onSelectAllCategories?: () => void;
  onClearCategories?: () => void;
  appLang: string;
  categoryValues?: Record<string, CategoryValue>;
}

const LEVELS = ["LVL_1", "LVL_2", "LVL_3", "LVL_4"];

export default function FilterModal({
  isOpen,
  onClose,
  modalType,
  selectedLevel,
  onSelectLevel,
  availableCategories,
  selectedCategories,
  onToggleCategory,
  appLang,
  categoryValues,
}: FilterModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const t = getTranslation(appLang === "en" ? "en" : "ja");
  const categoryLanguage = appLang === "fr" || appLang === "en" ? appLang : "ja";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="filter-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="filter-modal-title"
    >
      {isOpen && (
        <div
          className="modal-sheet"
          style={{ margin: "0 auto", maxWidth: "520px" }}
          onClick={(event) => event.stopPropagation()}
        >
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: "40px",
                height: "5px",
                background: "#e5e5ea",
                borderRadius: "3px",
                margin: "0 auto 18px auto",
              }}
            />
            <button
              type="button"
              onClick={onClose}
              aria-label={t.common.close}
              style={{
                position: "absolute",
                top: "-15px",
                right: "0",
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "var(--text-secondary)",
                padding: "4px",
                lineHeight: "1",
              }}
            >
              &times;
            </button>
          </div>
          <h3
            id="filter-modal-title"
            style={{
              textAlign: "center",
              fontSize: "1.15rem",
              fontWeight: 700,
              marginBottom: "18px",
            }}
          >
            {modalType === "level" ? t.reading.selectLevel : t.reading.selectCategory}
          </h3>

          <div
            className={modalType === "category" ? "filter-grid" : ""}
            style={{
              display: modalType === "level" ? "flex" : undefined,
              flexDirection: modalType === "level" ? "column" : undefined,
              gap: "8px",
              overflowY: "auto",
            }}
          >
            {modalType === "level"
              ? LEVELS.map((level) => (
                  <button
                    key={level}
                    className="quiz-option"
                    style={{
                      borderColor: selectedLevel === level ? "var(--primary)" : "transparent",
                      background: selectedLevel === level ? "var(--primary-light)" : "var(--bg)",
                    }}
                    onClick={() => {
                      onSelectLevel(level);
                      onClose();
                    }}
                  >
                    {t.levels[level as keyof typeof t.levels] || level}
                  </button>
                ))
              : availableCategories.map((category) => {
                  const isSelected = selectedCategories.includes(category);
                  const categoryValue = categoryValues?.[category] ?? category;
                  const categoryLabel =
                    getCategoryFilterLabel(categoryValue, categoryLanguage) ||
                    getCategoryLabel(categoryValue, categoryLanguage) ||
                    category;

                  return (
                    <button
                      key={category}
                      className="quiz-option"
                      style={{
                        borderColor: isSelected ? "var(--primary)" : "#e5e5ea",
                        background: isSelected ? "var(--primary-light)" : "var(--surface)",
                      }}
                      onClick={() => onToggleCategory(category)}
                    >
                      {categoryLabel}
                    </button>
                  );
                })}
          </div>
        </div>
      )}
    </dialog>
  );
}
