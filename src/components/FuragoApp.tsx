"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { DictionaryService, DictLookupResult } from "@/lib/dictionary";

import { getTranslation, AppLanguage } from "@/lib/i18n";

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
  question?: TranslatableText;
  prompt?: TranslatableText;
  choices?: QuizChoice[];
  // For backwards compatibility with old mock data
  text?: string;
  options?: Record<string, string> | QuizChoice[];
  answer?: string;
}

export interface ArticleLevelData {
  title: string | TranslatableText;
  paragraphs?: Paragraph[];
  segments?: Paragraph[];
  quiz?: QuizQuestion[];
  // For backwards compatibility
  content?: string;
  learningGoal?: TranslatableText;
  targetVocabulary?: string[];
}

export type Category = TranslatableText | string;

export interface Article {
  id: number | string;
  date?: string;
  originalTitle?: string;
  category?: Category;
  imageUrl?: string;
  levels: Record<string, ArticleLevelData>;
  seriesId?: string | null;
  seriesOrder?: number | null;
  featured?: boolean;
}

interface WordList {
  id: string;
  name: string;
}

interface SavedWord {
  fr: string;
  originalWord?: string;
  ja: string;
  conciseDef?: string;
  nature?: string;
  gender?: string;
  phraseOriginale?: string;
  traductionPhrase?: string;
  definitions?: string[];
  listId: string;
  date: string;
}

interface TtsQueueItem {
  text: string;
  start: number;
  length: number;
}

const DATA_URL = "https://kohaiducode.github.io/furago-data/articles.json";
const LEVELS = ["LVL_1", "LVL_2", "LVL_3", "LVL_4"];

function extractDriveId(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const matchFile = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFile && matchFile[1]) return matchFile[1];
  const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchIdParam && matchIdParam[1]) return matchIdParam[1];
  return null;
}

function formatDriveUrl(url?: string): string {
  if (!url) return "";
  const id = extractDriveId(url);
  if (id) {
    return `https://lh3.googleusercontent.com/d/${id}=w1000`;
  }
  return url.trim();
}

const TargetVocabularyItem = ({ word, onClick }: { word: string, onClick: (e: React.MouseEvent<HTMLElement>, w: string, s: string) => void }) => {
  const [def, setDef] = useState<string>("");
  useEffect(() => {
    let active = true;
    DictionaryService.lookupWord(word, "").then(res => {
      if (active) {
        setDef(res.conciseDef || res.nature || "");
      }
    });
    return () => { active = false; };
  }, [word]);

  return (
    <div 
      onClick={(e) => onClick(e, word, "")}
      style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "12px", background: "var(--surface)", cursor: "pointer", border: "1px solid var(--border)", transition: "all 0.2s" }}
      className="target-vocab-item tap-word"
    >
      <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--primary)" }}>{word}</span>
      <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: 600 }}>{def}</span>
    </div>
  );
};
export default function FuragoApp({
  initialArticles,
}: {
  initialArticles: Article[];
}) {
  // Navigation & Views: "home" | "reading" | "words"
  const [activeView, setActiveView] = useState<"home" | "reading" | "words" | "vocab_review">("home");

  // i18n States
  const [appLang, setAppLang] = useState<AppLanguage>("ja");
  const t = getTranslation(appLang);
  const [showTranslation, setShowTranslation] = useState<Record<number, boolean>>({});
  const [translatedQuizIds, setTranslatedQuizIds] = useState<Record<string, boolean>>({});


  // Articles & Filters
  const [articles, setArticles] = useState<Article[]>(initialArticles || []);
  const [globalLevel, setGlobalLevel] = useState<string>("LVL_1");
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [filterModalType, setFilterModalType] = useState<"level" | "category" | null>(null);

  // Current Reading Article
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);

  // Quiz State
  const [quizIndex, setQuizIndex] = useState<number>(0);
  const [quizScore, setQuizScore] = useState<number>(0);
  const [noQuizCompleted, setNoQuizCompleted] = useState<boolean>(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  // Audio / TTS State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [queueIndex, setQueueIndex] = useState<number>(0);
  const [ttsQueue, setTtsQueue] = useState<TtsQueueItem[]>([]);
  const [highlightRange, setHighlightRange] = useState<{ start: number; length: number }>({
    start: -1,
    length: 0,
  });
  const [audioSpeed, setAudioSpeed] = useState<number>(1);
  const [frVoices, setFrVoices] = useState<{ voice: SpeechSynthesisVoice; label: string }[]>([]);
  const [selectedVoiceIdx, setSelectedVoiceIdx] = useState<number>(0);

  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const queueIndexRef = useRef(0);
  const ttsQueueRef = useRef<TtsQueueItem[]>([]);
  const audioSpeedRef = useRef(1);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Dictionary Popup State
  const [dictOpen, setDictOpen] = useState<boolean>(false);
  const [dictLoading, setDictLoading] = useState<boolean>(false);
  const [dictData, setDictData] = useState<DictLookupResult | null>(null);
  const [dictRect, setDictRect] = useState<DOMRect | null>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [arrowTop, setArrowTop] = useState<boolean>(false);
  const popupRef = useRef<HTMLDivElement | null>(null);

  // Word Lists & Saved Words (単語帳)
  const [wordLists, setWordLists] = useState<WordList[]>([
    { id: "default", name: "デフォルト" },
  ]);
  const [savedWords, setSavedWords] = useState<SavedWord[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [listSelectorOpen, setListSelectorOpen] = useState<boolean>(false);
  const [newListModalOpen, setNewListModalOpen] = useState<boolean>(false);
  const [newListName, setNewListName] = useState<string>("");

  // Email Lead Bar, Multi-step Profile Modal & Toast
  const [showLeadBar, setShowLeadBar] = useState<boolean>(false);
  const [leadModalOpen, setLeadModalOpen] = useState<boolean>(false);
  const [leadStep, setLeadStep] = useState<1 | 2 | 3>(1);
  const [leadEmail, setLeadEmail] = useState<string>("");
  const [leadFirstName, setLeadFirstName] = useState<string>("");
  const [leadLevel, setLeadLevel] = useState<string>("LVL_1");
  const [leadCategories, setLeadCategories] = useState<string[]>([]);
  const [leadSubmitting, setLeadSubmitting] = useState<boolean>(false);
  const [leadCheckingEmail, setLeadCheckingEmail] = useState<boolean>(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [lastCompletedDate, setLastCompletedDate] = useState<string>("");
  const [lastVocabReviewDate, setLastVocabReviewDate] = useState<string>("");
  const [lastOpenedArticleId, setLastOpenedArticleId] = useState<string>("");
  useEffect(() => {
    const d = localStorage.getItem("furago_daily_completed_date");
    if (d) setLastCompletedDate(d);
    const v = localStorage.getItem("furago_xp_vocab_date");
    if (v) setLastVocabReviewDate(v);
    const opened = localStorage.getItem("furago_last_opened_articleId");
    if (opened) setLastOpenedArticleId(opened);
  }, []);

  const todayStr = new Date().toLocaleDateString("en-CA"); // local timezone YYYY-MM-DD
  const isMissionCompletedToday = lastCompletedDate === todayStr;
  const isVocabReviewCompletedToday = lastVocabReviewDate === todayStr;

  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [longestStreak, setLongestStreak] = useState<number>(0);
  const [lastStreakDate, setLastStreakDate] = useState<string>("");

  useEffect(() => {
    setCurrentStreak(parseInt(localStorage.getItem("furago_current_streak") || "0", 10));
    setLongestStreak(parseInt(localStorage.getItem("furago_longest_streak") || "0", 10));
    setLastStreakDate(localStorage.getItem("furago_last_streak_date") || "");
  }, []);

  const updateStreak = useCallback(() => {
    const today = new Date().toLocaleDateString("en-CA");
    const storedDate = localStorage.getItem("furago_last_streak_date") || "";
    if (storedDate === today) return;

    let cs = parseInt(localStorage.getItem("furago_current_streak") || "0", 10);
    let ls = parseInt(localStorage.getItem("furago_longest_streak") || "0", 10);

    if (!storedDate) {
      cs = 1;
    } else {
      const prev = new Date(storedDate);
      const curr = new Date(today);
      const utcPrev = Date.UTC(prev.getFullYear(), prev.getMonth(), prev.getDate());
      const utcCurr = Date.UTC(curr.getFullYear(), curr.getMonth(), curr.getDate());
      const diffDays = Math.floor((utcCurr - utcPrev) / 86400000);

      if (diffDays === 1) {
        cs += 1;
      } else if (diffDays > 1) {
        cs = 1;
      }
    }

    ls = Math.max(ls, cs);
    localStorage.setItem("furago_current_streak", cs.toString());
    localStorage.setItem("furago_longest_streak", ls.toString());
    localStorage.setItem("furago_last_streak_date", today);
    
    setCurrentStreak(cs);
    setLongestStreak(ls);
    setLastStreakDate(today);
  }, []);

  // XP State and logic
  const [totalXP, setTotalXP] = useState<number>(0);
  useEffect(() => {
    setTotalXP(parseInt(localStorage.getItem("furago_xp") || "0", 10));
  }, []);

  const addXP = useCallback((amount: number) => {
    setTotalXP(prev => {
      const next = prev + amount;
      localStorage.setItem("furago_xp", next.toString());
      return next;
    });
  }, []);

  const checkAndAwardArticleXP = useCallback((articleId: string) => {
    const key = "furago_xp_articles";
    const done = JSON.parse(localStorage.getItem(key) || "[]");
    if (!done.includes(articleId)) {
      done.push(articleId);
      localStorage.setItem(key, JSON.stringify(done));
      addXP(20);
    }
  }, [addXP]);

  const checkAndAwardQuizXP = useCallback((articleId: string, isPerfect: boolean) => {
    const quizKey = "furago_xp_quizzes";
    const doneQ = JSON.parse(localStorage.getItem(quizKey) || "[]");
    if (!doneQ.includes(articleId)) {
      doneQ.push(articleId);
      localStorage.setItem(quizKey, JSON.stringify(doneQ));
      addXP(10);
    }
    if (isPerfect) {
      const perfKey = "furago_xp_perfects";
      const doneP = JSON.parse(localStorage.getItem(perfKey) || "[]");
      if (!doneP.includes(articleId)) {
        doneP.push(articleId);
        localStorage.setItem(perfKey, JSON.stringify(doneP));
        addXP(5);
      }
    }
  }, [addXP]);

  const checkAndAwardDailyMissionXP = useCallback(() => {
    const key = "furago_xp_daily_date";
    const lastDate = localStorage.getItem(key);
    const today = new Date().toLocaleDateString("en-CA");
    if (lastDate !== today) {
      localStorage.setItem(key, today);
      addXP(10);
    }
  }, [addXP]);

  const checkAndAwardVocabReviewXP = useCallback(() => {
    const key = "furago_xp_vocab_date";
    const lastDate = localStorage.getItem(key);
    const today = new Date().toLocaleDateString("en-CA");
    if (lastDate !== today) {
      localStorage.setItem(key, today);
      setLastVocabReviewDate(today);
      addXP(10);
    }
  }, [addXP]);

  const [vocabReviewIndex, setVocabReviewIndex] = useState(0);
  const [vocabReviewWords, setVocabReviewWords] = useState<SavedWord[]>([]);
  const [vocabReviewAnswers, setVocabReviewAnswers] = useState<string[][]>([]);
  const [vocabReviewSelected, setVocabReviewSelected] = useState<string | null>(null);

  const startVocabReview = () => {
    if (savedWords.length === 0) return;
    const shuffled = [...savedWords].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 5);
    
    const optionsList = selected.map(word => {
       let others = savedWords.filter(w => w.fr !== word.fr);
       others = others.sort(() => 0.5 - Math.random());
       const fakeOptions = others.slice(0, 3).map(w => w.conciseDef || w.ja);
       while(fakeOptions.length < 3) fakeOptions.push("ダミー" + fakeOptions.length);
       
       const options = [...fakeOptions, word.conciseDef || word.ja].sort(() => 0.5 - Math.random());
       return options;
    });
    
    setVocabReviewWords(selected);
    setVocabReviewAnswers(optionsList);
    setVocabReviewIndex(0);
    setVocabReviewSelected(null);
    setActiveView("vocab_review");
    window.scrollTo(0,0);
  };


  const dailyArticle = React.useMemo(() => {
    const available = articles.filter(a => a.levels && a.levels[globalLevel]);
    if (available.length === 0) return null;
    const sorted = [...available].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const featured = sorted.filter(a => a.featured);
    const pool = featured.length > 0 ? featured : sorted;
    const seed = new Date(todayStr).getTime() / 86400000;
    const index = Math.abs(Math.floor(seed)) % pool.length;
    return pool[index];
  }, [articles, globalLevel, todayStr]);

  useEffect(() => {
    if (activeView === "reading" && currentArticle) {
      const q = currentArticle.levels[globalLevel]?.quiz;
      if (!q || q.length === 0) {
        if (noQuizCompleted) {
          updateStreak();
          checkAndAwardArticleXP(currentArticle.id.toString());
          if (dailyArticle && currentArticle.id === dailyArticle.id) {
            localStorage.setItem("furago_daily_completed_date", todayStr);
            setLastCompletedDate(todayStr);
            checkAndAwardDailyMissionXP();
          }
        }
      } else if (quizIndex >= q.length) {
        updateStreak();
        checkAndAwardArticleXP(currentArticle.id.toString());
        checkAndAwardQuizXP(currentArticle.id.toString(), quizScore === q.length);
        if (dailyArticle && currentArticle.id === dailyArticle.id) {
          localStorage.setItem("furago_daily_completed_date", todayStr);
          setLastCompletedDate(todayStr);
          checkAndAwardDailyMissionXP();
        }
      }
    }
  }, [activeView, currentArticle, globalLevel, quizIndex, quizScore, updateStreak, checkAndAwardArticleXP, checkAndAwardQuizXP, noQuizCompleted, dailyArticle, todayStr, checkAndAwardDailyMissionXP]);

  const { continueArticle, currentSeriesNextEp } = React.useMemo(() => {
    if (!lastOpenedArticleId) return { continueArticle: null, currentSeriesNextEp: null };
    const lastOpened = articles.find(a => a.id.toString() === lastOpenedArticleId && a.levels && a.levels[globalLevel]);
    if (!lastOpened) return { continueArticle: null, currentSeriesNextEp: null };

    const done = JSON.parse(typeof window !== "undefined" ? localStorage.getItem("furago_xp_articles") || "[]" : "[]");
    const isCompleted = done.includes(lastOpened.id.toString());

    if (!isCompleted) {
      return { continueArticle: lastOpened, currentSeriesNextEp: null };
    } else if (lastOpened.seriesId) {
      const nextEp = articles
        .filter(a => a.seriesId === lastOpened.seriesId && (a.seriesOrder || 0) > (lastOpened.seriesOrder || 0))
        .sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0))[0];
      return { continueArticle: null, currentSeriesNextEp: nextEp || null };
    }
    return { continueArticle: null, currentSeriesNextEp: null };
  }, [articles, lastOpenedArticleId, globalLevel]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  // 1. Initialize Dictionary, LocalStorage, Voices, and refresh Articles
  useEffect(() => {
    DictionaryService.init();

    // Load saved word lists & words from localStorage
    try {
      const rawLists = localStorage.getItem("furago_lists");
      if (rawLists) {
        const parsed = JSON.parse(rawLists);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWordLists(parsed);
        }
      }
      const rawWords = localStorage.getItem("furago_words");
      if (rawWords) {
        const parsedWords = JSON.parse(rawWords);
        if (Array.isArray(parsedWords)) {
          setSavedWords(parsedWords);
        }
      }
      if (localStorage.getItem("furago_lead_subscribed") === "1") {
        setShowLeadBar(false);
      } else {
        setShowLeadBar(true);
      }
    } catch (e) {
      console.error("Error loading localStorage", e);
    }

    // Extract categories from initialArticles
    const initCats = new Set<string>();
    (initialArticles || []).forEach((a) => {
      if (a.category) initCats.add((typeof a.category === "string" ? a.category : (a.category?.ja || "")).trim());
    });
    const catArray = Array.from(initCats);
    setAllCategories(catArray);
    setSelectedCategories(catArray);

    // Fetch latest articles from GitHub in case new ones were published
    fetch(DATA_URL)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.articles)) {
          const valid = data.articles.filter(
            (a: Article) => a.levels && Object.keys(a.levels).length > 0
          );
          valid.sort((a: Article, b: Article) => {
            const dA = a.date ? new Date(a.date).getTime() : 0;
            const dB = b.date ? new Date(b.date).getTime() : 0;
            return dB - dA;
          });
          setArticles(valid);
          const freshCats = new Set<string>();
          valid.forEach((a: Article) => {
            if (a.category) freshCats.add((typeof a.category === "string" ? a.category : (a.category?.ja || "")).trim());
          });
          const freshArr = Array.from(freshCats);
          setAllCategories(freshArr);
          setSelectedCategories((prev) => (prev.length === 0 ? freshArr : prev));
        }
      })
      .catch(() => {});
  }, [initialArticles]);

  // 2. Initialize French TTS Voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      const localFr = voices.filter((v) => {
        const l = (v.lang || "").toLowerCase();
        const n = (v.name || "").toLowerCase();
        if (l.includes("fr-ca") || l.includes("canada") || n.includes("canada") || n.includes("canadien"))
          return false;
        if (n.includes("network") || n.includes("réseau")) return false;
        return l.startsWith("fr");
      });

      const uniqueVoices: SpeechSynthesisVoice[] = [];
      const seen = new Set<string>();
      localFr.forEach((v) => {
        const id = (v.voiceURI || v.name || "")
          .toLowerCase()
          .replace(/-local/g, "")
          .replace(/-network/g, "")
          .trim();
        if (!seen.has(id)) {
          seen.add(id);
          uniqueVoices.push(v);
        }
      });

      const femaleNames = ["Sophie", "Camille", "Léa", "Alice", "Emma"];
      const maleNames = ["Thomas", "Lucas", "Hugo", "Paul", "Arthur"];
      let fIdx = 0;
      let mIdx = 0;

      const mapped: { voice: SpeechSynthesisVoice; label: string }[] = [];
      uniqueVoices.forEach((v, idx) => {
        if (idx === 5) return;
        const id = (v.voiceURI || v.name || "").toLowerCase();
        let isFemale = false;
        if (/vlf|vld|vla|fra|frc|female|femme|hortense|julie|eloise|denise/i.test(id)) {
          isFemale = true;
        } else if (/vle|vlc|vlb|frb|frd|male|homme|paul|henri|thomas/i.test(id)) {
          isFemale = false;
        } else {
          isFemale = idx === 0 || idx === 1 || idx === 3;
        }

        const label = isFemale
          ? `(女) ${femaleNames[fIdx++ % femaleNames.length]}`
          : `(男) ${maleNames[mIdx++ % maleNames.length]}`;
        mapped.push({ voice: v, label });
      });

      setFrVoices(mapped);
      if (mapped.length > 0 && !selectedVoiceRef.current) {
        selectedVoiceRef.current = mapped[0].voice;
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Stop audio helper
  const stopAudio = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    isPlayingRef.current = false;
    isPausedRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    setHighlightRange({ start: -1, length: 0 });
  }, []);

  // Build TTS sentence queue when article or level changes
  const buildQueueForText = useCallback((paragraphs: Paragraph[]) => {
    const q: TtsQueueItem[] = [];
    let currentIndex = 0;
    const regex = /[^.!?\n]+[.!?\n]*\s*/g;
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
  }, []);

  // Play current sentence in TTS queue
  const playNextInQueue = useCallback(() => {
    if (!isPlayingRef.current || isPausedRef.current) return;
    const q = ttsQueueRef.current;
    const idx = queueIndexRef.current;

    if (idx >= q.length) {
      isPlayingRef.current = false;
      isPausedRef.current = false;
      queueIndexRef.current = 0;
      setIsPlaying(false);
      setIsPaused(false);
      setQueueIndex(0);
      setHighlightRange({ start: -1, length: 0 });
      return;
    }

    const item = q[idx];
    setQueueIndex(idx);

    // Helper pour cibler uniquement le premier mot de la phrase (jamais la phrase entière)
    const getFirstWordRange = (sentenceItem: TtsQueueItem) => {
      const m = sentenceItem.text.match(/[a-zA-ZÀ-ÿœŒæÆ]+(?:['’][a-zA-ZÀ-ÿœŒæÆ]+)?/);
      if (m && m.index !== undefined) {
        return { start: sentenceItem.start + m.index, length: m[0].length };
      }
      return { start: -1, length: 0 };
    };

    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(item.text);
    if (selectedVoiceRef.current) {
      utterance.voice = selectedVoiceRef.current;
    }
    utterance.lang = "fr-FR";
    utterance.rate = audioSpeedRef.current;

    utterance.onstart = () => {
      setHighlightRange(getFirstWordRange(item));
    };

    utterance.onboundary = (e) => {
      if (e.name === "word") {
        const textRemaining = item.text.substring(e.charIndex);
        const match = textRemaining.match(/^[a-zA-ZÀ-ÿœŒæÆ]+(?:['’][a-zA-ZÀ-ÿœŒæÆ]+)?/);
        const wordLength = match ? match[0].length : 1;
        setHighlightRange({
          start: item.start + e.charIndex,
          length: wordLength,
        });
      }
    };

    utterance.onend = () => {
      if (isPlayingRef.current && !isPausedRef.current) {
        queueIndexRef.current += 1;
        playNextInQueue();
      }
    };

    utterance.onerror = () => {
      isPlayingRef.current = false;
      isPausedRef.current = false;
      setIsPlaying(false);
      setIsPaused(false);
      setHighlightRange({ start: -1, length: 0 });
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const handlePlayPause = () => {
    if (!currentArticle) return;
    const levelData = currentArticle.levels[globalLevel];
    if (!levelData) return;

    if (isPlaying && !isPaused) {
      // Pause
      isPausedRef.current = true;
      isPlayingRef.current = false;
      setIsPaused(true);
      setIsPlaying(false);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } else {
      // Play or Resume
      if (ttsQueueRef.current.length === 0) {
        buildQueueForText((levelData.paragraphs || levelData.segments || []));
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      isPausedRef.current = false;
      isPlayingRef.current = true;
      setIsPaused(false);
      setIsPlaying(true);
      playNextInQueue();
    }
  };

  const handleRestartAudio = () => {
    if (!currentArticle) return;
    const levelData = currentArticle.levels[globalLevel];
    if (!levelData) return;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (ttsQueueRef.current.length === 0) {
      buildQueueForText((levelData.paragraphs || levelData.segments || []));
    }
    queueIndexRef.current = 0;
    setQueueIndex(0);
    isPausedRef.current = false;
    isPlayingRef.current = true;
    setIsPaused(false);
    setIsPlaying(true);
    setTimeout(() => {
      playNextInQueue();
    }, 80);
  };

  const handlePrevSentence = () => {
    if (queueIndexRef.current > 0) {
      queueIndexRef.current -= 1;
      setQueueIndex(queueIndexRef.current);
      const item = ttsQueueRef.current[queueIndexRef.current];
      if (item) {
        const m = item.text.match(/[a-zA-ZÀ-ÿœŒæÆ]+(?:['’][a-zA-ZÀ-ÿœŒæÆ]+)?/);
        if (m && m.index !== undefined) {
          setHighlightRange({ start: item.start + m.index, length: m[0].length });
        }
      }
      if (isPlayingRef.current) {
        window.speechSynthesis?.cancel();
        playNextInQueue();
      }
    }
  };

  const handleNextSentence = () => {
    if (queueIndexRef.current < ttsQueueRef.current.length - 1) {
      queueIndexRef.current += 1;
      setQueueIndex(queueIndexRef.current);
      const item = ttsQueueRef.current[queueIndexRef.current];
      if (item) {
        const m = item.text.match(/[a-zA-ZÀ-ÿœŒæÆ]+(?:['’][a-zA-ZÀ-ÿœŒæÆ]+)?/);
        if (m && m.index !== undefined) {
          setHighlightRange({ start: item.start + m.index, length: m[0].length });
        }
      }
      if (isPlayingRef.current) {
        window.speechSynthesis?.cancel();
        playNextInQueue();
      }
    }
  };

  // Open an article
  const openArticle = (article: Article) => {
    stopAudio();
    setDictOpen(false);
    setCurrentArticle(article);
    setLastOpenedArticleId(article.id.toString());
    localStorage.setItem("furago_last_opened_articleId", article.id.toString());
    setQuizIndex(0);
    setQuizScore(0);
    setNoQuizCompleted(false);
    setSelectedAnswer(null);
    const levelData = article.levels[globalLevel];
    if (levelData) {
      buildQueueForText((levelData.paragraphs || levelData.segments || []));
    }
    if (dailyArticle && article.id === dailyArticle.id) {
    // Removed early daily mission completion
    }
    setActiveView("reading");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Position Dictionary Popup whenever dictRect or dictData updates
  useEffect(() => {
    if (!dictOpen || !dictRect) return;

    const updatePosition = () => {
      const popupEl = popupRef.current;
      const popupWidth = popupEl?.offsetWidth || 220;
      const popupHeight = popupEl?.offsetHeight || 95;
      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;

      const paddingX = 14;
      let leftPos = dictRect.left + dictRect.width / 2;
      const minLeft = paddingX + popupWidth / 2;
      const maxLeft = winWidth - paddingX - popupWidth / 2;
      if (leftPos < minLeft) leftPos = minLeft;
      if (leftPos > maxLeft) leftPos = maxLeft;

      const wordCenterX = dictRect.left + dictRect.width / 2;
      const popupLeftX = leftPos - popupWidth / 2;
      let arrowPct = ((wordCenterX - popupLeftX) / popupWidth) * 100;
      arrowPct = Math.max(12, Math.min(88, arrowPct));

      const topSafety = 65;
      const bottomSafety = 130;
      const spaceAbove = dictRect.top - topSafety;
      const spaceBelow = winHeight - dictRect.bottom - bottomSafety;

      let topPos = 0;
      let isTopArrow = false;
      if (spaceAbove >= popupHeight + 10) {
        topPos = dictRect.top - popupHeight - 10;
        isTopArrow = false;
      } else if (spaceBelow >= popupHeight + 10) {
        topPos = dictRect.bottom + 10;
        isTopArrow = true;
      } else {
        topPos = Math.max(topSafety + 6, dictRect.top - popupHeight - 10);
        isTopArrow = false;
      }

      setArrowTop(isTopArrow);
      setPopupStyle({
        left: `${leftPos}px`,
        top: `${topPos}px`,
        "--arrow-x": `${arrowPct}%`,
      } as React.CSSProperties);
    };

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(raf);
  }, [dictOpen, dictRect, dictData, dictLoading]);

  // Trigger Dictionary Lookup on Word Click
  const handleWordClick = async (
    e: React.MouseEvent<HTMLElement>,
    word: string,
    paragraphText: string
  ) => {
    e.stopPropagation();
    if (!word.trim()) return;

    const rect = e.currentTarget.getBoundingClientRect();
    setDictRect(rect);
    setDictOpen(true);
    setDictLoading(true);
    setDictData(null);

    const result = await DictionaryService.lookupWord(word, paragraphText, appLang as "ja" | "en");
    setDictData(result);
    setDictLoading(false);
  };

  // Close Dictionary Popup when clicking outside
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (!dictOpen) return;
      const target = e.target as HTMLElement;
      if (popupRef.current && popupRef.current.contains(target)) return;
      if (target.closest(".tap-word")) return;
      setDictOpen(false);
    };
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [dictOpen]);

  // Pronounce single word
  const speakWord = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = 0.95;
    if (selectedVoiceRef.current) {
      u.voice = selectedVoiceRef.current;
    }
    window.speechSynthesis.speak(u);
  };

  // Save word to a specific list
  const saveWordToList = (listId: string) => {
    if (!dictData) return;
    setListSelectorOpen(false);

    const exists = savedWords.some(
      (w) =>
        w.fr.toLowerCase() === dictData.mot.toLowerCase() && w.listId === listId
    );
    if (exists) {
      showToast(t.toasts.alreadyInList);
      return;
    }

    const newWord: SavedWord = {
      fr: dictData.mot,
      originalWord: dictData.originalWord,
      ja: dictData.traductionPhrase,
      conciseDef: dictData.conciseDef,
      nature: dictData.nature,
      gender: dictData.gender,
      phraseOriginale: dictData.phraseOriginale,
      traductionPhrase: dictData.traductionPhrase,
      definitions: dictData.definitions,
      listId,
      date: new Date().toISOString(),
    };

    const updated = [...savedWords, newWord];
    setSavedWords(updated);
    localStorage.setItem("furago_words", JSON.stringify(updated));
    showToast(t.toasts.saved);
  };

  // Create new word list
  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    const newList: WordList = {
      id: "list_" + Date.now(),
      name: newListName.trim(),
    };
    const updated = [...wordLists, newList];
    setWordLists(updated);
    localStorage.setItem("furago_lists", JSON.stringify(updated));
    setNewListName("");
    setNewListModalOpen(false);
    showToast(t.toasts.listCreated);
  };

  // Delete saved word
  const handleDeleteWord = (wordFr: string, listId: string) => {
    const updated = savedWords.filter(
      (w) => !(w.fr === wordFr && w.listId === listId)
    );
    setSavedWords(updated);
    localStorage.setItem("furago_words", JSON.stringify(updated));
    showToast(t.toasts.deleted);
  };

  // Liste des catégories proposées à l'inscription (issues des articles + thèmes principaux)
  const newsletterCategoryOptions = Array.from(
    new Set([...allCategories, "地理", "文化", "歴史", "グルメ", "ニュース・日常"])
  );

  // Vérifie localement si l'email a déjà été enregistré sur ce navigateur
  const isEmailLocallyRegistered = (emailToCheck: string): boolean => {
    try {
      const normalized = emailToCheck.trim().toLowerCase();
      if (!normalized) return false;
      const single = (localStorage.getItem("furago_lead_email") || "")
        .trim()
        .toLowerCase();
      if (single && single === normalized) return true;
      const rawList = localStorage.getItem("furago_registered_emails");
      if (rawList) {
        const list = JSON.parse(rawList);
        if (Array.isArray(list) && list.includes(normalized)) return true;
      }
    } catch {
      // ignore
    }
    return false;
  };

  const rememberRegisteredEmail = (emailToSave: string) => {
    try {
      const normalized = emailToSave.trim().toLowerCase();
      if (!normalized) return;
      localStorage.setItem("furago_lead_email", normalized);
      const rawList = localStorage.getItem("furago_registered_emails");
      const list: string[] = rawList ? JSON.parse(rawList) : [];
      if (!list.includes(normalized)) {
        list.push(normalized);
        localStorage.setItem("furago_registered_emails", JSON.stringify(list));
      }
    } catch {
      // ignore
    }
  };

  // Lance une vérification silencieuse en arrière-plan auprès de Google Sheets
  const checkEmailInBackground = (emailToCheck: string) => {
    const normalizedEmail = emailToCheck.trim().toLowerCase();
    if (!normalizedEmail) return;

    const scriptUrl =
      process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL ||
      "https://script.google.com/macros/s/AKfycbxUb-hUABm9TodggnQgnxrXjhmFzhxQxo-7beGqTdTLAlkI_kdEjQUXGeLMrq9Lhvg1QQ/exec";
    if (!scriptUrl) return;

    fetch(scriptUrl, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "check_email",
        email: normalizedEmail,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.status === "already_exists") {
          rememberRegisteredEmail(normalizedEmail);
          setLeadStep(1);
          setLeadError(t.toasts.emailRegistered);
          showToast(t.toasts.emailRegistered);
        }
      })
      .catch(() => {});
  };

  // Clic sur "登録" dans la barre du haut -> Ouvre la modale de profil à l'étape 1
  const handleOpenLeadModal = (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError(null);
    setLeadSubmitting(false);
    setLeadCheckingEmail(false);

    if (leadEmail.trim()) {
      if (isEmailLocallyRegistered(leadEmail)) {
        showToast(t.toasts.emailRegistered);
        return;
      }
      // Si l'utilisateur a déjà tapé son email dans la barre du haut, on lance la vérif en tâche de fond dès l'ouverture !
      checkEmailInBackground(leadEmail);
    }

    setLeadStep(1);
    setLeadLevel("LVL_1");
    setLeadModalOpen(true);
  };

  // Validation des étapes (instantanée 0ms) et envoi final en arrière-plan (Étape 3)
  const handleLeadProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError(null);

    const scriptUrl =
      process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL ||
      "https://script.google.com/macros/s/AKfycbxUb-hUABm9TodggnQgnxrXjhmFzhxQxo-7beGqTdTLAlkI_kdEjQUXGeLMrq9Lhvg1QQ/exec";

    if (leadStep === 1) {
      if (!leadFirstName.trim() || !leadEmail.trim()) {
        setLeadError(t.toasts.enterAllFields);
        return;
      }

      const normalizedEmail = leadEmail.trim().toLowerCase();
      if (isEmailLocallyRegistered(normalizedEmail)) {
        setLeadError(t.toasts.emailRegistered);
        showToast(t.toasts.emailRegistered);
        return;
      }

      // Passage instantané à l'étape 2 sans faire attendre l'utilisateur,
      // pendant que la vérification Google Sheet tourne en tâche de fond !
      setLeadStep(2);
      checkEmailInBackground(normalizedEmail);
      return;
    }

    if (leadStep === 2) {
      setLeadStep(3);
      return;
    }

    if (leadCategories.length === 0) {
      setLeadError(t.toasts.selectCategory);
      return;
    }

    const email = leadEmail.trim().toLowerCase();
    if (!email) return;

    if (isEmailLocallyRegistered(email)) {
      setLeadStep(1);
      setLeadError(t.toasts.emailRegistered);
      showToast(t.toasts.emailRegistered);
      return;
    }

    const payload = {
      email,
      name: leadFirstName.trim(),
      firstName: leadFirstName.trim(),
      gender: "Not specified",
      level: leadLevel,
      categories: leadCategories,
      source: "FuragoWeb",
    };

    // Fermeture immédiate du pop-up (0ms d'attente pour l'utilisateur)
    rememberRegisteredEmail(email);
    localStorage.setItem("furago_lead_subscribed", "1");
    setLeadSubmitting(false);
    setLeadModalOpen(false);
    setShowLeadBar(false);
    showToast(t.toasts.registrationSuccess);

    // Envoi en tâche de fond vers Google Sheets + déclenchement de l'email de bienvenue
    if (scriptUrl) {
      fetch(scriptUrl, {
        method: "POST",
        redirect: "follow",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (
            data &&
            (data.status === "already_exists" || data.status === "updated")
          ) {
            showToast(t.toasts.emailRegistered);
          }
        })
        .catch((err) => {
          console.error("Erreur lors de l'envoi en arrière-plan:", err);
        });
    }
  };

  // Filtered articles for Home view
  const filteredArticles = articles.filter((article) => {
    const cat = (typeof article.category === "string" ? article.category : article.category?.ja || "").trim();
    if (selectedCategories.length > 0 && cat && !selectedCategories.includes(cat)) {
      return false;
    }
    if (!article.levels || !article.levels[globalLevel]) return false;
    return true;
  }).sort((a, b) => {
    if (a.seriesId && a.seriesId === b.seriesId) {
      return (a.seriesOrder || 0) - (b.seriesOrder || 0);
    }
    // Default fallback to keep non-series articles (or different series) in their original relative order.
    // Usually they are already sorted by date descending in the source JSON.
    return 0; 
  });

  // Render interactive French paragraph with clickable words and TTS highlight
  const renderInteractiveContent = (paragraphs: Paragraph[]) => {
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
              onClick={(e) => handleWordClick(e, token, text)}
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
        <div key={p.id || pIdx} style={{ marginBottom: "1.2rem", position: "relative" }}>
          <p lang="fr" style={{ margin: 0 }}>
             {elements}
          </p>
        </div>
      );
      
      globalOffset += 1;
    });
    
    return allElements;
  };

  const currentLevelData =
    currentArticle && currentArticle.levels
      ? currentArticle.levels[globalLevel]
      : null;

  const progressPercent =
    ttsQueue.length > 0 ? ((queueIndex + 1) / ttsQueue.length) * 100 : 0;

  const quizNextEp = (activeView === "reading" && currentArticle?.seriesId) ? articles
    .filter(a => a.seriesId === currentArticle.seriesId && (a.seriesOrder || 0) > (currentArticle.seriesOrder || 0))
    .sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0))[0] : null;

    const renderCompletionScreen = () => {
    const hasQuiz = currentLevelData?.quiz && currentLevelData.quiz.length > 0;
    return (
      <div className="quiz-card fade-in" style={{ textAlign: "center", padding: "32px 24px" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "24px", color: "var(--text-main)", fontWeight: 800 }}>
          🎉 記事を完了しました
        </h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px", background: "var(--bg)", padding: "16px 20px", borderRadius: "16px", textAlign: "left" }}>
          {hasQuiz && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>スコア</span>
              <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>{quizScore} / {currentLevelData.quiz?.length}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>獲得 XP</span>
            <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--primary)" }}>
              +{20 + (hasQuiz ? 10 + (quizScore === currentLevelData.quiz?.length ? 5 : 0) : 0) + (dailyArticle?.id === currentArticle?.id ? 10 : 0)} XP
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>ストリーク</span>
            <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#ff9500" }}>🔥 {currentStreak} {appLang === 'ja' ? '日' : 'jours'}</span>
          </div>
          {currentLevelData?.targetVocabulary && currentLevelData.targetVocabulary.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>新しい単語</span>
              <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>📚 {currentLevelData.targetVocabulary.length} items</span>
            </div>
          )}
        </div>

        {currentArticle?.seriesId && (
          <div style={{ marginBottom: "28px", padding: "16px", borderRadius: "16px", border: "1px solid var(--border)", background: "var(--bg)" }}>
            <p style={{ margin: "0 0 6px 0", fontSize: "0.95rem", color: "var(--primary)", fontWeight: 800 }}>
              {currentArticle.seriesId.replace(/_/g, ' ')}
            </p>
            <p style={{ margin: "0", fontWeight: 700, color: "var(--text-main)" }}>
              Article {currentArticle.seriesOrder || '?'} / {articles.filter(a => a.seriesId === currentArticle.seriesId).length}
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {currentArticle?.seriesId ? (
            quizNextEp ? (
              <button
                onClick={() => openArticle(quizNextEp)}
                style={{ width: "100%", padding: "14px", borderRadius: "16px", border: "none", background: "var(--primary)", color: "white", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer" }}
              >
                次のエピソード
              </button>
            ) : (
              <div style={{ width: "100%", padding: "14px", borderRadius: "16px", background: "rgba(76, 217, 100, 0.15)", color: "#2e7d32", fontSize: "1.05rem", fontWeight: 800, textAlign: "center" }}>
                🏆 シリーズ完結 (Series Completed)
              </div>
            )
          ) : (
            <button
              onClick={() => {
                setActiveView("home");
                window.scrollTo(0,0);
              }}
              style={{ width: "100%", padding: "14px", borderRadius: "16px", border: "none", background: "var(--primary)", color: "white", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer" }}
            >
              次の記事
            </button>
          )}
          
          <button
            onClick={() => {
              setActiveView("home");
              window.scrollTo(0,0);
            }}
            style={{ width: "100%", padding: "14px", borderRadius: "16px", border: "none", background: "var(--bg)", color: "var(--text-main)", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer" }}
          >
            ホームへ戻る
          </button>
        </div>
      </div>
    );
  };
return (
    <div className="app-shell">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="furago-toast">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          {toastMsg}
        </div>
      )}

      {/* Top Bar - Capture d'emails (Lead Generation) */}
      {showLeadBar && (
        <div className="lead-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary)', color: 'white', padding: '10px 16px', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, whiteSpace: "nowrap", fontSize: '0.95rem' }}>
            {t.nav.leadBarText}
          </span>
          <form className="lead-bar-form" onSubmit={(e) => { e.preventDefault(); handleOpenLeadModal(e); }} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="email"
              value={leadEmail}
              onChange={(e) => setLeadEmail(e.target.value)}
              placeholder="e.g. taro@furago.com"
              className="lead-bar-input"
              style={{ padding: '6px 12px', borderRadius: '16px', border: 'none', outline: 'none', fontSize: '0.85rem' }}
            />
            <button type="submit" className="lead-bar-btn" style={{ background: 'white', color: 'var(--primary)', border: 'none', borderRadius: '16px', padding: '6px 12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
              {t.nav.leadBarBtn}
            </button>
            <button
              type="button"
              onClick={() => setShowLeadBar(false)}
              aria-label="Close"
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.8)",
                cursor: "pointer",
                padding: "2px 4px",
                fontSize: "1.2rem",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </form>
        </div>
      )}

      {/* App Header */}
      <header className="app-header" style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', background: 'var(--surface)', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        {activeView === "reading" && (
          <button
            className="back-btn"
            onClick={() => {
              stopAudio();
              setDictOpen(false);
              setActiveView("home");
            }}
            aria-label="Back"
            style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        )}
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0', color: 'var(--primary)', letterSpacing: '-0.5px', marginLeft: activeView === 'reading' ? '8px' : '0' }}>Furago</h1>
        {currentStreak > 0 && (
          <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '4px 10px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
            <span style={{ marginRight: '4px' }}>🔥</span> {currentStreak} {appLang === 'ja' ? '日' : 'jours'}
          </div>
        )}
        {totalXP > 0 && (
          <div style={{ marginLeft: currentStreak > 0 ? '8px' : '12px', display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '4px 10px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
            <span style={{ marginRight: '4px', color: 'var(--primary)' }}>★</span> Level {Math.floor(totalXP / 100) + 1} <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 600 }}>{totalXP} XP</span>
          </div>
        )}
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            {activeView === "reading" && (
            <button
                className="header-level-btn"
                onClick={() => setFilterModalType("level")}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '4px 10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: 'var(--text-main)' }}
            >
                {t.levels[globalLevel as keyof typeof t.levels] || globalLevel} ▾
            </button>
            )}
            
            <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: '20px', padding: '2px', border: '1px solid var(--border)' }}>
              <button 
                onClick={() => setAppLang("ja")}
                style={{
                  background: appLang === 'ja' ? 'var(--primary)' : 'transparent',
                  color: appLang === 'ja' ? 'white' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '18px',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                🇯🇵 JP
              </button>
              <button 
                onClick={() => setAppLang("en")}
                style={{
                  background: appLang === 'en' ? 'var(--primary)' : 'transparent',
                  color: appLang === 'en' ? 'white' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '18px',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                🇬🇧 EN
              </button>
            </div>
        </div>
      </header>

      {/* VIEW 1: HOME (記事一覧) */}
      {activeView === "home" && (
        <main className="view fade-in">
          <div className="filters-bar">
            <button
              className="filter-btn"
              onClick={() => setFilterModalType("level")}
            >
              {t.nav.level} : {t.levels[globalLevel as keyof typeof t.levels] || globalLevel}
            </button>
            <button
              className="filter-btn"
              onClick={() => setFilterModalType("category")}
            >
              {selectedCategories.length === allCategories.length ||
              selectedCategories.length === 0
                ? t.nav.category
                : `${t.nav.category} (${selectedCategories.length})`}
            </button>
          </div>

          <div style={{ padding: '20px 20px 0' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
              今日やること
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 600, marginBottom: '24px' }}>
              What should I do today?
            </p>

            {/* Priority 1: Continue reading */}
            {continueArticle && (
              <div className="fade-in" style={{ marginBottom: '16px', padding: '20px', background: 'var(--surface)', borderRadius: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #eaeaea' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--primary)', fontWeight: 800 }}>続きを読む</h2>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  {continueArticle.imageUrl && (
                    <div style={{ width: '80px', height: '80px', borderRadius: '16px', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={formatDriveUrl(continueArticle.imageUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 700, lineHeight: '1.3' }}>
                      {typeof continueArticle.levels[globalLevel]?.title === 'string' 
                         ? continueArticle.levels[globalLevel]?.title 
                         : (continueArticle.levels[globalLevel]?.title as any)?.fr || continueArticle.originalTitle}
                    </h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
                      {globalLevel.replace('LVL_', 'Level ')}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => openArticle(continueArticle)}
                  style={{ width: '100%', marginTop: '20px', padding: '14px', borderRadius: '16px', border: 'none', background: 'var(--primary)', color: 'white', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  続きを読む
                </button>
              </div>
            )}

            {/* Priority 2: Today's mission */}
            {dailyArticle && (
              <div className="fade-in" style={{ marginBottom: '16px', padding: '20px', background: 'var(--surface)', borderRadius: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #eaeaea' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-main)', fontWeight: 800 }}>今日のミッション</h2>
                  {isMissionCompletedToday && (
                    <span style={{ background: '#4cd964', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800 }}>クリア！</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  {dailyArticle.imageUrl && (
                    <div style={{ width: '80px', height: '80px', borderRadius: '16px', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={formatDriveUrl(dailyArticle.imageUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 700, lineHeight: '1.3' }}>
                      {typeof dailyArticle.levels[globalLevel]?.title === 'string' 
                         ? dailyArticle.levels[globalLevel]?.title 
                         : (dailyArticle.levels[globalLevel]?.title as any)?.fr || dailyArticle.originalTitle}
                    </h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
                      {globalLevel.replace('LVL_', 'Level ')} · 5 min
                    </p>
                  </div>
                </div>
                {!isMissionCompletedToday ? (
                  <button 
                    onClick={() => openArticle(dailyArticle)}
                    style={{ width: '100%', marginTop: '20px', padding: '14px', borderRadius: '16px', border: 'none', background: 'var(--primary)', color: 'white', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    読む
                  </button>
                ) : (
                  <div style={{ width: '100%', marginTop: '20px', padding: '14px', borderRadius: '16px', background: 'rgba(76, 217, 100, 0.15)', color: '#2e7d32', fontSize: '1.05rem', fontWeight: 800, textAlign: 'center' }}>
                    🎉 今日のミッション完了
                  </div>
                )}
              </div>
            )}

            {/* Priority 4: Vocabulary review */}
            {savedWords.length > 0 && (
              <div className="fade-in" style={{ marginBottom: '16px', padding: '20px', background: 'var(--surface)', borderRadius: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #eaeaea' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-main)', fontWeight: 800 }}>🔤 今日の復習</h2>
                  {isVocabReviewCompletedToday && (
                    <span style={{ background: 'var(--bg)', color: 'var(--text-muted)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800 }}>クリア！</span>
                  )}
                </div>
                <p style={{ margin: '0 0 20px 0', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>{Math.min(5, savedWords.length)} mots</p>
                <button 
                  onClick={startVocabReview}
                  style={{ width: '100%', padding: '14px', borderRadius: '16px', border: 'none', background: isVocabReviewCompletedToday ? 'var(--bg)' : 'var(--primary)', color: isVocabReviewCompletedToday ? 'var(--text-muted)' : 'white', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  {isVocabReviewCompletedToday ? 'もう一度復習する' : 'Réviser'}
                </button>
              </div>
            )}

            {/* Priority 5: Current series */}
            {currentSeriesNextEp && (
              <div className="fade-in" style={{ marginBottom: '16px', padding: '20px', background: 'var(--surface)', borderRadius: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #eaeaea' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-main)', fontWeight: 800 }}>📚 {currentSeriesNextEp.seriesId?.replace(/_/g, ' ')}</h2>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  {currentSeriesNextEp.imageUrl && (
                    <div style={{ width: '80px', height: '80px', borderRadius: '16px', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={formatDriveUrl(currentSeriesNextEp.imageUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 700, lineHeight: '1.3' }}>
                      {typeof currentSeriesNextEp.levels[globalLevel]?.title === 'string' 
                         ? currentSeriesNextEp.levels[globalLevel]?.title 
                         : (currentSeriesNextEp.levels[globalLevel]?.title as any)?.fr || currentSeriesNextEp.originalTitle}
                    </h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
                      Episode {currentSeriesNextEp.seriesOrder || '?'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => openArticle(currentSeriesNextEp)}
                  style={{ width: '100%', marginTop: '20px', padding: '14px', borderRadius: '16px', border: 'none', background: 'var(--primary)', color: 'white', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  次のエピソード
                </button>
              </div>
            )}

            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '32px', marginBottom: '16px' }}>
              新着・おすすめ
            </h2>
          </div>

          {filteredArticles.length === 0 ? (
            <p
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "var(--text-muted)",
              }}
            >
              {appLang === "ja" ? "条件に一致する記事は見つかりませんでした。" : "No articles found matching the criteria."}
            </p>
          ) : (
            <ul className="article-list">
              {filteredArticles.map((article, index) => {
                const levelData = article.levels[globalLevel];
                const displayTitle = levelData?.title || article.originalTitle;
                const imgUrl = formatDriveUrl(article.imageUrl);
                const dateFormatted = article.date
                  ? new Date(article.date).toLocaleDateString("ja-JP")
                  : "";

                return (
                  <li
                    key={article.id || index}
                    onClick={() => openArticle(article)}
                    className={`article-card fade-in ${
                      index === 0 ? "hero-format" : "list-format"
                    }`}
                  >
                    {imgUrl && (
                      <div className="article-image-container">
                        <img
                          src={imgUrl}
                          alt={typeof displayTitle === "string" ? displayTitle : displayTitle?.fr || ""}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const id = extractDriveId(article.imageUrl);
                            const fallback = id
                              ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000`
                              : "";
                            if (fallback && e.currentTarget.src !== fallback) {
                              e.currentTarget.src = fallback;
                            }
                          }}
                        />
                      </div>
                    )}
                    <div className="article-card-content">
                      <h3 lang="fr">{typeof displayTitle === "string" ? displayTitle : displayTitle?.fr}</h3>
                      <p
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          margin: 0,
                          flexWrap: "wrap",
                        }}
                      >
                        <span className="badge">{globalLevel}</span>
                        <span
                          className="badge"
                          style={{
                            background: "var(--bg)",
                            color: "var(--text-muted)",
                            textTransform: "capitalize"
                          }}
                        >
                          {typeof article.category === "string" ? article.category : article.category?.[appLang] || "General"}
                        </span>
                        {dateFormatted && (
                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontSize: "0.8rem",
                              marginLeft: "auto",
                            }}
                          >
                            {dateFormatted}
                          </span>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      )}

      {/* VIEW 2: READING ARTICLE (記事閲覧 + 音声 + クイズ) */}
      {activeView === "reading" && currentArticle && currentLevelData && (
        <main className="view reading-view fade-in">
          {formatDriveUrl(currentArticle.imageUrl) && (
            <div className="article-hero">
              <img
                src={formatDriveUrl(currentArticle.imageUrl)}
                alt={typeof currentLevelData.title === "string" ? currentLevelData.title : currentLevelData.title?.fr}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const id = extractDriveId(currentArticle.imageUrl);
                  const fallback = id
                    ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000`
                    : "";
                  if (fallback && e.currentTarget.src !== fallback) {
                    e.currentTarget.src = fallback;
                  }
                }}
              />
            </div>
          )}

          <div className="article-header">
            {currentArticle.seriesId && (
              <p style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "var(--primary)", fontWeight: 800 }}>
                {currentArticle.seriesId.replace(/_/g, ' ')} • {currentArticle.seriesOrder || '?'} / {articles.filter(a => a.seriesId === currentArticle.seriesId).length}
              </p>
            )}
            <h2 lang="fr">{typeof currentLevelData.title === "string" ? currentLevelData.title : (currentLevelData.title as any)?.fr}</h2>
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
                {typeof currentArticle.category === "string" ? currentArticle.category : (currentArticle.category as any)?.[appLang] || "General"}
              </span>
              {currentArticle.date && (
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                    marginLeft: "auto",
                  }}
                >
                  {new Date(currentArticle.date).toLocaleDateString("ja-JP")}
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

          {/* Learning Layer */}
          {currentLevelData.learningGoal && (
             <div style={{ marginBottom: "20px", padding: "16px", borderRadius: "16px", background: "rgba(0, 122, 255, 0.05)" }}>
               <h3 style={{ margin: "0 0 8px 0", fontSize: "1.05rem", color: "var(--primary)", fontWeight: 800 }}>
                 この記事で学ぶこと
               </h3>
               <p style={{ margin: "0", fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)", lineHeight: "1.5" }}>
                 {typeof currentLevelData.learningGoal === 'string' 
                   ? currentLevelData.learningGoal 
                   : (currentLevelData.learningGoal as any)[appLang === 'ja' ? 'ja' : 'en'] || (currentLevelData.learningGoal as any).ja}
               </p>
             </div>
          )}
          {currentLevelData.targetVocabulary && currentLevelData.targetVocabulary.length > 0 && (
             <div style={{ marginBottom: "32px", padding: "16px", borderRadius: "16px", background: "var(--bg)", border: "1px solid var(--border)" }}>
               <h3 style={{ margin: "0 0 12px 0", fontSize: "1.05rem", color: "var(--text-main)", fontWeight: 800 }}>
                 今日の単語
               </h3>
               <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                 {currentLevelData.targetVocabulary.slice(0, 5).map((word, i) => (
                    <TargetVocabularyItem key={i} word={word} onClick={handleWordClick} />
                 ))}
               </div>
             </div>
          )}

          <div className="article-content" lang="fr">
            {renderInteractiveContent((currentLevelData.paragraphs || currentLevelData.segments || []))}
          </div>

          {/* Comprehension Quiz and Completion */}
          {((currentLevelData.quiz && currentLevelData.quiz.length > 0 && quizIndex >= currentLevelData.quiz.length) || noQuizCompleted) ? (
            <div className="quiz-section">
              {renderCompletionScreen()}
            </div>
          ) : (currentLevelData.quiz && currentLevelData.quiz.length > 0) ? (
            <div className="quiz-section">
              <h3>🧠 {appLang === 'ja' ? '理解度チェック' : 'Comprehension Check'}</h3>
              {(() => {
                const q = currentLevelData.quiz[quizIndex];
                if (!q.choices && !(Array.isArray(q.options))) {
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
                          Q {quizIndex + 1} / {currentLevelData.quiz?.length}
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
                    
                    <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px', lineHeight: '1.4' }} lang="fr">
                      {(q.question?.fr || q.prompt?.fr)}
                    </p>
                    {isQTranslated && (
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', marginTop: '0' }}>
                            {appLang === 'ja' ? (q.question?.ja || q.prompt?.ja) : (q.question?.en || q.prompt?.en)}
                        </p>
                    )}
                    {!isQTranslated && <div style={{ height: '16px' }} />}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {(q.choices || (Array.isArray(q.options) ? q.options : [])).map((choice, cIdx) => {
                        const key = choice.id || String(cIdx);
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
                          (q.choices || (Array.isArray(q.options) ? q.options : [])).find(c => c.id === selectedAnswer)?.isCorrect
                            ? "text-correct"
                            : "text-incorrect"
                        }`}
                      >
                        {(q.choices || (Array.isArray(q.options) ? q.options : [])).find(c => c.id === selectedAnswer)?.isCorrect
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
                onClick={() => setNoQuizCompleted(true)}
                style={{ width: "100%", padding: "16px", borderRadius: "16px", border: "none", background: "var(--primary)", color: "white", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer" }}
              >
                🎉 読み終わった (Mark as Completed)
              </button>
            </div>
          )}
        </main>
      )}

      {/* VIEW: VOCAB REVIEW */}
      {activeView === "vocab_review" && vocabReviewWords.length > 0 && (
        <main className="view fade-in" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '80vh', justifyContent: 'center' }}>
          {vocabReviewIndex < vocabReviewWords.length ? (
            <div className="fade-in">
              <h2 style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '40px' }}>{vocabReviewIndex + 1} / {vocabReviewWords.length}</h2>
              <div style={{ textAlign: 'center', margin: '40px 0' }}>
                <h1 style={{ fontSize: '2.5rem', color: 'var(--text-main)', marginBottom: '20px', fontWeight: 800 }}>{vocabReviewWords[vocabReviewIndex].fr}</h1>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {vocabReviewAnswers[vocabReviewIndex].map((ans, i) => {
                  const isCorrect = ans === (vocabReviewWords[vocabReviewIndex].conciseDef || vocabReviewWords[vocabReviewIndex].ja);
                  let bg = "var(--surface)";
                  let color = "var(--text-main)";
                  let border = "1px solid var(--border)";
                  
                  if (vocabReviewSelected !== null) {
                    if (isCorrect) {
                      bg = "rgba(76, 217, 100, 0.1)";
                      color = "#4cd964";
                      border = "1px solid #4cd964";
                    } else if (vocabReviewSelected === ans) {
                      bg = "rgba(255, 59, 48, 0.1)";
                      color = "#ff3b30";
                      border = "1px solid #ff3b30";
                    }
                  }
                  
                  return (
                    <button
                      key={i}
                      disabled={vocabReviewSelected !== null}
                      onClick={() => {
                        setVocabReviewSelected(ans);
                        setTimeout(() => {
                          setVocabReviewSelected(null);
                          setVocabReviewIndex(idx => idx + 1);
                        }, 1200);
                      }}
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        background: bg,
                        color: color,
                        border: border,
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        cursor: vocabReviewSelected !== null ? 'default' : 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        boxShadow: vocabReviewSelected === null ? '0 2px 8px rgba(0,0,0,0.04)' : 'none'
                      }}
                    >
                      {ans}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="fade-in" style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--surface)', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
              <h1 style={{ fontSize: '1.8rem', marginBottom: '16px', color: 'var(--text-main)' }}>復習完了！</h1>
              <p style={{ fontSize: '1.1rem', marginBottom: '32px', color: 'var(--text-muted)' }}>よくできました！</p>
              <button
                onClick={() => {
                  checkAndAwardVocabReviewXP();
                  setActiveView("home");
                  window.scrollTo(0,0);
                }}
                style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--primary)', color: 'white', fontSize: '1.1rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                ホームに戻る
              </button>
            </div>
          )}
        </main>
      )}

      {/* VIEW 3: WORDBOOK (単語帳) */}
      {activeView === "words" && (
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
                  onClick={() => setNewListModalOpen(true)}
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
                {wordLists.map((list) => {
                  const count = savedWords.filter(
                    (w) => (w.listId || "default") === list.id
                  ).length;
                  return (
                    <div
                      key={list.id}
                      onClick={() => setCurrentListId(list.id)}
                      className="quiz-card"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        marginBottom: 0,
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
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                          </svg>
                        </div>
                        <div>
                          <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                            {list.name === 'デフォルト' ? t.words.defaultList : list.name}
                          </h3>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                            {count} {t.words.wordCount}
                          </span>
                        </div>
                      </div>
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--text-muted)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "22px",
                  gap: "12px",
                }}
              >
                <button
                  onClick={() => setCurrentListId(null)}
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
                <h2
                  style={{
                    fontSize: "1.35rem",
                    fontWeight: 800,
                    color: "var(--primary)",
                    margin: 0,
                  }}
                >
                  {(() => {
                    const ln = wordLists.find((l) => l.id === currentListId)?.name;
                    if (ln === 'デフォルト') return t.words.defaultList;
                    return ln || t.words.list;
                  })()}
                </h2>
              </div>

              {(() => {
                const wordsInList = savedWords
                  .filter((w) => (w.listId || "default") === currentListId)
                  .slice()
                  .reverse();

                if (wordsInList.length === 0) {
                  return (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "50px 20px",
                        color: "var(--text-muted)",
                      }}
                    >
                      <p>
                        {t.words.emptyList.split('\n').map((line, i) => (
                          <React.Fragment key={i}>
                            {line}
                            {i === 0 && <br />}
                          </React.Fragment>
                        ))}
                      </p>
                    </div>
                  );
                }

                return wordsInList.map((word, idx) => (
                  <div
                    key={`${word.fr}-${idx}`}
                    className="quiz-card fade-in"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
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
                          <h3
                          lang="fr"
                          style={{
                            color: "var(--primary)",
                            margin: 0,
                            fontSize: "1.2rem",
                            fontWeight: 700,
                          }}
                        >
                          {word.originalWord &&
                          word.originalWord.toLowerCase() !== word.fr.toLowerCase() ? (
                            <>
                              {word.originalWord}{" "}
                              <span
                                style={{
                                  fontSize: "0.85rem",
                                  color: "var(--text-muted)",
                                  fontWeight: 400,
                                }}
                              >
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
                          onClick={() => speakWord(word.fr)}
                          title={t.words.listenPronunciation}
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
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
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
                          onClick={() => handleDeleteWord(word.fr, word.listId || "default")}
                          title={t.words.delete}
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
                          <svg
                            width="17"
                            height="17"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="dict-def-line">
                        {word.conciseDef || word.ja}
                      </div>
                      {word.phraseOriginale && word.traductionPhrase && (
                        <div className="dict-context-row" style={{ marginTop: "6px" }}>
                          <span className="dict-context-label">{t.dict.context}</span>
                          <span>{word.traductionPhrase}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </main>
      )}

      {/* Dictionary Floating Popup */}
      {dictOpen && (
        <div
          ref={popupRef}
          className={`dict-popup ${arrowTop ? "arrow-top" : ""}`}
          style={popupStyle}
        >
          <div className="dict-header">
            <div className="dict-word-container">
              <span className="dict-word" lang="fr">
                {dictData ? (
                  dictData.matchedLemma &&
                  dictData.matchedLemma.toLowerCase() !==
                    dictData.originalWord.toLowerCase() ? (
                    <>
                      {dictData.originalWord}{" "}
                      <span className="dict-lemma-hint">({dictData.mot})</span>
                    </>
                  ) : (
                    dictData.originalWord
                  )
                ) : (
                  "..."
                )}
              </span>
              {dictData?.nature && (
                <span className="dict-nature-tag">{dictData.nature}{dictData.gender && ` · ${dictData.gender}`}</span>
              )}
            </div>
            <div className="dict-buttons">
              <button
                className="dict-save-btn"
                title={t.dict.saveToList}
                onClick={() => {
                  if (!dictData) return;
                  if (wordLists.length <= 1) {
                    saveWordToList(wordLists[0]?.id || "default");
                  } else {
                    setListSelectorOpen(true);
                  }
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
                onClick={() => {
                  if (dictData) speakWord(dictData.mot);
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
            </div>
          </div>

          {dictLoading || !dictData ? (
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "4px 0" }}>
              {t.dict.loading}
            </div>
          ) : (
            <div>
              {dictData.conciseDef && (
                <div className="dict-def-line">{dictData.conciseDef}</div>
              )}
              {dictData.traductionPhrase ? (
                <div className="dict-context-row">
                  <span className="dict-context-label">{t.dict.context}</span>
                  <span>{dictData.traductionPhrase}</span>
                </div>
              ) : (
                !dictData.conciseDef && (
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    {t.dict.noDef}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* Audio Player Bottom Sheet (Visible in Reading View) */}
      <div className={`audio-panel ${activeView === "reading" ? "visible" : ""}`}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <button
            onClick={handleRestartAudio}
            title={t.reading.restartAudio}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-main)",
              cursor: "pointer",
              padding: "6px",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 2v6h6"></path>
              <path d="M3 8A9 9 0 1 1 12 21a9 9 0 0 1-9-9"></path>
            </svg>
          </button>

          <button
            onClick={handlePrevSentence}
            title={t.reading.prevSentence}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-main)",
              cursor: "pointer",
              padding: "6px",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="19 20 9 12 19 4 19 20"></polygon>
              <line x1="5" y1="19" x2="5" y2="5"></line>
            </svg>
          </button>

          <button
            onClick={handlePlayPause}
            title={t.reading.playPause}
            style={{
              background:
                isPlaying && !isPaused
                  ? "#FF9500"
                  : isPaused
                    ? "var(--green)"
                    : "var(--primary)",
              border: "none",
              color: "white",
              cursor: "pointer",
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 3px 10px rgba(94, 92, 230, 0.3)",
            }}
          >
            {isPlaying && !isPaused ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 3 20 12 6 21 6 3"></polygon>
              </svg>
            )}
          </button>

          <button
            onClick={handleNextSentence}
            title={t.reading.nextSentence}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-main)",
              cursor: "pointer",
              padding: "6px",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <line x1="19" y1="5" x2="19" y2="19"></line>
            </svg>
          </button>
        </div>

        <div className="audio-progress-container">
          <div
            className="audio-progress-bar"
            style={{ width: `${isPlaying || isPaused ? progressPercent : 0}%` }}
          ></div>
        </div>

        <div className="audio-options-row">
          <select
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
          </select>

          <select
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
            ) : (
              frVoices.map((v, i) => (
                <option key={i} value={i}>
                  {v.label}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Bottom Navigation (Visible on Home and Words views) */}
      {activeView !== "reading" && (
        <nav className="bottom-nav">
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
        </nav>
      )}

      {/* Filter Modal (Level / Category) */}
      {filterModalType !== null && (
        <div
          className="modal-overlay"
          onClick={() => setFilterModalType(null)}
        >
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                width: "40px",
                height: "5px",
                background: "#e5e5ea",
                borderRadius: "3px",
                margin: "0 auto 18px auto",
              }}
            />
            <h3
              style={{
                textAlign: "center",
                fontSize: "1.15rem",
                fontWeight: 700,
                marginBottom: "18px",
              }}
            >
              {filterModalType === "level" ? t.reading.selectLevel : t.reading.selectCategory}
            </h3>

            <div
              className={filterModalType === "category" ? "filter-grid" : ""}
              style={{
                display: filterModalType === "level" ? "flex" : undefined,
                flexDirection: filterModalType === "level" ? "column" : undefined,
                gap: "8px",
                overflowY: "auto",
              }}
            >
              {filterModalType === "level"
                ? LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      className="quiz-option"
                      style={{
                        borderColor:
                          globalLevel === lvl ? "var(--primary)" : "transparent",
                        background:
                          globalLevel === lvl ? "var(--primary-light)" : "var(--bg)",
                      }}
                      onClick={() => {
                        stopAudio();
                        setGlobalLevel(lvl);
                        if (currentArticle && currentArticle.levels[lvl]) {
                          buildQueueForText((currentArticle.levels[lvl].paragraphs || currentArticle.levels[lvl].segments || []));
                        }
                        setFilterModalType(null);
                      }}
                    >
                      {t.levels[lvl as keyof typeof t.levels] || lvl}
                    </button>
                  ))
                : allCategories.map((cat) => {
                    const isSelected = selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        className="quiz-option"
                        style={{
                          borderColor: isSelected ? "var(--primary)" : "#e5e5ea",
                          background: isSelected
                            ? "var(--primary-light)"
                            : "var(--surface)",
                        }}
                        onClick={() => {
                          if (isSelected) {
                            if (selectedCategories.length > 1) {
                              setSelectedCategories((prev) =>
                                prev.filter((c) => c !== cat)
                              );
                            }
                          } else {
                            setSelectedCategories((prev) => [...prev, cat]);
                          }
                        }}
                      >
                        {(() => {
                          if (appLang === 'ja') return cat;
                          const matchedArticle = articles.find(a => (typeof a.category === 'string' ? a.category : a.category?.ja) === cat);
                          return matchedArticle && typeof matchedArticle.category !== 'string' && matchedArticle.category?.[appLang] 
                            ? matchedArticle.category[appLang] 
                            : cat;
                        })()}
                      </button>
                    );
                  })}
            </div>
          </div>
        </div>
      )}

      {/* List Selector Modal (when saving a word and multiple lists exist) */}
      {listSelectorOpen && (
        <div
          className="modal-overlay"
          style={{ alignItems: "center" }}
          onClick={() => setListSelectorOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              padding: "24px",
              borderRadius: "20px",
              width: "88%",
              maxWidth: "340px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ textAlign: "center", fontSize: "1.15rem", fontWeight: 700, marginBottom: "16px" }}>
              {t.words.selectListToSave}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {wordLists.map((list) => {
                const count = savedWords.filter(
                  (w) => (w.listId || "default") === list.id
                ).length;
                return (
                  <button
                    key={list.id}
                    onClick={() => saveWordToList(list.id)}
                    style={{
                      padding: "12px 16px",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      fontSize: "0.95rem",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>
                      {list.name === 'デフォルト' ? t.words.defaultList : list.name}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {count} {t.words.wordCount}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setListSelectorOpen(false)}
              style={{
                marginTop: "16px",
                width: "100%",
                padding: "11px",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t.words.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Create New List Modal */}
      {newListModalOpen && (
        <div
          className="modal-overlay"
          style={{ alignItems: "center" }}
          onClick={() => setNewListModalOpen(false)}
        >
          <form
            onSubmit={handleCreateList}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              padding: "24px",
              borderRadius: "20px",
              width: "88%",
              maxWidth: "340px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ textAlign: "center", fontSize: "1.1rem", fontWeight: 700, marginBottom: "14px" }}>
              {t.words.newListNameTitle}
            </h3>
            <input
              type="text"
              required
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder={t.words.newListPlaceholder}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                fontSize: "0.95rem",
                marginBottom: "16px",
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setNewListModalOpen(false)}
                style={{
                  flex: 1,
                  padding: "11px",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t.words.cancel}
              </button>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: "11px",
                  background: "var(--primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t.words.create}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Newsletter 3-Step Profile Registration Modal */}
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
                  {["LVL_1", "LVL_2", "LVL_3", "LVL_4"].map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setLeadLevel(code);
                        setLeadError(null);
                      }}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "12px",
                        border:
                          leadLevel === code
                            ? "2px solid var(--primary)"
                            : "2px solid var(--border)",
                        background:
                          leadLevel === code
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
                        {t.levels[code as keyof typeof t.levels]}
                      </span>
                      {leadLevel === code && <span>✔️</span>}
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
}