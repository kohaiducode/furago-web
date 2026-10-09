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
