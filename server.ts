import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Lazy Gemini client helper
  let genAIClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    if (!genAIClient) {
      genAIClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return genAIClient;
  }

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // Server-side AI Chat API
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, history } = req.body;
      const cleanMessage = (typeof message === "string" ? message : "").trim();
      if (!cleanMessage) {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      const client = getGeminiClient();
      const chatHistory = Array.isArray(history) ? history : [];

      // Build strictly valid alternating turns starting with "user"
      const turns: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

      for (const item of chatHistory) {
        const text = (item.content || "").trim();
        if (!text) continue;
        const role: "user" | "model" = item.role === "assistant" ? "model" : "user";

        // Gemini API constraint: first turn in contents MUST be "user"
        if (turns.length === 0 && role === "model") {
          continue;
        }

        // Gemini API constraint: turns must alternate roles
        if (turns.length > 0 && turns[turns.length - 1].role === role) {
          turns[turns.length - 1].parts[0].text += "\n" + text;
        } else {
          turns.push({ role, parts: [{ text }] });
        }
      }

      // Ensure the latest user message is at the end of the conversation
      if (turns.length === 0) {
        turns.push({ role: "user", parts: [{ text: cleanMessage }] });
      } else {
        const last = turns[turns.length - 1];
        if (last.role === "model") {
          turns.push({ role: "user", parts: [{ text: cleanMessage }] });
        } else if (last.role === "user" && !last.parts[0].text.includes(cleanMessage)) {
          last.parts[0].text = cleanMessage;
        }
      }

      const systemInstruction =
        "You are Study Buddy, a friendly, intelligent, and highly knowledgeable 24/7 AI tutor.\n" +
        "CRITICAL LANGUAGE INSTRUCTION: You MUST ALWAYS respond in the EXACT SAME LANGUAGE as the user's message. For example: if the user writes in Serbian (srpski), respond in natural, fluent Serbian; if Croatian, in Croatian; if Bosnian, in Bosnian; if Spanish, in Spanish; if German, in German; if English, in English, etc.\n" +
        "Answer questions on ANY academic, practical, daily-life, technical, or scientific topic thoroughly, clearly, and step-by-step (e.g. kako objasniti šta je ćelija, fotosinteza, fizika, matematika, učenje, programiranje, istorija).\n" +
        "Format your answer with clean Markdown: bold key terms, clear bullet points or numbered steps, and a short question or tip at the end to check understanding.";

      let responseText = "";
      try {
        const response = await client.models.generateContent({
          model: "gemini-3.7-flash",
          contents: turns,
          config: {
            systemInstruction,
          },
        });
        responseText = response.text || "";
      } catch (geminiErr) {
        console.warn("Primary gemini-3.7-flash failed, trying gemini-2.5-flash fallback:", geminiErr);
        const fallbackResponse = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: turns,
          config: {
            systemInstruction,
          },
        });
        responseText = fallbackResponse.text || "";
      }

      res.json({ reply: responseText });
    } catch (err: unknown) {
      console.error("AI Chat error:", err);
      const errMsg = err instanceof Error ? err.message : "Internal AI Error";
      res.status(500).json({ error: errMsg });
    }
  });

  // Server-side Study Notes Generation API
  app.post("/api/ai/notes", async (req, res) => {
    try {
      const { title, topic } = req.body;
      const displayTitle = (title || topic || "Study Topic").trim();
      const displayTopic = (topic || title || "").trim();

      const client = getGeminiClient();

      const prompt = `Generate comprehensive, exam-ready study notes for:
TOPIC / TITLE: ${displayTitle}
DETAILS / SUBTOPICS: ${displayTopic}

CRITICAL RULES:
1. LANGUAGE: You MUST write the ENTIRE notes and all fields in the EXACT SAME LANGUAGE as the Topic/Title above (e.g. if in Serbian/Croatian/Bosnian, write everything in Serbian/Croatian/Bosnian; if in German, French, Spanish, English, etc., write in that language).
2. COMPREHENSIVENESS: Provide deep, high-quality, practical or academic content for any requested topic without restriction.
3. RETURN JSON with exactly these 4 keys:
   - "title": (string) The title or topic name.
   - "keyPoints": (array of 4-6 concise bullet strings highlighting core rules, mechanisms, or steps).
   - "summary": (string of 2-4 sentences explaining the essence).
   - "fullNotes": (markdown string with detailed structured sections, explanations, step-by-step guidance, and active recall review questions).`;

      let raw = "";
      try {
        const response = await client.models.generateContent({
          model: "gemini-3.7-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });
        raw = response.text || "{}";
      } catch (notesErr) {
        console.warn("Primary gemini-3.7-flash notes failed, trying gemini-2.5-flash fallback:", notesErr);
        const fallbackResponse = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });
        raw = fallbackResponse.text || "{}";
      }
      try {
        const parsed = JSON.parse(raw);
        res.json({
          title: parsed.title || displayTitle,
          keyPoints: Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0
            ? parsed.keyPoints
            : [`Core principles of ${displayTitle}`, `Key steps and mechanisms`, "Practical guidance and real-world application", "Active recall revision questions"],
          summary: parsed.summary || `${displayTitle}: Essential overview and breakdown.`,
          fullNotes: parsed.fullNotes || `### ${displayTitle}\n\n${displayTopic}`,
        });
      } catch {
        res.json({
          title: displayTitle,
          keyPoints: [`Core concept of ${displayTitle}`, `Fundamental principles`, "Practical application"],
          summary: `${displayTitle}`,
          fullNotes: raw,
        });
      }
    } catch (err: unknown) {
      console.error("AI Notes error:", err);
      const errMsg = err instanceof Error ? err.message : "Internal Notes Generation Error";
      res.status(500).json({ error: errMsg });
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Study Buddy server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
