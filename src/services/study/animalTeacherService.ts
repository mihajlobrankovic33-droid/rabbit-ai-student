import type {
  AnimalTeacher,
  AnimalTeacherId,
  ClassroomSession,
  ClassroomTurn,
} from "@/types/study";
import {
  speakText,
  stopSpeaking as stopVoiceSpeaking,
  LANGUAGE_LOCALE_MAP,
} from "./voiceService";

export const ANIMAL_TEACHERS: AnimalTeacher[] = [
  {
    id: "fox",
    name: "Feliks",
    title: "Profesor Feliks",
    species: "Pametni Lisac (Clever Fox)",
    emoji: "🦊",
    badge: "Oštrouman & Logičar",
    personality:
      "Lukav, radoznao, bistar i pun logičkih trikova. Voli da testira tvoju intuiciju i postavlja zanimljiva pitanja.",
    teachingStyle:
      "Izaziva te da misliš svojom glavom! Daje pametne zagonetke i ceni originalna objašnjenja.",
    greetingSr:
      "Zdravo! Ja sam profesor Feliks 🦊. Danas te ja ispitujem u učionici! Spremi se, proverićeš svoje znanje kao nikad pre!",
    greetingEn:
      "Hello there! I'm Professor Felix 🦊. Today I'm your classroom examiner! Get ready to test your wit and mastery!",
    catchphraseSr: "Lukavo razmišljaj i gledaj širu sliku! Šuma znanja je puna tajni!",
    catchphraseEn: "Think sharp and observe the details! The forest of knowledge is full of wonders!",
    rewardItem: "Pametna Šumska Bobica",
    rewardIcon: "🍓",
    avatarBg: "from-amber-500/20 via-orange-500/15 to-amber-600/10 border-amber-500/30",
    accentColor: "amber",
    voicePitch: 1.15,
    voiceRate: 1.05,
  },
  {
    id: "rabbit",
    name: "Barnabi",
    title: "Učitelj Barnabi",
    species: "Hitri Zec (Energetic Rabbit)",
    emoji: "🐰",
    badge: "Energija & Motivacija",
    personality:
      "Super veseo, optimističan i pun energije. Poskakuje od sreće kada odgovoriš tačno i uvek te hrabri!",
    teachingStyle:
      "Brza, dinamična pitanja pun entuzijazma. Kod njega nema straha od greške, svaka greška je korak ka uspehu!",
    greetingSr:
      "Hooop! Zdravo drugar! Ja sam učitelj Barnabi 🐰. Čas počinje! Znam da možeš do petice, idemo zajedno!",
    greetingEn:
      "Hop hop! Hello student! I'm Master Barnaby 🐰. Class is in session! I know you can ace this, let's go!",
    catchphraseSr: "Skačemo pravo u znanje! Svaki trud se isplati!",
    catchphraseEn: "Hopping straight into knowledge! Every single effort counts!",
    rewardItem: "Zlatna Šargarepica",
    rewardIcon: "🥕",
    avatarBg: "from-pink-500/20 via-rose-500/15 to-purple-500/10 border-pink-500/30",
    accentColor: "rose",
    voicePitch: 1.25,
    voiceRate: 1.1,
  },
  {
    id: "panda",
    name: "Bao",
    title: "Sensei Bao",
    species: "Mudra Panda (Zen Panda)",
    emoji: "🐼",
    badge: "Zen Mir & Strpljenje",
    personality:
      "Staložen, beskrajno strpljiv i blag. Nikada ne stvara pritisak, već ti pomaže da duboko razumeš gradivo.",
    teachingStyle:
      "Temeljna, filozofska i mirna pitanja. Vodi te korak po korak do suštine bez ikakve žurbe.",
    greetingSr:
      "Mir s tobom. Ja sam Sensei Bao 🐼. U mojoj učionici nema stresa. Duboko udahni i pokaži mi šta si naučio.",
    greetingEn:
      "Peace be with you. I am Sensei Bao 🐼. In my classroom there is no rush or panic. Breathe deeply and let's explore.",
    catchphraseSr: "Znanje je poput mirne reke koja polako oblikuje stenu. Polako i sigurno.",
    catchphraseEn: "Knowledge is like a calm river shaping the mountain. Slow, steady, and profound.",
    rewardItem: "Svež Bambusov Izdanak",
    rewardIcon: "🎋",
    avatarBg: "from-emerald-500/20 via-teal-500/15 to-green-600/10 border-emerald-500/30",
    accentColor: "emerald",
    voicePitch: 0.85,
    voiceRate: 0.95,
  },
  {
    id: "cat",
    name: "Mici",
    title: "Profesorka Mici",
    species: "Prefinjena Mačka (Refined Cat)",
    emoji: "🐱",
    badge: "Precizna & Prefinjena",
    personality:
      "Malo aristokratska, stroga ali neodoljivo simpatična. Prede od zadovoljstva kad je odgovor tačan i uredan!",
    teachingStyle:
      "Voli urednost, tačne termine i preciznost. Obrati pažnju na detalje i profesorka Mici će te nagraditi!",
    greetingSr:
      "Mjao! Dobrodošao na moj čas. Ja sam profesorka Mici 🐱. Očekujem pažnju, lepo izražavanje i tačne odgovore!",
    greetingEn:
      "Purr! Welcome to my class. I am Professor Whiskers 🐱. I expect focus, elegance, and precise answers!",
    catchphraseSr: "Mjao! Urednost i tačnost su odlika pravih učenika!",
    catchphraseEn: "Purr! Precision and elegance are the true marks of mastery!",
    rewardItem: "Zlatna Ribica Znanja",
    rewardIcon: "🐟",
    avatarBg: "from-violet-500/20 via-purple-500/15 to-indigo-600/10 border-violet-500/30",
    accentColor: "violet",
    voicePitch: 1.18,
    voiceRate: 1.0,
  },
  {
    id: "owl",
    name: "Arhimed",
    title: "Doktor Arhimed",
    species: "Akademski Ćuk (Wise Owl)",
    emoji: "🦉",
    badge: "Akademik & Enciklopedija",
    personality:
      "Nosi male zamišljene naočare, zna istorijske činjenice, citate i složene formule. Pravi profesor starog kova!",
    teachingStyle:
      "Sistemska akademska provera sa fokusom na uzročno-posledične veze i ključne definicije.",
    greetingSr:
      "Hu-hu! Pozdrav mladom naučniku. Ja sam dr Arhimed 🦉. Otvori svesku i izađi pred tablu, vreme je za ispit!",
    greetingEn:
      "Hoo-hoo! Greetings, scholar. I am Dr. Archimedes 🦉. Step up to the blackboard, exam time has arrived!",
    catchphraseSr: "Samo činjenice, argumenti i logika vode do akademskog vrha!",
    catchphraseEn: "Only facts, arguments, and logic carry one to the peak of science!",
    rewardItem: "Zlatno Pero Mudrosti",
    rewardIcon: "📜",
    avatarBg: "from-blue-500/20 via-cyan-500/15 to-sky-600/10 border-blue-500/30",
    accentColor: "blue",
    voicePitch: 0.9,
    voiceRate: 0.98,
  },
  {
    id: "dog",
    name: "Milo",
    title: "Trener Milo",
    species: "Zlatni Retriver (Friendly Pup)",
    emoji: "🐶",
    badge: "Drugar & Verni Trener",
    personality:
      "Tvoj najbolji drug iz prve klupe! Maše repom, slavi svaki tvoj korak i nikada ne da da se obeshrabriš.",
    teachingStyle:
      "Podsticajan, praktičan i drugarski. Daje petaka za trud i pomaže ti da razbiješ tremu pred odgovaranje!",
    greetingSr:
      "Vau-vau! Hej druže! Ja sam trener Milo 🐶. Zaboravi na tremu, ja sam ovde sa tobom. Hajde da pokidamo ovaj čas!",
    greetingEn:
      "Woof! Hey buddy! I'm Coach Milo 🐶. Forget stage fright, we're in this together. Let's crush this exam!",
    catchphraseSr: "Daj šapu! Ti si šampion znanja, samo hrabro napred!",
    catchphraseEn: "High paw! You are a champion of learning, keep pushing!",
    rewardItem: "Zlatna Kost Znanja",
    rewardIcon: "🦴",
    avatarBg: "from-yellow-500/20 via-amber-500/15 to-orange-500/10 border-yellow-500/30",
    accentColor: "amber",
    voicePitch: 1.05,
    voiceRate: 1.05,
  },
];

export const CLASSROOM_SUBJECT_PRESETS = [
  {
    id: "biology",
    name: "Biologija & Medicina",
    icon: "🧬",
    topics: [
      "Ćelija i organele (mitohondrija, jedro, DNK)",
      "Fotosinteza i ćelijsko disanje",
      "Genetika i Mendelovi zakoni",
      "Ljudsko telo: Krvotok i srce",
      "Evolucija i prirodna selekcija",
    ],
  },
  {
    id: "math",
    name: "Matematika",
    icon: "📐",
    topics: [
      "Kvadratne jednačine i Vietove formule",
      "Izvodi funkcija i njihova primena",
      "Trigonometrija i jedinični krug",
      "Verovatnoća i statistika",
      "Geometrija: Pitagorina teorema i trouglovi",
    ],
  },
  {
    id: "history",
    name: "Istorija",
    icon: "📜",
    topics: [
      "Prvi svetski rat: Uzroci, Solunski front i ishod",
      "Drugi svetski rat i prekretnice (1939-1945)",
      "Antička Grčka i Rimsko carstvo",
      "Francuska revolucija 1789. godine",
      "Srednjovekovna Srbija i dinastija Nemanjića",
    ],
  },
  {
    id: "physics",
    name: "Fizika & Hemija",
    icon: "⚛️",
    topics: [
      "Njutnovi zakoni mehanike",
      "Termodinamika i zakoni održanja energije",
      "Periodni sistem elemenata i hemijske veze",
      "Elektricitet: Omov zakon i električna kola",
      "Kiseline, baze i pH vrednost",
    ],
  },
  {
    id: "cs",
    name: "Informatika & Programiranje",
    icon: "💻",
    topics: [
      "Objektno-orijentisano programiranje (OOP)",
      "Strukture podataka: Nizovi, stabla i heš mape",
      "Algoritmi za sortiranje i pretragu",
      "Kako radi internet: TCP/IP, DNS i HTTP",
      "Baze podataka i SQL upiti",
    ],
  },
  {
    id: "languages",
    name: "Jezik & Gramatika",
    icon: "📚",
    topics: [
      "Glasovne promene u srpskom jeziku",
      "Padeži i njihova značenja",
      "Engleska gramatika: Present Perfect vs Past Simple",
      "Analiza književnog dela i stilskih figura",
      "Pravopis: Pisanje velikog slova i rečce 'ne'",
    ],
  },
  {
    id: "geography",
    name: "Geografija",
    icon: "🌍",
    topics: [
      "Reljef i tektonika ploča",
      "Klimatski pojasevi i biosfera",
      "Reke i slivovi Evrope",
      "Svetsko stanovništvo i megagradovi",
      "Prirodni resursi i ekologija",
    ],
  },
];

export const CLASSROOM_MODES = [
  {
    id: "oral_exam" as const,
    title: "Usmeno ispitivanje pred tablom",
    subtitle: "5 Pitanja sa ocenjivanjem (1-5), podpitanjima i đačkom knjižicom",
    badge: "Klasik",
    questionCount: 5,
    icon: "🎓",
  },
  {
    id: "pop_quiz" as const,
    title: "Blic provera (Brza pitanja)",
    subtitle: "3 Brza pitanja za brzu proveru znanja pred kontrolni",
    badge: "Brzo",
    questionCount: 3,
    icon: "⚡",
  },
  {
    id: "interactive_lesson" as const,
    title: "Interaktivni čas sa nastavnikom",
    subtitle: "Nastavnik objašnjava pojam, a zatim proverava da li pratiš",
    badge: "Učenje",
    questionCount: 4,
    icon: "📖",
  },
  {
    id: "deep_drill" as const,
    title: "Strogi ispit za desetku / peticu",
    subtitle: "Dubinska pitanja visokog nivoa sa detaljnim ocenjivanjem",
    badge: "Napredno",
    questionCount: 6,
    icon: "🏆",
  },
];

const SESSIONS_STORAGE_KEY = "study_buddy_classroom_sessions";
const ACTIVE_TEACHER_KEY = "study_buddy_active_animal_teacher";

export function getActiveAnimalTeacher(): AnimalTeacher {
  try {
    const saved = localStorage.getItem(ACTIVE_TEACHER_KEY);
    if (saved) {
      const match = ANIMAL_TEACHERS.find((t) => t.id === saved);
      if (match) return match;
    }
  } catch {
    // ignore
  }
  return ANIMAL_TEACHERS[0]; // Default: Fox
}

export function setActiveAnimalTeacher(teacherId: AnimalTeacherId): void {
  try {
    localStorage.setItem(ACTIVE_TEACHER_KEY, teacherId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("study_buddy_animal_teacher_changed", { detail: teacherId })
      );
    }
  } catch {
    // ignore
  }
}

export function getClassroomSessions(userId: string): ClassroomSession[] {
  try {
    const raw = localStorage.getItem(`${SESSIONS_STORAGE_KEY}_${userId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveClassroomSession(userId: string, session: ClassroomSession): void {
  try {
    const existing = getClassroomSessions(userId);
    const idx = existing.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      existing[idx] = session;
    } else {
      existing.unshift(session);
    }
    localStorage.setItem(`${SESSIONS_STORAGE_KEY}_${userId}`, JSON.stringify(existing.slice(0, 30)));
  } catch (e) {
    console.warn("Could not save classroom session:", e);
  }
}

export function deleteClassroomSession(userId: string, sessionId: string): void {
  try {
    const existing = getClassroomSessions(userId).filter((s) => s.id !== sessionId);
    localStorage.setItem(`${SESSIONS_STORAGE_KEY}_${userId}`, JSON.stringify(existing));
  } catch (e) {
    console.warn("Could not delete classroom session:", e);
  }
}

const TEACHER_ELEVEN_VOICE_MAP: Record<string, string> = {
  fox: "ErXwobaYiN019PkySvjV", // Antoni (bistar, pametan lisac)
  rabbit: "EXAVITQu4vr4xnSDxMaL", // Bella (energičan, veseo zec)
  panda: "pNInz6obpgDQGcFmaJgB", // Adam (dubok, smiren mudar panda)
  cat: "21m00Tcm4TlvDq8ikWAM", // Rachel (topla, pažljiva mačka)
};

// Web Speech & ElevenLabs Voice synthesis helper
export function speakTeacherText(
  text: string,
  teacher: AnimalTeacher,
  lang: string = "sr",
  onEnd?: () => void
): () => void {
  const elevenVoiceId = TEACHER_ELEVEN_VOICE_MAP[teacher.id] || "21m00Tcm4TlvDq8ikWAM";

  return speakText(text, {
    lang,
    pitch: teacher.voicePitch,
    rate: teacher.voiceRate,
    elevenVoiceId,
    onEnd,
    onError: () => {
      onEnd?.();
    },
  });
}

export function stopSpeaking(): void {
  stopVoiceSpeaking();
}

// Classroom API Calls
export async function startClassroomSessionApi(params: {
  animalTeacher: AnimalTeacher;
  subject: string;
  topic: string;
  classMode: string;
  totalQuestions: number;
  language?: string;
  signal?: AbortSignal;
}): Promise<{
  welcomeMessage: string;
  question: string;
  hint: string;
  animalReaction: string;
}> {
  try {
    const res = await fetch("/api/ai/classroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        animalTeacher: params.animalTeacher,
        subject: params.subject,
        topic: params.topic,
        classMode: params.classMode,
        totalQuestions: params.totalQuestions,
        currentQuestionNumber: 1,
        language: params.language || "sr",
      }),
      signal: params.signal,
    });

    if (!res.ok) {
      throw new Error(`Classroom start error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn("Classroom start fallback:", err);
    return {
      welcomeMessage: `${params.animalTeacher.greetingSr} Danas te ispitujem temu "${params.topic}".`,
      question: `Za početak ispitivanja: Objasni svojim rečima suštinu teme "${params.topic}" i navedi jedan ključni primer.`,
      hint: `Razmisli o osnovnoj definiciji i kako to izgleda u praksi.`,
      animalReaction: `${params.animalTeacher.title} se osmehuje i čeka tvoj odgovor.`,
    };
  }
}

export async function evaluateAnswerApi(params: {
  animalTeacher: AnimalTeacher;
  subject: string;
  topic: string;
  previousQuestion: string;
  studentAnswer: string;
  currentQuestionNumber: number;
  totalQuestions: number;
  language?: string;
  signal?: AbortSignal;
}): Promise<{
  score: number;
  grade: string;
  isCorrect: boolean;
  feedback: string;
  animalReaction: string;
  rewardEarned: boolean;
  rewardItem: string;
  nextQuestion: string;
  nextQuestionHint?: string;
  isFinalQuestion: boolean;
}> {
  try {
    const res = await fetch("/api/ai/classroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "evaluate",
        animalTeacher: params.animalTeacher,
        subject: params.subject,
        topic: params.topic,
        previousQuestion: params.previousQuestion,
        studentAnswer: params.studentAnswer,
        currentQuestionNumber: params.currentQuestionNumber,
        totalQuestions: params.totalQuestions,
        language: params.language || "sr",
      }),
      signal: params.signal,
    });

    if (!res.ok) {
      throw new Error(`Classroom eval error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn("Classroom eval fallback:", err);
    const isFinal = params.currentQuestionNumber >= params.totalQuestions;
    const isGood = params.studentAnswer.trim().length > 15;
    return {
      score: isGood ? 85 : 65,
      grade: isGood ? "5 (Odličan)" : "3 (Dobar)",
      isCorrect: isGood,
      feedback: isGood
        ? `Odličan odgovor! Lepo si objasnio/la gradivo i povezao/la ključne termine.`
        : `Dobar trud! Za još bolju ocenu, razjasni uzroke i posledice ove pojave.`,
      animalReaction: `${params.animalTeacher.title} ti pruža ${params.animalTeacher.rewardIcon} ${params.animalTeacher.rewardItem}!`,
      rewardEarned: true,
      rewardItem: `${params.animalTeacher.rewardIcon} ${params.animalTeacher.rewardItem}`,
      nextQuestion: isFinal
        ? ""
        : `Pitanje #${params.currentQuestionNumber + 1}: Koji je sledeći najvažniji zakon ili pravilo u okviru teme "${params.topic}"?`,
      nextQuestionHint: "Seti se praktične primene.",
      isFinalQuestion: isFinal,
    };
  }
}

export async function finishClassroomSessionApi(params: {
  animalTeacher: AnimalTeacher;
  subject: string;
  topic: string;
  turns: ClassroomTurn[];
  language?: string;
  signal?: AbortSignal;
}): Promise<{
  finalGrade: string;
  averageScore: number;
  finalVerdict: string;
  keyStrengths: string[];
  topicsToReview: string[];
  diplomaPraise: string;
}> {
  try {
    const res = await fetch("/api/ai/classroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "finish",
        animalTeacher: params.animalTeacher,
        subject: params.subject,
        topic: params.topic,
        turns: params.turns,
        language: params.language || "sr",
      }),
      signal: params.signal,
    });

    if (!res.ok) {
      throw new Error(`Classroom finish error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn("Classroom finish fallback:", err);
    const validScores = params.turns.map((t) => t.score || 80);
    const avg = validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : 88;
    return {
      finalGrade: avg >= 85 ? "5 (Odličan)" : avg >= 70 ? "4 (Vrlo dobar)" : "3 (Dobar)",
      averageScore: avg,
      finalVerdict: `Čestitam na položenom ispitivanju pred tablom! Pokazao/la si stabilno znanje i zrelost u odgovorima na temu "${params.topic}".`,
      keyStrengths: ["Poznavanje osnovnih principa", "Samostalno formulisanje odgovora", "Strpljenje i fokus"],
      topicsToReview: ["Uvežbati dodatne primere za stoprocentnu sigurnost na kontrolnom"],
      diplomaPraise: `${params.animalTeacher.title}: "Ponos celog odeljenja! Zaslužena petica!" 🎓`,
    };
  }
}

// Browser Speech Recognition Support (Student voice answering)
export interface SpeechRecognitionResultState {
  transcript: string;
  isListening: boolean;
  isSupported: boolean;
  error?: string;
}

export function createSpeechRecognizer(
  lang: string = "sr-RS",
  onResult: (text: string) => void,
  onError?: (err: string) => void,
  onEnd?: () => void
): { start: () => void; stop: () => void; isSupported: boolean } {
  if (typeof window === "undefined") {
    return { start: () => {}, stop: () => {}, isSupported: false };
  }

  const SpeechRecognitionClass =
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    return { start: () => {}, stop: () => {}, isSupported: false };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognition = new (SpeechRecognitionClass as any)();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = LANGUAGE_LOCALE_MAP[lang] || lang;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recognition.onresult = (event: any) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    if (transcript) {
      onResult(transcript);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recognition.onerror = (event: any) => {
    onError?.(event.error || "Speech recognition error");
  };

  recognition.onend = () => {
    onEnd?.();
  };

  return {
    start: () => {
      try {
        recognition.start();
      } catch (e) {
        console.warn("Speech recognition already running or error:", e);
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    },
    isSupported: true,
  };
}

