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

# 6. Replace usages of buildQueueForText(levelData.content)
content = content.replace("buildQueueForText(levelData.content);", "buildQueueForText(levelData.paragraphs);")
content = content.replace("buildQueueForText(currentArticle.levels[lvl].content);", "buildQueueForText(currentArticle.levels[lvl].paragraphs);")
content = content.replace("buildQueueForText(article.levels[globalLevel].content);", "buildQueueForText(article.levels[globalLevel].paragraphs);")

with open("src/components/FuragoApp.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done step 1")
