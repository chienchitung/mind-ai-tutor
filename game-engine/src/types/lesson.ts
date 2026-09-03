import type { GameMission } from './game'

export interface Question {
  id: number;
  description: string;
  answer: string;
  hint?: string;
  explanation?: string;
}

export interface Lesson {
  lesson_id: string;
  title: string;
  description: string;
  content: string;
  number: number;
  excelExample?: string;
  duration?: string;
  xpPoints?: number;
  isLocked?: boolean;
  showGame?: boolean;
  questions?: Question[];
  isFinal?: boolean;
  role?: 'intro' | 'standard' | 'final';
  geniallyLink?: string | null;
  teachingContent?: string | null;
  markdownContent?: string | null;
  practiceExercises?: unknown;
  metadata?: Record<string, unknown>;
  learningFlow?: 'challenge_first' | 'content_first';
  mission?: GameMission;
}

export interface LessonProgress {
  currentLesson: string;
  completed: boolean;
  stars: number;
  completedLessons: string[];
  finalAnswer?: string;
}

export interface UserProgress {
  currentLesson: string;
  completed: boolean;
  stars: number;
  completedLessons: string[];
  finalAnswer?: string;
  lastUpdated?: Date;
  totalXP?: number;
  exp: number;
  level: number;
  dailyProgress: number;
  streak: number;
}

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  imageUrl?: string;
}

export interface State {
  currentLesson: string;
  completed: boolean;
  stars: number;
  completedLessons: string[];
  answer: string;
  hasSubmitted: boolean;
  isCorrect: boolean;
  showChat: boolean;
  exp: number;
  level: number;
  dailyProgress: number;
  dailyGoal: number;
  streak: number;
}
