import { useState, useCallback } from "react";
import type { ChatMessage, StudyContent } from "@/types/study";
import { generateChatResponse, generateStudyNotes } from "@/services/study/aiService";

const API_KEY_STORAGE = "study_buddy_gemini_key";

export function useStudyAI() {
  const [isLoading, setIsLoading] = useState(false);

  const getApiKey = useCallback(() => {
    try {
      return localStorage.getItem(API_KEY_STORAGE) || undefined;
    } catch {
      return undefined;
    }
  }, []);

  const chatWithAI = useCallback(
    async (message: string, history: ChatMessage[] = []): Promise<string> => {
      setIsLoading(true);
      try {
        const apiKey = getApiKey();
        const response = await generateChatResponse(message, history, apiKey);
        return response;
      } finally {
        setIsLoading(false);
      }
    },
    [getApiKey]
  );

  const generateNotes = useCallback(
    async (title: string, topic: string): Promise<{ content: StudyContent }> => {
      setIsLoading(true);
      try {
        const apiKey = getApiKey();
        const result = await generateStudyNotes(title, topic, apiKey);
        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [getApiKey]
  );

  return {
    chatWithAI,
    generateNotes,
    isLoading,
  };
}
