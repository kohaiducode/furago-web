"use client";

import React from "react";
import { extractDriveId, formatDriveUrl } from "@/lib/image";
import { AppLanguage, getTranslation } from "@/lib/i18n";
import type { Article, ArticleLevelData, QuizChoice } from "@/types/article";

type TextRange = { start: number; length: number };

interface ReadingCompletion {
  hasQuiz: boolean;
  quizScore: number;
  quizQuestionCount: number;
  reward: { xp: number; vocab: number } | null;
  streak: number;
  dueReviewCount: number;
  hasVocabToReview: boolean;
  seriesId: string | null;
  seriesIndex: number | null;
  seriesTotal: number | null;
  hasNextEpisode: boolean;
  onReviewVocabulary: () => void;
  onNextEpisode: () => void;
  onNextArticle: () => void;
  onBackHome: () => void;
}

export interface ReadingViewProps {
  article: Article;
  levelData: ArticleLevelData;
  globalLevel: string;
  appLang: AppLanguage;
  t: ReturnType<typeof getTranslation>;
  seriesProgress: { currentIndex: number; total: number } | null;
  onWordClick: (event: React.MouseEvent<HTMLElement>, word: string, paragraphText: string) => void;
  renderVocabularyItem: (word: string, index: number) => React.ReactNode;
  speechRange: TextRange | null;
  highlightRange: TextRange;
  quizIndex: number;
  selectedAnswer: string | null;
  translatedQuizIds: Record<string, boolean>;
  onToggleQuestionTranslation: (questionId: string) => void;
  onSelectAnswer: (answerKey: string, isCorrect: boolean) => void;
  onCompleteWithoutQuiz: () => void;
  completion: ReadingCompletion | null;
}

export default function ReadingView({
  article,
  levelData,
  globalLevel,
  appLang,
  t,
  seriesProgress,
  onWordClick,
  renderVocabularyItem,
  speechRange,
  highlightRange,
  quizIndex,
  selectedAnswer,
  translatedQuizIds,
  onToggleQuestionTranslation,
  onSelectAnswer,
  onCompleteWithoutQuiz,
  completion,
}: ReadingViewProps) {
  let globalOffset = 0;
  const interactiveParagraphs: React.ReactNode[] = [];
  const paragraphs = levelData.paragraphs || levelData.segments || [];
  const sentenceStart = speechRange?.start ?? -1;
  const sentenceEnd = speechRange ? speechRange.start + speechRange.length : -1;

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const text = paragraph.fr;
    const elements: React.ReactNode[] = [];
    const tokenRegex = /([a-zA-ZÀ-ÿœæŒÆ]+(?:['’][a-zA-ZÀ-ÿœæŒÆ]+)?)|([^a-zA-ZÀ-ÿœæŒÆ]+)/g;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(text)) !== null) {
      const token = match[0];
      const startIdx = globalOffset;
      const isWord = /[a-zA-ZÀ-ÿœæŒÆ]/.test(token);
      let isHighlighted = false;
      let isDimmed = false;

      if (sentenceStart !== -1 && sentenceEnd !== -1) {
        if (startIdx >= sentenceStart && startIdx < sentenceEnd) {
          isHighlighted = true;
        } else {
          isDimmed = true;
        }
      }

      if (isWord) {
        elements.push(
          <button
            type="button"
            key={startIdx}
            onClick={(event) => onWordClick(event, token, text)}
            style={{
              cursor: "pointer",
              transition: "all 0.15s",
              color: isHighlighted ? "var(--primary)" : isDimmed ? "var(--text-muted)" : "inherit",
              opacity: isDimmed ? 0.6 : 1,
              backgroundColor:
                isHighlighted &&
                highlightRange.length > 0 &&
                startIdx >= highlightRange.start &&
                startIdx < highlightRange.start + highlightRange.length
                  ? "rgba(0, 122, 255, 0.15)"
                  : "transparent",
              borderRadius: "4px",
            }}
            className="hover-word reset-button interactive-word"
          >
            {token}
          </button>
        );
      } else {
        elements.push(
          <span
            key={startIdx}
            style={{
              color: isHighlighted ? "inherit" : isDimmed ? "var(--text-muted)" : "inherit",
              opacity: isDimmed ? 0.6 : 1,
            }}
          >
            {token}
          </span>
        );
      }

      globalOffset += token.length;
    }

    interactiveParagraphs.push(
      <div key={paragraph.id || paragraphIndex} style={{ marginBottom: "1.2rem", position: "relative" }}>
        <p lang="fr" style={{ margin: 0 }}>
          {elements}
        </p>
      </div>
    );

    globalOffset += 1;
  });

  const quiz = levelData.quiz || [];
  const quizComplete = (quiz.length > 0 && quizIndex >= quiz.length) || Boolean(completion);

  return (
    <main className="view reading-view fade-in">
      {formatDriveUrl(article.imageUrl) && (
        <div className="article-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={formatDriveUrl(article.imageUrl)}
            alt={typeof levelData.title === "string" ? levelData.title : levelData.title?.fr}
            referrerPolicy="no-referrer"
            onError={(event) => {
              const id = extractDriveId(article.imageUrl);
              const fallback = id
                ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000`
                : "";
              if (fallback && event.currentTarget.src !== fallback) {
                event.currentTarget.src = fallback;
              }
            }}
          />
        </div>
      )}

      <div className="article-header">
        {article.seriesId && seriesProgress && (
          <p style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "var(--primary)", fontWeight: 800 }}>
            {article.seriesId.replace(/_/g, " ")} • {seriesProgress.currentIndex + 1} / {seriesProgress.total}
          </p>
        )}
        <h2 lang="fr">{typeof levelData.title === "string" ? levelData.title : levelData.title.fr}</h2>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "10px",
          }}
        >
          <span className="badge" style={{ fontSize: "0.85rem" }}>
            {t.levels[globalLevel as keyof typeof t.levels] || globalLevel}
          </span>
          <span
            className="badge"
            style={{
              background: "#E5E5EA",
              color: "#636366",
              fontSize: "0.85rem",
            }}
          >
            {typeof article.category === "string" ? article.category : (article.category?.[appLang] || article.category?.ja || "General")}
          </span>
          {article.date && (
            <span
              style={{
                color: "var(--text-muted)",
                fontSize: "0.85rem",
                marginLeft: "auto",
              }}
            >
              {new Date(article.date).toLocaleDateString("ja-JP")}
            </span>
          )}
        </div>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            marginTop: "10px",
          }}
        >
          {t.reading.tapHint}
        </p>
      </div>

      {levelData.learningGoal && (
        <div style={{ marginBottom: "20px", padding: "16px", borderRadius: "16px", background: "rgba(0, 122, 255, 0.05)" }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "1.05rem", color: "var(--primary)", fontWeight: 800 }}>
            {appLang === "ja" ? "この記事で学ぶこと" : "What you will learn"}
          </h3>
          <p style={{ margin: "0", fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)", lineHeight: "1.5" }}>
            {typeof levelData.learningGoal === "string"
              ? levelData.learningGoal
              : levelData.learningGoal[appLang === "ja" ? "ja" : "en"] || levelData.learningGoal.ja}
          </p>
        </div>
      )}
      {levelData.targetVocabulary && levelData.targetVocabulary.length > 0 && (
        <div style={{ marginBottom: "32px", padding: "16px", borderRadius: "16px", background: "var(--bg)", border: "1px solid var(--border)" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "1.05rem", color: "var(--text-main)", fontWeight: 800 }}>
            {appLang === "ja" ? "今日の単語" : "Today's Vocabulary"}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {levelData.targetVocabulary.slice(0, 5).map(renderVocabularyItem)}
          </div>
        </div>
      )}

      <div className="article-content" lang="fr">
        {interactiveParagraphs}
      </div>

      {quizComplete ? (
        <div className="quiz-section">
          {completion && <CompletionScreen completion={completion} appLang={appLang} t={t} />}
        </div>
      ) : quiz.length > 0 ? (
        <div className="quiz-section">
          <h3>🧠 {appLang === "ja" ? "理解度チェック" : "Comprehension Check"}</h3>
          {(() => {
            const question = quiz[quizIndex];
            let normalizedChoices: QuizChoice[] = [];

            if (question.choices) {
              normalizedChoices = question.choices;
            } else if (Array.isArray(question.options)) {
              normalizedChoices = question.options as QuizChoice[];
            } else if (question.options && typeof question.options === "object") {
              normalizedChoices = Object.entries(question.options).map(([key, value]) => ({
                id: key,
                text: { fr: String(value), ja: String(value), en: String(value) },
                isCorrect: question.answer === key,
              }));
            }

            if (normalizedChoices.length === 0) {
              return null;
            }

            const questionId = question.id;
            const isTranslated = !!translatedQuizIds[questionId];

            return (
              <div className="quiz-card fade-in" key={quizIndex}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <p
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      margin: 0,
                    }}
                  >
                    Q {quizIndex + 1} / {quiz.length}
                  </p>
                  <button
                    onClick={() => onToggleQuestionTranslation(questionId)}
                    style={{
                      background: "none", border: "none", color: "var(--primary)",
                      fontSize: "0.75rem", cursor: "pointer", fontWeight: 700,
                    }}
                  >
                    {isTranslated ? t.reading.hideTranslation : t.reading.translateQuestion}
                  </button>
                </div>

                <p style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px", lineHeight: "1.4" }} lang="fr">
                  {(question.question?.fr || question.prompt?.fr)}
                </p>
                {isTranslated && (
                  <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "16px", marginTop: "0" }}>
                    {appLang === "ja" ? (question.question?.ja || question.prompt?.ja) : (question.question?.en || question.prompt?.en)}
                  </p>
                )}
                {!isTranslated && <div style={{ height: "16px" }} />}

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {normalizedChoices.map((choice, choiceIndex) => {
                    const key = choice.id || String(choiceIndex);
                    const isChosen = selectedAnswer === key;
                    const isCorrectOption = choice.isCorrect;

                    let statusClass = "";
                    if (selectedAnswer !== null) {
                      if (isCorrectOption) statusClass = "correct";
                      else if (isChosen) statusClass = "incorrect";
                    }

                    return (
                      <button
                        key={key}
                        disabled={selectedAnswer !== null}
                        className={`quiz-option ${statusClass}`}
                        onClick={() => onSelectAnswer(key, isCorrectOption)}
                        style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}
                      >
                        <span lang="fr">{choiceIndex + 1}. {choice.text.fr}</span>
                        {isTranslated && (
                          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
                            {appLang === "ja" ? choice.text.ja : choice.text.en}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedAnswer !== null && (
                  <div
                    className={`quiz-feedback-text ${
                      (question.choices || (Array.isArray(question.options) ? question.options : [])).find((choice) => choice.id === selectedAnswer)?.isCorrect
                        ? "text-correct"
                        : "text-incorrect"
                    }`}
                  >
                    {(question.choices || (Array.isArray(question.options) ? question.options : [])).find((choice) => choice.id === selectedAnswer)?.isCorrect
                      ? `⭕ ${t.quiz.correct}`
                      : `❌ ${t.quiz.wrong}`}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="quiz-section" style={{ textAlign: "center", marginTop: "40px" }}>
          <button
            onClick={onCompleteWithoutQuiz}
            style={{ width: "100%", padding: "16px", borderRadius: "16px", border: "none", background: "var(--primary)", color: "white", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer" }}
          >
            {appLang === "ja" ? "🎉 読み終わった" : "🎉 Finished Reading"}
          </button>
        </div>
      )}
    </main>
  );
}

function CompletionScreen({
  completion,
  appLang,
  t,
}: {
  completion: ReadingCompletion;
  appLang: AppLanguage;
  t: ReturnType<typeof getTranslation>;
}) {
  return (
    <div className="quiz-card fade-in" style={{ textAlign: "center", padding: "32px 24px" }}>
      <h2 style={{ fontSize: "1.5rem", marginBottom: "24px", color: "var(--text-main)", fontWeight: 800 }}>
        {appLang === "ja" ? "🎉 記事を完了しました" : "🎉 Article Completed"}
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px", background: "var(--bg)", padding: "16px 20px", borderRadius: "16px", textAlign: "left" }}>
        {completion.hasQuiz && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>{appLang === "ja" ? "スコア" : "Score"}</span>
            <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>{completion.quizScore} / {completion.quizQuestionCount}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>{appLang === "ja" ? "獲得 XP" : "Earned XP"}</span>
          <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--primary)" }}>
            {completion.reward === null ? "..." : `+${completion.reward.xp} XP`}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>{t.progress.streak}</span>
          <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#ff9500" }}>🔥 {completion.streak} {t.progress.days}</span>
        </div>
        {completion.reward !== null && completion.reward.vocab > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>{appLang === "ja" ? "新出単語" : "New Words"}</span>
            <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>📚 {completion.reward.vocab} {appLang === "ja" ? "件" : "items"}</span>
          </div>
        )}
        {completion.dueReviewCount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>{appLang === "ja" ? "復習待ち" : "Due for Review"}</span>
            <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--primary)" }}>🔄 {completion.dueReviewCount} {appLang === "ja" ? "件" : "items"}</span>
          </div>
        )}
      </div>

      {completion.seriesId && completion.seriesIndex !== null && completion.seriesTotal !== null && (
        <div style={{ marginBottom: "28px", padding: "16px", borderRadius: "16px", border: "1px solid var(--border)", background: "var(--bg)" }}>
          <p style={{ margin: "0 0 6px 0", fontSize: "0.95rem", color: "var(--primary)", fontWeight: 800 }}>
            {completion.seriesId.replace(/_/g, " ")}
          </p>
          <p style={{ margin: "0", fontWeight: 700, color: "var(--text-main)" }}>
            Article {completion.seriesIndex + 1} / {completion.seriesTotal}
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {completion.hasVocabToReview && (
          <button
            type="button"
            onClick={completion.onReviewVocabulary}
            style={{ width: "100%", padding: "14px", borderRadius: "16px", border: "none", background: "var(--primary)", color: "white", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            🔄 {appLang === "ja" ? "単語を復習する" : "Review Vocabulary"}
          </button>
        )}

        {completion.seriesId ? (
          completion.hasNextEpisode ? (
            <button
              onClick={completion.onNextEpisode}
              style={{ width: "100%", padding: "14px", borderRadius: "16px", border: completion.hasVocabToReview ? "2px solid var(--primary)" : "none", background: completion.hasVocabToReview ? "var(--bg)" : "var(--primary)", color: completion.hasVocabToReview ? "var(--primary)" : "white", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer" }}
            >
              {appLang === "ja" ? "次のエピソード" : "Next Episode"}
            </button>
          ) : (
            <div style={{ width: "100%", padding: "14px", borderRadius: "16px", background: "rgba(76, 217, 100, 0.15)", color: "#2e7d32", fontSize: "1.05rem", fontWeight: 800, textAlign: "center", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "1.1rem" }}>{appLang === "ja" ? "🏆 シリーズ完了" : "🏆 Series Completed"}</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{appLang === "ja" ? "このシリーズのすべてのエピソードを読み終えました。" : "You have finished all episodes in this series."}</span>
            </div>
          )
        ) : (
          <button
            onClick={completion.onNextArticle}
            style={{ width: "100%", padding: "14px", borderRadius: "16px", border: completion.hasVocabToReview ? "2px solid var(--primary)" : "none", background: completion.hasVocabToReview ? "var(--bg)" : "var(--primary)", color: completion.hasVocabToReview ? "var(--primary)" : "white", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer" }}
          >
            {appLang === "ja" ? "次の記事" : "Next Article"}
          </button>
        )}

        <button
          onClick={completion.onBackHome}
          style={{ width: "100%", padding: "14px", borderRadius: "16px", border: "none", background: "var(--bg)", color: "var(--text-main)", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer" }}
        >
          {appLang === "ja" ? "ホームへ戻る" : "Back to Home"}
        </button>
      </div>
    </div>
  );
}
