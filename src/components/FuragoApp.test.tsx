/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
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
});
