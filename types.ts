
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
  userSentence?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string | WordDetail | SavedWord;
  timestamp: number;
}

export interface QuizQuestion {
  sentence: string;
  correctWord: string;
  options: string[];
}
