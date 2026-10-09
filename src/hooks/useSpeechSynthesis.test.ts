import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useSpeechSynthesis from "./useSpeechSynthesis";

class MockSpeechSynthesisUtterance {
  lang = "";
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: ((event: SpeechSynthesisEvent) => void) | null = null;
  onboundary: ((event: SpeechSynthesisEvent) => void) | null = null;
  onend: ((event: SpeechSynthesisEvent) => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

  constructor(public text: string) {}
}

describe("useSpeechSynthesis", () => {
  let speechSynthesisMock: SpeechSynthesis;
  let speakMock: ReturnType<typeof vi.fn<(utterance: SpeechSynthesisUtterance) => void>>;
  let cancelMock: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    speakMock = vi.fn<(utterance: SpeechSynthesisUtterance) => void>();
    cancelMock = vi.fn<() => void>();
    speechSynthesisMock = window.speechSynthesis;
    vi.spyOn(speechSynthesisMock, "getVoices").mockReturnValue([]);
    vi.spyOn(speechSynthesisMock, "speak").mockImplementation((utterance) => speakMock(utterance));
    vi.spyOn(speechSynthesisMock, "cancel").mockImplementation(() => cancelMock());
    speechSynthesisMock.onvoiceschanged = null;
    vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("initializes with default playback state", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.currentSentenceIndex).toBe(0);
    expect(result.current.totalSentences).toBe(0);
    expect(result.current.speechRate).toBe(1);
    expect(result.current.speechRange).toBeNull();
    expect(result.current.highlightRange).toBeNull();
  });

  it("speaks a word with a French utterance", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.speakWord("bonjour"));

    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledTimes(1);
    const utterance = speakMock.mock.calls[0][0] as MockSpeechSynthesisUtterance;
    expect(utterance.text).toBe("bonjour");
    expect(utterance.lang).toBe("fr-FR");
    expect(utterance.rate).toBe(0.95);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isPaused).toBe(false);
  });

  it("stops playback and clears speech and highlight ranges", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.playText("Bonjour."));
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.speechRange).toEqual([0, 8]);

    act(() => {
      result.current.stopAudio();
    });

    expect(cancelMock).toHaveBeenCalledTimes(2);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.speechRange).toBeNull();
    expect(result.current.highlightRange).toBeNull();
  });

  it("cancels speech and removes the voice-change handler on unmount", () => {
    const { unmount } = renderHook(() => useSpeechSynthesis());
    expect(speechSynthesisMock.onvoiceschanged).toBeTypeOf("function");

    unmount();

    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(speechSynthesisMock.onvoiceschanged).toBeNull();
  });

  it("builds a sentence queue and starts speaking the first sentence", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.playText("Bonjour. Comment ça va?"));

    expect(result.current.totalSentences).toBe(2);
    expect(result.current.currentSentenceIndex).toBe(0);
    expect(result.current.speechRange).toEqual([0, 9]);
    expect(speakMock).toHaveBeenCalledTimes(1);
  });
});
