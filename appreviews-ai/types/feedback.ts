export interface Feedback {
  id: string;
  date: string;
  sentiment: '正面' | '中性' | '負面';
  rating: number;
  device: string;
  category: string;
}

export interface Keyword {
  word: string;
  count: number;
}

export interface Review {
  date: string;
  username: string;
  review: string;
  rating: number;
  platform: string;
  developerResponse: string;
  language: string;
  appName?: string;
}

export interface ApiResponse {
  success: boolean;
  data: Review[];
  error?: string;
  details?: any;
}

export interface AnalysisResult {
  feedbacks: Array<{
    id: string;
    company: string;
    date: string;
    content: string;
    rating: number;
    device: string;
    category: string;
    sentiment: string;
    keywords: string[];
  }>;
  keywords: Keyword[];
  summary: {
    totalCount: number;
    positiveRatio: number;
    neutralRatio: number;
    negativeRatio: number;
    averageRating: number;
  };
} 