import type { ChatMessage, StudyContent } from "@/types/study";
import {
  generateOllamaChat,
  generateOllamaNotes,
  getOllamaConfig,
} from "./ollamaService";
import {
  generateInBrowserChat,
  generateInBrowserStudyNotes,
  getSavedBrowserModel,
} from "./webLlmService";

export type AIProvider = "gemini" | "ollama" | "in_browser" | "builtin_offline";

const AI_PROVIDER_KEY = "study_buddy_ai_provider";

export function getSelectedAIProvider(): AIProvider {
  try {
    const raw = localStorage.getItem(AI_PROVIDER_KEY);
    if (raw === "gemini" || raw === "ollama" || raw === "in_browser" || raw === "builtin_offline") {
      return raw;
    }
  } catch (e) {
    console.warn(e);
  }
  return "gemini";
}

export function setSelectedAIProvider(provider: AIProvider): void {
  try {
    localStorage.setItem(AI_PROVIDER_KEY, provider);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Sends chat message to the server-side AI endpoint
 */
async function callServerChat(message: string, history: ChatMessage[] = [], signal?: AbortSignal): Promise<string> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
    signal,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Server responded with ${res.status}`);
  }

  const data = await res.json();
  return data.reply || "";
}

/**
 * Sends note generation request to the server-side AI endpoint
 */
async function callServerNotes(title: string, topic: string, signal?: AbortSignal): Promise<StudyContent> {
  const res = await fetch("/api/ai/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, topic }),
    signal,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Server responded with ${res.status}`);
  }

  const data = await res.json();
  return {
    title: data.title || title || "Study Notes",
    keyPoints: Array.isArray(data.keyPoints) && data.keyPoints.length > 0
      ? data.keyPoints
      : ["Core concept breakdown", "Step-by-step principles", "Practical application"],
    summary: data.summary || `${title}`,
    fullNotes: data.fullNotes || "",
  };
}

export async function generateChatResponse(
  message: string,
  history: ChatMessage[] = [],
  _customApiKey?: string,
  signal?: AbortSignal
): Promise<string> {
  const clean = message.trim();
  const lower = clean.toLowerCase();
  const provider = getSelectedAIProvider();

  // 1. If user chose Gemini Cloud AI (Primary / Deep Thinking)
  if (provider === "gemini") {
    try {
      const reply = await callServerChat(clean, history, signal);
      if (reply && reply.trim().length > 0) {
        return reply;
      }
    } catch (err: unknown) {
      if (signal?.aborted) {
        return "*(Generation was stopped)*";
      }
      console.warn("Gemini cloud brain failed, falling back:", err);
    }
  }

  // 2. If user explicitly chose Ollama local model
  if (provider === "ollama") {
    let ollamaError: string | null = null;
    const ollamaConfig = getOllamaConfig();
    try {
      const messagesForOllama = [
        ...history.slice(-6).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        { role: "user", content: clean },
      ];
      const ollamaReply = await generateOllamaChat(messagesForOllama, ollamaConfig, signal);
      if (ollamaReply && ollamaReply.trim().length > 0) {
        return ollamaReply;
      }
    } catch (err: unknown) {
      if (signal?.aborted) {
        return "*(Generation was stopped)*";
      }
      ollamaError = err instanceof Error ? err.message : "Ollama connection error";
      console.warn("Ollama call failed:", err);
    }

    // Try cloud brain to answer the user's question, and inform them of Ollama status
    try {
      const reply = await callServerChat(clean, history, signal);
      if (reply && reply.trim().length > 0) {
        if (ollamaError) {
          return `> ⚠️ **Ollama Status:** ${ollamaError}\n> *(Answered via Cloud AI Tutor while Ollama connects)*\n\n${reply}`;
        }
        return reply;
      }
    } catch (err: unknown) {
      console.warn("Server AI fallback after Ollama failed:", err);
    }

    if (ollamaError) {
      return `### ⚠️ Ollama Connection Error\n\n${ollamaError}\n\n**How to start Ollama with browser access:**\n1. In your terminal run: \`OLLAMA_ORIGINS="*" ollama serve\`\n2. Download the model: \`ollama run ${ollamaConfig.selectedModel || "qwen2.5:0.5b"}\`\n3. Refresh this page or re-test connection in Settings.`;
    }
  }

  // 3. In-browser AI Engine (WebLLM - downloaded right into browser)
  if (provider === "in_browser") {
    try {
      const modelId = getSavedBrowserModel();
      const chatMessages = [
        ...history.slice(-6).map((m) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: clean },
      ];
      const browserReply = await generateInBrowserChat(chatMessages, modelId, undefined, signal);
      if (browserReply && browserReply.trim().length > 0) {
        return browserReply;
      }
    } catch (inBrowserErr) {
      if (signal?.aborted) {
        return "*(Generation was stopped)*";
      }
      console.warn("In-browser engine fallback triggered:", inBrowserErr);
    }

    // Seamlessly answer with server AI
    try {
      const reply = await callServerChat(clean, history, signal);
      if (reply && reply.trim().length > 0) {
        return reply;
      }
    } catch (err: unknown) {
      console.warn("Server AI chat fallback triggered:", err);
    }
  }

  // 4. Default fallback: Server AI Brain
  try {
    const reply = await callServerChat(clean, history, signal);
    if (reply && reply.trim().length > 0) {
      return reply;
    }
  } catch (err: unknown) {
    if (signal?.aborted) {
      return "*(Generation was stopped)*";
    }
    console.warn("Server AI chat fallback triggered:", err);
  }

  // 5. Final Fallback: Intelligent offline generator
  return generateDynamicBuiltinResponse(clean, lower);
}

/**
 * Context-aware dynamic offline fallback with real Serbian and English answers
 */
function generateDynamicBuiltinResponse(clean: string, lower: string): string {
  // Serbian / Ex-Yu greetings
  if (/^(zdrav|pozdrav|cao|ćao|bok|hej|dobar dan|jutro|vece|veče)\b/i.test(lower)) {
    return `Pozdrav! 👋 Ja sam Study Buddy, tvoj pametni asistent za učenje.\n\nO kojoj temi želiš da razgovaramo ili učimo danas? (npr. *kako da naučim da vozim bicikl, izvodi i integrali, fotosinteza, engleska gramatika, programiranje...*)`;
  }

  // English greetings
  if (/^(hi|hello|hey|hola|bonjour|hallo|ciao|yo)\b/i.test(lower)) {
    return `Hello! 👋 I'm Study Buddy, your 24/7 AI tutor.\n\nWhat subject or concept are you studying today? Feel free to ask any question in any language!`;
  }

  // Biology & Cells (ćelija, DNK, biologija)
  if (/(celij|ćelij|cell|biolog|dnk|dna|mitoz|organel|fotosintez|ribozom|mitohondrij)/i.test(lower)) {
    return `### Kako jednostavno objasniti šta je ćelija 🧬

Najlakši način da objasniš ćeliju je **poređenje sa malom, savršeno organizovanom fabrikom ili minijaturnim gradom**:

1. **Osnovna definicija**:
   - Ćelija je **osnovna građevinska i funkcionalna jedinica svih živih bića**.
   - Sve što je živo (od jedne bakterije do tebe i slona) sastavljeno je od ćelija. Kao što je kuća sagrađena od cigala, tako je tvoje telo sagrađeno od oko 37 biliona ćelija!

2. **Glavni delovi ćelije (Poređenje sa fabrikom)**:
   - **Ćelijska membrana (Zid i kapija fabrike)**: Spoljašnji omotač koji štiti ćeliju i kontroliše šta ulazi (hrana, kiseonik), a šta izlazi (otpad).
   - **Jedro / Nukleus (Direktorska kancelarija)**: Centar upravljanja koji čuva **DNK** – recept i uputstvo za sve što ćelija radi.
   - **Citoplazma (Prostor fabrike)**: Želatinasta tečnost u kojoj plivaju sve radionice.
   - **Mitohondrije (Elektrana fabrike)**: Pretvaraju hranu u energiju (ATP) koja pokreće ceo organizam.
   - **Ribozomi (Radnici za mašinama)**: Prave proteine neophodne za rast i popravku tkiva.

3. **Dve glavne vrste ćelija**:
   - **Prokariotske** (prostije, npr. bakterije – nemaju izdvojeno jedro).
   - **Eukariotske** (složenije, kod biljaka, životinja i ljudi – imaju pravo jedro).

💡 **Pitanje za proveru**: *Ako je mitohondrija "elektrana", koji deo ćelije bi bio "direktor" i zašto?* 🐰`;
  }
  if (/(voz.*bicikl|voznj.*bicikl|bicikl)/i.test(lower)) {
    return `### Kako naučiti da voziš bicikl (Korak po korak) 🚲

Učenje vožnje bicikla je pre svega stvar **ravnoteže i koordinacije**, a ne snage! Evo dokazano najbrže metode:

1. **Priprema bicikla (Metoda bez pedala / Balans)**:
   - Spusti sedište toliko da sa oba stopala možeš potpuno ravno da dodirneš zemlju.
   - Ako je moguće, privremeno skini pedale (ili ih jednostavno nemoj koristiti u prvim minutima).

2. **Korak 1: Odgurivanje i održavanje ravnoteže**:
   - Pronađi ravan asfalt ili blagi nagib sa čistim prostorom.
   - Sedni na bicikl, odgurni se nogama o tlo i pusti bicikl da klizi dok držiš noge podignute 5–10 centimetara iznad zemlje.
   - Cilj: Kliziti 5 do 10 sekundi u ravnoteži bez spuštanja nogu.

3. **Korak 2: Gledaj napred, a ne u točak**:
   - Najčešća greška početnika je gledanje u prednji točak ili pedale. Uvek gledaj **5–10 metara ispred sebe**. Bicikl ide tamo gde gledaš!

4. **Korak 3: Korišćenje kočnica**:
   - Pre nego što počneš brzo da voziš, nauči lagano stiskanje kočnica (uvek obe kočnice ravnomerno, ne samo prednju naglo).

5. **Korak 4: Stavljanje nogu na pedale**:
   - Namesti jednu pedalu u položaj "2 sata" (malo podignutu).
   - Nagazi je jače da dobiješ početnu brzinu (brzina zapravo daje stabilnost kroz žiroskopski efekat točkova!).
   - Odmah stavi drugu nogu na drugu pedalu i počni ujednačeno da okrećeš.

💡 **Zlatno pravilo**: Kada osetiš da gubiš ravnotežu, nemoj paničiti – samo blago usmeri volan na tu stranu na koju padaš i spusti noge na tlo. Većina ljudi savlada balans za manje od sat vremena!`;
  }

  // General learning / study technique
  if (/(study tip|how to study|pomodoro|active recall|spaced repetition|feynman|kako uciti|saveti za ucenje)/i.test(lower)) {
    return `### Dokazane strategije efikasnog učenja 🎯

1. **Feynmanova tehnika**: Objasni koncept jednostavnim rečima kao da predaješ nekome ko se prvi put susreće sa tom temom.
2. **Aktivno prisećanje (Active Recall)**: Testiraj se bez gledanja u beleške umesto pasivnog podvlačenja teksta.
3. **Pauzirani razmaci (Spaced Repetition)**: Ponavljaj gradivo u razmacima (nakon 1 dana, 3 dana, 7 dana).
4. **Pomodoro metoda**: 25 minuta maksimalnog fokusa, zatim 5 minuta pauze.`;
  }

  // Physics & Mechanics (fizika, gravitacija, kretanje, struja)
  if (/(fizik|gravitacij|njutn|sila|energij|struj|magnet|optik|physics|newton)/i.test(lower)) {
    return `### Pregled i objašnjenje: Fizika ⚡
Tema: **${clean}**

1. **Osnovni fizički zakon**:
   Svaki fizički proces opisan je zakonima održanja (održanje energije, mase ili količine kretanja). Za **${clean}**, ključno je uočiti sile koje deluju i njihov smer.

2. **Glavne veličine i formule**:
   - **II Njutnov zakon**: $F = m \\cdot a$ (Sila jednaka masi puta ubrzanju).
   - **Rad i energija**: $E_k = \\frac{1}{2}m v^2$, $E_p = m g h$.
   - **Razlaganje vektora**: Uvek razloži silu na horizontalnu ($F_x$) i vertikalnu ($F_y$) komponentu.

3. **Savet za zadatke**:
   Uvek prvo nacrtaj dijagram sila sa koordinatnim osama pre nego što uvrstiš brojeve u formule! 🐰`;
  }

  // Chemistry (hemija, reakcije, atomi, kiseline)
  if (/(hemij|reakcij|periodn|atom|molekul|vez|kisel|baz|ph|chemistry|acid)/i.test(lower)) {
    return `### Pregled i objašnjenje: Hemija 🧪
Tema: **${clean}**

1. **Suština hemijskog procesa**:
   Hemijske promene nastaju preuređivanjem hemijskih veza i razmenom elektrona između atoma kako bi se postigao stabilan oktet.

2. **Ključni koraci**:
   - **Izjednačavanje reakcije**: Broj atoma svakog elementa na levoj strani (reaktanti) mora biti jednak broju na desnoj (proizvodi).
   - **Molovi i masa**: $n = \\frac{m}{M}$ (količina supstance jednaka je masi podeljenoj sa molarnom masom).
   - **Oksidacija i redukcija**: Oksidacija je otpuštanje elektrona, redukcija je primanje elektrona.

3. **Pitanje za proveru**:
   *Koji su reaktanti a koji proizvodi u ovom procesu?* 🐰`;
  }

  // Programming & Computer Science
  if (/(programir|kod|python|javascript|typescript|algoritm|funkcij|petlj|rekurzij|code|programming)/i.test(lower)) {
    return `### Programiranje & Algoritmi 💻
Tema: **${clean}**

1. **Osnovna logika**:
   Svaki program se sastoji od tri osnovne strukture: sekvence (korak po korak), grananja (\`if/else\`) i ponavljanja (\`for/while\` petlje).

2. **Dobre prakse pisanja koda**:
   - **Čitljivost**: Imenuj promenljive i funkcije opisno.
   - **Rubni slučajevi (Edge Cases)**: Uvek proveri šta se dešava ako je niz prazan, vrednost \`null\`, ili ako je broj negativan.
   - **Vremenska složenost**: Teži optimalnom algoritmu (npr. $O(n)$ ili $O(\\log n)$ umesto $O(n^2)$).

3. **Primer**:
   Koji problem tačno rešavaš? Pošalji isečak koda ili zadatak i rešićemo ga korak po korak! 🐰`;
  }

  // History & Social Studies
  if (/(istorij|revolucij|rat|carstv|vek|veku|rim|grck|srbij|history|war)/i.test(lower)) {
    return `### Istorijska analiza 🏛️
Tema: **${clean}**

1. **Istorijski kontekst i uzroci**:
   Nijedan događaj se ne dešava izolovano. Razlikujemo **duboke uzroke** (socijalne, ekonomske, političke tenzije) i **neposredan povod** (okidač događaja).

2. **Hronologija i ključni akteri**:
   - Koje su bile suprotstavljene strane i njihovi ciljevi?
   - Koji su bili ključni prelomni momenti i bitke/odluke?
   - Kako su mirovni ugovori i zakoni promenili društvo?

3. **Posledice**:
   *Koji su dugoročni uticaji ovog događaja na savremeni svet?* 🐰`;
  }
  if (/(calculus|derivative|integral|limit|izvod|granicna vrednost|matematika|funkcija)/i.test(lower)) {
    return `### Pregled matematičkog koncepta: **${clean}** 🧮

1. **Osnovna definicija i intuicija**:
   Razumevanje promena i akumulacije u matematici. Za **${clean}**, ključno je uočiti odnos između ulaznih promenljivih i stope promene.

2. **Koraci rešavanja zadataka**:
   - Identifikuj domen i definisanost funkcije.
   - Primeni odgovarajuća pravila (izvod zbira, proizvoda, količnika ili složene funkcije).
   - Proveri granične vrednosti i prevojne tačke.

3. **Pitanje za proveru**:
   *Možeš li napisati osnovnu formulu bez gledanja u udžbenik i objasniti šta ona geometrijski predstavlja?*`;
  }

  // General fallback structured explanation
  return `### Vodič i objašnjenje: **${clean}** 💡

Evo ključnih informacija i smernica za **${clean}**:

1. **Osnovni koncept**:
   **${clean}** je važna tema. Razumevanje osnovnih principa ti pomaže da povežeš teoriju sa praktičnim primerima.

2. **Glavni koraci i principi**:
   - **Razumevanje osnova**: Počni od fundamentalnih pravila pre prelaska na složene detalje.
   - **Praksa**: Primeni koncept kroz konkretne primere i vežbu.
   - **Uobičajene greške**: Obrati pažnju na najčešće zamke i preskakanje međukoraka.

Slobodno postavi dodatno pitanje ili zatraži detaljniji primer! 🐰`;
}

export async function generateStudyNotes(
  title: string,
  topic: string,
  _customApiKey?: string,
  signal?: AbortSignal
): Promise<{ content: StudyContent }> {
  const displayTitle = title.trim() || topic.trim() || "Study Notes";
  const displayTopic = topic.trim() || title.trim() || "General Study Topic";

  const provider = getSelectedAIProvider();

  // 1. Gemini Cloud AI Brain
  if (provider === "gemini") {
    try {
      const serverNotes = await callServerNotes(displayTitle, displayTopic, signal);
      return { content: serverNotes };
    } catch (err: unknown) {
      if (signal?.aborted) throw new Error("Notes generation stopped");
      console.warn("Gemini cloud notes failed, falling back:", err);
    }
  }

  // 2. Ollama Provider if selected
  if (provider === "ollama") {
    try {
      const ollamaConfig = getOllamaConfig();
      const result = await generateOllamaNotes(displayTitle, displayTopic, ollamaConfig, signal);
      return { content: result };
    } catch (ollamaErr) {
      if (signal?.aborted) throw new Error("Notes generation stopped");
      console.warn("Ollama notes failed, trying cloud fallback:", ollamaErr);
      try {
        const serverNotes = await callServerNotes(displayTitle, displayTopic, signal);
        return { content: serverNotes };
      } catch {
        // Fallback to offline notes
      }
    }
  }

  // 3. In-browser AI Engine (WebLLM)
  if (provider === "in_browser") {
    try {
      const modelId = getSavedBrowserModel();
      const result = await generateInBrowserStudyNotes(displayTitle, displayTopic, modelId, undefined, signal);
      return { content: result };
    } catch (inBrowserErr) {
      if (signal?.aborted) throw new Error("Notes generation stopped");
      console.warn("In-browser notes generation fallback:", inBrowserErr);
      try {
        const serverNotes = await callServerNotes(displayTitle, displayTopic, signal);
        return { content: serverNotes };
      } catch {
        // Fallback to offline notes
      }
    }
  }

  // 4. Server-side Gemini AI Notes endpoint (General fallback)
  try {
    const serverNotes = await callServerNotes(displayTitle, displayTopic, signal);
    return { content: serverNotes };
  } catch (err: unknown) {
    if (signal?.aborted) throw new Error("Notes generation stopped");
    console.warn("Server AI notes fallback triggered:", err);
  }

  // 4. Built-in dynamic notes generator (Offline)
  return {
    content: {
      title: displayTitle,
      keyPoints: [
        `Osnovni principi: Ključne definicije i pravila za ${displayTitle}.`,
        `Mehanizam: Korak po korak analiza za ${displayTopic}.`,
        "Praktična primena: Kako se ovo primenjuje u praksi i zadacima.",
        "Aktivno prisećanje: Objasni suštinu svojim rečima bez gledanja u beleške.",
      ],
      summary: `${displayTitle}: Sažet pregled i vodič za učenje teme ${displayTopic}.`,
      fullNotes: `### ${displayTitle}\n\n**Pregled teme:**\n${displayTopic}\n\n### Ključne celine\n1. Osnovni principi i definicije.\n2. Analiza korak po korak i praktični saveti.\n3. Najčešće greške i pitanja za samoproveru.\n\n### Pitanja za vežbu\n- Koje je osnovno pravilo iza teme ${displayTitle}?\n- Kako se ovo primenjuje u svakodnevnim ili ispitnim situacijama?`,
    },
  };
}

