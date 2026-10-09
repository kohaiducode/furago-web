"use client";

import type { CSSProperties } from "react";
import type { SavedWord } from "@/lib/userState";
import type { AppLanguage } from "@/lib/i18n";

export interface VocabReviewAction {
  label: string;
  onClick: () => void;
}

export interface VocabReviewViewProps {
  appLang: AppLanguage;
  words: SavedWord[];
  answers: string[][];
  index: number;
  selectedAnswer: string | null;
  dueRemaining: number;
  onBack: () => void;
  onMarkKnown: (word: SavedWord) => void;
  onAnswer: (word: SavedWord, answer: string, isCorrect: boolean) => void;
  primaryAction: VocabReviewAction;
  secondaryAction: VocabReviewAction | null;
}

const primaryStyle: CSSProperties = {
  width: '100%',
  padding: '16px',
  borderRadius: '16px',
  background: 'var(--primary)',
  color: 'white',
  fontSize: '1.05rem',
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
};

const secondaryStyle: CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: '16px',
  background: 'var(--bg)',
  color: 'var(--text-main)',
  fontSize: '0.98rem',
  fontWeight: 600,
  border: '1px solid var(--border)',
  cursor: 'pointer',
};

export default function VocabReviewView({
  appLang,
  words,
  answers,
  index,
  selectedAnswer,
  dueRemaining,
  onBack,
  onMarkKnown,
  onAnswer,
  primaryAction,
  secondaryAction,
}: VocabReviewViewProps) {
  return (
    <main className="view fade-in" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '80vh', justifyContent: 'center' }}>
      {words.length === 0 ? (
        <div className="fade-in" style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--surface)', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📚</div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '16px', color: 'var(--text-main)' }}>
            {appLang === "ja" ? "まだ復習する単語がありません" : "No words to review yet"}
          </h1>
          <p style={{ fontSize: '1.05rem', marginBottom: '32px', color: 'var(--text-muted)' }}>
            {appLang === "ja" ? "もっと記事を読んで、語彙を増やしましょう。" : "Read more articles to expand your vocabulary."}
          </p>
          <button
            onClick={onBack}
            style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--primary)', color: 'white', fontSize: '1.1rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            {appLang === "ja" ? "戻る" : "Back"}
          </button>
        </div>
      ) : index < words.length ? (
        <div className="fade-in">
          <h2 style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '40px' }}>{index + 1} / {words.length}</h2>
          <div style={{ textAlign: 'center', margin: '40px 0' }}>
            <h1 style={{ fontSize: '2.5rem', color: 'var(--text-main)', marginBottom: '20px', fontWeight: 800 }}>{words[index].fr}</h1>
          </div>
          {answers[index].length === 0 ? (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', marginBottom: '16px' }}>{appLang === 'ja' ? 'この単語の意味を確認しましょう' : "Let's check the meaning of this word"}</p>
              <div style={{ fontSize: '1.5rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '32px' }}>
                {words[index].conciseDef || words[index].ja}
              </div>
              <button
                onClick={() => onMarkKnown(words[index])}
                style={{ padding: '16px', borderRadius: '16px', background: 'var(--primary)', color: 'white', fontSize: '1.1rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                {appLang === "ja" ? "覚えた" : "I know this"}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {answers[index].map((ans, i) => {
                const isCorrect = ans === (words[index].conciseDef || words[index].ja);
                let bg = "var(--surface)";
                let color = "var(--text-main)";
                let border = "1px solid var(--border)";

                if (selectedAnswer !== null) {
                  if (isCorrect) {
                    bg = "rgba(76, 217, 100, 0.1)";
                    color = "#4cd964";
                    border = "1px solid #4cd964";
                  } else if (selectedAnswer === ans) {
                    bg = "rgba(255, 59, 48, 0.1)";
                    color = "#ff3b30";
                    border = "1px solid #ff3b30";
                  }
                }

                return (
                  <button
                    key={i}
                    disabled={selectedAnswer !== null}
                    onClick={() => onAnswer(words[index], ans, isCorrect)}
                    style={{
                      padding: '16px',
                      borderRadius: '16px',
                      background: bg,
                      color: color,
                      border: border,
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      cursor: selectedAnswer !== null ? 'default' : 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      boxShadow: selectedAnswer === null ? '0 2px 8px rgba(0,0,0,0.04)' : 'none'
                    }}
                  >
                    {ans}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="fade-in" style={{ textAlign: 'center', padding: '36px 20px', background: 'var(--surface)', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>
            {dueRemaining === 0 ? "🎉" : "✨"}
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '12px', color: 'var(--text-main)', fontWeight: 800 }}>
            {dueRemaining === 0
              ? (appLang === "ja" ? "復習完了！" : "Review Completed!")
              : (appLang === "ja" ? "セッション完了！" : "Session Completed!")}
          </h1>
          <p style={{ fontSize: '1.05rem', marginBottom: '28px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {dueRemaining === 0
              ? (appLang === "ja" ? "🎉 すべての復習が完了しました！" : "🎉 All reviews are up to date!")
              : (appLang === "ja"
                  ? `あと${dueRemaining}語の復習が残っています`
                  : `You have ${dueRemaining} ${dueRemaining === 1 ? 'word' : 'words'} left to review`)}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '420px', margin: '0 auto', width: '100%' }}>
            <button onClick={primaryAction.onClick} style={primaryStyle}>
              {primaryAction.label}
            </button>
            {secondaryAction && (
              <button onClick={secondaryAction.onClick} style={secondaryStyle}>
                {secondaryAction.label}
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
