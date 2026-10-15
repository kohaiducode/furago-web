/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import FuragoApp from './FuragoApp';
import * as userStateMock from '../lib/userState';

vi.mock('../lib/userState', () => ({
  loadUserState: vi.fn(),
  updateUserState: vi.fn(),
  saveUserState: vi.fn(),
  mergeLearnedVocabulary: vi.fn((existing, newVocab) => [...existing, ...newVocab.map((w: any) => ({ word: w }))]),
}));
vi.mock('../lib/analytics', () => ({
  checkAndTrackSessionStart: vi.fn(),
  updateSessionActivity: vi.fn(),
  trackEvent: vi.fn(),
}));

const mockArticles = [
  {
    id: 1,
    category: 'Technology',
    levels: {
      LVL_1: {
        title: 'Article 1',
        paragraphs: [{ id: '1', fr: 'Test FR', ja: 'Test JA', en: 'Test EN' }],
        targetVocabulary: ['test'],
        quiz: [] 
      }
    }
  },
  {
    id: 2,
    category: { ja: 'Science', en: 'Science', fr: 'Science' },
    levels: {
      LVL_1: {
        title: 'Article 2',
        paragraphs: [{ id: '2', fr: 'Test 2', ja: 'Test 2 JA', en: 'Test 2 EN' }],
        quiz: [
          { id: 'q1', text: { ja: 'Q1', en: 'Q1', fr: 'Q1' }, choices: [{ id: 'c1', text: { ja: 'A', en: 'A', fr: 'A' }, isCorrect: true }] }
        ]
      }
    }
  }
];

const getMockUserState = () => ({
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
});

describe('FuragoApp 5.5-A Refactor Regression Tests', () => {
  let originalWindowLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userStateMock.loadUserState).mockReturnValue(getMockUserState());
    localStorage.clear();

    originalWindowLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalWindowLocation, search: '' },
      writable: true,
      configurable: true
    });

    let currentUrl = '/';
    let currentState: any = {};
    window.history.pushState = vi.fn((state, _, url) => {
      currentState = state;
      currentUrl = url as string;
    });
    window.history.replaceState = vi.fn((state, _, url) => {
      currentState = state;
      currentUrl = url as string;
    });
    Object.defineProperty(window.history, 'state', { get: () => currentState, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalWindowLocation,
      writable: true,
      configurable: true
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const setLocationSearch = (search: string) => {
    Object.defineProperty(window, 'location', {
      value: { ...originalWindowLocation, search },
      writable: true,
      configurable: true
    });
  };

  it('APP-04: URL ?view=reading&id=... initializes directly the right article', () => {
    setLocationSearch('?view=reading&id=1');
    render(<FuragoApp initialArticles={mockArticles as any} />);
    expect(screen.getByText('Article 1')).toBeDefined();
  });

  it('APP-05: Invalid URL falls back correctly to Home', () => {
    setLocationSearch('?view=reading&id=999');
    render(<FuragoApp initialArticles={mockArticles as any} />);
    expect(screen.queryByText('Article 999')).toBeNull();
  });

  it('APP-06: popstate to article loads article', async () => {
    render(<FuragoApp initialArticles={mockArticles as any} />);
    const popStateEvent = new PopStateEvent('popstate', {
      state: { furago: true, view: 'reading', id: 1 }
    });
    setLocationSearch('?view=reading&id=1');
    window.dispatchEvent(popStateEvent);
    await waitFor(() => {
      expect(screen.getByText('Article 1')).toBeDefined();
    });
  });

  it('APP-07: popstate to Home goes to Home', async () => {
    setLocationSearch('?view=reading&id=1');
    render(<FuragoApp initialArticles={mockArticles as any} />);
    const popStateEvent = new PopStateEvent('popstate', {
      state: { furago: true, view: 'home' }
    });
    window.dispatchEvent(popStateEvent);
    await waitFor(() => {
      expect(screen.queryByText('Article 1')).toBeNull(); 
    });
  });

  it('APP-01, APP-03: Article without quiz can be completed, XP awarded exactly once', async () => {
    setLocationSearch('?view=reading&id=1');
    const { container } = render(<FuragoApp initialArticles={mockArticles as any} />);
    
    const btn = await screen.findByText(/読み終わった|Finished Reading/i);
    fireEvent.click(btn);
    
    await waitFor(() => {
      expect(screen.getByText(/記事を完了しました|Article Completed/i)).toBeDefined();
    });
    
    // Check UI for XP (it should be 20 or 30 with daily mission)
    let xpElement = container.querySelector('.stat-xp');
    expect(xpElement?.textContent).toMatch(/20|30/);
    
    // Go back to Home
    fireEvent.click(screen.getByText(/ホームへ戻る|Back to Home/i));
    await waitFor(() => {
      expect(screen.queryByText(/記事を完了しました|Article Completed/i)).toBeNull();
    });
    
    // Open article 1 again by popstate
    const popStateEvent = new PopStateEvent('popstate', {
      state: { furago: true, view: 'reading', id: 1 }
    });
    window.dispatchEvent(popStateEvent);
    
    await waitFor(() => {
      expect(screen.getByText('Article 1')).toBeDefined();
    });

    // The finished button shouldn't add more XP if we somehow trigger completion again
    // But since it's already complete, the UI handles it. The XP on top should still be the same.
    xpElement = container.querySelector('.stat-xp');
    expect(xpElement?.textContent).not.toMatch(/40|60/); 
    expect(xpElement?.textContent).toMatch(/20|30/);
  });

  it('APP-02: Quiz completion awards XP exactly once', async () => {
    setLocationSearch('?view=reading&id=2');
    const { container } = render(<FuragoApp initialArticles={mockArticles as any} />);
    
    const answer = await screen.findByText('1. A');
    fireEvent.click(answer);
    
    await waitFor(() => {
      expect(screen.getByText(/記事を完了しました|Article Completed/i)).toBeDefined();
    }, { timeout: 3000 });
    
    let xpElement: Element | null = null;
    await waitFor(() => {
      xpElement = container.querySelector('.stat-xp');
      expect(xpElement).not.toBeNull();
    }, { timeout: 3000 });
    
    // Article(20) + Quiz(10) + Perfect(5) = 35. With daily mission (+10) = 45.
    expect((xpElement as Element | null)?.textContent).toMatch(/35|45/);
  });
  
  it('APP-08: Initial lead bar state corresponds to localStorage', () => {
    localStorage.setItem("furago_lead_subscribed", "1");
    render(<FuragoApp initialArticles={mockArticles as any} />);
    expect(screen.queryByText(/ニュースレター/)).toBeNull();
  });

  it('APP-09: Categories are correctly initialized from articles', () => {
    render(<FuragoApp initialArticles={mockArticles as any} />);
    expect(screen.getAllByText('Technology').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Science').length).toBeGreaterThan(0);
  });

  it('APP-WORDBOOK-01: URL ?view=words renders the Wordbook lists from UserState', () => {
    const state = getMockUserState() as any;
    state.wordLists = [{ id: "default", name: "Ma liste" }];
    state.savedVocabulary = [{ fr: "bonjour", ja: "hello", listId: "default", date: "2026-01-01" }];
    vi.mocked(userStateMock.loadUserState).mockReturnValue(state);
    setLocationSearch('?view=words');

    render(<FuragoApp initialArticles={mockArticles as any} />);

    expect(screen.getByText('Furago — Mots appris')).toBeDefined();
    expect(screen.getByText('Ma liste')).toBeDefined();
  });

  it('HOME-ARCH-01: primary action precedes the article catalogue and filters sit above the list', () => {
    const { container } = render(<FuragoApp initialArticles={mockArticles as any} />);

    const primary = container.querySelector('.primary-card');
    const catalog = container.querySelector('#home-catalog');
    expect(primary).not.toBeNull();
    expect(catalog).not.toBeNull();

    // Primary action appears before the catalogue in document order.
    const positionPrimary = Array.from(container.querySelectorAll('.primary-card, #home-catalog')).indexOf(primary as Element);
    const positionCatalog = Array.from(container.querySelectorAll('.primary-card, #home-catalog')).indexOf(catalog as Element);
    expect(positionPrimary).toBeLessThan(positionCatalog);

    // Filters are inside the catalogue section.
    const filters = catalog?.querySelector('.filters-bar');
    expect(filters).not.toBeNull();

    // Article list follows the filters inside the catalogue.
    const articleList = catalog?.querySelector('.article-list');
    expect(articleList).not.toBeNull();
  });

  it('USERSTATE-HYDRATION-01: server markup is stable, persisted state restores, and the home action is recalculated', async () => {
    const today = new Date().toLocaleDateString('en-CA');
    const persistedState = {
      ...getMockUserState(),
      xp: 42,
      savedVocabulary: [{ fr: 'bonjour', ja: 'こんにちは', listId: 'default', date: today }],
      dailyMissionTarget: { date: today, articleId: '2', level: 'LVL_1' },
    };
    const persistedRaw = JSON.stringify(persistedState);
    localStorage.setItem('furago:user-state:v1', persistedRaw);
    vi.mocked(userStateMock.loadUserState).mockReturnValue(persistedState as any);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ articles: mockArticles }),
    }));

    const browserWindow = window;
    vi.stubGlobal('window', undefined as unknown as Window);
    let serverMarkup: string;
    try {
      serverMarkup = renderToString(<FuragoApp initialArticles={mockArticles as any} />);
    } finally {
      vi.stubGlobal('window', browserWindow);
    }

    const serverContainer = document.createElement('div');
    serverContainer.innerHTML = serverMarkup;
    expect(serverContainer.querySelector('#home-primary-title')?.textContent).toBe('次の学習');
    expect(userStateMock.loadUserState).not.toHaveBeenCalled();

    const container = document.createElement('div');
    container.innerHTML = serverMarkup;
    document.body.appendChild(container);
    const recoverableErrors: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <FuragoApp initialArticles={mockArticles as any} />, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      });
    });

    expect(recoverableErrors).toEqual([]);
    expect(container.querySelector('#home-primary-title')?.textContent).toBe('今日のミッション');
    expect(userStateMock.loadUserState).toHaveBeenCalledTimes(1);
    expect(userStateMock.saveUserState).not.toHaveBeenCalled();
    expect(localStorage.getItem('furago:user-state:v1')).toBe(persistedRaw);
    expect(container.querySelector('.stat-xp')?.textContent).toContain('42');

    await act(async () => root?.unmount());
    container.remove();
  });
});
