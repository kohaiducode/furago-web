"use client";

import React from "react";
import type { AppLanguage, getTranslation } from "@/lib/i18n";
import type { LearnedWord, SavedWord, WordList } from "@/lib/userState";

const LEARNED_LIST_NAME = "📚 Furago — Mots appris";

export interface WordbookViewProps {
  t: ReturnType<typeof getTranslation>;
  appLang: AppLanguage;
  savedWords: SavedWord[];
  learnedWords: LearnedWord[];
  wordLists: WordList[];
  currentListId: string | null;
  learnedListId: string;
  learnedDueCount: number;
  onCreateList: (trigger: HTMLButtonElement) => void;
  onSelectList: (listId: string | null) => void;
  onReviewLearned: () => void;
  onWordClick: (
    event: React.MouseEvent<HTMLElement>,
    word: string,
    paragraphText: string
  ) => void;
  onSpeakWord: (word: string) => void;
  onDeleteWord: (wordFr: string, listId: string) => void;
}

export default function WordbookView({
  t,
  appLang,
  savedWords,
  learnedWords,
  wordLists,
  currentListId,
  learnedListId,
  learnedDueCount,
  onCreateList,
  onSelectList,
  onReviewLearned,
  onWordClick,
  onSpeakWord,
  onDeleteWord,
}: WordbookViewProps) {
  const wordsInList = currentListId === null || currentListId === learnedListId
    ? []
    : savedWords
      .filter((word) => (word.listId || "default") === currentListId)
      .slice()
      .reverse();

  return (
    <main className="view fade-in">
      {currentListId === null ? (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "22px",
            }}
          >
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--primary)" }}>
              {t.words.title}
            </h2>
            <button
              type="button"
              onClick={(event) => onCreateList(event.currentTarget)}
              style={{
                background: "var(--primary)",
                color: "white",
                border: "none",
                padding: "8px 14px",
                borderRadius: "16px",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              + {t.words.newList}
            </button>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            <button
              type="button"
              onClick={() => onSelectList(learnedListId)}
              className="quiz-card reset-button"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                cursor: "pointer",
                marginBottom: 0,
                background: "linear-gradient(135deg, var(--primary-light), var(--surface) 70%)",
                border: "1px solid var(--primary-light)",
                width: "100%",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                <div
                  aria-hidden="true"
                  style={{
                    background: "var(--surface)",
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: "1.35rem",
                    flexShrink: 0,
                  }}
                >
                  📚
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 lang="fr" style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                    Furago — Mots appris
                  </h3>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    {learnedWords.length} {t.words.wordCount} · {appLang === "ja" ? "読了した記事から自動で追加" : "Added automatically from completed articles"}
                  </span>
                </div>
              </div>
              <ChevronIcon />
            </button>

            {wordLists.map((list) => {
              const count = savedWords.filter(
                (word) => (word.listId || "default") === list.id
              ).length;
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => onSelectList(list.id)}
                  className="quiz-card reset-button"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    marginBottom: 0,
                    width: "100%",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      style={{
                        background: "var(--primary-light)",
                        color: "var(--primary)",
                        width: "44px",
                        height: "44px",
                        borderRadius: "12px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <FolderIcon />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                        {list.name === "デフォルト" ? t.words.defaultList : list.name}
                      </h3>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        {count} {t.words.wordCount}
                      </span>
                    </div>
                  </div>
                  <ChevronIcon />
                </button>
              );
            })}
          </div>
        </div>
      ) : currentListId === learnedListId ? (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "22px",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <BackButton onClick={() => onSelectList(null)} />
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--primary)", margin: 0 }}>
                {LEARNED_LIST_NAME}
              </h2>
            </div>

            {learnedWords.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
                  {learnedDueCount} {appLang === "ja" ? "件" : "due"}
                </div>
                <button
                  type="button"
                  disabled={learnedDueCount === 0}
                  onClick={onReviewLearned}
                  style={{
                    background: learnedDueCount > 0 ? "var(--primary)" : "var(--bg)",
                    color: learnedDueCount > 0 ? "white" : "var(--text-muted)",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    cursor: learnedDueCount > 0 ? "pointer" : "not-allowed",
                    boxShadow: learnedDueCount > 0 ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  {appLang === "ja" ? "復習する" : "Review"}
                </button>
              </div>
            )}
          </div>

          {learnedWords.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>📚</div>
              <p style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {appLang === "ja"
                  ? "まだ学んだ単語はありません。\n記事を読んで完了すると、自動的に追加されます。"
                  : "You haven't learned any words yet.\nWords are added automatically when you complete an article."}
              </p>
            </div>
          ) : (
            learnedWords.map((word, index) => (
              <div
                key={`learned-${index}`}
                className="quiz-card fade-in"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}
              >
                <div style={{ minWidth: 0 }}>
                  <h3 lang="fr" style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, wordBreak: "break-word" }}>
                    <button
                      type="button"
                      className="tap-word reset-button interactive-word"
                      onClick={(event) => onWordClick(event, word.word, "")}
                      style={{
                        color: "var(--primary)",
                        cursor: "pointer",
                        textDecoration: "underline",
                        textDecorationColor: "var(--border)",
                        textUnderlineOffset: "4px",
                      }}
                    >
                      {word.word}
                    </button>
                  </h3>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 600 }}>
                    {appLang === "ja" ? `${word.articleIds.length}つの記事から` : `From ${word.articleIds.length} articles`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSpeakWord(word.word)}
                  title={t.words.listenPronunciation}
                  aria-label={t.words.listenPronunciation}
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    color: "var(--green)",
                    borderRadius: "50%",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <AudioIcon />
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "22px", gap: "12px" }}>
            <BackButton onClick={() => onSelectList(null)} />
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--primary)", margin: 0 }}>
              {(() => {
                const listName = wordLists.find((list) => list.id === currentListId)?.name;
                if (listName === "デフォルト") return t.words.defaultList;
                return listName || t.words.list;
              })()}
            </h2>
          </div>

          {wordsInList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--text-muted)" }}>
              <p>
                {t.words.emptyList.split("\n").map((line, index) => (
                  <React.Fragment key={index}>
                    {line}
                    {index === 0 && <br />}
                  </React.Fragment>
                ))}
              </p>
            </div>
          ) : (
            wordsInList.map((word, index) => (
                <div
                  key={`${word.fr}-${index}`}
                  className="quiz-card fade-in"
                  style={{ display: "flex", flexDirection: "column", gap: "10px" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      {word.nature && (
                        <span
                          style={{
                            background: "var(--primary-light)",
                            color: "var(--primary)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            marginBottom: "4px",
                            display: "inline-block",
                          }}
                        >
                          {word.nature}{word.gender && ` · ${word.gender}`}
                        </span>
                      )}
                      <h3 lang="fr" style={{ color: "var(--primary)", margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                        {word.originalWord && word.originalWord.toLowerCase() !== word.fr.toLowerCase() ? (
                          <>
                            {word.originalWord}{" "}
                            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 400 }}>
                              ({t.words.lemmaPrefix} {word.fr})
                            </span>
                          </>
                        ) : (
                          word.fr
                        )}
                      </h3>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => onSpeakWord(word.fr)}
                        title={t.words.listenPronunciation}
                        aria-label={t.words.listenPronunciation}
                        style={{
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                          color: "var(--green)",
                          borderRadius: "50%",
                          width: "36px",
                          height: "36px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <AudioIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteWord(word.fr, word.listId || "default")}
                        title={t.words.delete}
                        aria-label={`${t.words.delete} ${word.fr}`}
                        style={{
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                          color: "var(--red)",
                          borderRadius: "50%",
                          width: "36px",
                          height: "36px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="dict-def-line">{word.conciseDef || word.ja}</div>
                    {word.phraseOriginale && word.traductionPhrase && (
                      <div className="dict-context-row" style={{ marginTop: "6px" }}>
                        <span className="dict-context-label">{t.dict.context}</span>
                        <span>{word.traductionPhrase}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </main>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "50%",
        width: "38px",
        height: "38px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "1.1rem",
        cursor: "pointer",
      }}
    >
      ←
    </button>
  );
}

function ChevronIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" strokeWidth="2"></path>
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  );
}
