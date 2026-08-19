import { useState, useCallback, useRef } from "react";
import type { ChatMessage, StudyContent } from "@/types/study";
import { generateChatResponse, generateStudyNotes } from "@/services/study/aiService";

const API_KEY_STORAGE = "study_buddy_gemini_key";

export function useStudyAI() {
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getApiKey = useCallback(() => {
    try {
      return localStorage.getItem(API_KEY_STORAGE) || undefined;
    } catch {
      return undefined;
    }
  }, []);

  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  const chatWithAI = useCallback(
    async (message: string, history: ChatMessage[] = []): Promise<string> => {
      // Abort any existing running query first
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsLoading(true);

      try {
        const apiKey = getApiKey();
        const response = await generateChatResponse(
          message,
          history,
          apiKey,
          controller.signal
        );
        return response;
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [getApiKey]
  );

  const generateNotes = useCallback(
    async (title: string, topic: string): Promise<{ content: StudyContent }> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsLoading(true);

      try {
        const apiKey = getApiKey();
        const result = await generateStudyNotes(
          title,
          topic,
          apiKey,
          controller.signal
        );
        return result;
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [getApiKey]
  );

  return {
    chatWithAI,
    generateNotes,
    cancelGeneration,
    isLoading,
  };
}
