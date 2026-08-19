import type { ChatMessage, StudyContent } from "@/types/study";
import {
  generateOllamaChat,
  generateOllamaNotes,
  getOllamaConfig,
} from "./ollamaService";

export type AIProvider = "ollama" | "builtin_offline" | "gemini";

const AI_PROVIDER_KEY = "study_buddy_ai_provider";
const GEMINI_KEY_STORAGE = "study_buddy_gemini_key";

export function getSelectedAIProvider(): AIProvider {
  try {
    const raw = localStorage.getItem(AI_PROVIDER_KEY);
    if (raw === "ollama" || raw === "builtin_offline" || raw === "gemini") {
      return raw;
    }
  } catch (e) {
    console.warn(e);
  }
  return "builtin_offline";
}

export function setSelectedAIProvider(provider: AIProvider): void {
  try {
    localStorage.setItem(AI_PROVIDER_KEY, provider);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Built-in intelligent offline knowledge base across disciplines.
 * Provides dynamic, non-repetitive responses when offline.
 */
interface SubjectPattern {
  keywords: RegExp;
  subject: string;
  generateResponse: (topic: string) => string;
}

const SUBJECT_PATTERNS: SubjectPattern[] = [
  {
    keywords: /(calculus|derivative|integral|limit|taylor|differentiation|chain rule|product rule)/i,
    subject: "Calculus & Analysis",
    generateResponse: (topic) => `### Calculus & Mathematical Analysis: **${topic}** 🧮

1. **Fundamental Definition**:
   Calculus studies instantaneous change and accumulation. For **${topic}**, determine whether the question focuses on the rate of change ($df/dx$) or total accumulated area ($\\int f(x)dx$).

2. **Step-by-Step Problem Solving Method**:
   - **Step 1**: Identify input variables and boundary conditions.
   - **Step 2**: Apply foundational identities (power rule, product/quotient rule, or integration by substitution).
   - **Step 3**: Differentiate or integrate term-by-term.
   - **Step 4**: Check limit behavior ($x \\to 0, x \\to \\infty$) or verify units.

3. **Active Recall Quiz**:
   *Can you state the derivative or integral formula for this function from memory and explain what its graph represents?*`,
  },
  {
    keywords: /(physics|gravity|newton|momentum|kinematics|thermodynamic|entropy|electromagnet|quantum|relativity|optics|wave)/i,
    subject: "Physics",
    generateResponse: (topic) => `### Physics Breakdown: **${topic}** ⚡

1. **Governing Physical Laws**:
   **${topic}** is governed by foundational conservation laws (Energy, Momentum, or Charge).

2. **Key Relationships & Mechanics**:
   - **Forces & Vectors**: Break vectors into orthogonal components ($x, y, z$).
   - **Energy Transformation**: Potential energy $\\leftrightarrow$ Kinetic energy, accounting for dissipation.
   - **Symmetry & Limits**: Verify what happens in extreme cases (e.g., zero friction or vacuum conditions).

3. **Memory Tip**:
   Always draw a Free Body Diagram (FBD) and track dimensional units ($kg \\cdot m/s^2$, Joules, Watts) before calculating final numbers.`,
  },
  {
    keywords: /(chemistry|reaction|stoichiometry|periodic|acid|base|ph|oxidation|reduction|orbital|covalent|ionic|molarity)/i,
    subject: "Chemistry",
    generateResponse: (topic) => `### Chemistry Insights: **${topic}** 🧪

1. **Core Mechanism**:
   **${topic}** centers on molecular interactions, electron configurations, and valence dynamics.

2. **Essential Study Steps**:
   - **Step 1**: Write down the balanced chemical equation.
   - **Step 2**: Identify oxidation numbers and electron transfer (LEO says GER: Loss = Oxidation, Gain = Reduction).
   - **Step 3**: Calculate molar ratios ($n = m/M$) and limiting reagents.
   - **Step 4**: Note equilibrium shifts via Le Chatelier's principle.

3. **Self-Test**:
   *What happens to the reaction equilibrium if temperature or pressure is doubled?*`,
  },
  {
    keywords: /(biology|cell|mitosis|meiosis|dna|rna|genetics|protein|photosynthesis|enzyme|evolution|organism|neuron)/i,
    subject: "Biology & Life Sciences",
    generateResponse: (topic) => `### Biology Guide: **${topic}** 🧬

1. **Biological Significance**:
   In living systems, **${topic}** is an essential biochemical process sustaining homeostasis and cellular function.

2. **Sequential Stages**:
   - **Structure**: Cellular organelle or enzyme active site responsible.
   - **Process**: Molecular pathway from initiation $\\to$ elongation/transcription $\\to$ termination.
   - **Regulation**: Feedback inhibition and hormonal/environmental triggers.

3. **Study Strategy**:
   Sketch the cycle or cell diagram and label each intermediate stage without looking at the textbook.`,
  },
  {
    keywords: /(code|programming|algorithm|python|javascript|typescript|react|data structure|tree|graph|sorting|complexity|big o)/i,
    subject: "Computer Science",
    generateResponse: (topic) => `### Computer Science & Algorithms: **${topic}** 💻

1. **Core Concept & Complexity**:
   Understanding **${topic}** requires analyzing time complexity $O(n)$ and auxiliary space overhead.

2. **Implementation Blueprint**:
   - **Base Case**: Always establish termination conditions to prevent stack overflow.
   - **Edge Cases**: Handle empty inputs, null pointers, single elements, and boundary values.
   - **Optimal Invariant**: Maintain correctness across loops or recursive steps.

3. **Practice Challenge**:
   Implement a minimal prototype or trace the algorithm step-by-step on a whiteboard with a 4-element test array.`,
  },
  {
    keywords: /(history|revolution|empire|war|treaty|century|dynasty|civil war|renaissance|constitution)/i,
    subject: "History & Social Studies",
    generateResponse: (topic) => `### Historical Analysis: **${topic}** 🏛️

1. **Historical Context & Causes**:
   Examine the socio-economic, political, and philosophical catalysts that led to **${topic}**.

2. **Turning Points & Impact**:
   - **Primary Catalyst**: The immediate flashpoint and underlying tensions.
   - **Key Figures & Factions**: Motives, treaties, and strategic decisions.
   - **Long-term Legacy**: How institutions, borders, and modern governance were reshaped.

3. **Revision Question**:
   *What were the top 3 unintended consequences that followed this historical period?*`,
  },
  {
    keywords: /(economics|macroeconomics|microeconomics|inflation|gdp|supply|demand|fiscal|monetary|market|elasticity)/i,
    subject: "Economics & Finance",
    generateResponse: (topic) => `### Economics Analysis: **${topic}** 📈

1. **Market Mechanics**:
   **${topic}** illustrates the interplay between price signals, incentives, and resource allocation.

2. **Key Analytical Tools**:
   - **Supply & Demand Curves**: Shifts vs. movements along the curve.
   - **Opportunity Cost**: The highest-value foregone alternative.
   - **Policy Interventions**: Central bank rates, taxation, and price ceilings/floors.

3. **Quick Review**:
   *Does this change cause a short-run equilibrium shift or a permanent structural realignment?*`,
  },
];

export async function generateChatResponse(
  message: string,
  history: ChatMessage[] = [],
  customApiKey?: string,
  signal?: AbortSignal
): Promise<string> {
  const clean = message.trim();
  const lower = clean.toLowerCase();
  const provider = getSelectedAIProvider();

  // 1. Ollama Provider (with anti-repetition / anti-suspension parameters)
  if (provider === "ollama") {
    try {
      const ollamaConfig = getOllamaConfig();
      const messagesForOllama = [
        ...history.slice(-6).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        { role: "user", content: clean },
      ];
      const ollamaReply = await generateOllamaChat(messagesForOllama, ollamaConfig, signal);
      return ollamaReply;
    } catch (ollamaErr: unknown) {
      if (signal?.aborted) {
        return "*(Generation was stopped)*";
      }
      console.warn("Ollama query failed, falling back to dynamic built-in engine:", ollamaErr);
      const errMsg = ollamaErr instanceof Error ? ollamaErr.message : "Ollama connection error";
      const fallbackResponse = generateDynamicBuiltinResponse(clean, lower);
      return `*(Ollama notice: ${errMsg} — using built-in study assistant)*\n\n${fallbackResponse}`;
    }
  }

  // 2. Gemini Cloud Provider (Optional)
  if (provider === "gemini") {
    const key =
      customApiKey ||
      localStorage.getItem(GEMINI_KEY_STORAGE) ||
      (typeof process !== "undefined" ? process.env?.VITE_GEMINI_API_KEY : undefined);

    if (key) {
      try {
        const contents = [
          ...history.slice(-6).map((msg) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          })),
          {
            role: "user",
            parts: [
              {
                text: `You are Study Buddy, an expert, friendly AI tutor. Answer directly, provide structured explanations with bold highlights and bullet points, and avoid repetitive boilerplate.\n\nStudent question: ${clean}`,
              },
            ],
          },
        ];

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal,
            body: JSON.stringify({ contents }),
          }
        );
        if (response.ok) {
          const data = await response.json();
          const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidate) return candidate;
        }
      } catch (e) {
        if (signal?.aborted) return "*(Generation stopped)*";
        console.warn("Cloud AI call failed, using built-in generator:", e);
      }
    }
  }

  // 3. Dynamic Built-in Offline Engine (Diverse, context-aware, anti-spam)
  return generateDynamicBuiltinResponse(clean, lower);
}

/**
 * Context-aware dynamic offline engine: inspects topic and generates customized content without repetition
 */
function generateDynamicBuiltinResponse(clean: string, lower: string): string {
  // Greetings
  if (/^(hi|hello|hey|hola|bonjour|hallo|ciao|olá|привет|здрав|yo)\b/i.test(lower)) {
    return `Hey there! 👋 I'm Study Buddy, your AI tutor.\n\nWhat subject or concept are you working on today? (e.g. *Derivatives, Newton's Laws, Mitosis, Python recursion, or World War II*)`;
  }

  // Study technique queries
  if (/(study tip|how to study|pomodoro|active recall|spaced repetition|feynman)/i.test(lower)) {
    return `### High-Efficiency Study Strategies 🎯\n\n1. **The Feynman Technique**: Teach the concept to an imaginary 10-year-old in simple, jargon-free words.\n2. **Active Recall**: Test yourself with flashcards or practice questions instead of re-reading.\n3. **Interleaving**: Mix 2–3 related subjects in one session rather than doing one topic for 5 hours straight.\n4. **Spaced Intervals**: Review challenging points at 1 day, 3 days, and 7 days.`;
  }

  // Check matching subjects
  for (const pattern of SUBJECT_PATTERNS) {
    if (pattern.keywords.test(clean)) {
      return pattern.generateResponse(clean);
    }
  }

  // General dynamic analytical breakdown
  return `### Concept Breakdown: **${clean}** 📚

1. **Overview & Definition**:
   **${clean}** is an important concept in its domain. Understanding its fundamentals allows you to build intuition and connect practical applications with theoretical models.

2. **Key Mechanism & Principles**:
   - **Core Invariant**: Identify the underlying rule, law, or mechanism that remains constant.
   - **Relationships**: Observe how changing one variable influences the rest of the system.
   - **Common Misconceptions**: Avoid confusing cause and effect or skipping intermediate derivation steps.

3. **Active Revision Check**:
   • *Can you summarize the core rule in two sentences?*
   • *What is a real-world example where ${clean} is applied?*

Feel free to ask follow-up questions or request a step-by-step breakdown! 🐰`;
}

export async function generateStudyNotes(
  title: string,
  topic: string,
  customApiKey?: string,
  signal?: AbortSignal
): Promise<{ content: StudyContent }> {
  const displayTitle = title.trim() || topic.trim() || "Study Notes";
  const displayTopic = topic.trim() || title.trim() || "General Study Topic";

  const provider = getSelectedAIProvider();

  // 1. Ollama Provider
  if (provider === "ollama") {
    try {
      const ollamaConfig = getOllamaConfig();
      const result = await generateOllamaNotes(displayTitle, displayTopic, ollamaConfig, signal);
      return { content: result };
    } catch (ollamaErr) {
      if (signal?.aborted) throw new Error("Notes generation stopped");
      console.warn("Ollama notes failed, using built-in generator:", ollamaErr);
    }
  }

  // 2. Gemini Cloud Provider
  if (provider === "gemini") {
    const key =
      customApiKey ||
      localStorage.getItem(GEMINI_KEY_STORAGE) ||
      (typeof process !== "undefined" ? process.env?.VITE_GEMINI_API_KEY : undefined);

    if (key) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal,
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `Generate clear, exam-ready study notes for:\nTitle: ${displayTitle}\nTopic/Details: ${displayTopic}\n\nReturn JSON with keys: "title" (string), "keyPoints" (array of 4-6 concise bullet strings), "summary" (string of 2-4 sentences), and "fullNotes" (markdown string explaining the topic thoroughly with sections).`,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: "application/json",
              },
            }),
          }
        );
        if (response.ok) {
          const data = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            return {
              content: {
                title: parsed.title || displayTitle,
                keyPoints: Array.isArray(parsed.keyPoints)
                  ? parsed.keyPoints
                  : [
                      `Overview of ${displayTopic}`,
                      "Key mechanisms and functional properties",
                      "Primary use cases and practical applications",
                      "Active recall review questions",
                    ],
                summary: parsed.summary || `Comprehensive overview and revision notes for ${displayTitle}.`,
                fullNotes: parsed.fullNotes || "",
              },
            };
          }
        }
      } catch (e) {
        if (signal?.aborted) throw new Error("Notes generation stopped");
        console.warn("Cloud notes generation failed, using built-in generator:", e);
      }
    }
  }

  // 3. Built-in structured notes generator (Offline)
  return {
    content: {
      title: displayTitle,
      keyPoints: [
        `Core Definition: ${displayTitle} establishes foundational rules in ${displayTopic}.`,
        "Key Principles: Identify the governing equations, rules, or theorems that determine its behavior.",
        "Practical Application: How this concept appears in exam problems and real-world systems.",
        "Active Recall Prompt: Explain this concept from memory without referencing notes.",
        "Connections: Link this topic to adjacent principles to solidify neural connections.",
      ],
      summary: `${displayTitle} provides essential concepts in ${displayTopic}. Mastering these core points and practicing active recall builds strong exam confidence.`,
      fullNotes: `### 1. Fundamentals of ${displayTitle}\n\n${displayTitle} is a core component of ${displayTopic}.\n\n### 2. Methodical Steps\n- Understand foundational axioms.\n- Practice standard sample problems.\n- Test retention through self-quizzing.\n\n### 3. Review Questions\n- What is the primary function of ${displayTitle}?\n- How does changing parameters affect outcomes?`,
    },
  };
}
