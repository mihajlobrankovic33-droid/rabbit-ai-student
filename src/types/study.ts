export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  userId?: string;
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
  userId?: string;
}

export interface Note {
  id: string;
  title: string;
  topic: string;
  content: StudyContent;
  createdAt: string;
  updatedAt?: string;
  userId?: string;
}

export interface AIVerificationResult {
  status: "approved" | "rejected" | "processing" | "idle";
  verified: boolean;
  accuracyScore: number; // 0 - 100
  verdictSummary: string;
  correctionsOrIssues: string[];
  topicsCovered: string[];
  pageCount: number;
  verifiedAt?: string;
  strengths?: string[];
}

export interface MarketComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: string;
}

export interface MarketNote {
  id: string;
  title: string;
  subject: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  description: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  pdfDataUrl?: string; // base64 or generated blob data
  verification: AIVerificationResult;
  upvotes: number;
  upvotedBy?: string[]; // user IDs who upvoted
  downloadsCount: number;
  tags: string[];
  createdAt: string;
  comments?: MarketComment[];
}
