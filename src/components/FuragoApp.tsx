"use client";

import { loadUserState, updateUserState, mergeLearnedVocabulary } from "../lib/userState";
import type { SavedWord, UserState, WordList } from "../lib/userState";
import { selectContinueArticle, selectRecommendedArticles, getStreakStatus, getNextReviewDayOffset, determineNextBestActionType, completedArticleId } from "../lib/home";
import { getWordsDueForReview, recordReviewResult, getReviewStats } from "../lib/srs";
import { checkGoalCompletion } from "../lib/progress";
import ProgressDashboard from "./ProgressDashboard";
import { checkAndTrackSessionStart, updateSessionActivity, trackEvent } from "../lib/analytics";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { DictionaryService, DictLookupResult } from "@/lib/dictionary";
import HomeView from "@/features/home/HomeView";
import ReadingView from "@/features/reading/ReadingView";
import VocabReviewView, { type VocabReviewAction } from "@/features/vocab-review/VocabReviewView";
import WordbookView from "@/features/wordbook/WordbookView";
import type { Article } from "@/types/article";
import useSpeechSynthesis from "../hooks/useSpeechSynthesis";

import { getTranslation, AppLanguage } from "@/lib/i18n";

const DATA_URL = "https://kohaiducode.github.io/furago-data/articles.json";
const LEVELS = ["LVL_1", "LVL_2", "LVL_3", "LVL_4"];
// Reserved id for the read-only system list "📚 Furago — Mots appris".
// Never part of wordLists, so it cannot be renamed, deleted, or used as a save target.
const LEARNED_LIST_ID = "__furago_learned__";

const getSpeechContent = (levelData: Article["levels"][string]) => {
  const paragraphs = levelData.paragraphs || levelData.segments || [];
  return {
    text: levelData.content || paragraphs.map((paragraph) => paragraph.fr).join("\n"),
    paragraphs: paragraphs.map((paragraph) => paragraph.fr),
  };
};

const getSpeechVoiceOptions = (voices: SpeechSynthesisVoice[]) => {
  const femaleNames = ["Sophie", "Camille", "Léa", "Alice", "Emma"];
  const maleNames = ["Thomas", "Lucas", "Hugo", "Paul", "Arthur"];
  let femaleIndex = 0;
  let maleIndex = 0;

  return voices.map((voice, index) => {
    const id = (voice.voiceURI || voice.name || "").toLowerCase();
    let isFemale: boolean;
    if (/vlf|vld|vla|fra|frc|female|femme|hortense|julie|eloise|denise/i.test(id)) {
      isFemale = true;
    } else if (/vle|vlc|vlb|frb|frd|male|homme|paul|henri|thomas/i.test(id)) {
      isFemale = false;
    } else {
      isFemale = index === 0 || index === 1 || index === 3;
    }

    const label = isFemale
      ? `(女) ${femaleNames[femaleIndex++ % femaleNames.length]}`
      : `(男) ${maleNames[maleIndex++ % maleNames.length]}`;
    return { voice, label };
  });
};

const getArticleCategories = (articles: Article[] = []) => {
  const categories = new Set<string>();
  articles.forEach((article) => {
    if (article.category) {
      categories.add((typeof article.category === "string" ? article.category : (article.category?.ja || "")).trim());
    }
  });
  return Array.from(categories);
};

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
  const [activeView, setActiveView] = useState<"home" | "reading" | "words" | "vocab_review" | "progress">("home");

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
  const [userState, setReactUserState] = useState<UserState>(() => ({
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
    }));
  const [userStateRestored, setUserStateRestored] = useState(false);

  const userStateRef = useRef<UserState>(userState);
  const userStateRestoredRef = useRef(false);
  const pendingUserStateUpdatesRef = useRef<Array<Partial<UserState> | ((prev: UserState) => Partial<UserState>)>>([]);

  const mutateUserState = useCallback((updater: Partial<UserState> | ((prev: UserState) => Partial<UserState>)) => {
    if (!userStateRestoredRef.current) {
      pendingUserStateUpdatesRef.current.push(updater);
      return;
    }

    const prev = userStateRef.current;
    const updates = typeof updater === 'function' ? updater(prev) : updater;
    if (!updates || Object.keys(updates).length === 0) return;
    
    const next = { ...prev, ...updates };
    if (updates.xp !== undefined) {
      next.furagoLevel = Math.max(1, Math.floor(next.xp / 100) + 1);
    }

    const completedGoal = checkGoalCompletion(prev, next);
    if (completedGoal) {
      trackEvent("pedagogical_goal_completed", {
        goal_id: completedGoal.id,
        goal_category: completedGoal.category,
      });
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

  const {
    voices,
    selectedVoice,
    setSelectedVoice,
    speechRate,
    setSpeechRate,
    isPlaying: ttsPlaying,
    isPaused: ttsPaused,
    speechRange,
    highlightRange,
    currentSentenceIndex,
    totalSentences,
    prepareText,
    playText,
    handlePlayPause,
    handleRestartAudio,
    handlePrevSentence,
    handleNextSentence,
    stopAudio,
    speakWord,
  } = useSpeechSynthesis();

  const voiceOptions = getSpeechVoiceOptions(voices);
  const selectedVoiceIndex = selectedVoice ? Math.max(0, voices.indexOf(selectedVoice)) : 0;
  const readingSpeechRange = speechRange
    ? { start: speechRange[0], length: speechRange[1] }
    : null;
  const readingHighlightRange = highlightRange
    ? { start: highlightRange[0], length: highlightRange[1] }
    : { start: -1, length: 0 };


  const [articles, setArticles] = useState<Article[]>(initialArticles || []);
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "success" | "offline" | "error">(
    (initialArticles && initialArticles.length > 0) ? "success" : "loading"
  );
  const [allCategories, setAllCategories] = useState<string[]>(() => getArticleCategories(initialArticles));
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => getArticleCategories(initialArticles));
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

  const quizTimerRef = useRef<NodeJS.Timeout | null>(null);
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
    if (userStateRestoredRef.current) return;

    try {
      const state = loadUserState();
      userStateRef.current = state;
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    } finally {
      userStateRestoredRef.current = true;
      setUserStateRestored(true);
      const pendingUpdates = pendingUserStateUpdatesRef.current.splice(0);
      pendingUpdates.forEach(mutateUserState);
    }
  }, [mutateUserState]);

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
    // Level-aware entry ("articleId::LVL_x") so the progress engine can report the level.
    // Legacy bare-id entries stay valid: dedupe on the article id part only.
    const progressKey = `${articleId}::${state.level}`;
    const newProgress = { ...state.articleProgress };

    if (newProgress[progressKey] !== undefined) {
      delete newProgress[progressKey];
      updates.articleProgress = newProgress;
    }

    if (!done.some((entry) => completedArticleId(entry) === articleId)) {
      done.push(progressKey);
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
    if (!userStateRestored || articles.length === 0) return;
    const target = userState.dailyMissionTarget;
    if (!target || target.date !== todayStr || target.level !== globalLevel) {
      const available = articles.filter(a => a.levels && a.levels[globalLevel]);
      if (available.length === 0) return;
      const sorted = [...available].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const uncompleted = sorted.filter(a => !completedArticleIds.some((entry) => completedArticleId(entry) === String(a.id)));
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
  }, [userStateRestored, articles, globalLevel, todayStr, userState.dailyMissionTarget, completedArticleIds, mutateUserState]);

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
    if (!userStateRestored || activeView !== "reading" || !currentArticle) return;

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
  }, [userStateRestored, activeView, currentArticle, globalLevel]);

  useEffect(() => {
    if (!userStateRestored) return;
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
            // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }, [userStateRestored, activeView, currentArticle, globalLevel, quizIndex, quizScore, updateStreak, checkAndAwardArticleXP, checkAndAwardQuizXP, noQuizCompleted, dailyArticle, todayStr, checkAndAwardDailyMissionXP, sessionReward]);

  const { continueArticle, currentSeriesNextEp } = React.useMemo(() => {
    let nextEp: Article | null = null;
    if (lastOpenedArticleId) {
      const last = articles.find(a => String(a.id) === String(lastOpenedArticleId));
      if (last && completedArticleIds.some((entry) => completedArticleId(entry) === String(last.id))) {
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

  const handleArticlePlayPause = () => {
    if (!currentArticle) return;
    if (totalSentences === 0) {
      const levelData = currentArticle.levels[globalLevel];
      if (!levelData) return;
      const speechContent = getSpeechContent(levelData);
      playText(speechContent.text, speechContent.paragraphs);
      return;
    }
    handlePlayPause();
  };

  // Open an article
  const openArticle = (article: Article, skipHistory = false, source?: "home_continue" | "home_mission" | "catalog" | "recommendation" | "home_progress_widget") => {
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
      const speechContent = getSpeechContent(levelData);
      prepareText(speechContent.text, speechContent.paragraphs);
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
    
    if (!urlView || !["home", "reading", "words", "vocab_review", "progress"].includes(urlView)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      stopAudio();
      const state = e.state;
      if (!state || !state.furago) {
        const query = new URLSearchParams(window.location.search);
        const urlView = query.get("view") as typeof activeView | null;
        
        if (urlView && ["home", "reading", "words", "vocab_review", "progress"].includes(urlView)) {
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
  }, [navigateTo, stopAudio]);

  // Sync Reading View on popstate or direct URL load
  useEffect(() => {
    if (activeView !== "reading" || articles.length === 0) return;
    const query = new URLSearchParams(window.location.search);
    const id = query.get("id");
    
    if (currentArticle && String(currentArticle.id) === id) return;
    
    if (id) {
      const art = articles.find(a => String(a.id) === id);
      if (art) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const getNextArticleFor = useCallback((article: Article | null): Article | null => {
    if (!article) return null;
    const validArticles = filteredArticles;
    if (validArticles.length <= 1) return null;

    const currentIndex = validArticles.findIndex(a => a.id === article.id);
    if (currentIndex === -1) return null;

    const completed = new Set((completedArticleIds || []).map(completedArticleId));

    // Look forward
    for (let i = currentIndex + 1; i < validArticles.length; i++) {
      if (!completed.has(String(validArticles[i].id))) return validArticles[i];
    }
    // Look from start
    for (let i = 0; i < currentIndex; i++) {
      if (!completed.has(String(validArticles[i].id))) return validArticles[i];
    }
    
    // Fallback: Just next article in the filtered list
    return validArticles[(currentIndex + 1) % validArticles.length];
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [filteredArticles, completedArticleIds]);

  // --- ANALYTICS: HOME VIEWED ---
  useEffect(() => {
    if (!userStateRestored) return;
    if (activeView === "home") {
      const key = `home_viewed_${dueReviewCount}_${dailyArticle?.id || 'none'}_${continueTarget?.id || 'none'}`;
      if (!analyticsFiredRef.current[key]) {
        trackEvent("home_viewed", {
          srs_due_count: dueReviewCount,
          has_daily_mission: !!dailyArticle,
          has_continue_article: !!continueTarget,
          streak_state: streakStatus.state
        });
        analyticsFiredRef.current[key] = true;
      }
    }
  }, [userStateRestored, activeView, dueReviewCount, dailyArticle, continueTarget, streakStatus.state]);

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

  const currentLevelData =
    currentArticle && currentArticle.levels
      ? currentArticle.levels[globalLevel]
      : null;

  const progressPercent =
    totalSentences > 0 ? ((currentSentenceIndex + 1) / totalSentences) * 100 : 0;

  const currentSeriesInfo = currentArticle ? getSeriesInfo(currentArticle, globalLevel) : null;
  const quizNextEp = currentArticle?.seriesId ? currentSeriesInfo?.nextEp : null;
  const nextRewardEp = currentArticle?.seriesId ? currentSeriesInfo?.nextEp : null;
  const nextRewardArticle = getNextArticleFor(currentArticle);
  const dueRemaining = vocabReviewSource === "learned"
    ? getWordsDueForReview(learnedWords, nowMs).length
    : 0;
  const isReadingComplete = Boolean(
    (currentLevelData?.quiz && currentLevelData.quiz.length > 0 && quizIndex >= currentLevelData.quiz.length) || noQuizCompleted
  );
  const readingCompletionStats = activeView === "reading" && isReadingComplete
    ? getReviewStats(learnedWords, nowMs)
    : null;

  // Vocab review completion CTAs: destinations resolved here, presentation stays in VocabReviewView.
  const vocabReviewPrimaryAction: VocabReviewAction = dueRemaining > 0
    ? {
        label: appLang === "ja" ? `🔄 復習を続ける (+${Math.min(5, dueRemaining)})` : `🔄 Continue review (+${Math.min(5, dueRemaining)})`,
        onClick: () => {
          checkAndAwardVocabReviewXP();
          startVocabReview("learned", vocabReviewReturnTo);
        },
      }
    : vocabReviewReturnTo === "reading"
      ? nextRewardEp
        ? {
            label: appLang === "ja" ? "📖 次のエピソード" : "📖 Next Episode",
            onClick: () => {
              checkAndAwardVocabReviewXP();
              if (nextRewardEp) openArticle(nextRewardEp);
            },
          }
        : nextRewardArticle
          ? {
              label: appLang === "ja" ? "📖 次の記事" : "📖 Next Article",
              onClick: () => {
                checkAndAwardVocabReviewXP();
                if (nextRewardArticle) openArticle(nextRewardArticle);
              },
            }
          : {
              label: appLang === "ja" ? "🏠 ホームへ戻る" : "🏠 Back to Home",
              onClick: () => {
                checkAndAwardVocabReviewXP();
                navigateTo("home");
              },
            }
      : vocabReviewReturnTo === "home"
        ? continueTarget
          ? {
              label: continueArticle
                ? (appLang === "ja" ? "📖 続きを読む" : "📖 Continue reading")
                : (appLang === "ja" ? "📖 次のエピソードへ" : "📖 Next episode"),
              onClick: () => {
                checkAndAwardVocabReviewXP();
                trackEvent("home_cta_clicked", { cta_type: "continue", position: 1 });
                if (continueTarget) openArticle(continueTarget, false, "home_continue");
              },
            }
          : dailyArticle && !isMissionCompletedToday
            ? {
                label: appLang === "ja" ? "🎯 今日のミッションを読む" : "🎯 Today's mission",
                onClick: () => {
                  checkAndAwardVocabReviewXP();
                  trackEvent("home_cta_clicked", { cta_type: "mission", position: 2 });
                  if (dailyArticle) openArticle(dailyArticle, false, "home_mission");
                },
              }
            : {
                label: appLang === "ja" ? "🏠 ホームへ戻る" : "🏠 Back to Home",
                onClick: () => {
                  checkAndAwardVocabReviewXP();
                  navigateTo("home");
                },
              }
        : {
            label: appLang === "ja" ? "単語帳に戻る" : "Back to Vocabulary",
            onClick: () => {
              checkAndAwardVocabReviewXP();
              handleBack("words");
            },
          };

  const vocabReviewSecondaryAction: VocabReviewAction | null =
    dueRemaining > 0
      ? vocabReviewReturnTo === "words"
        ? {
            label: appLang === "ja" ? "単語帳に戻る" : "Back to Vocabulary",
            onClick: () => {
              checkAndAwardVocabReviewXP();
              handleBack("words");
            },
          }
        : {
            label: appLang === "ja" ? "🏠 ホームへ戻る" : "🏠 Back to Home",
            onClick: () => {
              checkAndAwardVocabReviewXP();
              navigateTo("home");
            },
          }
      : (vocabReviewReturnTo === "reading" && (nextRewardEp || nextRewardArticle)) ||
          (vocabReviewReturnTo === "home" && (continueTarget || (dailyArticle && !isMissionCompletedToday))) ||
          vocabReviewReturnTo === "words"
        ? {
            label: appLang === "ja" ? "🏠 ホームへ戻る" : "🏠 Back to Home",
            onClick: () => {
              checkAndAwardVocabReviewXP();
              navigateTo("home");
            },
          }
        : null;

  const openFilterModal = useCallback((type: "level" | "category", trigger: HTMLButtonElement | null) => {
    filterTriggerRef.current = trigger;
    setFilterModalType(type);
  }, []);

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
        <div className="lead-bar">
          <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
            {t.nav.leadBarText}
          </span>
          <form className="lead-bar-form" onSubmit={(e) => { e.preventDefault(); handleOpenLeadModal(e); }}>
            <input
              type="email"
              value={leadEmail}
              onChange={(e) => setLeadEmail(e.target.value)}
              placeholder="e.g. taro@furago.com"
              aria-label={t.common.email}
              className="lead-bar-input"
            />
            <button type="submit" className="lead-bar-btn">
              {t.nav.leadBarBtn}
            </button>
            <button
              type="button"
              onClick={() => setShowLeadBar(false)}
              aria-label={t.common.close}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
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
              aria-label={t.common.back}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
          )}
          <h1 className="header-title" style={{ marginLeft: activeView === 'reading' ? '4px' : '0' }}>Furago</h1>
        </div>

        <div className="header-right">
          {(streakStatus.display > 0 || totalXP > 0) && (
            <div className="header-stats-compact">
              {streakStatus.display > 0 && (
                <div className="stat-item" title={t.progress.streak}>
                  <span className="stat-icon">🔥</span>
                  <span className="stat-val">{streakStatus.display}</span>
                  <span className="stat-label desktop-only">&nbsp;{t.progress.days}</span>
                </div>
              )}
              {totalXP > 0 && (
                <div className="stat-item" title={appLang === 'ja' ? 'XPとレベル' : 'Level & XP'}>
                  <span className="stat-icon" style={{color: 'var(--primary)'}}>★</span>
                  <span className="stat-label desktop-only">{t.nav.level}&nbsp;</span>
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

      {/* VIEW 1: HOME (redesigned 6.3-D.2-B) */}
      {activeView === "home" && (
        <HomeView
          t={t}
          appLang={appLang}
          globalLevel={globalLevel}
          onOpenFilterModal={openFilterModal}
          selectedCategories={selectedCategories}
          allCategories={allCategories}
          catalogStatus={catalogStatus}
          filteredArticles={filteredArticles}
          articles={articles}
          openArticle={openArticle}
          startVocabReview={(source) => startVocabReview(source, "home")}
          dueReviewCount={dueReviewCount}
          nextReviewOffset={nextReviewOffset}
          continueTarget={continueTarget}
          continueArticle={continueArticle}
          continuePercent={continuePercent}
          dailyArticle={dailyArticle}
          isMissionCompletedToday={isMissionCompletedToday}
          missionIsContinue={missionIsContinue}
          nextBestActionType={nextBestActionType}
          recommendedArticles={recommendedArticles}
          streakStatus={streakStatus}
          lastStreakDate={lastStreakDate}
          todayStr={todayStr}
          isVocabReviewCompletedToday={isVocabReviewCompletedToday}
          savedWords={savedWords}
          learnedWords={learnedWords}
          userState={userState}
          navigateTo={navigateTo}
          completedArticleIds={completedArticleIds}
          getArticleTitle={getArticleTitle}
          getCategoryLabel={getCategoryLabel}
        />
      )}

      {/* VIEW 2: READING ARTICLE (記事閲覧 + 音声 + クイズ) */}
      {activeView === "reading" && currentArticle && currentLevelData && (
        <ReadingView
          article={currentArticle}
          levelData={currentLevelData}
          globalLevel={globalLevel}
          appLang={appLang}
          t={t}
          seriesProgress={currentSeriesInfo ? { currentIndex: currentSeriesInfo.currentIndex, total: currentSeriesInfo.total } : null}
          onWordClick={handleWordClick}
          renderVocabularyItem={(word, index) => <TargetVocabularyItem key={index} word={word} onClick={handleWordClick} />}
          speechRange={readingSpeechRange}
          highlightRange={readingHighlightRange}
          quizIndex={quizIndex}
          selectedAnswer={selectedAnswer}
          translatedQuizIds={translatedQuizIds}
          onToggleQuestionTranslation={(questionId) => setTranslatedQuizIds((previous) => ({ ...previous, [questionId]: !previous[questionId] }))}
          onSelectAnswer={(answerKey, isCorrect) => {
            setSelectedAnswer(answerKey);
            if (isCorrect) {
              setQuizScore((score) => score + 1);
            }

            if (quizTimerRef.current) {
              clearTimeout(quizTimerRef.current);
            }

            const delay = isCorrect ? 1700 : 3500;
            quizTimerRef.current = setTimeout(() => {
              setSelectedAnswer(null);
              setQuizIndex((index) => index + 1);
              quizTimerRef.current = null;
            }, delay);
          }}
          onCompleteWithoutQuiz={() => setNoQuizCompleted(true)}
          completion={isReadingComplete ? {
            hasQuiz: Boolean(currentLevelData.quiz && currentLevelData.quiz.length > 0),
            quizScore,
            quizQuestionCount: currentLevelData.quiz?.length || 0,
            reward: sessionReward,
            streak: streakStatus.display,
            dueReviewCount: readingCompletionStats?.dueToday || 0,
            hasVocabToReview: (sessionReward !== null && sessionReward.vocab > 0) || (readingCompletionStats?.dueToday || 0) > 0,
            seriesId: currentArticle.seriesId || null,
            seriesIndex: currentSeriesInfo?.currentIndex ?? null,
            seriesTotal: currentSeriesInfo?.total ?? null,
            hasNextEpisode: Boolean(quizNextEp),
            onReviewVocabulary: () => startVocabReview("learned", "reading"),
            onNextEpisode: () => {
              if (quizNextEp) openArticle(quizNextEp);
            },
            onNextArticle: () => {
              if (nextRewardArticle) {
                openArticle(nextRewardArticle);
              } else {
                navigateTo("home");
              }
            },
            onBackHome: () => handleBack("home"),
          } : null}
        />
      )}

      {/* VIEW: VOCAB REVIEW */}
      {activeView === "vocab_review" && (
        <VocabReviewView
          appLang={appLang}
          words={vocabReviewWords}
          answers={vocabReviewAnswers}
          index={vocabReviewIndex}
          selectedAnswer={vocabReviewSelected}
          dueRemaining={dueRemaining}
          onBack={() => handleBack(vocabReviewReturnTo)}
          onMarkKnown={(word) => {
            handleRecordReviewResult(word, true);
            setVocabReviewCorrectCount(prev => prev + 1);
            setVocabReviewIndex(idx => idx + 1);
          }}
          onAnswer={(word, answer, isCorrect) => {
            setVocabReviewSelected(answer);
            if (isCorrect) {
              setVocabReviewCorrectCount(prev => prev + 1);
            }
            handleRecordReviewResult(word, isCorrect);

            setTimeout(() => {
              setVocabReviewSelected(null);
              setVocabReviewIndex(idx => idx + 1);
            }, 1200);
          }}
          primaryAction={vocabReviewPrimaryAction}
          secondaryAction={vocabReviewSecondaryAction}
        />
      )}

      {/* VIEW 3: WORDBOOK (単語帳) */}
      {activeView === "words" && (
        <WordbookView
          t={t}
          appLang={appLang}
          savedWords={savedWords}
          learnedWords={learnedWords}
          wordLists={wordLists}
          currentListId={currentListId}
          learnedListId={LEARNED_LIST_ID}
          learnedDueCount={currentListId === LEARNED_LIST_ID && learnedWords.length > 0 ? getReviewStats(learnedWords, nowMs).dueToday : 0}
          onCreateList={(trigger) => {
            newListTriggerRef.current = trigger;
            setNewListModalOpen(true);
          }}
          onSelectList={setCurrentListId}
          onReviewLearned={() => startVocabReview("learned", "words")}
          onWordClick={handleWordClick}
          onSpeakWord={speakWord}
          onDeleteWord={handleDeleteWord}
        />
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
                aria-label={t.common.close}
                title={t.common.close}
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

      
      {/* VIEW: PROGRESS */}
      {activeView === "progress" && (
        <main>
          <ProgressDashboard
            userState={userState}
            appLang={appLang}
            onGoalClick={(cat: string) => {
              if (cat === "VOCABULARY" || cat === "CONSOLIDATION") {
                navigateTo("words");
              } else if (cat === "READING" || cat === "QUIZ") {
                navigateTo("home");
                setTimeout(() => {
                  const el = document.getElementById("home-reco") || document.getElementById("home-catalog");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }
            }}
          />
        </main>
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
            onClick={handleArticlePlayPause}
            title={t.reading.playPause}
            aria-pressed={ttsPlaying && !ttsPaused}
            style={{
              background:
                ttsPlaying && !ttsPaused
                  ? "#FF9500"
                  : ttsPaused
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
            {ttsPlaying && !ttsPaused ? (
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
            style={{ width: `${ttsPlaying || ttsPaused ? progressPercent : 0}%` }}
          ></div>
        </div>

        <div className="audio-options-row">
          <select
            className="audio-select"
            value={speechRate}
            onChange={(e) => {
              const rate = parseFloat(e.target.value);
              setSpeechRate(rate);
            }}
          >
            <option value={1}>{appLang === 'ja' ? '速度 : 標準 (1x)' : 'Speed: Normal (1x)'}</option>
            <option value={0.8}>{appLang === 'ja' ? '速度 : 遅い (0.8x)' : 'Speed: Slow (0.8x)'}</option>
            <option value={0.6}>{appLang === 'ja' ? '速度 : とても遅い (0.6x)' : 'Speed: Very Slow (0.6x)'}</option>
            <option value={0.4}>{appLang === 'ja' ? '速度 : 最も遅い (0.4x)' : 'Speed: Slowest (0.4x)'}</option>
          </select>

          <select
            className="audio-select"
            value={selectedVoiceIndex}
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10);
              if (voices[idx]) setSelectedVoice(voices[idx]);
            }}
          >
            {voiceOptions.length === 0 ? (
              <option value={0}>{appLang === 'ja' ? 'フランス語音声 (標準)' : 'French Voice (Default)'}</option>
            ) : (
              voiceOptions.map((v, i) => (
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
        
          <button
            className={`nav-item ${activeView === "progress" ? "active" : ""}`}
            onClick={() => {
              stopAudio();
              setDictOpen(false);
              navigateTo("progress", undefined, true);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            {t.nav.progress}
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
                          const speechContent = getSpeechContent(currentArticle.levels[lvl]);
                          prepareText(speechContent.text, speechContent.paragraphs);
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
                aria-label={t.common.close}
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



