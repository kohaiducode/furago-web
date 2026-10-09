"use client";

import React, { useCallback } from "react";
import type { DictLookupResult } from "../lib/dictionary";
import { getTranslation } from "../lib/i18n";

export interface DictionaryModalProps {
  isOpen: boolean;
  loading: boolean;
  data: DictLookupResult | null;
  popupStyle: React.CSSProperties;
  arrowOrientation?: "top" | "bottom";
  appLang: string;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  onClose: () => void;
  onSaveWord: () => void;
  onSpeakWord: (word: string) => void;
}

export default function DictionaryModal({
  isOpen,
  loading,
  data,
  popupStyle,
  arrowOrientation = "bottom",
  appLang,
  dialogRef,
  onClose,
  onSaveWord,
  onSpeakWord,
}: DictionaryModalProps) {
  const t = getTranslation(appLang === "en" ? "en" : "ja");

  const setDialogRef = useCallback(
    (node: HTMLDialogElement | null) => {
      dialogRef.current = node;
      if (node && !node.open) {
        node.showModal();
      }
    },
    [dialogRef]
  );

  if (!isOpen) return null;

  return (
    <dialog
      ref={setDialogRef}
      className={`dict-popup ${arrowOrientation === "top" ? "arrow-top" : ""}`}
      style={{ ...popupStyle, margin: 0 }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="dict-header">
        <div className="dict-word-container">
          <span className="dict-word" lang="fr">
            {data ? (
              data.matchedLemma &&
              data.matchedLemma.toLowerCase() !== data.originalWord.toLowerCase() ? (
                <>
                  {data.originalWord}{" "}
                  <span className="dict-lemma-hint">({data.mot})</span>
                </>
              ) : (
                data.originalWord
              )
            ) : (
              "..."
            )}
          </span>
          {data?.nature && (
            <span className="dict-nature-tag">
              {data.nature}{data.gender && ` · ${data.gender}`}
            </span>
          )}
        </div>
        <div className="dict-buttons">
          <button
            className="dict-save-btn"
            title={t.dict.saveToList}
            aria-label={t.dict.saveToList}
            onClick={() => {
              if (!data) return;
              onSaveWord();
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button
            className="dict-audio-btn"
            title={t.words.listenPronunciation}
            aria-label={t.words.listenPronunciation}
            onClick={() => {
              if (data) onSpeakWord(data.mot);
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path
                d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              ></path>
            </svg>
          </button>
          <button
            className="dict-close-btn"
            aria-label={t.common.close}
            title={t.common.close}
            onClick={onClose}
            autoFocus
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              width: "44px",
              height: "44px",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "4px 0" }}>
          {t.dict.loading}
        </div>
      ) : (
        <div>
          {data.conciseDef && <div className="dict-def-line">{data.conciseDef}</div>}
          {data.traductionPhrase ? (
            <div className="dict-context-row">
              <span className="dict-context-label">{t.dict.context}</span>
              <span>{data.traductionPhrase}</span>
            </div>
          ) : (
            !data.conciseDef && (
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                {t.dict.noDef}
              </div>
            )
          )}
        </div>
      )}
    </dialog>
  );
}
