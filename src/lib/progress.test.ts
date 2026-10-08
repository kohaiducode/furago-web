import { describe, it, expect } from 'vitest';
import { 
  deriveVocabularyProgress, 
  deriveReadingProgress, 
  deriveConsistencyProgress, 
  deriveCurrentPedagogicalGoal, 
  deriveCanDos,
  derivePedagogicalProgress,
  getHighestCompletedContentLevel,
  checkGoalCompletion,
  isPedagogicalGoalAchieved
} from './progress';
import { UserState, LearnedWord } from './userState';

// Helper for minimal state
const createMockState = (overrides?: Partial<UserState>): UserState => ({
  level: "LVL_1",
  savedVocabulary: [],
  learnedVocabulary: [],
  wordLists: [],
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
  ...overrides,
});

describe('Pedagogical Progress Engine', () => {

  it('PROGRESS-01: 0 vocabulaire => 0 rencontré / 0 consolidé.', () => {
    const state = createMockState();
    const progress = deriveVocabularyProgress(state);
    
    expect(progress.wordsEncountered).toBe(0);
    expect(progress.wordsConsolidated).toBe(0);
    expect(progress.wordsInStudy).toBe(0);
  });

  it('PROGRESS-02: interval < 14 => study.', () => {
    const word: LearnedWord = { word: 'test', articleIds: ['art1'], firstLearnedAt: 0, lastReviewedAt: 0, dueAt: 0, interval: 7, difficulty: 'normal', correctCount: 0, wrongCount: 0, reviewStreak: 0 };
    const state = createMockState({ learnedVocabulary: [word] });
    const progress = deriveVocabularyProgress(state);
    
    expect(progress.wordsInStudy).toBe(1);
    expect(progress.wordsConsolidating).toBe(0);
    expect(progress.wordsConsolidated).toBe(0);
  });

  it('PROGRESS-03: interval = 14 => consolidating.', () => {
    const word: LearnedWord = { word: 'test', articleIds: ['art1'], firstLearnedAt: 0, lastReviewedAt: 0, dueAt: 0, interval: 14, difficulty: 'normal', correctCount: 0, wrongCount: 0, reviewStreak: 0 };
    const state = createMockState({ learnedVocabulary: [word] });
    const progress = deriveVocabularyProgress(state);
    
    expect(progress.wordsInStudy).toBe(0);
    expect(progress.wordsConsolidating).toBe(1);
    expect(progress.wordsConsolidated).toBe(0);
  });

  it('PROGRESS-04: interval >= 30 => consolidated.', () => {
    const word: LearnedWord = { word: 'test', articleIds: ['art1'], firstLearnedAt: 0, lastReviewedAt: 0, dueAt: 0, interval: 30, difficulty: 'normal', correctCount: 0, wrongCount: 0, reviewStreak: 0 };
    const state = createMockState({ learnedVocabulary: [word] });
    const progress = deriveVocabularyProgress(state);
    
    expect(progress.wordsInStudy).toBe(0);
    expect(progress.wordsConsolidating).toBe(0);
    expect(progress.wordsConsolidated).toBe(1);
  });

  it('PROGRESS-05: les mots dus utilisent la logique SRS existante.', () => {
    const now = Date.now();
    const past = now - 10000;
    const future = now + 10000;
    const w1: LearnedWord = { word: 'w1', dueAt: past, interval: 1 } as LearnedWord;
    const w2: LearnedWord = { word: 'w2', dueAt: future, interval: 1 } as LearnedWord;
    
    const state = createMockState({ learnedVocabulary: [w1, w2] });
    const progress = deriveVocabularyProgress(state);
    
    // Only past dueAt is considered due
    expect(progress.dueWords).toBe(1);
  });

  it('PROGRESS-06: articles terminés correctement comptés par niveau.', () => {
    const state = createMockState({ 
      level: "LVL_1",
      completedArticles: ["ART1::LVL_2", "ART2", "ART3::LVL_3"] 
    });
    const progress = deriveReadingProgress(state);
    
    expect(progress.completedArticles).toBe(3);
    // ART2 has no level, is not artificially assigned state.level
    expect(progress.completedByLevel["LVL_2"]).toBe(1);
    expect(progress.completedByLevel["LVL_1"]).toBeUndefined();
    expect(progress.completedByLevel["LVL_3"]).toBe(1);
  });

  it('PROGRESS-07: highestCompletedContentLevel est correct.', () => {
    const state = createMockState({ 
      level: "LVL_1",
      completedArticles: ["ART1::LVL_2", "ART2", "ART3::LVL_3"] 
    });
    
    const highest = getHighestCompletedContentLevel(state);
    expect(highest).toBe("LVL_3");
  });

  it('PROGRESS-08: perfectQuizResults correctement comptés.', () => {
    const state = createMockState({ 
      perfectQuizResults: ["ART1", "ART2"] 
    });
    const progress = deriveReadingProgress(state);
    
    expect(progress.perfectQuizResults).toBe(2);
  });

  it('PROGRESS-09: streak séparé de la compétence linguistique.', () => {
    const state = createMockState({ currentStreak: 5, longestStreak: 10 });
    const consistency = deriveConsistencyProgress(state);
    
    expect(consistency.currentStreak).toBe(5);
    expect(consistency.longestStreak).toBe(10);
  });

  it('PROGRESS-10: objectif dynamique déterministe.', () => {
    const vocab = { wordsConsolidated: 5, wordsEncountered: 5, wordsInStudy: 0, wordsConsolidating: 0, dueWords: 0 };
    const reading = { completedArticles: 5, completedByLevel: {}, startedByLevel: {}, highestCompletedContentLevel: "LVL_1" as import('./progress').ContentLevel, perfectQuizResults: 5, quizResults: 5 };
    
    // Test 1: Vocab < 10 => Vocab Goal
    const goal1 = deriveCurrentPedagogicalGoal(vocab, reading);
    expect(goal1.category).toBe("VOCABULARY");
    expect(goal1.target).toBe(10);

    // Test 2: Vocab >= 10, Reading < 3 => Reading Goal
    vocab.wordsConsolidated = 15;
    reading.completedArticles = 2;
    const goal2 = deriveCurrentPedagogicalGoal(vocab, reading);
    expect(goal2.category).toBe("READING");
    expect(goal2.target).toBe(3);

    // Test 3: Reading >= 3, Quiz < 2 => Quiz Goal
    reading.completedArticles = 4;
    reading.perfectQuizResults = 1;
    const goal3 = deriveCurrentPedagogicalGoal(vocab, reading);
    expect(goal3.category).toBe("QUIZ");
    expect(goal3.target).toBe(2);

    // Test 4: All met => Consolidation Goal
    reading.perfectQuizResults = 3;
    const goal4 = deriveCurrentPedagogicalGoal(vocab, reading);
    expect(goal4.category).toBe("CONSOLIDATION");
    expect(goal4.target).toBe(20);
  });

  it('PROGRESS-11: Can-Do vocabulaire débloqué au bon seuil.', () => {
    const vocab = { wordsConsolidated: 20, wordsEncountered: 20, wordsInStudy: 0, wordsConsolidating: 0, dueWords: 0 };
    const reading = { completedArticles: 0, completedByLevel: {}, startedByLevel: {}, highestCompletedContentLevel: null, perfectQuizResults: 0, quizResults: 0 };
    const cons = { currentStreak: 0, longestStreak: 0 };
    
    const canDos = deriveCanDos(vocab, reading, cons);
    const vocabSkill = canDos.find(c => c.id === "CAN-DO-VOCAB-01");
    expect(vocabSkill?.isUnlocked).toBe(true);

    vocab.wordsConsolidated = 19;
    const canDos2 = deriveCanDos(vocab, reading, cons);
    expect(canDos2.find(c => c.id === "CAN-DO-VOCAB-01")?.isUnlocked).toBe(false);
  });

  it('PROGRESS-12: Can-Do lecture débloqué au bon seuil.', () => {
    const vocab = { wordsConsolidated: 0, wordsEncountered: 0, wordsInStudy: 0, wordsConsolidating: 0, dueWords: 0 };
    const reading = { completedArticles: 5, completedByLevel: {}, startedByLevel: {}, highestCompletedContentLevel: null, perfectQuizResults: 3, quizResults: 0 };
    const cons = { currentStreak: 0, longestStreak: 0 };
    
    const canDos = deriveCanDos(vocab, reading, cons);
    const read1 = canDos.find(c => c.id === "CAN-DO-READ-01");
    const read2 = canDos.find(c => c.id === "CAN-DO-READ-02");
    
    expect(read1?.isUnlocked).toBe(true);
    expect(read2?.isUnlocked).toBe(true);
  });

  it('PROGRESS-13: Can-Do niveau de contenu débloqué au bon seuil.', () => {
    const vocab = { wordsConsolidated: 0, wordsEncountered: 0, wordsInStudy: 0, wordsConsolidating: 0, dueWords: 0 };
    const reading = { completedArticles: 1, completedByLevel: {}, startedByLevel: {}, highestCompletedContentLevel: "LVL_2" as import('./progress').ContentLevel, perfectQuizResults: 0, quizResults: 0 };
    const cons = { currentStreak: 0, longestStreak: 0 };
    
    const canDos = deriveCanDos(vocab, reading, cons);
    const contentSkill = canDos.find(c => c.id === "CAN-DO-CONTENT-01");
    expect(contentSkill?.isUnlocked).toBe(true);
  });

  it('PROGRESS-14: Can-Do habit séparé des compétences linguistiques.', () => {
    const vocab = { wordsConsolidated: 0, wordsEncountered: 0, wordsInStudy: 0, wordsConsolidating: 0, dueWords: 0 };
    const reading = { completedArticles: 0, completedByLevel: {}, startedByLevel: {}, highestCompletedContentLevel: null, perfectQuizResults: 0, quizResults: 0 };
    const cons = { currentStreak: 0, longestStreak: 3 };
    
    const canDos = deriveCanDos(vocab, reading, cons);
    const habitSkill = canDos.find(c => c.id === "CAN-DO-HABIT-01");
    expect(habitSkill?.isUnlocked).toBe(true);
    expect(habitSkill?.category).toBe("HABIT");
  });

  it('PROGRESS-15: aucune mutation du UserState.', () => {
    const state = createMockState({ 
      completedArticles: ["A", "B"], 
      learnedVocabulary: [{ word: 'a', interval: 30 } as LearnedWord] 
    });
    
    // Deep clone to check immutability
    const originalStateStr = JSON.stringify(state);
    
    derivePedagogicalProgress(state);
    
    expect(JSON.stringify(state)).toBe(originalStateStr);
  });

  it('PROGRESS-HIST-01: Un article terminé avec niveau explicitement connu est classé dans ce niveau.', () => {
    const state = createMockState({
      level: "LVL_1",
      completedArticles: ["art1::LVL_2"]
    });
    const level = getHighestCompletedContentLevel(state);
    expect(level).toBe("LVL_2");
  });

  it('PROGRESS-HIST-02: Un article terminé sans niveau explicite n\'est pas artificiellement classé avec state.level.', () => {
    const state = createMockState({
      level: "LVL_3",
      completedArticles: ["art_old"] // Pas de ::LVL_3
    });
    const level = getHighestCompletedContentLevel(state);
    expect(level).toBeNull();
  });

  it('PROGRESS-HIST-03: Le calcul du plus haut niveau ignore les articles dont le niveau est inconnu.', () => {
    const state = createMockState({
      level: "LVL_1",
      completedArticles: ["art_old", "art2::LVL_2", "art3::LVL_1"]
    });
    const level = getHighestCompletedContentLevel(state);
    expect(level).toBe("LVL_2");
  });

  it('PROGRESS-REG-01: La modification ne change pas les autres métriques de progression.', () => {
    const state = createMockState({
      level: "LVL_3",
      completedArticles: ["art_old", "art2::LVL_2"]
    });
    const result = derivePedagogicalProgress(state);
    // Even if highest level is LVL_2, consistency, vocabulary, reading counts should be correctly derived
    expect(result.reading.completedArticles).toBe(2);
    expect(result.reading.completedByLevel["LVL_2"]).toBe(1);
    expect(result.reading.highestCompletedContentLevel).toBe("LVL_2");
  });

  it('ANALYTICS-PROGRESS-01: état déjà atteint => aucune completion de transition.', () => {
    const completedState = createMockState({
      learnedVocabulary: Array.from({ length: 10 }, (_, i) => ({
        word: `word${i}`,
        articleIds: ["art1"],
        firstLearnedAt: 0,
        lastReviewedAt: 0,
        dueAt: 0,
        interval: 30,
        difficulty: "normal",
        correctCount: 5,
        wrongCount: 0,
        reviewStreak: 4,
      })),
    });

    expect(checkGoalCompletion(completedState, completedState)).toBeNull();
  });

  it('ANALYTICS-PROGRESS-02: transition réelle du goal vocabulaire => retourne le même goal.', () => {
    const prevState = createMockState({
      learnedVocabulary: Array.from({ length: 9 }, (_, i) => ({
        word: `word${i}`,
        articleIds: ["art1"],
        firstLearnedAt: 0,
        lastReviewedAt: 0,
        dueAt: 0,
        interval: 30,
        difficulty: "normal",
        correctCount: 5,
        wrongCount: 0,
        reviewStreak: 4,
      })),
    });
    const nextState = {
      ...prevState,
      learnedVocabulary: [
        ...prevState.learnedVocabulary,
        {
          word: "word9",
          articleIds: ["art1"],
          firstLearnedAt: 0,
          lastReviewedAt: 0,
          dueAt: 0,
          interval: 30,
          difficulty: "normal" as const,
          correctCount: 5,
          wrongCount: 0,
          reviewStreak: 4,
        },
      ],
    };

    expect(checkGoalCompletion(prevState, nextState)).toMatchObject({
      id: "GOAL_VOCAB_START",
      category: "VOCABULARY",
    });
  });

  it('ANALYTICS-PROGRESS-03: goal toujours incomplet => null.', () => {
    const prevState = createMockState({
      learnedVocabulary: Array.from({ length: 9 }, () => ({ interval: 30 } as LearnedWord)),
    });
    const nextState = createMockState({
      learnedVocabulary: Array.from({ length: 9 }, () => ({ interval: 30 } as LearnedWord)),
      completedArticles: ["art1"],
    });

    expect(checkGoalCompletion(prevState, nextState)).toBeNull();
  });

  it('ANALYTICS-PROGRESS-04: CONTENT_LEVEL utilise le niveau de contenu réellement terminé.', () => {
    const goal = {
      id: "GOAL_CONTENT_LEVEL_2",
      title: "Niveau 2",
      description: "Atteindre le niveau 2",
      current: 1,
      target: 2,
      progressRatio: 0.5,
      category: "CONTENT_LEVEL" as const,
    };
    const prevProgress = derivePedagogicalProgress(createMockState({
      completedArticles: ["art1::LVL_1"],
    }));
    const nextProgress = derivePedagogicalProgress(createMockState({
      completedArticles: ["art1::LVL_1", "art2::LVL_2"],
    }));

    expect(isPedagogicalGoalAchieved(goal, prevProgress)).toBe(false);
    expect(isPedagogicalGoalAchieved(goal, nextProgress)).toBe(true);
  });

  it('ANALYTICS-PROGRESS-05: augmenter le niveau de contenu seul ne valide pas un autre goal actif.', () => {
    const prevState = createMockState({
      completedArticles: ["art1::LVL_1"],
      learnedVocabulary: Array.from({ length: 9 }, () => ({ interval: 30 } as LearnedWord)),
    });
    const nextState = {
      ...prevState,
      completedArticles: ["art1::LVL_1", "art2::LVL_4"],
    };

    expect(checkGoalCompletion(prevState, nextState)).toBeNull();
  });

  it('ANALYTICS-PROGRESS-06: progression reading vers 3 articles valide le goal READING actif.', () => {
    const prevState = createMockState({
      learnedVocabulary: Array.from({ length: 10 }, () => ({ interval: 30 } as LearnedWord)),
      completedArticles: ["art1", "art2"],
    });
    const nextState = {
      ...prevState,
      completedArticles: ["art1", "art2", "art3"],
    };

    expect(checkGoalCompletion(prevState, nextState)).toMatchObject({
      id: "GOAL_READ_MORE",
      category: "READING",
    });
  });

});
