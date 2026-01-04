
export interface ContextExample {
  category: string;
  sentence: string;
  explanation?: string;
}

export interface WordDetail {
  word: string;
  nuance: string;
  examples: ContextExample[];
}

export interface SavedWord extends WordDetail {
  id: string;
  savedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string | WordDetail;
  timestamp: number;
}

export interface QuizQuestion {
  sentence: string; // The sentence with a blank ____
  correctWord: string;
  options: string[];
}
