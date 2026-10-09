"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechQueueItem = {
  text: string;
  start: number;
  length: number;
};

type SpeechRange = [number, number];

export interface UseSpeechSynthesisResult {
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  setSelectedVoice: (voice: SpeechSynthesisVoice | null) => void;
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  isPlaying: boolean;
  isPaused: boolean;
  speechRange: SpeechRange | null;
  highlightRange: SpeechRange | null;
  currentSentenceIndex: number;
  totalSentences: number;
  prepareText: (text: string, paragraphs?: string[]) => void;
  playText: (text: string, paragraphs?: string[]) => void;
  handlePlayPause: () => void;
  handleRestartAudio: () => void;
  handlePrevSentence: () => void;
  handleNextSentence: () => void;
  stopAudio: () => void;
  speakWord: (word: string) => void;
}

const firstWordPattern = /[a-zA-ZÀ-ÿœŒæÆ]+(?:['’][a-zA-ZÀ-ÿœŒæÆ]+)?/;
const firstWordAtStartPattern = /^[a-zA-ZÀ-ÿœŒæÆ]+(?:['’][a-zA-ZÀ-ÿœŒæÆ]+)?/;

function getFirstWordRange(item: SpeechQueueItem): SpeechRange | null {
  const match = item.text.match(firstWordPattern);
  if (!match || match.index === undefined) return null;
  return [item.start + match.index, match[0].length];
}

function buildSpeechQueue(paragraphs: string[]): SpeechQueueItem[] {
  const queue: SpeechQueueItem[] = [];
  let currentIndex = 0;
  const sentencePattern = /[^.!?\n]+[.!?\n]*\s*/g;

  paragraphs.forEach((text) => {
    const offset = currentIndex;
    let match: RegExpExecArray | null;

    while ((match = sentencePattern.exec(text)) !== null) {
      if (match[0].trim().length > 0) {
        queue.push({
          text: match[0],
          start: offset + match.index,
          length: match[0].length,
        });
      }
    }

    currentIndex += text.length + 1;
  });

  return queue;
}

export default function useSpeechSynthesis(): UseSpeechSynthesisResult {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoiceState] = useState<SpeechSynthesisVoice | null>(null);
  const [speechRate, setSpeechRateState] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechRange, setSpeechRange] = useState<SpeechRange | null>(null);
  const [highlightRange, setHighlightRange] = useState<SpeechRange | null>(null);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [queue, setQueue] = useState<SpeechQueueItem[]>([]);

  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const queueRef = useRef<SpeechQueueItem[]>([]);
  const currentSentenceIndexRef = useRef(0);
  const speechRateRef = useRef(1);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const utteranceVersionRef = useRef(0);
  const playNextInQueueRef = useRef<() => void>(() => {});

  const setSelectedVoice = useCallback((voice: SpeechSynthesisVoice | null) => {
    selectedVoiceRef.current = voice;
    setSelectedVoiceState(voice);

    if (isPlayingRef.current && typeof window !== "undefined" && "speechSynthesis" in window) {
      utteranceVersionRef.current += 1;
      window.speechSynthesis.cancel();
      window.setTimeout(() => playNextInQueueRef.current(), 60);
    }
  }, []);

  const setSpeechRate = useCallback((rate: number) => {
    speechRateRef.current = rate;
    setSpeechRateState(rate);

    if (isPlayingRef.current && typeof window !== "undefined" && "speechSynthesis" in window) {
      utteranceVersionRef.current += 1;
      window.speechSynthesis.cancel();
      window.setTimeout(() => playNextInQueueRef.current(), 60);
    }
  }, []);

  const playNextInQueue = useCallback(() => {
    if (!isPlayingRef.current || isPausedRef.current) return;

    const currentQueue = queueRef.current;
    const index = currentSentenceIndexRef.current;
    if (index >= currentQueue.length) {
      isPlayingRef.current = false;
      isPausedRef.current = false;
      currentSentenceIndexRef.current = 0;
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentSentenceIndex(0);
      const firstItem = currentQueue[0];
      setSpeechRange(firstItem ? [firstItem.start, firstItem.length] : null);
      setHighlightRange(null);
      return;
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const item = currentQueue[index];
    const utteranceVersion = utteranceVersionRef.current;
    const utterance = new SpeechSynthesisUtterance(item.text);
    if (selectedVoiceRef.current) utterance.voice = selectedVoiceRef.current;
    utterance.lang = "fr-FR";
    utterance.rate = speechRateRef.current;

    setCurrentSentenceIndex(index);
    setSpeechRange([item.start, item.length]);

    utterance.onstart = () => {
      if (utteranceVersion === utteranceVersionRef.current) {
        setHighlightRange(getFirstWordRange(item));
      }
    };

    utterance.onboundary = (event) => {
      if (utteranceVersion !== utteranceVersionRef.current || event.name !== "word") return;

      const textRemaining = item.text.substring(event.charIndex);
      const match = textRemaining.match(firstWordAtStartPattern);
      setHighlightRange([item.start + event.charIndex, match ? match[0].length : 1]);
    };

    utterance.onend = () => {
      if (
        utteranceVersion === utteranceVersionRef.current &&
        isPlayingRef.current &&
        !isPausedRef.current
      ) {
        currentSentenceIndexRef.current += 1;
        playNextInQueueRef.current();
      }
    };

    utterance.onerror = (event) => {
      if (utteranceVersion !== utteranceVersionRef.current || event.error === "canceled") return;

      isPlayingRef.current = false;
      isPausedRef.current = false;
      setIsPlaying(false);
      setIsPaused(false);
      setHighlightRange(null);
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    playNextInQueueRef.current = playNextInQueue;
  }, [playNextInQueue]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices() || [];
      const localFrenchVoices = availableVoices.filter((voice) => {
        const language = (voice.lang || "").toLowerCase();
        const name = (voice.name || "").toLowerCase();
        if (
          language.includes("fr-ca") ||
          language.includes("canada") ||
          name.includes("canada") ||
          name.includes("canadien")
        ) {
          return false;
        }
        if (name.includes("network") || name.includes("réseau")) return false;
        return language.startsWith("fr");
      });

      const uniqueVoices: SpeechSynthesisVoice[] = [];
      const seenVoiceIds = new Set<string>();
      localFrenchVoices.forEach((voice) => {
        const id = (voice.voiceURI || voice.name || "")
          .toLowerCase()
          .replace(/-local/g, "")
          .replace(/-network/g, "")
          .trim();
        if (!seenVoiceIds.has(id)) {
          seenVoiceIds.add(id);
          uniqueVoices.push(voice);
        }
      });

      const supportedVoices = uniqueVoices.slice(0, 5);
      setVoices(supportedVoices);
      if (supportedVoices.length > 0 && !selectedVoiceRef.current) {
        setSelectedVoice(supportedVoices[0]);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [setSelectedVoice]);

  useEffect(
    () => () => {
      isPlayingRef.current = false;
      isPausedRef.current = false;
      utteranceVersionRef.current += 1;
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  const stopAudio = useCallback(() => {
    utteranceVersionRef.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    isPlayingRef.current = false;
    isPausedRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    setSpeechRange(null);
    setHighlightRange(null);
  }, []);

  const prepareText = useCallback((text: string, paragraphs?: string[]) => {
    const nextQueue = buildSpeechQueue(paragraphs?.length ? paragraphs : [text]);
    utteranceVersionRef.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    queueRef.current = nextQueue;
    setQueue(nextQueue);
    currentSentenceIndexRef.current = 0;
    setCurrentSentenceIndex(0);
    const firstItem = nextQueue[0];
    setSpeechRange(firstItem ? [firstItem.start, firstItem.length] : null);
    setHighlightRange(null);
    isPlayingRef.current = false;
    isPausedRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const playText = useCallback((text: string, paragraphs?: string[]) => {
    prepareText(text, paragraphs);
    const nextQueue = queueRef.current;

    if (nextQueue.length === 0 || typeof window === "undefined" || !("speechSynthesis" in window)) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);
    playNextInQueueRef.current();
  }, [prepareText]);

  const handlePlayPause = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || queueRef.current.length === 0) {
      return;
    }

    if (isPlayingRef.current && !isPausedRef.current) {
      isPausedRef.current = true;
      isPlayingRef.current = false;
      setIsPaused(true);
      setIsPlaying(false);
      utteranceVersionRef.current += 1;
      window.speechSynthesis.cancel();
      return;
    }

    utteranceVersionRef.current += 1;
    window.speechSynthesis.cancel();
    isPausedRef.current = false;
    isPlayingRef.current = true;
    setIsPaused(false);
    setIsPlaying(true);
    playNextInQueueRef.current();
  }, []);

  const handleRestartAudio = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || queueRef.current.length === 0) {
      return;
    }

    utteranceVersionRef.current += 1;
    window.speechSynthesis.cancel();
    currentSentenceIndexRef.current = 0;
    setCurrentSentenceIndex(0);
    isPausedRef.current = false;
    isPlayingRef.current = true;
    setIsPaused(false);
    setIsPlaying(true);
    window.setTimeout(() => playNextInQueueRef.current(), 80);
  }, []);

  const changeSentence = useCallback((direction: -1 | 1) => {
    const nextIndex = currentSentenceIndexRef.current + direction;
    if (nextIndex < 0 || nextIndex >= queueRef.current.length) return;

    currentSentenceIndexRef.current = nextIndex;
    setCurrentSentenceIndex(nextIndex);
    const item = queueRef.current[nextIndex];
    setSpeechRange([item.start, item.length]);
    setHighlightRange(getFirstWordRange(item));

    if (isPlayingRef.current && typeof window !== "undefined" && "speechSynthesis" in window) {
      utteranceVersionRef.current += 1;
      window.speechSynthesis.cancel();
      playNextInQueueRef.current();
    }
  }, []);

  const handlePrevSentence = useCallback(() => changeSentence(-1), [changeSentence]);
  const handleNextSentence = useCallback(() => changeSentence(1), [changeSentence]);

  const speakWord = useCallback((word: string) => {
    stopAudio();
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "fr-FR";
    utterance.rate = 0.95;
    if (selectedVoiceRef.current) utterance.voice = selectedVoiceRef.current;
    window.speechSynthesis.speak(utterance);
  }, [stopAudio]);

  return {
    voices,
    selectedVoice,
    setSelectedVoice,
    speechRate,
    setSpeechRate,
    isPlaying,
    isPaused,
    speechRange,
    highlightRange,
    currentSentenceIndex,
    totalSentences: queue.length,
    prepareText,
    playText,
    handlePlayPause,
    handleRestartAudio,
    handlePrevSentence,
    handleNextSentence,
    stopAudio,
    speakWord,
  };
}
