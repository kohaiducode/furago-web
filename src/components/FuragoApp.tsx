"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { DictionaryService, DictLookupResult } from "@/lib/dictionary";

export interface QuizQuestion {
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
const LEVELS = ["A1", "A2", "B1", "B2", "C1"];

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

export default function FuragoApp({
  initialArticles,
}: {
  initialArticles: Article[];
}) {
  // Navigation & Views: "home" | "reading" | "words"
  const [activeView, setActiveView] = useState<"home" | "reading" | "words">("home");

  // Articles & Filters
  const [articles, setArticles] = useState<Article[]>(initialArticles || []);
  const [globalLevel, setGlobalLevel] = useState<string>("A1");
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [filterModalType, setFilterModalType] = useState<"level" | "category" | null>(null);

  // Current Reading Article
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);

  // Quiz State
  const [quizIndex, setQuizIndex] = useState<number>(0);
  const [quizScore, setQuizScore] = useState<number>(0);
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
  const [leadGender, setLeadGender] = useState<string>("");
  const [leadLevel, setLeadLevel] = useState<string>("A1");
  const [leadCategories, setLeadCategories] = useState<string[]>([]);
  const [leadSubmitting, setLeadSubmitting] = useState<boolean>(false);
  const [leadCheckingEmail, setLeadCheckingEmail] = useState<boolean>(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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
      if (a.category) initCats.add(a.category.trim());
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
            if (a.category) freshCats.add(a.category.trim());
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
  const buildQueueForText = useCallback((text: string) => {
    const q: TtsQueueItem[] = [];
    let currentIndex = 0;
    const regex = /[^.!?\n]+[.!?\n]*\s*/g;
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
        buildQueueForText(levelData.content);
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
      buildQueueForText(levelData.content);
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
    setQuizIndex(0);
    setQuizScore(0);
    setSelectedAnswer(null);
    const levelData = article.levels[globalLevel];
    if (levelData) {
      buildQueueForText(levelData.content);
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
    e: React.MouseEvent<HTMLSpanElement>,
    word: string,
    paragraphText: string
  ) => {
    e.stopPropagation();
    const clean = word.replace(/[.,!?:;"'()[\]«»„“”]/g, "").trim();
    if (!clean) return;

    const rect = e.currentTarget.getBoundingClientRect();
    setDictRect(rect);
    setDictOpen(true);
    setDictLoading(true);
    setDictData(null);

    const result = await DictionaryService.lookupWord(clean, paragraphText);
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
      showToast("すでにリストにあります");
      return;
    }

    const newWord: SavedWord = {
      fr: dictData.mot,
      originalWord: dictData.originalWord,
      ja: dictData.traductionPhrase,
      conciseDef: dictData.conciseDef,
      nature: dictData.nature,
      phraseOriginale: dictData.phraseOriginale,
      traductionPhrase: dictData.traductionPhrase,
      definitions: dictData.definitions,
      listId,
      date: new Date().toISOString(),
    };

    const updated = [...savedWords, newWord];
    setSavedWords(updated);
    localStorage.setItem("furago_words", JSON.stringify(updated));
    showToast("保存しました !");
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
    showToast("リストを作成しました");
  };

  // Delete saved word
  const handleDeleteWord = (wordFr: string, listId: string) => {
    const updated = savedWords.filter(
      (w) => !(w.fr === wordFr && w.listId === listId)
    );
    setSavedWords(updated);
    localStorage.setItem("furago_words", JSON.stringify(updated));
    showToast("削除しました");
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
          setLeadError("このメールアドレスは既に登録されています。");
          showToast("このメールアドレスは既に登録されています。");
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
        showToast("このメールアドレスは既に登録されています。");
        return;
      }
      // Si l'utilisateur a déjà tapé son email dans la barre du haut, on lance la vérif en tâche de fond dès l'ouverture !
      checkEmailInBackground(leadEmail);
    }

    setLeadStep(1);
    setLeadLevel("A1");
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
      if (!leadFirstName.trim() || !leadEmail.trim() || !leadGender) {
        setLeadError("すべての項目を入力・選択してください。");
        return;
      }

      const normalizedEmail = leadEmail.trim().toLowerCase();
      if (isEmailLocallyRegistered(normalizedEmail)) {
        setLeadError("このメールアドレスは既に登録されています。");
        showToast("このメールアドレスは既に登録されています。");
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
      setLeadError("興味のあるカテゴリーを1つ以上選んでください。");
      return;
    }

    const email = leadEmail.trim().toLowerCase();
    if (!email) return;

    if (isEmailLocallyRegistered(email)) {
      setLeadStep(1);
      setLeadError("このメールアドレスは既に登録されています。");
      showToast("このメールアドレスは既に登録されています。");
      return;
    }

    const payload = {
      email,
      name: leadFirstName.trim(),
      firstName: leadFirstName.trim(),
      gender: leadGender,
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
    showToast("ご登録ありがとうございます！確認メールを送信しました。");

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
            showToast("このメールアドレスは既に登録されています。");
          }
        })
        .catch((err) => {
          console.error("Erreur lors de l'envoi en arrière-plan:", err);
        });
    }
  };

  // Filtered articles for Home view
  const filteredArticles = articles.filter((article) => {
    const cat = (article.category || "").trim();
    if (selectedCategories.length > 0 && cat && !selectedCategories.includes(cat)) {
      return false;
    }
    if (!article.levels || !article.levels[globalLevel]) return false;
    return true;
  });

  // Render interactive French paragraph with clickable words and TTS highlight
  const renderInteractiveContent = (text: string) => {
    if (!text) return null;
    const paragraphs = text.split("\n");
    let globalOffset = 0;

    return paragraphs.map((pText, pIdx) => {
      const pStart = globalOffset;
      globalOffset += pText.length + 1;

      if (pText.trim() === "") return null;

      // Tokenize paragraph into words and non-word separators while preserving character offsets
      const tokens: { text: string; isWord: boolean; start: number; end: number }[] = [];
      const tokenRegex = /([a-zA-ZÀ-ÿœŒæÆ]+(?:['’][a-zA-ZÀ-ÿœŒæÆ]+)?)|([^a-zA-ZÀ-ÿœŒæÆ]+)/g;
      let match: RegExpExecArray | null;
      while ((match = tokenRegex.exec(pText)) !== null) {
        const tStart = pStart + match.index;
        const tEnd = tStart + match[0].length;
        tokens.push({
          text: match[0],
          isWord: Boolean(match[1]),
          start: tStart,
          end: tEnd,
        });
      }

      const hlStart = highlightRange.start;
      const hlEnd =
        highlightRange.start >= 0
          ? highlightRange.start + highlightRange.length
          : -1;

      return (
        <p key={pIdx} lang="fr">
          {tokens.map((tok, tIdx) => {
            const isHighlighted =
              hlStart >= 0 && tok.start < hlEnd && tok.end > hlStart;

            if (!tok.isWord) {
              return (
                <span
                  key={tIdx}
                  className={isHighlighted ? "tts-highlight" : undefined}
                >
                  {tok.text}
                </span>
              );
            }

            const isSelectedWord =
              dictOpen &&
              dictData &&
              dictData.originalWord.toLowerCase() === tok.text.toLowerCase();

            return (
              <span
                key={tIdx}
                lang="fr"
                onClick={(e) => handleWordClick(e, tok.text, pText)}
                className={`tap-word ${isHighlighted ? "tts-highlight" : ""} ${
                  isSelectedWord ? "active-word" : ""
                }`}
              >
                {tok.text}
              </span>
            );
          })}
        </p>
      );
    });
  };

  const currentLevelData =
    currentArticle && currentArticle.levels
      ? currentArticle.levels[globalLevel]
      : null;

  const progressPercent =
    ttsQueue.length > 0 ? ((queueIndex + 1) / ttsQueue.length) * 100 : 0;

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
            {globalLevel} ▾
          </button>
        )}
      </header>

      {/* VIEW 1: HOME (記事一覧) */}
      {activeView === "home" && (
        <main className="view fade-in">
          <div className="filters-bar">
            <button
              className="filter-btn"
              onClick={() => setFilterModalType("level")}
            >
              レベル {globalLevel}
            </button>
            <button
              className="filter-btn"
              onClick={() => setFilterModalType("category")}
            >
              {selectedCategories.length === allCategories.length ||
              selectedCategories.length === 0
                ? "カテゴリー"
                : `カテゴリー (${selectedCategories.length})`}
            </button>
          </div>

          {filteredArticles.length === 0 ? (
            <p
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "var(--text-muted)",
              }}
            >
              条件に一致する記事は見つかりませんでした。
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
                          alt={displayTitle || ""}
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
                      <h3 lang="fr">{displayTitle}</h3>
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
                          }}
                        >
                          {article.category || "一般"}
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
                alt={currentLevelData.title}
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
              💡 単語をタップ（またはクリック）すると日本語の意味と文脈翻訳が表示されます
            </p>
          </div>

          <div className="article-content" lang="fr">
            {renderInteractiveContent(currentLevelData.content)}
          </div>

          {/* Comprehension Quiz */}
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
                  単語帳
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
                  + 新しいリスト
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
                            {list.name}
                          </h3>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                            {count} 単語
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
                  {wordLists.find((l) => l.id === currentListId)?.name || "リスト"}
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
                        このリストは空です。
                        <br />
                        記事内でフランス語の単語をタップして追加しましょう！
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
                            {word.nature}
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
                                (原形: {word.fr})
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
                          title="発音を聞く"
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
                          title="削除"
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
                          <span className="dict-context-label">文脈</span>
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
                <span className="dict-nature-tag">{dictData.nature}</span>
              )}
            </div>
            <div className="dict-buttons">
              <button
                className="dict-save-btn"
                title="単語帳に保存"
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
                title="発音を聞く"
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
              検索中...
            </div>
          ) : (
            <div>
              {dictData.conciseDef && (
                <div className="dict-def-line">{dictData.conciseDef}</div>
              )}
              {dictData.traductionPhrase ? (
                <div className="dict-context-row">
                  <span className="dict-context-label">文脈</span>
                  <span>{dictData.traductionPhrase}</span>
                </div>
              ) : (
                !dictData.conciseDef && (
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    定義が見つかりませんでした
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
            title="最初から再生"
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
            title="前の文"
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
            title={isPlaying && !isPaused ? "一時停止" : "再生"}
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
            title="次の文"
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
            <option value={1}>速度 : 標準 (1x)</option>
            <option value={0.8}>速度 : 遅い (0.8x)</option>
            <option value={0.6}>速度 : とても遅い (0.6x)</option>
            <option value={0.4}>速度 : 最も遅い (0.4x)</option>
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
              <option value={0}>フランス語音声 (標準)</option>
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
              {filterModalType === "level" ? "レベルを選ぶ" : "カテゴリーを選ぶ"}
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
                          buildQueueForText(currentArticle.levels[lvl].content);
                        }
                        setFilterModalType(null);
                      }}
                    >
                      レベル {lvl}
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
                        {cat}
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
              保存先リストを選択
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
                    <span style={{ fontWeight: 700 }}>{list.name}</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {count} 単語
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
              キャンセル
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
              新しいリストの名前
            </h3>
            <input
              type="text"
              required
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="例：旅行フレーズ、動詞..."
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
                キャンセル
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
                作成
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
                Furago ニュースレター登録
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

            {/* Barre de progression 3 étapes */}
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
                <span>ステップ {leadStep} / 3</span>
                <span>
                  {leadStep === 1
                    ? "基本情報"
                    : leadStep === 2
                      ? "フランス語レベル"
                      : "興味のあるテーマ"}
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

            {/* Message d'erreur (ex: Email déjà enregistré) */}
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

            {/* ÉTAPE 1 : Prénom, Email et Sexe (Liste déroulante sans sélection par défaut) */}
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
                  名前
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
                  placeholder="例: 太郎 / Taro"
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
                  メールアドレス
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
                  性別
                </label>
                <select
                  required
                  value={leadGender}
                  onChange={(e) => {
                    setLeadGender(e.target.value);
                    setLeadError(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: leadGender ? "var(--text-main)" : "var(--text-muted)",
                    fontSize: "0.95rem",
                    fontWeight: leadGender ? 600 : 400,
                    marginBottom: "22px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  <option value="女性">女性</option>
                  <option value="男性">男性</option>
                  <option value="回答しない">回答しない</option>
                </select>

                <button
                  type="submit"
                  disabled={
                    leadCheckingEmail ||
                    !leadFirstName.trim() ||
                    !leadEmail.trim() ||
                    !leadGender
                  }
                  style={{
                    width: "100%",
                    padding: "13px",
                    background:
                      leadCheckingEmail ||
                      !leadFirstName.trim() ||
                      !leadEmail.trim() ||
                      !leadGender
                        ? "var(--border)"
                        : "var(--primary)",
                    color:
                      leadCheckingEmail ||
                      !leadFirstName.trim() ||
                      !leadEmail.trim() ||
                      !leadGender
                        ? "var(--text-muted)"
                        : "white",
                    border: "none",
                    borderRadius: "12px",
                    fontWeight: 800,
                    fontSize: "0.96rem",
                    cursor:
                      leadCheckingEmail ||
                      !leadFirstName.trim() ||
                      !leadEmail.trim() ||
                      !leadGender
                        ? "not-allowed"
                        : "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {leadCheckingEmail ? "確認中..." : "次へ"}
                </button>
              </div>
            )}

            {/* ÉTAPE 2 : Niveau de français */}
            {leadStep === 2 && (
              <div className="fade-in">
                <p
                  style={{
                    fontSize: "0.92rem",
                    fontWeight: 700,
                    marginBottom: "12px",
                  }}
                >
                  現在のフランス語レベルを教えてください
                </p>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginBottom: "22px",
                  }}
                >
                  {[
                    { code: "A1", desc: "A1 — 入門・初心者" },
                    { code: "A2", desc: "A2 — 初級（日常の基礎）" },
                    { code: "B1", desc: "B1 — 中級（一般的な話題）" },
                    { code: "B2", desc: "B2 — 中上級（ニュースや議論）" },
                    { code: "C1", desc: "C1 — 上級（自然な表現）" },
                  ].map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => setLeadLevel(item.code)}
                      style={{
                        width: "100%",
                        padding: "11px 14px",
                        borderRadius: "12px",
                        textAlign: "left",
                        border:
                          leadLevel === item.code
                            ? "2px solid var(--primary)"
                            : "1px solid var(--border)",
                        background:
                          leadLevel === item.code
                            ? "var(--primary-light)"
                            : "var(--bg)",
                        color:
                          leadLevel === item.code
                            ? "var(--primary)"
                            : "var(--text-main)",
                        fontWeight: 700,
                        fontSize: "0.92rem",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{item.desc}</span>
                      {leadLevel === item.code && <span>✓</span>}
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
                      color: "var(--text-main)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    戻る
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 2,
                      padding: "12px",
                      background: "var(--primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: 800,
                      fontSize: "0.96rem",
                      cursor: "pointer",
                    }}
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 3 : Catégories préférées (Aucune pré-sélectionnée par défaut -> choix conscient) */}
            {leadStep === 3 && (
              <div className="fade-in">
                <p
                  style={{
                    fontSize: "0.92rem",
                    fontWeight: 700,
                    marginBottom: "6px",
                  }}
                >
                  興味のあるカテゴリーを選んでください
                </p>
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    marginBottom: "14px",
                  }}
                >
                  1つ以上タップして選択してください（複数選択可）
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    marginBottom: "24px",
                  }}
                >
                  {newsletterCategoryOptions.map((cat) => {
                    const isSelected = leadCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setLeadCategories((prev) =>
                              prev.filter((c) => c !== cat)
                            );
                          } else {
                            setLeadCategories((prev) => [...prev, cat]);
                          }
                        }}
                        style={{
                          padding: "10px 16px",
                          borderRadius: "18px",
                          border: isSelected
                            ? "2px solid var(--primary)"
                            : "1px solid var(--border)",
                          background: isSelected
                            ? "var(--primary-light)"
                            : "var(--bg)",
                          color: isSelected
                            ? "var(--primary)"
                            : "var(--text-main)",
                          fontWeight: 700,
                          fontSize: "0.9rem",
                          cursor: "pointer",
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
                      color: "var(--text-main)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    戻る
                  </button>
                  <button
                    type="submit"
                    disabled={leadSubmitting || leadCategories.length === 0}
                    style={{
                      flex: 2,
                      padding: "12px",
                      background:
                        leadSubmitting || leadCategories.length === 0
                          ? "var(--border)"
                          : "var(--primary)",
                      color:
                        leadSubmitting || leadCategories.length === 0
                          ? "var(--text-muted)"
                          : "white",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: 800,
                      fontSize: "0.96rem",
                      cursor:
                        leadSubmitting || leadCategories.length === 0
                          ? "not-allowed"
                          : "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {leadSubmitting ? "送信中..." : "登録を完了する"}
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
