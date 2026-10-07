"use client";

import { loadUserState, updateUserState, UserState, LearnedWord, mergeLearnedVocabulary } from "../lib/userState";
import { selectContinueArticle, selectRecommendedArticles, getStreakStatus, getNextReviewDayOffset, determineNextBestActionType } from "../lib/home";
import { getWordsDueForReview, recordReviewResult, getReviewStats } from "../lib/srs";
import { checkAndTrackSessionStart, updateSessionActivity, trackEvent } from "../lib/analytics";
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
// Reserved id for the read-only system list "📚 Furago — Mots appris".
// Never part of wordLists, so it cannot be renamed, deleted, or used as a save target.
const LEARNED_LIST_ID = "__furago_learned__";
const LEARNED_LIST_NAME = "📚 Furago — Mots appris";

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
    <button 
      type="button"
      onClick={(e) => onClick(e, word, "")}
      style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "12px", background: "var(--surface)", cursor: "pointer", border: "1px solid var(--border)", transition: "all 0.2s", width: "100%", textAlign: "left" }}
      className="target-vocab-item tap-word reset-button"
    >
      <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--primary)" }}>{word}</span>
      <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: 600 }}>{def}</span>
    </button>
  );
};
export default function FuragoApp({
  initialArticles,
}: {
  initialArticles: Article[];
}) {
  // Navigation & Views: "home" | "reading" | "words"
  const [activeView, setActiveView] = useState<"home" | "reading" | "words" | "vocab_review">("home");

  // Track if events have been fired to prevent duplicate events on React re-renders
  const analyticsFiredRef = useRef<Record<string, boolean>>({});

  // Throttle activity updates
  useEffect(() => {
    let lastUpdate = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > 60000) { // Max once per minute
        updateSessionActivity();
        lastUpdate = now;
      }
    };
    
    window.addEventListener("pointerdown", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    document.addEventListener("visibilitychange", handleActivity, { passive: true });
    
    return () => {
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      document.removeEventListener("visibilitychange", handleActivity);
    };
  }, []);

  // --- History API Layer ---
  const navigateTo = useCallback((view: typeof activeView, params?: Record<string, string>, replace = false) => {
    if (typeof window === "undefined") {
      setActiveView(view);
      return;
    }
    const query = new URLSearchParams();
    query.set("view", view);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) query.set(k, v);
      });
    }
    const url = `/?${query.toString()}`;
    const currentState = window.history.state || {};
    const historyIdx = replace ? (currentState.historyIdx || 0) : ((currentState.historyIdx || 0) + 1);
    
    const newState = { furago: true, view, historyIdx, ...params };
    if (replace) {
      window.history.replaceState(newState, "", url);
    } else {
      window.history.pushState(newState, "", url);
    }
    setActiveView(view);
  }, []);

  const handleBack = useCallback((fallbackView: typeof activeView) => {
    if (typeof window !== "undefined" && window.history.state?.historyIdx > 0) {
      window.history.back();
    } else {
      navigateTo(fallbackView, undefined, true);
    }
  }, [navigateTo]);



  // i18n States
  const [appLang, setAppLang] = useState<AppLanguage>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("furago_app_lang") as AppLanguage) || "ja";
    }
    return "ja";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("furago_app_lang", appLang);
    }
  }, [appLang]);
  const t = getTranslation(appLang);
  const [showTranslation, setShowTranslation] = useState<Record<number, boolean>>({});
  const [translatedQuizIds, setTranslatedQuizIds] = useState<Record<string, boolean>>({});
  
  // Session Rewards tracking for accurate completion screen
  const [sessionReward, setSessionReward] = useState<{ xp: number; vocab: number } | null>(null);


  // Articles & Filters
    const [userState, setReactUserState] = useState<UserState>(() => {
    if (typeof window !== 'undefined') return loadUserState();
    return {
      level: "LVL_1",
      savedVocabulary: [],
      learnedVocabulary: [],
      wordLists: [{ id: "default", name: "すべて" }],
      completedArticles: [],
      quizResults: [],
      perfectQuizResults: [],
      currentStreak: 0,
      longestStreak: 0,
      lastStreakDate: "",
      lastActivityDate: null,
      xp: 0,
      furagoLevel: 1,
      dailyMissionCompletedDate: "",
      dailyMissionXPDate: "",
      vocabReviewXPDate: "",
      lastOpenedArticleId: "",
      articleProgress: {},
    };
  });

  const userStateRef = useRef<UserState>(userState);

  const mutateUserState = useCallback((updater: Partial<UserState> | ((prev: UserState) => Partial<UserState>)) => {
    const prev = userStateRef.current;
    const updates = typeof updater === 'function' ? updater(prev) : updater;
    if (!updates || Object.keys(updates).length === 0) return;
    
    const next = { ...prev, ...updates };
    if (updates.xp !== undefined) {
      next.furagoLevel = Math.max(1, Math.floor(next.xp / 100) + 1);
    }
    
    userStateRef.current = next;
    import('../lib/userState').then(m => m.saveUserState(next));
    setReactUserState(next);
  }, []);

  const {
    level: globalLevel,
    wordLists,
    savedVocabulary: savedWords,
    learnedVocabulary: learnedWords,
    dailyMissionCompletedDate: lastCompletedDate,
    vocabReviewXPDate: lastVocabReviewDate,
    lastOpenedArticleId,
    currentStreak,
    longestStreak,
    lastStreakDate,
    xp: totalXP,
    furagoLevel,
    completedArticles: completedArticleIds,
    articleProgress: articleProgressMap
  } = userState;


  const [articles, setArticles] = useState<Article[]>(initialArticles || []);
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "success" | "offline" | "error">(
    (initialArticles && initialArticles.length > 0) ? "success" : "loading"
  );
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [filterModalType, setFilterModalType] = useState<"level" | "category" | null>(null);
  const filterDialogRef = useRef<HTMLDialogElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (filterModalType !== null) {
      if (filterDialogRef.current && !filterDialogRef.current.open) {
        filterDialogRef.current.showModal();
        // Focus first button (either level or close button)
      }
    } else {
      if (filterDialogRef.current && filterDialogRef.current.open) {
        filterDialogRef.current.close();
      }
      if (filterTriggerRef.current && document.contains(filterTriggerRef.current)) {
        filterTriggerRef.current.focus();
      }
    }
  }, [filterModalType]);

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

  const quizTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const queueIndexRef = useRef(0);
  const ttsQueueRef = useRef<TtsQueueItem[]>([]);
  const audioSpeedRef = useRef(1);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const dictRequestIdRef = useRef<number>(0);

  // Dictionary Popup State
  const [dictOpen, setDictOpen] = useState<boolean>(false);
  const [dictLoading, setDictLoading] = useState<boolean>(false);
  const [dictData, setDictData] = useState<DictLookupResult | null>(null);
  const [dictRect, setDictRect] = useState<DOMRect | null>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [arrowTop, setArrowTop] = useState<boolean>(false);
  const popupRef = useRef<HTMLDialogElement | null>(null);
  const dictTriggerRef = useRef<HTMLElement | null>(null);

  // Word Lists & Saved Words (単語帳)
  
  // System list (read-only): words Furago considers learned from completed articles.
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [listSelectorOpen, setListSelectorOpen] = useState<boolean>(false);
  const listSelectorDialogRef = useRef<HTMLDialogElement>(null);
  const listSelectorTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const dialog = listSelectorDialogRef.current;
    if (listSelectorOpen) {
      if (dialog && !dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog && dialog.open) {
        dialog.close();
      }
      if (listSelectorTriggerRef.current && document.contains(listSelectorTriggerRef.current)) {
        listSelectorTriggerRef.current.focus();
      }
    }
  }, [listSelectorOpen]);
  const [newListModalOpen, setNewListModalOpen] = useState<boolean>(false);
  const [newListName, setNewListName] = useState<string>("");
  const newListDialogRef = useRef<HTMLDialogElement>(null);
  const newListTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = newListDialogRef.current;
    if (newListModalOpen) {
      if (dialog && !dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog && dialog.open) {
        dialog.close();
      }
      if (newListTriggerRef.current && document.contains(newListTriggerRef.current)) {
        newListTriggerRef.current.focus();
      }
    }
  }, [newListModalOpen]);

  // Email Lead Bar, Multi-step Profile Modal & Toast
  const [showLeadBar, setShowLeadBar] = useState<boolean>(false);
  const [leadModalOpen, setLeadModalOpen] = useState<boolean>(false);
  const leadDialogRef = useRef<HTMLDialogElement>(null);
  const leadTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = leadDialogRef.current;
    if (leadModalOpen) {
      if (dialog && !dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog && dialog.open) {
        dialog.close();
      }
      if (leadTriggerRef.current && document.contains(leadTriggerRef.current)) {
        leadTriggerRef.current.focus();
      }
    }
  }, [leadModalOpen]);

  const [leadStep, setLeadStep] = useState<1 | 2 | 3>(1);
  const [leadEmail, setLeadEmail] = useState<string>("");
  const [leadFirstName, setLeadFirstName] = useState<string>("");
  const [leadLevel, setLeadLevel] = useState<string>("LVL_1");
  const [leadCategories, setLeadCategories] = useState<string[]>([]);
  const [leadSubmitting, setLeadSubmitting] = useState<boolean>(false);
  const [leadCheckingEmail, setLeadCheckingEmail] = useState<boolean>(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const todayStr = new Date().toLocaleDateString("en-CA"); // local timezone YYYY-MM-DD
  const isMissionCompletedToday = lastCompletedDate === todayStr;
  const isVocabReviewCompletedToday = lastVocabReviewDate === todayStr;

  const updateStreak = useCallback(() => {
    const today = new Date().toLocaleDateString("en-CA");
    const state = userStateRef.current;
    const storedDate = state.lastStreakDate;
    if (storedDate === today) return;

    let cs = state.currentStreak;
    let ls = state.longestStreak;

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
    mutateUserState({
      currentStreak: cs,
      longestStreak: ls,
      lastStreakDate: today,
    });
  }, [mutateUserState]);

  // XP State and logic

  const getSeriesInfo = useCallback((article: Article | null | undefined, level: string) => {
    if (!article || !article.seriesId || typeof article.seriesOrder !== "number") return null;

    const members = articles
      .filter(a => a.seriesId === article.seriesId && typeof a.seriesOrder === "number" && a.levels && a.levels[level])
      .sort((a, b) => {
        if (a.seriesOrder === b.seriesOrder) return String(a.id).localeCompare(String(b.id));
        return (a.seriesOrder as number) - (b.seriesOrder as number);
      });

    const currentIndex = members.findIndex(a => a.id === article.id);
    if (currentIndex === -1) return null;

    const nextEp = currentIndex + 1 < members.length ? members[currentIndex + 1] : null;

    return { members, currentIndex, total: members.length, nextEp };
  }, [articles]);



  const checkAndAwardArticleXP = useCallback((articleId: string, targetVocab?: string[]) => {
    const state = userStateRef.current;
    const updates: Partial<import("../lib/userState").UserState> = {};
    let awardedXP = 0;
    let newVocabCount = 0;

    const done = [...state.completedArticles];
    const progressKey = `${articleId}::${state.level}`;
    const newProgress = { ...state.articleProgress };

    if (newProgress[progressKey] !== undefined) {
      delete newProgress[progressKey];
      updates.articleProgress = newProgress;
    }

    if (!done.includes(articleId)) {
      done.push(articleId);
      updates.completedArticles = done;
      awardedXP += 20;

      if (targetVocab && targetVocab.length > 0) {
        const oldLen = state.learnedVocabulary.length;
        const newLearnedVocab = mergeLearnedVocabulary(state.learnedVocabulary, targetVocab, articleId);
        updates.learnedVocabulary = newLearnedVocab;
        newVocabCount = newLearnedVocab.length - oldLen;
      }
    }
    
    if (awardedXP > 0) {
      updates.xp = state.xp + awardedXP;
    }

    if (Object.keys(updates).length > 0) {
      mutateUserState(updates);
    }
    
    return { awardedXP, newVocabCount };
  }, [mutateUserState]);

  const checkAndAwardQuizXP = useCallback((articleId: string, isPerfect: boolean) => {
    const state = userStateRef.current;
    const updates: Partial<import("../lib/userState").UserState> = {};
    let awardedXP = 0;
    
    const doneQ = [...state.quizResults];
    if (!doneQ.includes(articleId)) {
      doneQ.push(articleId);
      updates.quizResults = doneQ;
      awardedXP += 10;
    }
    
    if (isPerfect) {
      const doneP = [...state.perfectQuizResults];
      if (!doneP.includes(articleId)) {
        doneP.push(articleId);
        updates.perfectQuizResults = doneP;
        awardedXP += 5;
      }
    }
    
    if (awardedXP > 0) {
      updates.xp = state.xp + awardedXP;
    }

    if (Object.keys(updates).length > 0) {
      mutateUserState(updates);
    }
    
    return awardedXP;
  }, [mutateUserState]);

  const checkAndAwardDailyMissionXP = useCallback(() => {
    const state = userStateRef.current;
    const lastDate = state.dailyMissionXPDate;
    const today = new Date().toLocaleDateString("en-CA");
    if (lastDate !== today) {
      mutateUserState({ dailyMissionXPDate: today, xp: state.xp + 10 });
      return 10;
    }
    return 0;
  }, [mutateUserState]);

  const checkAndAwardVocabReviewXP = useCallback(() => {
    const today = new Date().toLocaleDateString("en-CA");
    mutateUserState((prev) => {
      if (prev.vocabReviewXPDate !== today) {
        return { vocabReviewXPDate: today, xp: prev.xp + 10 };
      }
      return {};
    });
  }, [mutateUserState]);

  const [vocabReviewIndex, setVocabReviewIndex] = useState(0);
  const [vocabReviewCorrectCount, setVocabReviewCorrectCount] = useState(0);
  const [vocabReviewWords, setVocabReviewWords] = useState<SavedWord[]>([]);
  const [vocabReviewAnswers, setVocabReviewAnswers] = useState<string[][]>([]);
  const [vocabReviewSelected, setVocabReviewSelected] = useState<string | null>(null);
  const [vocabReviewReturnTo, setVocabReviewReturnTo] = useState<"home" | "words" | "reading">("home");
  const [vocabReviewSource, setVocabReviewSource] = useState<"saved" | "learned">("saved");

  const handleRecordReviewResult = useCallback((word: SavedWord, isCorrect: boolean) => {
    // Only record SRS results for genuine learned/SRS words
    const isSRSWord = vocabReviewSource === "learned" || word.listId === "learned";
    if (!isSRSWord) return;

    mutateUserState((prev) => {
      const currentLearned = prev.learnedVocabulary || [];
      const lwIndex = currentLearned.findIndex(
        (w) => w.word.toLowerCase() === word.fr.toLowerCase()
      );
      if (lwIndex === -1) return {};

      const nextLw = recordReviewResult(currentLearned[lwIndex], isCorrect);
      const newLearned = [...currentLearned];
      newLearned[lwIndex] = nextLw;
      return { learnedVocabulary: newLearned };
    });
  }, [vocabReviewSource, mutateUserState]);

  const startVocabReview = async (source: "saved" | "learned" = "saved", returnTo: "home" | "words" | "reading" = "home") => {
    setVocabReviewSource(source);
    let sourceWords: import("../lib/userState").SavedWord[] = [];

    if (source === "saved") {
      sourceWords = savedWords;
    } else {
      const currentLearned = learnedWords;
      if (currentLearned.length === 0) return;
      
      const dueWords = getWordsDueForReview(currentLearned, Date.now());
      const wordsToReview = dueWords.slice(0, 5); // limit to 5 per session
      
      trackEvent("srs_session_started", { due_count: wordsToReview.length });
      
      const resolvedWords: import("../lib/userState").SavedWord[] = [];
      
      for (const lw of wordsToReview) {
         const dictRes = await DictionaryService.lookupWord(lw.word, "");
         resolvedWords.push({
            fr: lw.word,
            originalWord: lw.word,
            conciseDef: dictRes?.conciseDef || dictRes?.definitions?.[0] || "",
            ja: "",
            nature: dictRes?.nature || "",
            gender: dictRes?.gender || "",
            phraseOriginale: dictRes?.phraseOriginale || "",
            traductionPhrase: dictRes?.traductionPhrase || "",
            date: new Date().toLocaleDateString("en-CA"),
            listId: "learned"
         });
      }
      sourceWords = resolvedWords;
    }

    if (sourceWords.length === 0) {
      setVocabReviewWords([]);
      setVocabReviewAnswers([]);
      setVocabReviewIndex(0);
      setVocabReviewCorrectCount(0);
      setVocabReviewSelected(null);
      setVocabReviewReturnTo(returnTo);
      navigateTo("vocab_review", { returnTo });
      return;
    }

    let selected = [...sourceWords];
    if (source === "saved") {
      selected = [...sourceWords].sort(() => 0.5 - Math.random());
      const uniqueFrSelected: import("../lib/userState").SavedWord[] = [];
      const seenFr = new Set<string>();
      for (const w of selected) {
        if (!seenFr.has(w.fr)) {
          seenFr.add(w.fr);
          uniqueFrSelected.push(w);
        }
        if (uniqueFrSelected.length === 5) break;
      }
      selected = uniqueFrSelected;
    }
    // Note: for "learned", 'selected' is already deterministic and unique based on SRS!

    const poolSource = source === "saved" ? savedWords : learnedWords.map(w => ({ conciseDef: "" })); // we need distracters!
    // Wait, let's just use Dictionary definitions for distracters or previous answers
    let allMeanings: string[] = [];
    if (source === "saved") {
        allMeanings = Array.from(new Set(savedWords.map(w => w.conciseDef || w.ja).filter(Boolean)));
    } else {
        // Fallback: we need distracters for learned words. We can just use definitions from the resolved words themselves, or fetch random ones.
        // Actually, let's use the resolved words + some random saved words meanings if needed.
        const pool = [...selected, ...savedWords.slice(0, 20)];
        allMeanings = Array.from(new Set(pool.map(w => w.conciseDef || w.ja).filter(Boolean)));
    }
    
    const optionsList = selected.map(word => {
       const correctMeaning = word.conciseDef || word.ja;
       let choices: string[] = [];
       
       if (allMeanings.length <= 1) {
         choices = [];
       } else if (allMeanings.length <= 3) {
         choices = [...allMeanings];
       } else {
         const others = allMeanings.filter(m => m !== correctMeaning);
         others.sort(() => 0.5 - Math.random());
         choices = [correctMeaning, ...others.slice(0, 3)];
       }
       
       choices.sort(() => 0.5 - Math.random());
       return choices;
    });
    
    setVocabReviewWords(selected);
    setVocabReviewAnswers(optionsList);
    setVocabReviewIndex(0);
    setVocabReviewCorrectCount(0);
    setVocabReviewSelected(null);
    setVocabReviewReturnTo(returnTo);
    navigateTo("vocab_review", { returnTo });
  };


  useEffect(() => {
    if (articles.length === 0) return;
    const target = userState.dailyMissionTarget;
    if (!target || target.date !== todayStr || target.level !== globalLevel) {
      const available = articles.filter(a => a.levels && a.levels[globalLevel]);
      if (available.length === 0) return;
      const sorted = [...available].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const uncompleted = sorted.filter(a => !completedArticleIds.includes(String(a.id)));
      const validPool = uncompleted.length > 0 ? uncompleted : sorted;
      const featured = validPool.filter(a => a.featured);
      const pool = featured.length > 0 ? featured : validPool;
      const seed = new Date(todayStr).getTime() / 86400000;
      const index = Math.abs(Math.floor(seed)) % pool.length;
      const selected = pool[index];
      
      mutateUserState(s => ({
        dailyMissionTarget: { date: todayStr, articleId: String(selected.id), level: globalLevel }
      }));
    }
  }, [articles, globalLevel, todayStr, userState.dailyMissionTarget, completedArticleIds, mutateUserState]);

  const dailyArticle = React.useMemo(() => {
    const target = userState.dailyMissionTarget;
    if (!target || target.date !== todayStr || target.level !== globalLevel) return null;
    return articles.find(a => String(a.id) === target.articleId) || null;
  }, [articles, userState.dailyMissionTarget, todayStr, globalLevel]);



  // Time state for pure rendering of SRS counts
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNowMs(Date.now());
    const id = setInterval(update, 60000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, []);

    // --- Home Scroll Restoration ---
  useEffect(() => {
    if (activeView !== "home") return;
    if (typeof window === "undefined") return;

    const idx = window.history.state?.historyIdx || 0;
    let rafId: number | null = null;

    const saved = sessionStorage.getItem("furago_home_scroll_" + idx);
    if (saved) {
      const pos = parseInt(saved, 10);
      if (!isNaN(pos) && pos > 0) {
        let attempts = 0;
        const MAX_ATTEMPTS = 15;
        const tolerance = 50;

        const tryRestore = () => {
          attempts++;
          const currentHeight = document.documentElement.scrollHeight;
          const viewportHeight = window.innerHeight;

          if (currentHeight >= pos + viewportHeight - tolerance || attempts >= MAX_ATTEMPTS) {
            window.scrollTo({ top: pos, behavior: "instant" });
          } else {
            rafId = requestAnimationFrame(tryRestore);
          }
        };
        rafId = requestAnimationFrame(tryRestore);
      } else if (pos === 0) {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    let scrollTimeout: NodeJS.Timeout | null = null;
    const handleHomeScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        sessionStorage.setItem("furago_home_scroll_" + idx, window.scrollY.toString());
        scrollTimeout = null;
      }, 150);
    };

    window.addEventListener("scroll", handleHomeScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleHomeScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
        sessionStorage.setItem("furago_home_scroll_" + idx, window.scrollY.toString());
      }
    };
  }, [activeView]);

  // --- Reading Progress Tracking & Restoration ---
  useEffect(() => {
    if (activeView !== "reading" || !currentArticle) return;

    const progressKey = `${currentArticle.id}::${globalLevel}`;
    const state = userStateRef.current;
    const savedRatio = state.articleProgress?.[progressKey];

    // Restore position after initial render
    let restoreTimeout: NodeJS.Timeout;
    if (savedRatio && savedRatio > 0 && savedRatio <= 1) {
      restoreTimeout = setTimeout(() => {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollHeight > 0) {
          window.scrollTo({ top: scrollHeight * savedRatio, behavior: "instant" });
        }
      }, 150); // slight delay to allow images/layout to settle
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    // Scroll listener to save position
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollHeight <= 0) return;
        
        let ratio = window.scrollY / scrollHeight;
        if (ratio < 0) ratio = 0;
        if (ratio > 1) ratio = 1;

        // Only save if meaningful movement (e.g., beyond the top 5% or restoring)
        if (ratio > 0.05 || ratio === 0) {
          const currentState = loadUserState();
          mutateUserState({
            articleProgress: {
              ...currentState.articleProgress,
              [progressKey]: ratio
            }
          });
        }
      }, 500); // Debounce saves
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      if (restoreTimeout) clearTimeout(restoreTimeout);
    };
  }, [activeView, currentArticle, globalLevel]);

  useEffect(() => {
    if (activeView === "reading" && currentArticle) {
      const q = currentArticle.levels[globalLevel]?.quiz;
      if (!q || q.length === 0) {
        if (noQuizCompleted) {
          if (sessionReward === null) {
            // Intentional: completion rewards are applied when the completion state is reached (deduplicated in userState).
            // eslint-disable-next-line react-hooks/set-state-in-effect
            updateStreak();
            const artRes = checkAndAwardArticleXP(
              currentArticle.id.toString(),
              currentArticle.levels[globalLevel]?.targetVocabulary
            );
            
            trackEvent("article_completed", { article_id: String(currentArticle.id) });
            
            let totalXP = artRes.awardedXP;
            if (dailyArticle && currentArticle.id === dailyArticle.id) {
              mutateUserState({ dailyMissionCompletedDate: todayStr });
              trackEvent("mission_completed", { article_id: String(currentArticle.id) });
              totalXP += checkAndAwardDailyMissionXP();
            }
            setSessionReward({ xp: totalXP, vocab: artRes.newVocabCount });
          }
        }
      } else if (quizIndex >= q.length) {
        if (sessionReward === null) {
          updateStreak();
          const artRes = checkAndAwardArticleXP(
            currentArticle.id.toString(),
            currentArticle.levels[globalLevel]?.targetVocabulary
          );
          
          trackEvent("article_completed", { article_id: String(currentArticle.id) });
          
          let totalXP = artRes.awardedXP;
          totalXP += checkAndAwardQuizXP(currentArticle.id.toString(), quizScore === q.length);
          if (dailyArticle && currentArticle.id === dailyArticle.id) {
            mutateUserState({ dailyMissionCompletedDate: todayStr });
            trackEvent("mission_completed", { article_id: String(currentArticle.id) });
            totalXP += checkAndAwardDailyMissionXP();
          }
          setSessionReward({ xp: totalXP, vocab: artRes.newVocabCount });
        }
      }
    }
  }, [activeView, currentArticle, globalLevel, quizIndex, quizScore, updateStreak, checkAndAwardArticleXP, checkAndAwardQuizXP, noQuizCompleted, dailyArticle, todayStr, checkAndAwardDailyMissionXP, sessionReward]);

  const { continueArticle, currentSeriesNextEp } = React.useMemo(() => {
    let nextEp: Article | null = null;
    if (lastOpenedArticleId) {
      const last = articles.find(a => String(a.id) === String(lastOpenedArticleId));
      if (last && completedArticleIds.includes(String(last.id))) {
         const info = getSeriesInfo(last, globalLevel);
         if (info?.nextEp) nextEp = info.nextEp;
      }
    }
    const contMatch = selectContinueArticle(articles, globalLevel, completedArticleIds, articleProgressMap, lastOpenedArticleId || "");
    return { continueArticle: contMatch?.article || null, currentSeriesNextEp: nextEp };
  }, [articles, globalLevel, completedArticleIds, articleProgressMap, lastOpenedArticleId, getSeriesInfo]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  // 1. Initialize Dictionary, LocalStorage, Voices, and refresh Articles
  useEffect(() => {
    DictionaryService.init();

    // Load centralized user state
    try {
      const state = loadUserState();
      userStateRef.current = state;
      setReactUserState(state);
      
      const wordsDue = (state.learnedVocabulary || []).filter(w => w.dueAt <= Date.now()).length;
      checkAndTrackSessionStart(state.currentStreak || 0, wordsDue);

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
    const fetchCatalog = () => {
      if (!articles || articles.length === 0) setCatalogStatus("loading");
      fetch(DATA_URL)
        .then((res) => {
          if (!res.ok) throw new Error("Fetch failed");
          return res.json();
        })
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
            setCatalogStatus("success");
          } else {
            throw new Error("Invalid format");
          }
        })
        .catch(() => {
          setCatalogStatus(prev => prev === "success" || (articles && articles.length > 0) ? "offline" : "error");
        });
    };
    fetchCatalog();
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
      const offset = currentIndex;
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
        // Intentional recursion: onend runs asynchronously, after this stable ([] deps) callback is initialized.
        // eslint-disable-next-line react-hooks/immutability
        playNextInQueue();
      }
    };

    utterance.onerror = (e) => {
      if (e.error === "canceled") return;

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

    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

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

    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

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
  const openArticle = (article: Article, skipHistory = false, source?: "home_continue" | "home_mission" | "catalog" | "recommendation") => {
    if (quizTimerRef.current) {
      clearTimeout(quizTimerRef.current);
      quizTimerRef.current = null;
    }
    stopAudio();
    setDictOpen(false);
    setCurrentArticle(article);
    
    mutateUserState({ lastOpenedArticleId: article.id.toString() });
    
    if (source) {
      trackEvent("article_started", { article_id: String(article.id), source });
    }
    
    setQuizIndex(0);
    setQuizScore(0);
    setNoQuizCompleted(false);
    setSelectedAnswer(null);
    setSessionReward(null);
    const levelData = article.levels[globalLevel];
    if (levelData) {
      buildQueueForText((levelData.paragraphs || levelData.segments || []));
    }
    
    if (skipHistory) {
      setActiveView("reading");
    } else {
      navigateTo("reading", { id: String(article.id), level: globalLevel });
    }
  };

  // Initialization and PopState
  useEffect(() => {
    if (typeof window === "undefined") return;

    const query = new URLSearchParams(window.location.search);
    const urlView = query.get("view") as typeof activeView | null;
    
    if (!urlView || !["home", "reading", "words", "vocab_review"].includes(urlView)) {
      navigateTo("home", undefined, true);
    } else {
      const state: Record<string, string | number | boolean> = { furago: true, view: urlView, historyIdx: window.history.state?.historyIdx || 0 };
      if (urlView === "reading") {
        const id = query.get("id");
        const level = query.get("level");
        if (id) Object.assign(state, { id, level });
      } else if (urlView === "vocab_review") {
        const returnTo = query.get("returnTo");
        if (returnTo) Object.assign(state, { returnTo });
      }
      window.history.replaceState(state, "", window.location.href);
      setActiveView(urlView);
    }

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      if (!state || !state.furago) {
        const query = new URLSearchParams(window.location.search);
        const urlView = query.get("view") as typeof activeView | null;
        
        if (urlView && ["home", "reading", "words", "vocab_review"].includes(urlView)) {
          if (urlView === "vocab_review") {
            const returnTo = query.get("returnTo");
            if (returnTo) setVocabReviewReturnTo(returnTo as "home" | "words" | "reading");
          }
          setActiveView(urlView);
        } else {
          setActiveView("home");
        }
        return;
      }
      
      const { view, returnTo } = state;
      if (view === "vocab_review" && returnTo) {
        setVocabReviewReturnTo(returnTo);
      }
      setActiveView(view);
    };
    
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigateTo]);

  // Sync Reading View on popstate or direct URL load
  useEffect(() => {
    if (activeView !== "reading" || articles.length === 0) return;
    const query = new URLSearchParams(window.location.search);
    const id = query.get("id");
    
    if (currentArticle && String(currentArticle.id) === id) return;
    
    if (id) {
      const art = articles.find(a => String(a.id) === id);
      if (art) {
        openArticle(art, true);
      } else {
        navigateTo("home", undefined, true);
      }
    }
  }, [activeView, articles, currentArticle, navigateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Safety cleanup for quiz timer
  useEffect(() => {
    if (activeView !== "reading" && quizTimerRef.current) {
      clearTimeout(quizTimerRef.current);
      quizTimerRef.current = null;
    }
  }, [activeView]);

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

    dictTriggerRef.current = document.activeElement as HTMLElement;

    const reqId = ++dictRequestIdRef.current;

    const rect = e.currentTarget.getBoundingClientRect();
    setDictRect(rect);
    setDictOpen(true);
    setDictLoading(true);
    setDictData(null);

    const result = await DictionaryService.lookupWord(word, paragraphText, appLang as "ja" | "en");
    
    if (dictRequestIdRef.current === reqId) {
      setDictData(result);
      setDictLoading(false);
    }
  };

  // Manage Dictionary Focus Restoration
  useEffect(() => {
    if (!dictOpen && dictTriggerRef.current) {
      dictTriggerRef.current.focus();
      dictTriggerRef.current = null;
    }
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
    
    mutateUserState({ savedVocabulary: updated });
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
    
    mutateUserState({ wordLists: updated });
    setNewListName("");
    setNewListModalOpen(false);
    showToast(t.toasts.listCreated);
  };

  // Delete saved word
  const handleDeleteWord = (wordFr: string, listId: string) => {
    const updated = savedWords.filter(
      (w) => !(w.fr === wordFr && w.listId === listId)
    );
    
    mutateUserState({ savedVocabulary: updated });
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
    leadTriggerRef.current = document.activeElement as HTMLElement;
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
    const lvl = article.levels[globalLevel];
    if (!lvl.paragraphs?.length && !lvl.segments?.length) return false;
    return true;
  });

  const getLevelProgress = (xp: number, currentLevel: number) => {
    const xpInCurrentLevel = xp % 100;
    return {
      xpIntoLevel: xpInCurrentLevel,
      xpToNextLevel: 100 - xpInCurrentLevel,
      nextLevel: currentLevel + 1,
      ratio: xpInCurrentLevel / 100
    };
  };

  const getArticleTitle = (a: Article): string => {
    const title = a.levels[globalLevel]?.title;
    return (typeof title === "string" ? title : title?.fr) || a.originalTitle || "";
  };
  const getCategoryLabel = (a: Article): string =>
    typeof a.category === "string" ? a.category : (a.category?.[appLang] || a.category?.ja || "");
  const getCategoryKey = (a: Article): string =>
    (typeof a.category === "string" ? a.category : a.category?.ja || "").trim();

  const levelProgress = getLevelProgress(totalXP, furagoLevel);
  const streakStatus = getStreakStatus(currentStreak, lastStreakDate, todayStr);
  const dueReviewCount = getWordsDueForReview(learnedWords, nowMs).length;
  const nextReviewOffset = dueReviewCount === 0 ? getNextReviewDayOffset(learnedWords, nowMs) : null;
  const continueTarget: Article | null = continueArticle ?? currentSeriesNextEp;
  
  let continueRatio = 0;
  if (continueTarget && continueTarget === continueArticle) {
     continueRatio = articleProgressMap[`${continueTarget.id}::${globalLevel}`] || 0;
  }
  const continuePercent = Math.round(continueRatio * 100);
  
  const missionIsContinue = !!dailyArticle && !!continueTarget && String(dailyArticle.id) === String(continueTarget.id);
  const nextBestActionType = determineNextBestActionType(
    dueReviewCount,
    !!continueTarget,
    !!dailyArticle,
    isMissionCompletedToday
  );
  const recommendedArticles = selectRecommendedArticles(
    filteredArticles,
    completedArticleIds,
    [continueTarget?.id, dailyArticle?.id].filter((id): id is string | number => id !== undefined && id !== null),
    getCategoryKey,
    3
  );

  const getNextArticleFor = useCallback((article: Article | null): Article | null => {
    if (!article) return null;
    const validArticles = filteredArticles;
    if (validArticles.length <= 1) return null;

    const currentIndex = validArticles.findIndex(a => a.id === article.id);
    if (currentIndex === -1) return null;

    const completed = completedArticleIds || [];

    // Look forward
    for (let i = currentIndex + 1; i < validArticles.length; i++) {
      if (!completed.includes(String(validArticles[i].id))) return validArticles[i];
    }
    // Look from start
    for (let i = 0; i < currentIndex; i++) {
      if (!completed.includes(String(validArticles[i].id))) return validArticles[i];
    }
    
    // Fallback: Just next article in the filtered list
    return validArticles[(currentIndex + 1) % validArticles.length];
  }, [filteredArticles, completedArticleIds]);

  const homeCard: React.CSSProperties = { background: "var(--surface)", borderRadius: "18px", border: "1px solid var(--border)", padding: "14px", marginBottom: "4px", boxSizing: "border-box", maxWidth: "100%" };
  const homeSectionLabel: React.CSSProperties = { fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", margin: "20px 0 8px" };
  const homeMeta: React.CSSProperties = { margin: "4px 0 0", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, overflowWrap: "anywhere" };
  const homeTitle: React.CSSProperties = { margin: 0, fontSize: "1.02rem", fontWeight: 700, lineHeight: 1.3, color: "var(--text-main)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" };
  const homeCompactLine: React.CSSProperties = { margin: 0, padding: "12px 14px", borderRadius: "14px", background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.9rem", fontWeight: 600, color: "var(--text-muted)", overflowWrap: "anywhere" };
  const homeCtaPrimary: React.CSSProperties = { width: "100%", minHeight: "48px", padding: "12px 16px", borderRadius: "14px", border: "none", background: "var(--primary)", color: "white", fontSize: "1.02rem", fontWeight: 800, cursor: "pointer" };
  const homeCtaSecondary: React.CSSProperties = { ...homeCtaPrimary, background: "var(--primary-light)", color: "var(--primary)" };
  const homeCta = (isPrimary: boolean) => (isPrimary ? homeCtaPrimary : homeCtaSecondary);
  const homeThumb = (size: number): React.CSSProperties => ({ width: size, height: size, borderRadius: "12px", overflow: "hidden", flexShrink: 0, background: "var(--bg)" });

  // --- ANALYTICS: HOME VIEWED ---
  useEffect(() => {
    if (activeView === "home") {
      const key = `home_viewed_${dueReviewCount}_${dailyArticle?.id || 'none'}_${continueTarget?.id || 'none'}`;
      if (!analyticsFiredRef.current[key]) {
        trackEvent("home_viewed", {
          srs_due_count: dueReviewCount,
          has_daily_mission: !!dailyArticle,
          has_continue_article: !!continueTarget
        });
        analyticsFiredRef.current[key] = true;
      }
    }
  }, [activeView, dueReviewCount, dailyArticle, continueTarget]);

  // --- ANALYTICS: SRS SESSION COMPLETED ---
  useEffect(() => {
    if (activeView === "vocab_review" && vocabReviewWords.length > 0 && vocabReviewIndex === vocabReviewWords.length) {
      const key = `srs_completed_${vocabReviewWords.length}_${vocabReviewCorrectCount}_${Date.now()}`;
      if (!analyticsFiredRef.current['srs_completed_fired']) {
        trackEvent("srs_session_completed", { 
          reviewed_count: vocabReviewWords.length, 
          correct_count: vocabReviewCorrectCount 
        });
        analyticsFiredRef.current['srs_completed_fired'] = true;
      }
    } else if (activeView !== "vocab_review" || vocabReviewIndex === 0) {
      // Reset when starting a new review or leaving
      analyticsFiredRef.current['srs_completed_fired'] = false;
    }
  }, [activeView, vocabReviewIndex, vocabReviewWords.length, vocabReviewCorrectCount]);

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
            <button
              type="button"
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

  const currentSeriesInfo = currentArticle ? getSeriesInfo(currentArticle, globalLevel) : null;
  const quizNextEp = currentArticle?.seriesId ? currentSeriesInfo?.nextEp : null;
  const nextRewardEp = currentArticle?.seriesId ? currentSeriesInfo?.nextEp : null;
  const nextRewardArticle = getNextArticleFor(currentArticle);
  const dueRemaining = vocabReviewSource === "learned"
    ? getWordsDueForReview(learnedWords, nowMs).length
    : 0;

  const renderCompletionScreen = () => {
    const hasQuiz = currentLevelData?.quiz && currentLevelData.quiz.length > 0;
    const sInfo = currentSeriesInfo;
    const nextArticle = getNextArticleFor(currentArticle);

    return (
      <div className="quiz-card fade-in" style={{ textAlign: "center", padding: "32px 24px" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "24px", color: "var(--text-main)", fontWeight: 800 }}>
          {appLang === "ja" ? "🎉 記事を完了しました" : "🎉 Article Completed"}
        </h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px", background: "var(--bg)", padding: "16px 20px", borderRadius: "16px", textAlign: "left" }}>
          {hasQuiz && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>{appLang === "ja" ? "スコア" : "Score"}</span>
              <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>{quizScore} / {currentLevelData.quiz?.length}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>{appLang === "ja" ? "獲得 XP" : "Earned XP"}</span>
            <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--primary)" }}>
              {sessionReward === null ? "..." : `+${sessionReward.xp} XP`}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>{appLang === "ja" ? "ストリーク" : "Streak"}</span>
            <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#ff9500" }}>🔥 {currentStreak} {appLang === 'ja' ? '日' : 'days'}</span>
          </div>
          {sessionReward !== null && sessionReward.vocab > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
              <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>{appLang === "ja" ? "新出単語" : "New Words"}</span>
              <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>📚 {sessionReward.vocab} {appLang === 'ja' ? '件' : 'items'}</span>
            </div>
          )}
          {(() => {
             const stats = getReviewStats(learnedWords, nowMs);
             if (stats.dueToday > 0) {
               return (
                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                   <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>{appLang === "ja" ? "復習待ち" : "Due for Review"}</span>
                   <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--primary)" }}>🔄 {stats.dueToday} {appLang === 'ja' ? '件' : 'items'}</span>
                 </div>
               );
             }
             return null;
          })()}
        </div>

        {currentArticle?.seriesId && sInfo && (
          <div style={{ marginBottom: "28px", padding: "16px", borderRadius: "16px", border: "1px solid var(--border)", background: "var(--bg)" }}>
            <p style={{ margin: "0 0 6px 0", fontSize: "0.95rem", color: "var(--primary)", fontWeight: 800 }}>
              {currentArticle.seriesId.replace(/_/g, ' ')}
            </p>
            <p style={{ margin: "0", fontWeight: 700, color: "var(--text-main)" }}>
              Article {sInfo.currentIndex + 1} / {sInfo.total}
            </p>
          </div>
        )}

        {(() => {
          const stats = getReviewStats(learnedWords, nowMs);
          const hasVocabToReview = (sessionReward !== null && sessionReward.vocab > 0) || stats.dueToday > 0;
          
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {hasVocabToReview && (
                <button
                  type="button"
                  onClick={() => startVocabReview("learned", "reading")}
                  style={{ width: "100%", padding: "14px", borderRadius: "16px", border: "none", background: "var(--primary)", color: "white", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  🔄 {appLang === "ja" ? "単語を復習する" : "Review Vocabulary"}
                </button>
              )}

              {currentArticle?.seriesId ? (
                quizNextEp ? (
                  <button
                    onClick={() => openArticle(quizNextEp)}
                    style={{ width: "100%", padding: "14px", borderRadius: "16px", border: hasVocabToReview ? "2px solid var(--primary)" : "none", background: hasVocabToReview ? "var(--bg)" : "var(--primary)", color: hasVocabToReview ? "var(--primary)" : "white", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer" }}
                  >
                    {appLang === "ja" ? "次のエピソード" : "Next Episode"}
                  </button>
                ) : (
                  <div style={{ width: "100%", padding: "14px", borderRadius: "16px", background: "rgba(76, 217, 100, 0.15)", color: "#2e7d32", fontSize: "1.05rem", fontWeight: 800, textAlign: "center", display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '1.1rem' }}>{appLang === "ja" ? "🏆 シリーズ完了" : "🏆 Series Completed"}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{appLang === "ja" ? "このシリーズのすべてのエピソードを読み終えました。" : "You have finished all episodes in this series."}</span>
                  </div>
                )
              ) : (
                <button
                  onClick={() => {
                    if (nextArticle) {
                      openArticle(nextArticle);
                    } else {
                      navigateTo("home");
                    }
                  }}
                  style={{ width: "100%", padding: "14px", borderRadius: "16px", border: hasVocabToReview ? "2px solid var(--primary)" : "none", background: hasVocabToReview ? "var(--bg)" : "var(--primary)", color: hasVocabToReview ? "var(--primary)" : "white", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer" }}
                >
                  {appLang === "ja" ? "次の記事" : "Next Article"}
                </button>
              )}
              
              <button
                onClick={() => {
                  handleBack("home");
                }}
                style={{ width: "100%", padding: "14px", borderRadius: "16px", border: "none", background: "var(--bg)", color: "var(--text-main)", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer" }}
              >
                {appLang === "ja" ? "ホームへ戻る" : "Back to Home"}
              </button>
            </div>
          );
        })()}
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
              aria-label="Adresse email"
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
      <header className="app-header">
        <div className="header-left">
          {activeView === "reading" && (
            <button
              className="back-btn"
              onClick={() => {
                stopAudio();
                setDictOpen(false);
                handleBack("home");
              }}
              aria-label="Back"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
          )}
          <h1 className="header-title" style={{ marginLeft: activeView === 'reading' ? '4px' : '0' }}>Furago</h1>
        </div>

        <div className="header-right">
          {(currentStreak > 0 || totalXP > 0) && (
            <div className="header-stats-compact">
              {currentStreak > 0 && (
                <div className="stat-item" title={appLang === 'ja' ? 'ストリーク' : 'Streak'}>
                  <span className="stat-icon">🔥</span>
                  <span className="stat-val">{currentStreak}</span>
                  <span className="stat-label desktop-only">&nbsp;{appLang === 'ja' ? '日' : 'days'}</span>
                </div>
              )}
              {totalXP > 0 && (
                <div className="stat-item" title={appLang === 'ja' ? 'XPとレベル' : 'Level & XP'}>
                  <span className="stat-icon" style={{color: 'var(--primary)'}}>★</span>
                  <span className="stat-label desktop-only">Level&nbsp;</span>
                  <span className="stat-val">{Math.floor(totalXP / 100) + 1}</span>
                  <span className="stat-xp"><span className="desktop-only">&nbsp;(</span><span className="mobile-only">&nbsp;</span>{totalXP}<span className="desktop-only">&nbsp;XP)</span><span className="mobile-only">XP</span></span>
                </div>
              )}
            </div>
          )}

          {activeView === "reading" && (
            <button
                className="header-level-btn"
                onClick={(e) => {
                  filterTriggerRef.current = e.currentTarget;
                  setFilterModalType("level");
                }}
            >
                <span className="level-text">{t.levels[globalLevel as keyof typeof t.levels] || globalLevel}</span>
                <span className="level-arrow">▾</span>
            </button>
          )}

          <div className="lang-toggle-container">
            <button 
              className={`lang-toggle-btn ${appLang === 'ja' ? 'active' : ''}`}
              onClick={() => setAppLang("ja")}
            >
              🇯🇵<span className="lang-text"> JP</span>
            </button>
            <button 
              className={`lang-toggle-btn ${appLang === 'en' ? 'active' : ''}`}
              onClick={() => setAppLang("en")}
            >
              🇬🇧<span className="lang-text"> EN</span>
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
              onClick={(e) => {
                filterTriggerRef.current = e.currentTarget;
                setFilterModalType("level");
              }}
            >
              {t.nav.level} : {t.levels[globalLevel as keyof typeof t.levels] || globalLevel}
            </button>
            <button
              className="filter-btn"
              onClick={(e) => {
                filterTriggerRef.current = e.currentTarget;
                setFilterModalType("category");
              }}
            >
              {selectedCategories.length === allCategories.length ||
              selectedCategories.length === 0
                ? t.nav.category
                : `${t.nav.category} (${selectedCategories.length})`}
            </button>
          </div>

          <div style={{ padding: '16px 16px 0', maxWidth: '100%', boxSizing: 'border-box' }}>
            {/* A. PROGRESSION — where am I? */}
            <section aria-label={appLang === 'ja' ? '進捗' : 'Progress'} style={{ ...homeCard, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {appLang === 'ja' ? `レベル ${furagoLevel}` : `Level ${furagoLevel}`}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)' }}>{totalXP} XP</span>
                </div>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: streakStatus.display > 0 ? '#ff9500' : 'var(--text-muted)' }}>
                  🔥 {streakStatus.display} {appLang === 'ja' ? '日' : (streakStatus.display === 1 ? 'day' : 'days')}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={appLang === 'ja' ? '次のレベルまで' : 'Progress to next level'}
                aria-valuemin={0}
                aria-valuemax={levelProgress.xpIntoLevel + levelProgress.xpToNextLevel}
                aria-valuenow={levelProgress.xpIntoLevel}
                style={{ height: '8px', borderRadius: '8px', background: 'var(--bg)', overflow: 'hidden', margin: '10px 0 8px' }}
              >
                <div style={{ width: `${Math.round(levelProgress.ratio * 100)}%`, height: '100%', background: 'var(--primary)', borderRadius: '8px', transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px 12px', flexWrap: 'wrap', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <span>
                  {appLang === 'ja'
                    ? `レベル${levelProgress.nextLevel}まであと ${levelProgress.xpToNextLevel} XP`
                    : `${levelProgress.xpToNextLevel} XP to level ${levelProgress.nextLevel}`}
                </span>
                <span>
                  {streakStatus.state === 'done_today'
                    ? (appLang === 'ja' ? '今日のストリーク達成 ✓' : 'Streak kept today ✓')
                    : streakStatus.state === 'at_risk'
                      ? (appLang === 'ja' ? '今日1本読んでストリークを守ろう' : 'Read today to keep your streak')
                      : (appLang === 'ja' ? '今日からストリークを始めよう' : 'Start a streak today')}
                </span>
              </div>
            </section>

            {/* B. CONTINUER — real in-progress article (or next episode of a finished series) */}
            {continueTarget && (
              <section aria-labelledby="home-continue">
                <h2 id="home-continue" style={homeSectionLabel}>
                  {continueArticle
                    ? (appLang === 'ja' ? '続きから' : 'Continue')
                    : (appLang === 'ja' ? 'シリーズの続き' : 'Continue the series')}
                </h2>
                <div style={homeCard}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                    {continueTarget.imageUrl && (
                      <div style={homeThumb(64)}>
                        <img src={formatDriveUrl(continueTarget.imageUrl)} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 lang="fr" style={homeTitle}>{getArticleTitle(continueTarget)}</h3>
                      <p style={homeMeta}>
                        {[
                          t.levels[globalLevel as keyof typeof t.levels],
                          getCategoryLabel(continueTarget),
                          !continueArticle && continueTarget.seriesOrder ? `Episode ${continueTarget.seriesOrder}` : '',
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  {continueArticle && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                      <div
                        role="progressbar"
                        aria-label={appLang === 'ja' ? '読了率' : 'Reading progress'}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={continuePercent}
                        style={{ flex: 1, height: '6px', borderRadius: '6px', background: 'var(--bg)', overflow: 'hidden' }}
                      >
                        <div style={{ width: `${continuePercent}%`, height: '100%', background: 'var(--primary)' }} />
                      </div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--primary)', minWidth: '4ch', textAlign: 'right' }}>
                        {continuePercent}%
                      </span>
                    </div>
                  )}
                  {missionIsContinue && !isMissionCompletedToday && (
                    <p style={{ ...homeMeta, color: 'var(--primary)', fontWeight: 700, marginTop: '10px' }}>
                      {appLang === 'ja' ? '🎯 今日のミッション対象の記事です' : "🎯 This is today's mission"}
                    </p>
                  )}
                  <button onClick={() => {
                    trackEvent("home_cta_clicked", { cta_type: "continue", position: 1 });
                    openArticle(continueTarget, false, "home_continue");
                  }} style={{ ...homeCta(nextBestActionType === 'continue'), marginTop: '12px' }}>
                    {continueArticle
                      ? (appLang === 'ja' ? '続きを読む' : 'Continue reading')
                      : (appLang === 'ja' ? '次のエピソードへ' : 'Next episode')}
                  </button>
                </div>
              </section>
            )}

            {/* C. À RÉVISER — count comes from getWordsDueForReview (real SRS) */}
            <section aria-labelledby="home-review">
              <h2 id="home-review" style={homeSectionLabel}>{appLang === 'ja' ? '復習' : 'To review'}</h2>
              {dueReviewCount > 0 ? (
                <div style={{ ...homeCard, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {appLang === 'ja' ? `${dueReviewCount}語が復習待ち` : `${dueReviewCount} ${dueReviewCount === 1 ? 'word' : 'words'} due`}
                    </p>
                    <p style={homeMeta}>{appLang === 'ja' ? '忘れる前に確認しよう' : 'Review them before you forget'}</p>
                  </div>
                  <button
                    onClick={() => {
                      trackEvent("home_cta_clicked", { cta_type: "srs", position: 2 });
                      startVocabReview("learned", "home");
                    }}
                    style={{ ...homeCta(nextBestActionType === 'review'), width: 'auto', flex: '0 0 auto', padding: '12px 22px' }}
                  >
                    {appLang === 'ja' ? '復習する' : 'Review'}
                  </button>
                </div>
              ) : (
                <p style={homeCompactLine}>
                  {learnedWords.length === 0
                    ? (appLang === 'ja' ? '記事を読み終えると、ここに復習する単語が追加されます' : 'Finish an article to add words to review')
                    : nextReviewOffset === 0
                      ? (appLang === 'ja' ? '✅ 今は復習なし · 次は今日中' : '✅ Nothing due now · next review later today')
                      : nextReviewOffset === 1
                        ? (appLang === 'ja' ? '✅ 復習完了 · 次は明日' : '✅ All caught up · next review tomorrow')
                        : nextReviewOffset !== null
                          ? (appLang === 'ja' ? `✅ 復習完了 · 次は${nextReviewOffset}日後` : `✅ All caught up · next review in ${nextReviewOffset} days`)
                          : (appLang === 'ja' ? '✅ 復習完了' : '✅ All caught up')}
                </p>
              )}
              {savedWords.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    trackEvent("home_cta_clicked", { cta_type: "srs", position: 3 });
                    startVocabReview("saved", "home");
                  }}
                  style={{ background: 'none', border: 'none', padding: '8px 2px', minHeight: '44px', color: 'var(--primary)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left' }}
                >
                  {appLang === 'ja' ? `保存した単語を練習する（${savedWords.length}）` : `Practice my saved words (${savedWords.length})`}
                </button>
              )}
            </section>

            {/* D. MISSION DU JOUR — existing daily mission (dailyArticle + dailyMissionCompletedDate) */}
            {dailyArticle && (
              <section aria-labelledby="home-mission">
                <h2 id="home-mission" style={homeSectionLabel}>{appLang === 'ja' ? '今日のミッション' : "Today's mission"}</h2>
                {isMissionCompletedToday ? (
                  <p style={{ ...homeCompactLine, color: '#2e7d32', background: 'var(--green-light)', borderColor: 'transparent' }}>
                    {appLang === 'ja' ? '✅ ミッション完了！明日また新しいミッションが届きます' : '✅ Mission complete! A new one arrives tomorrow'}
                  </p>
                ) : missionIsContinue ? (
                  <p style={homeCompactLine}>
                    {appLang === 'ja' ? '🎯 読みかけの記事を最後まで読もう（上の「続きを読む」）' : '🎯 Finish the article you started (above)'}
                  </p>
                ) : (
                  <div style={homeCard}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                      {dailyArticle.imageUrl && (
                        <div style={homeThumb(56)}>
                          <img src={formatDriveUrl(dailyArticle.imageUrl)} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: '0 0 4px', fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>
                          {appLang === 'ja' ? '🎯 この記事を読み終えよう' : '🎯 Finish this article'}
                        </p>
                        <h3 lang="fr" style={homeTitle}>{getArticleTitle(dailyArticle)}</h3>
                        <p style={homeMeta}>{appLang === 'ja' ? 'ボーナスXP · ストリーク継続' : 'Bonus XP · keeps your streak'}</p>
                      </div>
                    </div>
                    <button onClick={() => {
                      trackEvent("home_cta_clicked", { cta_type: "mission", position: 2 });
                      openArticle(dailyArticle, false, "home_mission");
                    }} style={{ ...homeCta(nextBestActionType === 'mission'), marginTop: '12px' }}>
                      {t.reading.read}
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* E. RECOMMANDÉ — not completed, newest first, one per category first */}
            {recommendedArticles.length > 0 && (
              <section aria-labelledby="home-reco">
                <h2 id="home-reco" style={homeSectionLabel}>{appLang === 'ja' ? 'あなたへのおすすめ' : 'Recommended for you'}</h2>
                <ul style={{ ...homeCard, listStyle: 'none', margin: 0, padding: '2px 12px' }}>
                  {recommendedArticles.map((a, i) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => {
                          trackEvent("home_cta_clicked", { cta_type: "recommendation", position: 3 + i });
                          openArticle(a, false, "recommendation");
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', minWidth: 0, padding: '10px 0', background: 'none', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', color: 'inherit', font: 'inherit' }}
                      >
                        {a.imageUrl ? (
                          <span style={{ ...homeThumb(52), display: 'block' }}>
                            <img src={formatDriveUrl(a.imageUrl)} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </span>
                        ) : null}
                        <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
                          <span lang="fr" style={{ ...homeTitle, fontSize: '0.97rem' }}>{getArticleTitle(a)}</span>
                          {getCategoryLabel(a) && <span style={{ ...homeMeta, display: 'block' }}>{getCategoryLabel(a)}</span>}
                        </span>
                        <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '1.3rem', flexShrink: 0 }}>›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: '28px 0 12px' }}>
              {appLang === 'ja' ? 'すべての記事' : 'All articles'}
            </h2>
          </div>

          {catalogStatus === "loading" ? (
            <p style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
              {appLang === "ja" ? "読み込み中..." : "Loading..."}
            </p>
          ) : catalogStatus === "error" ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>
                {appLang === "ja" ? "記事を読み込めませんでした。ネットワーク接続を確認してください。" : "Could not load articles. Please check your network connection."}
              </p>
              <button 
                onClick={() => window.location.reload()}
                style={{ padding: "10px 20px", background: "var(--primary)", color: "white", borderRadius: "10px", border: "none", fontWeight: "bold", cursor: "pointer" }}
              >
                {appLang === "ja" ? "再試行" : "Retry"}
              </button>
            </div>
          ) : filteredArticles.length === 0 ? (
            <p style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
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
                  <li key={article.id || index} style={{ padding: 0, margin: 0 }}>
                    <button
                      type="button"
                      onClick={() => openArticle(article, false, "catalog")}
                      className={`article-card fade-in reset-button ${
                        index === 0 ? "hero-format" : "list-format"
                      }`}
                      style={{ width: "100%", textAlign: "left", display: "flex" }}
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
                          {typeof article.category === "string" ? article.category : (article.category?.[appLang] || article.category?.ja || "General")}
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
                    </button>
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
              (() => {
                const sInfo = getSeriesInfo(currentArticle, globalLevel);
                if (!sInfo) return null;
                return (
                  <p style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "var(--primary)", fontWeight: 800 }}>
                    {currentArticle.seriesId.replace(/_/g, ' ')} • {sInfo.currentIndex + 1} / {sInfo.total}
                  </p>
                );
              })()
            )}
            <h2 lang="fr">{typeof currentLevelData.title === "string" ? currentLevelData.title : (currentLevelData.title as TranslatableText)?.fr}</h2>
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
                {typeof currentArticle.category === "string" ? currentArticle.category : ((currentArticle.category as TranslatableText | undefined)?.[appLang] || (currentArticle.category as TranslatableText | undefined)?.ja || "General")}
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
                 {appLang === 'ja' ? 'この記事で学ぶこと' : 'What you will learn'}
               </h3>
               <p style={{ margin: "0", fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)", lineHeight: "1.5" }}>
                 {typeof currentLevelData.learningGoal === 'string' 
                   ? currentLevelData.learningGoal 
                   : (currentLevelData.learningGoal as TranslatableText)[appLang === 'ja' ? 'ja' : 'en'] || (currentLevelData.learningGoal as TranslatableText).ja}
               </p>
             </div>
          )}
          {currentLevelData.targetVocabulary && currentLevelData.targetVocabulary.length > 0 && (
             <div style={{ marginBottom: "32px", padding: "16px", borderRadius: "16px", background: "var(--bg)", border: "1px solid var(--border)" }}>
               <h3 style={{ margin: "0 0 12px 0", fontSize: "1.05rem", color: "var(--text-main)", fontWeight: 800 }}>
                 {appLang === 'ja' ? '今日の単語' : "Today's Vocabulary"}
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
                let normalizedChoices: QuizChoice[] = [];
                
                if (q.choices) {
                  normalizedChoices = q.choices;
                } else if (Array.isArray(q.options)) {
                  normalizedChoices = q.options as QuizChoice[];
                } else if (q.options && typeof q.options === 'object') {
                  normalizedChoices = Object.entries(q.options).map(([k, v]) => ({
                    id: k,
                    text: { fr: String(v), ja: String(v), en: String(v) },
                    isCorrect: q.answer === k
                  }));
                }
                
                if (normalizedChoices.length === 0) {
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
                      {normalizedChoices.map((choice, cIdx) => {
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
                              
                              if (quizTimerRef.current) {
                                clearTimeout(quizTimerRef.current);
                              }
                              
                              const delay = isCorrectOption ? 1700 : 3500;
                              
                              quizTimerRef.current = setTimeout(() => {
                                setSelectedAnswer(null);
                                setQuizIndex((idx) => idx + 1);
                                quizTimerRef.current = null;
                              }, delay);
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
                {appLang === "ja" ? "🎉 読み終わった" : "🎉 Finished Reading"}
              </button>
            </div>
          )}
        </main>
      )}

      {/* VIEW: VOCAB REVIEW */}
      {activeView === "vocab_review" && (
        <main className="view fade-in" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '80vh', justifyContent: 'center' }}>
          {vocabReviewWords.length === 0 ? (
            <div className="fade-in" style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--surface)', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📚</div>
              <h1 style={{ fontSize: '1.5rem', marginBottom: '16px', color: 'var(--text-main)' }}>
                {appLang === "ja" ? "まだ復習する単語がありません" : "No words to review yet"}
              </h1>
              <p style={{ fontSize: '1.05rem', marginBottom: '32px', color: 'var(--text-muted)' }}>
                {appLang === "ja" ? "もっと記事を読んで、語彙を増やしましょう。" : "Read more articles to expand your vocabulary."}
              </p>
              <button
                onClick={() => {
                  handleBack(vocabReviewReturnTo);
                }}
                style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--primary)', color: 'white', fontSize: '1.1rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                {appLang === "ja" ? "戻る" : "Back"}
              </button>
            </div>
          ) : vocabReviewIndex < vocabReviewWords.length ? (
            <div className="fade-in">
              <h2 style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '40px' }}>{vocabReviewIndex + 1} / {vocabReviewWords.length}</h2>
              <div style={{ textAlign: 'center', margin: '40px 0' }}>
                <h1 style={{ fontSize: '2.5rem', color: 'var(--text-main)', marginBottom: '20px', fontWeight: 800 }}>{vocabReviewWords[vocabReviewIndex].fr}</h1>
              </div>
              {vocabReviewAnswers[vocabReviewIndex].length === 0 ? (
                <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', marginBottom: '16px' }}>{appLang === 'ja' ? 'この単語の意味を確認しましょう' : "Let's check the meaning of this word"}</p>
                  <div style={{ fontSize: '1.5rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '32px' }}>
                    {vocabReviewWords[vocabReviewIndex].conciseDef || vocabReviewWords[vocabReviewIndex].ja}
                  </div>
                  <button
                    onClick={() => {
                      handleRecordReviewResult(vocabReviewWords[vocabReviewIndex], true);
                      setVocabReviewCorrectCount(prev => prev + 1);
                      setVocabReviewIndex(idx => idx + 1);
                    }}
                    style={{ padding: '16px', borderRadius: '16px', background: 'var(--primary)', color: 'white', fontSize: '1.1rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                  >
                    {appLang === "ja" ? "覚えた" : "I know this"}
                  </button>
                </div>
              ) : (
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
                          if (isCorrect) {
                            setVocabReviewCorrectCount(prev => prev + 1);
                          }
                          handleRecordReviewResult(vocabReviewWords[vocabReviewIndex], isCorrect);
                          
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
                  {/* PRIMARY CTA */}
                  {dueRemaining > 0 ? (
                    <button
                      onClick={() => {
                        checkAndAwardVocabReviewXP();
                        startVocabReview("learned", vocabReviewReturnTo);
                      }}
                      style={{
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
                      }}
                    >
                      {appLang === "ja"
                        ? `🔄 復習を続ける (+${Math.min(5, dueRemaining)})`
                        : `🔄 Continue review (+${Math.min(5, dueRemaining)})`}
                    </button>
                  ) : vocabReviewReturnTo === "reading" ? (
                    nextRewardEp ? (
                      <button
                        onClick={() => {
                          checkAndAwardVocabReviewXP();
                          openArticle(nextRewardEp);
                        }}
                        style={{
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
                        }}
                      >
                        {appLang === "ja" ? "📖 次のエピソード" : "📖 Next Episode"}
                      </button>
                    ) : nextRewardArticle ? (
                      <button
                        onClick={() => {
                          checkAndAwardVocabReviewXP();
                          openArticle(nextRewardArticle);
                        }}
                        style={{
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
                        }}
                      >
                        {appLang === "ja" ? "📖 次の記事" : "📖 Next Article"}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          checkAndAwardVocabReviewXP();
                          navigateTo("home");
                        }}
                        style={{
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
                        }}
                      >
                        {appLang === "ja" ? "🏠 ホームへ戻る" : "🏠 Back to Home"}
                      </button>
                    )
                  ) : vocabReviewReturnTo === "home" ? (
                    continueTarget ? (
                      <button
                        onClick={() => {
                          checkAndAwardVocabReviewXP();
                          trackEvent("home_cta_clicked", { cta_type: "continue", position: 1 });
                          openArticle(continueTarget, false, "home_continue");
                        }}
                        style={{
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
                        }}
                      >
                        {continueArticle
                          ? (appLang === "ja" ? "📖 続きを読む" : "📖 Continue reading")
                          : (appLang === "ja" ? "📖 次のエピソードへ" : "📖 Next episode")}
                      </button>
                    ) : dailyArticle && !isMissionCompletedToday ? (
                      <button
                        onClick={() => {
                          checkAndAwardVocabReviewXP();
                          trackEvent("home_cta_clicked", { cta_type: "mission", position: 2 });
                          openArticle(dailyArticle, false, "home_mission");
                        }}
                        style={{
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
                        }}
                      >
                        {appLang === "ja" ? "🎯 今日のミッションを読む" : "🎯 Today's mission"}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          checkAndAwardVocabReviewXP();
                          navigateTo("home");
                        }}
                        style={{
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
                        }}
                      >
                        {appLang === "ja" ? "🏠 ホームへ戻る" : "🏠 Back to Home"}
                      </button>
                    )
                  ) : (
                    /* vocabReviewReturnTo === "words" */
                    <button
                      onClick={() => {
                        checkAndAwardVocabReviewXP();
                        handleBack("words");
                      }}
                      style={{
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
                      }}
                    >
                      {appLang === "ja" ? "単語帳に戻る" : "Back to Vocabulary"}
                    </button>
                  )}

                  {/* SECONDARY CTA */}
                  {dueRemaining > 0 ? (
                    vocabReviewReturnTo === "words" ? (
                      <button
                        onClick={() => {
                          checkAndAwardVocabReviewXP();
                          handleBack("words");
                        }}
                        style={{
                          width: '100%',
                          padding: '14px',
                          borderRadius: '16px',
                          background: 'var(--bg)',
                          color: 'var(--text-main)',
                          fontSize: '0.98rem',
                          fontWeight: 600,
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                        }}
                      >
                        {appLang === "ja" ? "単語帳に戻る" : "Back to Vocabulary"}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          checkAndAwardVocabReviewXP();
                          navigateTo("home");
                        }}
                        style={{
                          width: '100%',
                          padding: '14px',
                          borderRadius: '16px',
                          background: 'var(--bg)',
                          color: 'var(--text-main)',
                          fontSize: '0.98rem',
                          fontWeight: 600,
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                        }}
                      >
                        {appLang === "ja" ? "🏠 ホームへ戻る" : "🏠 Back to Home"}
                      </button>
                    )
                  ) : (
                    /* dueRemaining === 0 */
                    (vocabReviewReturnTo === "reading" && (nextRewardEp || nextRewardArticle)) ? (
                      <button
                        onClick={() => {
                          checkAndAwardVocabReviewXP();
                          navigateTo("home");
                        }}
                        style={{
                          width: '100%',
                          padding: '14px',
                          borderRadius: '16px',
                          background: 'var(--bg)',
                          color: 'var(--text-main)',
                          fontSize: '0.98rem',
                          fontWeight: 600,
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                        }}
                      >
                        {appLang === "ja" ? "🏠 ホームへ戻る" : "🏠 Back to Home"}
                      </button>
                    ) : vocabReviewReturnTo === "home" && (continueTarget || (dailyArticle && !isMissionCompletedToday)) ? (
                      <button
                        onClick={() => {
                          checkAndAwardVocabReviewXP();
                          navigateTo("home");
                        }}
                        style={{
                          width: '100%',
                          padding: '14px',
                          borderRadius: '16px',
                          background: 'var(--bg)',
                          color: 'var(--text-main)',
                          fontSize: '0.98rem',
                          fontWeight: 600,
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                        }}
                      >
                        {appLang === "ja" ? "🏠 ホームへ戻る" : "🏠 Back to Home"}
                      </button>
                    ) : vocabReviewReturnTo === "words" ? (
                      <button
                        onClick={() => {
                          checkAndAwardVocabReviewXP();
                          navigateTo("home");
                        }}
                        style={{
                          width: '100%',
                          padding: '14px',
                          borderRadius: '16px',
                          background: 'var(--bg)',
                          color: 'var(--text-main)',
                          fontSize: '0.98rem',
                          fontWeight: 600,
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                        }}
                      >
                        {appLang === "ja" ? "🏠 ホームへ戻る" : "🏠 Back to Home"}
                      </button>
                    ) : null
                  )}
                </div>
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
                  onClick={(e) => {
                    newListTriggerRef.current = e.currentTarget;
                    setNewListModalOpen(true);
                  }}
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
                {/* System list (read-only): learned from completed articles */}
                <button
                  type="button"
                  onClick={() => setCurrentListId(LEARNED_LIST_ID)}
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
                    textAlign: "left"
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
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>

                {wordLists.map((list) => {
                  const count = savedWords.filter(
                    (w) => (w.listId || "default") === list.id
                  ).length;
                  return (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => setCurrentListId(list.id)}
                      className="quiz-card reset-button"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        marginBottom: 0,
                        width: "100%",
                        textAlign: "left"
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
                    </button>
                  );
                })}
              </div>
            </div>
          ) : currentListId === LEARNED_LIST_ID ? (
            /* ─── System list detail: Furago — Mots appris (read-only) ─── */
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
                      fontSize: "1.2rem",
                      fontWeight: 800,
                      color: "var(--primary)",
                      margin: 0,
                    }}
                  >
                    {LEARNED_LIST_NAME}
                  </h2>
                </div>
                
                {(() => {
                  if (learnedWords.length === 0) return null;
                  const stats = getReviewStats(learnedWords, nowMs);
                  const hasDue = stats.dueToday > 0;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {stats.dueToday} {appLang === "ja" ? "件" : "due"}
                      </div>
                      <button
                        disabled={!hasDue}
                        onClick={() => startVocabReview("learned", "words")}
                        style={{
                          background: hasDue ? "var(--primary)" : "var(--bg)",
                          color: hasDue ? "white" : "var(--text-muted)",
                          border: "none",
                          padding: "8px 16px",
                          borderRadius: "20px",
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          cursor: hasDue ? "pointer" : "not-allowed",
                          boxShadow: hasDue ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
                        }}
                      >
                        {appLang === "ja" ? "復習する" : "Review"}
                      </button>
                    </div>
                  );
                })()}
              </div>

              {learnedWords.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "50px 20px",
                    color: "var(--text-muted)",
                  }}
                >
                  <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>📚</div>
                  <p style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {appLang === "ja"
                      ? "まだ学んだ単語はありません。\n記事を読んで完了すると、自動的に追加されます。"
                      : "You haven't learned any words yet.\nWords are added automatically when you complete an article."}
                  </p>
                </div>
              ) : (
                learnedWords.map((lw, idx) => (
                  <div
                    key={`learned-${idx}`}
                    className="quiz-card fade-in"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <h3
                        lang="fr"
                        style={{
                          margin: 0,
                          fontSize: "1.15rem",
                          fontWeight: 700,
                          wordBreak: "break-word"
                        }}
                      >
                        <button
                          type="button"
                          className="tap-word reset-button interactive-word"
                          onClick={(e) => handleWordClick(e, lw.word, "")}
                          style={{
                            color: "var(--primary)",
                            cursor: "pointer",
                            textDecoration: "underline",
                            textDecorationColor: "var(--border)",
                            textUnderlineOffset: "4px"
                          }}
                        >
                          {lw.word}
                        </button>
                      </h3>
                      <span
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                        }}
                      >
                        {appLang === "ja"
                          ? `${lw.articleIds.length}つの記事から`
                          : `From ${lw.articleIds.length} articles`}
                      </span>
                    </div>
                    <button
                      onClick={() => speakWord(lw.word)}
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
                  </div>
                ))
              )}
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
        <dialog
          ref={(node) => {
            popupRef.current = node;
            if (node && !node.open) {
              node.showModal();
            }
          }}
          className={`dict-popup ${arrowTop ? "arrow-top" : ""}`}
          style={{ ...popupStyle, margin: 0 }}
          onClose={() => setDictOpen(false)}
          onClick={(e) => {
            if (e.target === popupRef.current) {
              setDictOpen(false);
            }
          }}
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
                aria-label={t.dict.saveToList}
                onClick={(e) => {
                  if (!dictData) return;
                  if (wordLists.length <= 1) {
                    saveWordToList(wordLists[0]?.id || "default");
                  } else {
                    listSelectorTriggerRef.current = e.currentTarget;
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
                aria-label={t.words.listenPronunciation}
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
              <button
                className="dict-close-btn"
                aria-label="Fermer"
                title="Fermer"
                onClick={() => setDictOpen(false)}
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
                  justifyContent: "center"
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
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
        </dialog>
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
            aria-label={t.reading.restartAudio}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-main)",
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
            aria-label={t.reading.prevSentence}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-main)",
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
            aria-pressed={isPlaying && !isPaused}
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
            aria-label={t.reading.nextSentence}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-main)",
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
              navigateTo("home", undefined, true);
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
              navigateTo("words", undefined, true);
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
      <dialog
        ref={filterDialogRef}
        className="filter-dialog"
        onClose={() => setFilterModalType(null)}
        onClick={(e) => {
          if (e.target === filterDialogRef.current) {
            setFilterModalType(null);
          }
        }}
        aria-labelledby="filter-dialog-title"
      >
        {filterModalType !== null && (
          <div className="modal-sheet" style={{ margin: "0 auto", maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
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
                onClick={() => setFilterModalType(null)}
                aria-label="Fermer"
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
                  lineHeight: "1"
                }}
              >
                &times;
              </button>
            </div>
            <h3
              id="filter-dialog-title"
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
                        
                        mutateUserState({ level: lvl });
                        
                        // Clear any pending quiz progression timeout
                        if (quizTimerRef.current) {
                          clearTimeout(quizTimerRef.current);
                          quizTimerRef.current = null;
                        }
                        // Reset transient quiz state to prevent leaking into the new level
                        setQuizIndex(0);
                        setQuizScore(0);
                        setSelectedAnswer(null);
                        setNoQuizCompleted(false);
                        setSessionReward(null);

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
                          const matchedArticle = articles.find(a => (typeof a.category === 'string' ? a.category : (a.category?.ja || "")).trim() === cat);
                          return matchedArticle && typeof matchedArticle.category !== 'string' && matchedArticle.category?.[appLang] 
                            ? matchedArticle.category[appLang] 
                            : cat;
                        })()}
                      </button>
                    );
                  })}
            </div>
          </div>
        )}
      </dialog>

      {/* List Selector Modal (when saving a word and multiple lists exist) */}
      <dialog
        ref={listSelectorDialogRef}
        className="list-selector-dialog"
        onClose={() => setListSelectorOpen(false)}
        onClick={(e) => {
          if (e.target === listSelectorDialogRef.current) {
            setListSelectorOpen(false);
          }
        }}
        aria-labelledby="list-selector-title"
      >
        {listSelectorOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              padding: "24px",
              borderRadius: "20px",
              width: "88vw",
              maxWidth: "340px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              margin: "0 auto",
            }}
          >
            <h3 id="list-selector-title" style={{ textAlign: "center", fontSize: "1.15rem", fontWeight: 700, marginBottom: "16px" }}>
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
        )}
      </dialog>

      {/* Create New List Modal */}
      <dialog
        ref={newListDialogRef}
        className="new-list-dialog"
        onClose={() => setNewListModalOpen(false)}
        onClick={(e) => {
          if (e.target === newListDialogRef.current) {
            setNewListModalOpen(false);
          }
        }}
        aria-labelledby="new-list-title"
      >
        {newListModalOpen && (
          <form
            onSubmit={handleCreateList}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              padding: "24px",
              borderRadius: "20px",
              width: "88vw",
              maxWidth: "340px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              margin: "0 auto",
            }}
          >
            <h3 id="new-list-title" style={{ textAlign: "center", fontSize: "1.1rem", fontWeight: 700, marginBottom: "14px" }}>
              {t.words.newListNameTitle}
            </h3>
            <input
              type="text"
              required
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder={t.words.newListPlaceholder}
              aria-labelledby="new-list-title"
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
        )}
      </dialog>

      {/* Newsletter 3-Step Profile Registration Modal */}
      <dialog
        ref={leadDialogRef}
        className="lead-dialog"
        onClose={() => setLeadModalOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setLeadModalOpen(false);
          }
        }}
        aria-labelledby="lead-modal-title"
      >
        {leadModalOpen && (
          <form
            className="modal-sheet"
            style={{ maxWidth: "440px", margin: "0 auto", boxSizing: "border-box" }}
            onSubmit={handleLeadProfileSubmit}
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
              <h3 id="lead-modal-title" style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>
                {t.newsletter.title}
              </h3>
              <button
                type="button"
                aria-label="Fermer"
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
                  htmlFor="lead-first-name"
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
                  id="lead-first-name"
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
                  htmlFor="lead-email"
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
                  id="lead-email"
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
                    {leadCheckingEmail ? (appLang === 'ja' ? "確認中..." : "Checking...") : (appLang === 'ja' ? '次へ' : 'Next')}
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
        )}
      </dialog>
    </div>
  );
}



