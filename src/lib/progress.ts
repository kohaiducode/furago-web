import { UserState } from "./userState";
import { getWordsDueForReview } from "./srs";

// 1. TYPES

export interface VocabularyProgress {
  wordsEncountered: number;
  wordsInStudy: number;
  wordsConsolidating: number;
  wordsConsolidated: number;
  dueWords: number;
}

export type ContentLevel = "LVL_1" | "LVL_2" | "LVL_3" | "LVL_4" | null;

export interface ReadingProgress {
  completedArticles: number;
  completedByLevel: Record<string, number>;
  startedByLevel: Record<string, number>;
  highestCompletedContentLevel: ContentLevel;
  perfectQuizResults: number;
  quizResults: number;
}

export interface ConsistencyProgress {
  currentStreak: number;
  longestStreak: number;
}

export type GoalCategory = "VOCABULARY" | "READING" | "QUIZ" | "CONTENT_LEVEL" | "CONSOLIDATION";

export interface PedagogicalGoal {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  progressRatio: number;
  category: GoalCategory;
}

export type CanDoCategory = "LEARNING_SKILLS" | "HABIT";

export interface CanDoSkill {
  id: string;
  title: string;
  category: CanDoCategory;
  isUnlocked: boolean;
  criteriaDescription: string;
}

export interface PedagogicalProgress {
  vocabulary: VocabularyProgress;
  reading: ReadingProgress;
  consistency: ConsistencyProgress;
  goal: PedagogicalGoal | null;
  canDos: CanDoSkill[];
}

// 2. VOCABULARY

export const deriveVocabularyProgress = (state: UserState): VocabularyProgress => {
  const vocab = state.learnedVocabulary || [];
  
  let wordsInStudy = 0;
  let wordsConsolidating = 0;
  let wordsConsolidated = 0;

  for (const w of vocab) {
    const interval = w.interval || 0;
    if (interval < 14) {
      wordsInStudy++;
    } else if (interval === 14) {
      wordsConsolidating++;
    } else if (interval >= 30) {
      wordsConsolidated++;
    }
  }

  const dueWords = getWordsDueForReview(vocab).length;

  return {
    wordsEncountered: vocab.length,
    wordsInStudy,
    wordsConsolidating,
    wordsConsolidated,
    dueWords,
  };
};

// 3. READING & CONTENT LEVEL

// Map string level to numeric weight for comparison
const LEVEL_WEIGHTS: Record<string, number> = {
  "LVL_1": 1,
  "LVL_2": 2,
  "LVL_3": 3,
  "LVL_4": 4,
};

export const getHighestCompletedContentLevel = (state: UserState): ContentLevel => {
  if (!state.completedArticles || state.completedArticles.length === 0) {
    return null;
  }
  
  let highest: string | null = null;

  for (const ca of state.completedArticles) {
    const parts = ca.split("::");
    if (parts.length > 1) {
      const lvl = parts[1];
      if (LEVEL_WEIGHTS[lvl]) {
        if (!highest || LEVEL_WEIGHTS[lvl] > LEVEL_WEIGHTS[highest]) {
          highest = lvl;
        }
      }
    }
  }

  return highest as ContentLevel;
};

export const deriveReadingProgress = (state: UserState): ReadingProgress => {
  const completedCount = state.completedArticles?.length || 0;
  
  const completedByLevel: Record<string, number> = {};
  const startedByLevel: Record<string, number> = {};

  if (state.articleProgress) {
    for (const key of Object.keys(state.articleProgress)) {
      const parts = key.split("::");
      if (parts.length > 1) {
        const lvl = parts[1];
        startedByLevel[lvl] = (startedByLevel[lvl] || 0) + 1;
      }
    }
  }

  if (state.completedArticles) {
    for (const ca of state.completedArticles) {
      const parts = ca.split("::");
      const lvl = parts.length > 1 ? parts[1] : null;
      if (lvl) {
        completedByLevel[lvl] = (completedByLevel[lvl] || 0) + 1;
      }
    }
  }

  return {
    completedArticles: completedCount,
    completedByLevel,
    startedByLevel,
    highestCompletedContentLevel: getHighestCompletedContentLevel(state),
    perfectQuizResults: state.perfectQuizResults?.length || 0,
    quizResults: state.quizResults?.length || 0,
  };
};

// 4. CONSISTENCY

export const deriveConsistencyProgress = (state: UserState): ConsistencyProgress => {
  return {
    currentStreak: state.currentStreak || 0,
    longestStreak: state.longestStreak || 0,
  };
};

// 5. GOALS

export const deriveCurrentPedagogicalGoal = (
  vocab: VocabularyProgress,
  reading: ReadingProgress
): PedagogicalGoal => {
  if (vocab.wordsConsolidated < 10) {
    return {
      id: "GOAL_VOCAB_START",
      title: "Consolider le vocabulaire",
      description: "Consolidez 10 mots pour construire une base solide.",
      current: vocab.wordsConsolidated,
      target: 10,
      progressRatio: Math.min(1, vocab.wordsConsolidated / 10),
      category: "VOCABULARY",
    };
  }

  if (reading.completedArticles < 3) {
    return {
      id: "GOAL_READ_MORE",
      title: "Pratique de la lecture",
      description: "Terminez 3 articles pour vous habituer à la lecture.",
      current: reading.completedArticles,
      target: 3,
      progressRatio: Math.min(1, reading.completedArticles / 3),
      category: "READING",
    };
  }

  if (reading.perfectQuizResults < 2) {
    return {
      id: "GOAL_QUIZ_PERFECT",
      title: "Compréhension précise",
      description: "Obtenez 2 scores parfaits aux quiz pour prouver votre compréhension.",
      current: reading.perfectQuizResults,
      target: 2,
      progressRatio: Math.min(1, reading.perfectQuizResults / 2),
      category: "QUIZ",
    };
  }

  const nextTarget = Math.ceil((vocab.wordsConsolidated + 1) / 20) * 20;
  return {
    id: "GOAL_CONSOLIDATE_MORE",
    title: "Enrichissement du vocabulaire",
    description: `Atteignez ${nextTarget} mots consolidés.`,
    current: vocab.wordsConsolidated,
    target: nextTarget,
    progressRatio: Math.min(1, vocab.wordsConsolidated / nextTarget),
    category: "CONSOLIDATION",
  };
};

// 6. CAN-DO

export const deriveCanDos = (
  vocab: VocabularyProgress,
  reading: ReadingProgress,
  consistency: ConsistencyProgress
): CanDoSkill[] => {
  const cando: CanDoSkill[] = [
    {
      id: "CAN-DO-READ-01",
      title: "Je peux comprendre l'idée générale de textes courts.",
      category: "LEARNING_SKILLS",
      isUnlocked: reading.completedArticles >= 5,
      criteriaDescription: "Nécessite 5 articles terminés.",
    },
    {
      id: "CAN-DO-READ-02",
      title: "Je peux retrouver des informations précises dans un texte.",
      category: "LEARNING_SKILLS",
      isUnlocked: reading.perfectQuizResults >= 3,
      criteriaDescription: "Nécessite 3 quiz parfaits.",
    },
    {
      id: "CAN-DO-VOCAB-01",
      title: "Je reconnais et consolide le vocabulaire fréquent rencontré dans mes lectures.",
      category: "LEARNING_SKILLS",
      isUnlocked: vocab.wordsConsolidated >= 20,
      criteriaDescription: "Nécessite 20 mots consolidés.",
    },
    {
      id: "CAN-DO-CONTENT-01",
      title: "Je peux lire et comprendre des textes de niveau intermédiaire.",
      category: "LEARNING_SKILLS",
      isUnlocked: (reading.highestCompletedContentLevel ? (LEVEL_WEIGHTS[reading.highestCompletedContentLevel] || 0) >= LEVEL_WEIGHTS["LVL_2"] : false) && reading.completedArticles > 0,
      criteriaDescription: "Nécessite d'avoir terminé au moins un article de niveau 2 ou supérieur.",
    },
    {
      id: "CAN-DO-HABIT-01",
      title: "Je peux travailler régulièrement sur des contenus élémentaires.",
      category: "HABIT",
      isUnlocked: consistency.longestStreak >= 3,
      criteriaDescription: "Nécessite une série de 3 jours.",
    },
  ];

  return cando;
};

// 7. COMPOSITION GLOBALE

export const derivePedagogicalProgress = (state: UserState): PedagogicalProgress => {
  const vocab = deriveVocabularyProgress(state);
  const reading = deriveReadingProgress(state);
  const consistency = deriveConsistencyProgress(state);
  
  return {
    vocabulary: vocab,
    reading,
    consistency,
    goal: deriveCurrentPedagogicalGoal(vocab, reading),
    canDos: deriveCanDos(vocab, reading, consistency),
  };
};
