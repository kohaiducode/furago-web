import sys
import re

with open("src/components/FuragoApp.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports and Types
types_old = """export interface QuizQuestion {
  text: string;
  options: Record<string, string>;
  answer: string;
}

export interface ArticleLevelData {
  title: string;
  content: string;
  quiz?: QuizQuestion[];
}

export interface Article {
  id: number | string;
  date?: string;
  originalTitle?: string;
  category?: string;
  imageUrl?: string;
  levels: Record<string, ArticleLevelData>;
}"""

types_new = """import { getTranslation, AppLanguage } from "@/lib/i18n";

export interface TranslatableText {
  fr: string;
  ja: string;
  en: string;
}

export interface Paragraph {
  id: string;
  fr: string;
  ja: string;
  en: string;
}

export interface QuizChoice {
  id: string;
  text: TranslatableText;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  question: TranslatableText;
  choices?: QuizChoice[];
  // For backwards compatibility with old mock data
  text?: string;
  options?: Record<string, string>;
  answer?: string;
}

export interface ArticleLevelData {
  title: string | TranslatableText;
  paragraphs: Paragraph[];
  quiz?: QuizQuestion[];
  // For backwards compatibility
  content?: string;
}

export type Category = TranslatableText | string;

export interface Article {
  id: number | string;
  date?: string;
  originalTitle?: string;
  category?: Category;
  imageUrl?: string;
  levels: Record<string, ArticleLevelData>;
}"""

content = content.replace(types_old, types_new)

# 2. Add appLang state, showTranslation state, translatedQuizIds state, remove leadGender
states_old = """  // Article Selection
  const [currentArticleId, setCurrentArticleId] = useState<number | string | null>(null);
  const [globalLevel, setGlobalLevel] = useState<string>("B1");

  // Lead Generation States
  const [showLeadBar, setShowLeadBar] = useState<boolean>(true);
  const [leadModalOpen, setLeadModalOpen] = useState<boolean>(false);
  const [leadStep, setLeadStep] = useState<number>(1);
  const [leadFirstName, setLeadFirstName] = useState<string>("");
  const [leadEmail, setLeadEmail] = useState<string>("");
  const [leadGender, setLeadGender] = useState<string>("");
  const [leadLevel, setLeadLevel] = useState<string>("A1");
  const [leadCategories, setLeadCategories] = useState<string[]>([]);
  const [leadCheckingEmail, setLeadCheckingEmail] = useState<boolean>(false);
  const [leadSubmitting, setLeadSubmitting] = useState<boolean>(false);
  const [leadError, setLeadError] = useState<string | null>(null);"""

states_new = """  // i18n States
  const [appLang, setAppLang] = useState<AppLanguage>("ja");
  const t = getTranslation(appLang);
  const [showTranslation, setShowTranslation] = useState<boolean>(false);
  const [translatedQuizIds, setTranslatedQuizIds] = useState<Record<string, boolean>>({});

  // Article Selection
  const [currentArticleId, setCurrentArticleId] = useState<number | string | null>(null);
  const [globalLevel, setGlobalLevel] = useState<string>("LVL_1");

  // Lead Generation States
  const [showLeadBar, setShowLeadBar] = useState<boolean>(true);
  const [leadModalOpen, setLeadModalOpen] = useState<boolean>(false);
  const [leadStep, setLeadStep] = useState<number>(1);
  const [leadFirstName, setLeadFirstName] = useState<string>("");
  const [leadEmail, setLeadEmail] = useState<string>("");
  const [leadLevel, setLeadLevel] = useState<string>("LVL_1");
  const [leadCategories, setLeadCategories] = useState<string[]>([]);
  const [leadCheckingEmail, setLeadCheckingEmail] = useState<boolean>(false);
  const [leadSubmitting, setLeadSubmitting] = useState<boolean>(false);
  const [leadError, setLeadError] = useState<string | null>(null);"""

content = content.replace(states_old, states_new)

# 3. LEVELS array
levels_old = """const LEVELS = ["A1", "A2", "B1", "B2", "C1"];"""
levels_new = """const LEVELS = ["LVL_1", "LVL_2", "LVL_3", "LVL_4"];"""
content = content.replace(levels_old, levels_new)

# 4. buildQueueForText modification
build_old = """  const buildQueueForText = useCallback((text: string) => {
    const q: TtsQueueItem[] = [];
    let currentIndex = 0;
    const regex = /[^.!?\\n]+[.!?\\n]*\\s*/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match[0].trim().length > 0) {
        q.push({
          text: match[0],
          start: currentIndex,
          length: match[0].length,
        });
      }
      currentIndex += match[0].length;
    }
    ttsQueueRef.current = q;
    setTtsQueue(q);
    queueIndexRef.current = 0;
    setQueueIndex(0);
    return q;
  }, []);"""

build_new = """  const buildQueueForText = useCallback((paragraphs: Paragraph[]) => {
    const q: TtsQueueItem[] = [];
    let currentIndex = 0;
    const regex = /[^.!?\\n]+[.!?\\n]*\\s*/g;
    let match: RegExpExecArray | null;
    paragraphs.forEach((p) => {
      const text = p.fr;
      let offset = currentIndex;
      while ((match = regex.exec(text)) !== null) {
        if (match[0].trim().length > 0) {
          q.push({
            text: match[0],
            start: offset + match.index,
            length: match[0].length,
          });
        }
      }
      currentIndex += text.length + 1;
    });

    ttsQueueRef.current = q;
    setTtsQueue(q);
    queueIndexRef.current = 0;
    setQueueIndex(0);
    return q;
  }, []);"""
content = content.replace(build_old, build_new)

# 5. renderInteractiveContent
render_old = """  const renderInteractiveContent = (text: string) => {
    let globalOffset = 0;
    const elements: React.ReactNode[] = [];
    const tokenRegex = /([a-zA-ZÀ-ÿœæŒÆ]+(?:['’][a-zA-ZÀ-ÿœæŒÆ]+)?)|([^a-zA-ZÀ-ÿœæŒÆ]+)/g;
    let match;

    const sentenceItem = ttsQueue[queueIndex];
    let sentenceStart = -1;
    let sentenceEnd = -1;
    if (sentenceItem) {
      sentenceStart = sentenceItem.start;
      sentenceEnd = sentenceItem.start + sentenceItem.length;
    }

    while ((match = tokenRegex.exec(text)) !== null) {
      const token = match[0];
      const startIdx = globalOffset;
      const endIdx = globalOffset + token.length;

      const isWord = /[a-zA-ZÀ-ÿœæŒÆ]/.test(token);
      let isHighlighted = false;
      let isDimmed = false;

      if (sentenceStart !== -1 && sentenceEnd !== -1) {
        if (startIdx >= sentenceStart && startIdx < sentenceEnd) {
          isHighlighted = true;
          if (
            highlightRange.length > 0 &&
            startIdx >= sentenceStart + highlightRange.start &&
            startIdx < sentenceStart + highlightRange.start + highlightRange.length
          ) {
          }
        } else {
          isDimmed = true;
        }
      }

      if (isWord) {
        elements.push(
          <span
            key={startIdx}
            onClick={() => handleWordClick(token)}
            style={{
              cursor: "pointer",
              transition: "all 0.15s",
              color: isHighlighted
                ? "var(--primary)"
                : isDimmed
                  ? "var(--text-muted)"
                  : "inherit",
              opacity: isDimmed ? 0.6 : 1,
              backgroundColor:
                isHighlighted &&
                highlightRange.length > 0 &&
                startIdx >= sentenceStart + highlightRange.start &&
                startIdx < sentenceStart + highlightRange.start + highlightRange.length
                  ? "rgba(0, 122, 255, 0.15)"
                  : "transparent",
              borderRadius: "4px",
            }}
            className="hover-word"
          >
            {token}
          </span>
        );
      } else {
        if (token.includes("\\n")) {
          const parts = token.split("\\n");
          parts.forEach((p, idx) => {
            elements.push(
              <span
                key={`${startIdx}-${idx}`}
                style={{
                  color: isHighlighted ? "inherit" : isDimmed ? "var(--text-muted)" : "inherit",
                  opacity: isDimmed ? 0.6 : 1,
                }}
              >
                {p}
              </span>
            );
            if (idx < parts.length - 1) {
              elements.push(<br key={`br-${startIdx}-${idx}`} />);
            }
          });
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
      }

      globalOffset += token.length;
    }
    return elements;
  };"""

render_new = """  const renderInteractiveContent = (paragraphs: Paragraph[]) => {
    let globalOffset = 0;
    const allElements: React.ReactNode[] = [];

    const sentenceItem = ttsQueue[queueIndex];
    let sentenceStart = -1;
    let sentenceEnd = -1;
    if (sentenceItem) {
      sentenceStart = sentenceItem.start;
      sentenceEnd = sentenceItem.start + sentenceItem.length;
    }

    paragraphs.forEach((p, pIdx) => {
      const text = p.fr;
      const elements: React.ReactNode[] = [];
      const tokenRegex = /([a-zA-ZÀ-ÿœæŒÆ]+(?:['’][a-zA-ZÀ-ÿœæŒÆ]+)?)|([^a-zA-ZÀ-ÿœæŒÆ]+)/g;
      let match;

      while ((match = tokenRegex.exec(text)) !== null) {
        const token = match[0];
        const startIdx = globalOffset;
        const endIdx = globalOffset + token.length;

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
            <span
              key={startIdx}
              onClick={() => handleWordClick(token)}
              style={{
                cursor: "pointer",
                transition: "all 0.15s",
                color: isHighlighted ? "var(--primary)" : isDimmed ? "var(--text-muted)" : "inherit",
                opacity: isDimmed ? 0.6 : 1,
                backgroundColor:
                  isHighlighted &&
                  highlightRange.length > 0 &&
                  startIdx >= sentenceStart + highlightRange.start &&
                  startIdx < sentenceStart + highlightRange.start + highlightRange.length
                    ? "rgba(0, 122, 255, 0.15)"
                    : "transparent",
                borderRadius: "4px",
              }}
              className="hover-word"
            >
              {token}
            </span>
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
      
      const transText = appLang === 'ja' ? p.ja : p.en;
      allElements.push(
        <div key={p.id || pIdx} style={{ marginBottom: "1.2rem" }}>
          <p lang="fr">
             {elements}
          </p>
          {showTranslation && transText && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginTop: "4px", paddingLeft: "8px", borderLeft: "3px solid var(--border)" }}>
              {transText}
            </p>
          )}
        </div>
      );
      
      globalOffset += 1;
    });
    
    return allElements;
  };"""
content = content.replace(render_old, render_new)

# Replace usages of buildQueueForText(levelData.content)
content = content.replace("buildQueueForText(levelData.content);", "buildQueueForText(levelData.paragraphs);")
content = content.replace("buildQueueForText(currentArticle.levels[lvl].content);", "buildQueueForText(currentArticle.levels[lvl].paragraphs);")
content = content.replace("buildQueueForText(article.levels[globalLevel].content);", "buildQueueForText(article.levels[globalLevel].paragraphs);")

# Header & Lead Bar
header_old = """      {/* Top Bar - Capture d'emails (Lead Generation) */}
      {showLeadBar && (
        <div className="lead-bar">
          <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
            新着記事・先行案内
          </span>
          <form className="lead-bar-form" onSubmit={handleOpenLeadModal}>
            <input
              type="email"
              value={leadEmail}
              onChange={(e) => setLeadEmail(e.target.value)}
              placeholder="メールアドレス"
              className="lead-bar-input"
            />
            <button type="submit" className="lead-bar-btn">
              登録
            </button>
            <button
              type="button"
              onClick={() => setShowLeadBar(false)}
              aria-label="閉じる"
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.8)",
                cursor: "pointer",
                padding: "2px 4px",
                fontSize: "1rem",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </form>
        </div>
      )}

      {/* App Header */}
      <header className="app-header">
        {activeView === "reading" && (
          <button
            className="back-btn"
            onClick={() => {
              stopAudio();
              setDictOpen(false);
              setActiveView("home");
            }}
            aria-label="戻る"
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        )}
        <h1>Furago</h1>
        {activeView === "reading" && (
          <button
            className="header-level-btn"
            onClick={() => setFilterModalType("level")}
          >
            レベル {globalLevel} ▾
          </button>
        )}
      </header>"""

header_new = """      {/* App Header (Redesigned for Professional UI/UX) */}
      <header className="app-header" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 100 }}>
        {activeView === "reading" && (
          <button
            className="back-btn"
            onClick={() => {
              stopAudio();
              setDictOpen(false);
              setActiveView("home");
            }}
            aria-label="Back"
            style={{ marginRight: '12px', padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        )}
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--primary)', letterSpacing: '-0.5px' }}>{t.appTitle}</h1>
        
        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', alignItems: 'center' }}>
            {activeView === "reading" && (
            <button
                className="header-level-btn"
                onClick={() => setFilterModalType("level")}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '4px 10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: 'var(--text-main)' }}
            >
                {t.levels[globalLevel as keyof typeof t.levels] || globalLevel} ▾
            </button>
            )}
            <div style={{ position: 'relative' }}>
              <select 
                value={appLang} 
                onChange={(e) => setAppLang(e.target.value as AppLanguage)}
                style={{
                    appearance: 'none',
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "16px",
                    padding: "4px 24px 4px 10px",
                    color: "var(--text-main)",
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    outline: "none",
                    cursor: "pointer"
                }}
              >
                  <option value="ja">🇯🇵 JP</option>
                  <option value="en">🇬🇧 EN</option>
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                  <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            
            {showLeadBar && (
              <button 
                onClick={(e) => { e.preventDefault(); handleOpenLeadModal(e); }}
                style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '16px', padding: '5px 12px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                {t.nav.register}
              </button>
            )}
        </div>
      </header>"""
content = content.replace(header_old, header_new)

# Reading Article Header Title & Translations toggle
reading_old = """          <div className="article-header">
            <h2 lang="fr">{currentLevelData.title}</h2>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "10px",
              }}
            >
              <span className="badge" style={{ fontSize: "0.85rem" }}>
                {globalLevel}
              </span>
              <span
                className="badge"
                style={{
                  background: "#E5E5EA",
                  color: "#636366",
                  fontSize: "0.85rem",
                }}
              >
                {currentArticle.category || "一般"}
              </span>
            </div>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginTop: "10px",
              }}
            >
              💡 単語をタップ（またはクリック）すると日本語の意味と文脈翻訳が表示されます
            </p>
          </div>

          <div className="article-content" lang="fr">
            {renderInteractiveContent(currentLevelData.content)}
          </div>"""

reading_new = """          <div className="article-header">
            <h2 lang="fr">{typeof currentLevelData.title === 'string' ? currentLevelData.title : currentLevelData.title?.fr}</h2>
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
                  textTransform: "capitalize"
                }}
              >
                {typeof currentArticle.category === 'string' ? currentArticle.category : currentArticle.category?.[appLang] || "General"}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: "10px" }}>
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                  }}
                >
                  💡 {appLang === 'ja' ? '単語をタップすると辞書が開きます' : 'Tap a word to open the dictionary'}
                </p>
                <button
                    onClick={() => setShowTranslation(!showTranslation)}
                    style={{
                        background: showTranslation ? "var(--primary)" : "transparent",
                        color: showTranslation ? "var(--text-main)" : "var(--primary)",
                        border: "1px solid var(--primary)",
                        padding: "6px 12px",
                        borderRadius: "12px",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer"
                    }}
                >
                    {showTranslation ? t.reading.hideTranslation : t.reading.showTranslation}
                </button>
            </div>
          </div>

          <div className="article-content">
            {renderInteractiveContent(currentLevelData.paragraphs)}
          </div>"""
content = content.replace(reading_old, reading_new)

# Quiz translation logic
quiz_old = """          {/* Comprehension Quiz */}
          {currentLevelData.quiz && currentLevelData.quiz.length > 0 && (
            <div className="quiz-section">
              <h3>🧠 理解度クイズ</h3>
              {quizIndex >= currentLevelData.quiz.length ? (
                <div className="quiz-card fade-in" style={{ textAlign: "center" }}>
                  <h4
                    style={{
                      fontSize: "1.7rem",
                      marginBottom: "10px",
                      color: "var(--primary)",
                    }}
                  >
                    スコア: {quizScore} / {currentLevelData.quiz.length}
                  </h4>
                  <p
                    style={{
                      fontSize: "1.15rem",
                      fontWeight: 700,
                      marginBottom: "20px",
                    }}
                  >
                    {quizScore === currentLevelData.quiz.length
                      ? "素晴らしい！🎉"
                      : quizScore >= currentLevelData.quiz.length / 2
                        ? "よくできました！👏"
                        : "もう一度挑戦しよう！💪"}
                  </p>
                  <button
                    onClick={() => {
                      setQuizIndex(0);
                      setQuizScore(0);
                      setSelectedAnswer(null);
                    }}
                    style={{
                      background: "var(--primary)",
                      color: "white",
                      border: "none",
                      padding: "12px 24px",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    もう一度やる
                  </button>
                </div>
              ) : (
                (() => {
                  const q = currentLevelData.quiz[quizIndex];
                  const correctKey = q.answer.trim().toUpperCase();
                  return (
                    <div className="quiz-card fade-in" key={quizIndex}>
                      <p
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.88rem",
                          marginBottom: "8px",
                          fontWeight: 700,
                        }}
                      >
                        質問 {quizIndex + 1} / {currentLevelData.quiz.length}
                      </p>
                      <p className="quiz-question" lang="fr">
                        {q.text}
                      </p>
                      <div>
                        {["A", "B", "C", "D"].map((key) => {
                          if (!q.options[key]) return null;
                          const isChosen = selectedAnswer === key;
                          const isCorrectOption = key === correctKey;

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
                              lang="fr"
                              onClick={() => {
                                setSelectedAnswer(key);
                                if (key === correctKey) {
                                  setQuizScore((s) => s + 1);
                                }
                                setTimeout(() => {
                                  setSelectedAnswer(null);
                                  setQuizIndex((idx) => idx + 1);
                                }, 1700);
                              }}
                            >
                              {key}. {q.options[key]}
                            </button>
                          );
                        })}
                      </div>
                      {selectedAnswer !== null && (
                        <div
                          className={`quiz-feedback-text ${
                            selectedAnswer === correctKey
                              ? "text-correct"
                              : "text-incorrect"
                          }`}
                        >
                          {selectedAnswer === correctKey
                            ? "⭕ 正解！"
                            : "❌ 不正解..."}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          )}"""

quiz_new = """          {/* Comprehension Quiz */}
          {currentLevelData.quiz && currentLevelData.quiz.length > 0 && (
            <div className="quiz-section">
              <h3>🧠 {t.reading.quiz}</h3>
              {quizIndex >= currentLevelData.quiz.length ? (
                <div className="quiz-card fade-in" style={{ textAlign: "center" }}>
                  <h4
                    style={{
                      fontSize: "1.7rem",
                      marginBottom: "10px",
                      color: "var(--primary)",
                    }}
                  >
                    {t.quiz.score}: {quizScore} {t.quiz.outOf} {currentLevelData.quiz.length}
                  </h4>
                  <p
                    style={{
                      fontSize: "1.15rem",
                      fontWeight: 700,
                      marginBottom: "20px",
                    }}
                  >
                    {quizScore === currentLevelData.quiz.length
                      ? "Excellent! 🎉"
                      : quizScore >= currentLevelData.quiz.length / 2
                        ? "Good job! 👏"
                        : "Try again! 💪"}
                  </p>
                  <button
                    onClick={() => {
                      setQuizIndex(0);
                      setQuizScore(0);
                      setSelectedAnswer(null);
                    }}
                    style={{
                      background: "var(--primary)",
                      color: "white",
                      border: "none",
                      padding: "12px 24px",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {t.quiz.finish} / {appLang === 'ja' ? 'もう一度やる' : 'Try Again'}
                  </button>
                </div>
              ) : (
                (() => {
                  const q = currentLevelData.quiz[quizIndex];
                  if (!q.choices && (q as any).options) {
                    return null;
                  }
                  
                  const qId = q.id;
                  const isQTranslated = !!translatedQuizIds[qId];

                  return (
                    <div className="quiz-card fade-in" key={quizIndex}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <p
                            style={{
                              color: "var(--text-muted)",
                              fontSize: "0.88rem",
                              fontWeight: 700,
                              margin: 0
                            }}
                          >
                            Q {quizIndex + 1} / {currentLevelData.quiz.length}
                          </p>
                          <button
                            onClick={() => setTranslatedQuizIds(prev => ({...prev, [qId]: !prev[qId]}))}
                            style={{
                                background: "none", border: "none", color: "var(--primary)",
                                fontSize: "0.75rem", cursor: "pointer", fontWeight: 700
                            }}
                          >
                            {isQTranslated ? t.reading.hideTranslation : t.reading.translateQuestion}
                          </button>
                      </div>
                      
                      <p className="quiz-question" lang="fr">
                        {q.question.fr}
                      </p>
                      {isQTranslated && (
                          <p className="quiz-question" style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '-10px', marginBottom: '20px' }}>
                              {appLang === 'ja' ? q.question.ja : q.question.en}
                          </p>
                      )}
                      
                      <div>
                        {q.choices?.map((choice, cIdx) => {
                          const key = choice.id;
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
                              onClick={() => {
                                setSelectedAnswer(key);
                                if (isCorrectOption) {
                                  setQuizScore((s) => s + 1);
                                }
                                setTimeout(() => {
                                  setSelectedAnswer(null);
                                  setQuizIndex((idx) => idx + 1);
                                }, 1700);
                              }}
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                            >
                              <span lang="fr">{cIdx + 1}. {choice.text.fr}</span>
                              {isQTranslated && (
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                      {appLang === 'ja' ? choice.text.ja : choice.text.en}
                                  </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {selectedAnswer !== null && (
                        <div
                          className={`quiz-feedback-text ${
                            q.choices?.find(c => c.id === selectedAnswer)?.isCorrect
                              ? "text-correct"
                              : "text-incorrect"
                          }`}
                        >
                          {q.choices?.find(c => c.id === selectedAnswer)?.isCorrect
                            ? `⭕ ${t.quiz.correct}`
                            : `❌ ${t.quiz.wrong}`}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          )}"""
content = content.replace(quiz_old, quiz_new)

# Audio Speed Options
audio_speed_old = """          <select
            className="audio-select"
            value={audioSpeed}
            onChange={(e) => {
              const rate = parseFloat(e.target.value);
              setAudioSpeed(rate);
              audioSpeedRef.current = rate;
              if (isPlayingRef.current) {
                window.speechSynthesis?.cancel();
                setTimeout(() => playNextInQueue(), 60);
              }
            }}
          >
            <option value={1}>速度 : 標準 (1x)</option>
            <option value={0.8}>速度 : 遅い (0.8x)</option>
            <option value={0.6}>速度 : とても遅い (0.6x)</option>
            <option value={0.4}>速度 : 最も遅い (0.4x)</option>
          </select>"""
audio_speed_new = """          <select
            className="audio-select"
            value={audioSpeed}
            onChange={(e) => {
              const rate = parseFloat(e.target.value);
              setAudioSpeed(rate);
              audioSpeedRef.current = rate;
              if (isPlayingRef.current) {
                window.speechSynthesis?.cancel();
                setTimeout(() => playNextInQueue(), 60);
              }
            }}
          >
            <option value={1}>{appLang === 'ja' ? '速度 : 標準 (1x)' : 'Speed: Normal (1x)'}</option>
            <option value={0.8}>{appLang === 'ja' ? '速度 : 遅い (0.8x)' : 'Speed: Slow (0.8x)'}</option>
            <option value={0.6}>{appLang === 'ja' ? '速度 : とても遅い (0.6x)' : 'Speed: Very Slow (0.6x)'}</option>
            <option value={0.4}>{appLang === 'ja' ? '速度 : 最も遅い (0.4x)' : 'Speed: Slowest (0.4x)'}</option>
          </select>"""
content = content.replace(audio_speed_old, audio_speed_new)

# Voice Selection Options
voice_select_old = """          <select
            className="audio-select"
            value={selectedVoiceIdx}
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10);
              setSelectedVoiceIdx(idx);
              if (frVoices[idx]) {
                selectedVoiceRef.current = frVoices[idx].voice;
                if (isPlayingRef.current) {
                  window.speechSynthesis?.cancel();
                  setTimeout(() => playNextInQueue(), 60);
                }
              }
            }}
          >
            {frVoices.length === 0 ? (
              <option value={0}>フランス語音声 (標準)</option>
            ) : ("""
voice_select_new = """          <select
            className="audio-select"
            value={selectedVoiceIdx}
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10);
              setSelectedVoiceIdx(idx);
              if (frVoices[idx]) {
                selectedVoiceRef.current = frVoices[idx].voice;
                if (isPlayingRef.current) {
                  window.speechSynthesis?.cancel();
                  setTimeout(() => playNextInQueue(), 60);
                }
              }
            }}
          >
            {frVoices.length === 0 ? (
              <option value={0}>{appLang === 'ja' ? 'フランス語音声 (標準)' : 'French Voice (Default)'}</option>
            ) : ("""
content = content.replace(voice_select_old, voice_select_new)

# Bottom Nav
bottom_nav_old = """        <nav className="bottom-nav">
          <button
            className={`nav-item ${activeView === "home" ? "active" : ""}`}
            onClick={() => {
              stopAudio();
              setDictOpen(false);
              setActiveView("home");
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            記事
          </button>
          <button
            className={`nav-item ${activeView === "words" ? "active" : ""}`}
            onClick={() => {
              stopAudio();
              setDictOpen(false);
              setCurrentListId(null);
              setActiveView("words");
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            単語帳
          </button>
        </nav>"""
bottom_nav_new = """        <nav className="bottom-nav">
          <button
            className={`nav-item ${activeView === "home" ? "active" : ""}`}
            onClick={() => {
              stopAudio();
              setDictOpen(false);
              setActiveView("home");
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            {t.nav.home}
          </button>
          <button
            className={`nav-item ${activeView === "words" ? "active" : ""}`}
            onClick={() => {
              stopAudio();
              setDictOpen(false);
              setCurrentListId(null);
              setActiveView("words");
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            {t.nav.words}
          </button>
        </nav>"""
content = content.replace(bottom_nav_old, bottom_nav_new)

# List category badge
list_cat_old = """                        <span
                          className="badge"
                          style={{
                            background: "var(--bg)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {article.category || "一般"}
                        </span>"""
list_cat_new = """                        <span
                          className="badge"
                          style={{
                            background: "var(--bg)",
                            color: "var(--text-muted)",
                            textTransform: "capitalize"
                          }}
                        >
                          {typeof article.category === "string" ? article.category : article.category?.[appLang] || "General"}
                        </span>"""
content = content.replace(list_cat_old, list_cat_new)


# Modal parsing and replacement - done using split('\n') without escaping
lines = content.split('\n')
start_idx = -1
for i, l in enumerate(lines):
    if '{/* Newsletter 3-Step Profile Registration Modal */}' in l:
        start_idx = i
        break

new_modal = """      {/* Newsletter 3-Step Profile Registration Modal */}
      {leadModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setLeadModalOpen(false)}
        >
          <form
            className="modal-sheet"
            style={{ maxWidth: "440px" }}
            onSubmit={handleLeadProfileSubmit}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header + Close Button */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>
                {t.newsletter.title}
              </h3>
              <button
                type="button"
                onClick={() => setLeadModalOpen(false)}
                style={{
                  background: "var(--bg)",
                  border: "none",
                  borderRadius: "50%",
                  width: "30px",
                  height: "30px",
                  cursor: "pointer",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                }}
              >
                ×
              </button>
            </div>

            {/* Barre de progression 3 etapes */}
            <div style={{ marginBottom: "18px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  marginBottom: "6px",
                }}
              >
                <span>Step {leadStep} / 3</span>
                <span>
                  {leadStep === 1
                    ? t.newsletter.step1
                    : leadStep === 2
                      ? t.newsletter.step2
                      : t.newsletter.step3}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                }}
              >
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    style={{
                      flex: 1,
                      height: "5px",
                      borderRadius: "3px",
                      background:
                        step <= leadStep ? "var(--primary)" : "var(--border)",
                      transition: "background 0.25s ease",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Message d'erreur */}
            {leadError && (
              <div
                style={{
                  background: "rgba(255, 59, 48, 0.1)",
                  border: "1px solid #FF3B30",
                  color: "#D70015",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  fontSize: "0.86rem",
                  fontWeight: 700,
                  marginBottom: "14px",
                  textAlign: "center",
                }}
              >
                {leadError}
              </div>
            )}

            {/* ETAPE 1 : Prenom, Email */}
            {leadStep === 1 && (
              <div className="fade-in">
                <label
                  style={{
                    display: "block",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    marginBottom: "6px",
                  }}
                >
                  {t.newsletter.name}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={leadFirstName}
                  onChange={(e) => {
                    setLeadFirstName(e.target.value);
                    setLeadError(null);
                  }}
                  placeholder={appLang === 'ja' ? "例: 太郎 / Taro" : "e.g. Taro"}
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    fontSize: "0.95rem",
                    marginBottom: "14px",
                    outline: "none",
                  }}
                />

                <label
                  style={{
                    display: "block",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    marginBottom: "6px",
                  }}
                >
                  {t.newsletter.email}
                </label>
                <input
                  type="email"
                  required
                  value={leadEmail}
                  onChange={(e) => {
                    setLeadEmail(e.target.value);
                    setLeadError(null);
                  }}
                  placeholder="example@mail.com"
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    fontSize: "0.95rem",
                    marginBottom: "22px",
                    outline: "none",
                  }}
                />

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setLeadModalOpen(false)}
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      color: "var(--text-main)",
                    }}
                  >
                    {t.newsletter.cancel}
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: "var(--primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {leadCheckingEmail ? (appLang === 'ja' ? "確認中..." : "Checking...") : "Next"}
                  </button>
                </div>
              </div>
            )}

            {/* ETAPE 2 : Niveau de francais */}
            {leadStep === 2 && (
              <div className="fade-in">
                <p
                  style={{
                    fontSize: "0.95rem",
                    marginBottom: "14px",
                    color: "var(--text-main)",
                    fontWeight: 600,
                  }}
                >
                  {appLang === 'ja' ? '現在のフランス語レベルを教えてください。' : 'What is your current French level?'}
                </p>
                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    marginBottom: "22px",
                  }}
                >
                  {[
                    { code: "LVL_1", desc: "Absolute Beginner" },
                    { code: "LVL_2", desc: "Beginner" },
                    { code: "LVL_3", desc: "Intermediate" },
                    { code: "LVL_4", desc: "Advanced" }
                  ].map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        setLeadLevel(item.code);
                        setLeadError(null);
                      }}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "12px",
                        border:
                          leadLevel === item.code
                            ? "2px solid var(--primary)"
                            : "2px solid var(--border)",
                        background:
                          leadLevel === item.code
                            ? "var(--primary-light)"
                            : "var(--surface)",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {t.levels[item.code as keyof typeof t.levels]}
                      </span>
                      {leadLevel === item.code && <span>✔️</span>}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setLeadStep(1)}
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      color: "var(--text-main)",
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: "var(--primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* ETAPE 3 : Categories preferees */}
            {leadStep === 3 && (
              <div className="fade-in">
                <p
                  style={{
                    fontSize: "0.95rem",
                    marginBottom: "14px",
                    color: "var(--text-main)",
                    fontWeight: 600,
                  }}
                >
                  {appLang === 'ja' ? '興味のあるカテゴリーを選んでください' : 'Select the categories you are interested in'}
                  <br />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 400 }}>
                    {appLang === 'ja' ? '（1つ以上タップして選択）' : '(Tap to select one or more)'}
                  </span>
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "22px",
                    maxHeight: "220px",
                    overflowY: "auto",
                    paddingBottom: "10px",
                  }}
                >
                  {newsletterCategoryOptions.map((cat) => {
                    const isSelected = leadCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setLeadError(null);
                          if (isSelected) {
                            setLeadCategories((prev) =>
                              prev.filter((c) => c !== cat)
                            );
                          } else {
                            setLeadCategories((prev) => [...prev, cat]);
                          }
                        }}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "20px",
                          border: isSelected
                            ? "2px solid var(--primary)"
                            : "1px solid var(--border)",
                          background: isSelected
                            ? "var(--primary-light)"
                            : "var(--surface)",
                          color: isSelected
                            ? "var(--primary)"
                            : "var(--text-main)",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        {isSelected ? `✓ ${cat}` : cat}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setLeadStep(2)}
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      color: "var(--text-main)",
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={leadSubmitting}
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: leadSubmitting ? "var(--border)" : "var(--primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: leadSubmitting ? "not-allowed" : "pointer",
                    }}
                  >
                    {leadSubmitting ? (appLang === 'ja' ? "送信中..." : "Submitting...") : t.newsletter.submit}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}"""

if start_idx != -1:
    lines = lines[:start_idx] + new_modal.split('\n')
    content = '\n'.join(lines)

    content = content.replace('if (!leadFirstName.trim() || !leadEmail.trim() || !leadGender) {', 'if (!leadFirstName.trim() || !leadEmail.trim()) {')
    content = content.replace('gender: leadGender,', 'gender: "Not specified",')

# Further little translations
content = content.replace('showToast("すでにリストにあります");', 'showToast(t.toasts.alreadyInList);')
content = content.replace('showToast("保存しました !");', 'showToast(t.toasts.saved);')
content = content.replace('showToast("リストを作成しました");', 'showToast(t.toasts.listCreated);')
content = content.replace('showToast("削除しました");', 'showToast(t.toasts.deleted);')

content = content.replace('setLeadError("このメールアドレスは既に登録されています。");', 'setLeadError(t.toasts.emailRegistered);')
content = content.replace('showToast("このメールアドレスは既に登録されています。");', 'showToast(t.toasts.emailRegistered);')

content = content.replace('setLeadError("すべての項目を入力・選択してください。");', 'setLeadError(t.toasts.enterAllFields);')
content = content.replace('setLeadError("興味のあるカテゴリーを1つ以上選んでください。");', 'setLeadError(t.toasts.selectCategory);')
content = content.replace('showToast("ご登録ありがとうございます！確認メールを送信しました。");', 'showToast(t.toasts.registrationSuccess);')

content = content.replace('検索中...', '{t.dict.loading}')
content = content.replace('定義が見つかりませんでした', '{t.dict.noDef}')
content = content.replace('<span className="dict-context-label">文脈</span>', '<span className="dict-context-label">{t.dict.context}</span>')

# Re-apply typescript ignore TS errors or string typing:
content = content.replace('alt={displayTitle || ""}', 'alt={typeof displayTitle === "string" ? displayTitle : displayTitle?.fr || ""}')
content = content.replace('<h3 lang="fr">{displayTitle}</h3>', '<h3 lang="fr">{typeof displayTitle === "string" ? displayTitle : displayTitle?.fr}</h3>')
content = content.replace('{article.category || "一般"}', '{typeof article.category === "string" ? article.category : article.category?.[appLang] || "General"}')
content = content.replace('alt={currentLevelData.title}', 'alt={typeof currentLevelData.title === "string" ? currentLevelData.title : currentLevelData.title?.fr}')

content = content.replace(
    'selectedCategories.length === 0\\n                ? "カテゴリー"\\n                : `カテゴリー (${selectedCategories.length})`}',
    'selectedCategories.length === 0\\n                ? (appLang === "ja" ? "カテゴリー" : "Category")\\n                : `${appLang === "ja" ? "カテゴリー" : "Category"} (${selectedCategories.length})`}'
)

content = content.replace('条件に一致する記事は見つかりませんでした。', '{appLang === "ja" ? "条件に一致する記事は見つかりませんでした。" : "No articles found matching the criteria."}')


with open("src/components/FuragoApp.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done reapply all")
