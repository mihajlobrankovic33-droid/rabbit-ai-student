export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
}

export interface StudyContent {
  title: string;
  keyPoints: string[];
  summary: string;
  fullNotes?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  topic: string;
  content: StudyContent;
  createdAt: string;
}
