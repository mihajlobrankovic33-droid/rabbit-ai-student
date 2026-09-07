import React, { useState, useEffect, useRef } from "react";
import {
  ANIMAL_TEACHERS,
  CLASSROOM_SUBJECT_PRESETS,
  CLASSROOM_MODES,
  getActiveAnimalTeacher,
  setActiveAnimalTeacher,
  getClassroomSessions,
  saveClassroomSession,
  deleteClassroomSession,
  speakTeacherText,
  stopSpeaking,
  startClassroomSessionApi,
  evaluateAnswerApi,
  finishClassroomSessionApi,
  createSpeechRecognizer,
} from "@/services/study/animalTeacherService";
import type {
  AnimalTeacher,
  ClassroomSession,
  ClassroomTurn,
} from "@/types/study";
import { saveNote } from "@/services/study/notesService";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/services/study/i18n";
import { Button } from "@/components/ui/button";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";

interface ClassroomViewProps {
  onOpenNotes?: () => void;
  onOpenChat?: (teacherPrompt?: string) => void;
}

export function ClassroomView({ onOpenNotes, onOpenChat }: ClassroomViewProps) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const currentUserId = user?.id || "default_student";

  // Teacher state
  const [activeTeacher, setActiveTeacherState] = useState<AnimalTeacher>(getActiveAnimalTeacher());

  // Past sessions
  const [pastSessions, setPastSessions] = useState<ClassroomSession[]>([]);

  // Setup form state
  const [selectedSubject, setSelectedSubject] = useState(CLASSROOM_SUBJECT_PRESETS[0]);
  const [customSubject, setCustomSubject] = useState("");
  const [topic, setTopic] = useState(CLASSROOM_SUBJECT_PRESETS[0].topics[0]);
  const [customTopic, setCustomTopic] = useState("");
  const [selectedMode, setSelectedMode] = useState(CLASSROOM_MODES[0]);

  // Active exam session state
  const [activeSession, setActiveSession] = useState<ClassroomSession | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Student answer state
  const [studentAnswer, setStudentAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [currentHint, setCurrentHint] = useState("");

  // Turn evaluation state
  const [currentEvaluation, setCurrentEvaluation] = useState<{
    score: number;
    grade: string;
    isCorrect: boolean;
    feedback: string;
    animalReaction: string;
    rewardEarned: boolean;
    rewardItem: string;
  } | null>(null);

  // Audio / Speech state
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const speechRecognizerRef = useRef<{ start: () => void; stop: () => void; isSupported: boolean } | null>(null);

  // Load history on mount
  useEffect(() => {
    setPastSessions(getClassroomSessions(currentUserId));
  }, [currentUserId]);

  // Change active teacher
  const handleSelectTeacher = (teacher: AnimalTeacher) => {
    stopSpeaking();
    setActiveTeacherState(teacher);
    setActiveAnimalTeacher(teacher.id);
    toast.success(`${teacher.title} je sada tvoj nastavnik! ${teacher.emoji}`);
  };

  // Setup speech recognizer for active language
  useEffect(() => {
    speechRecognizerRef.current = createSpeechRecognizer(
      lang,
      (transcript) => {
        setStudentAnswer((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
        toast.info("Odgovor snimljen glasom! 🎙️");
      },
      (err) => {
        setIsListening(false);
        console.warn("Speech error:", err);
      },
      () => {
        setIsListening(false);
      }
    );

    return () => {
      stopSpeaking();
    };
  }, [lang]);

  const toggleSpeechRecognition = () => {
    if (!speechRecognizerRef.current?.isSupported) {
      toast.error("Tvoj pregledač ne podržava direktno prepoznavanje glasa. Možeš normalno kucati odgovor!");
      return;
    }

    if (isListening) {
      speechRecognizerRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      speechRecognizerRef.current.start();
      toast.info("Govori sada, nastavnik te pažljivo sluša... 🎙️");
    }
  };

  const playVoice = (text: string) => {
    if (!voiceEnabled) return;
    setIsSpeaking(true);
    speakTeacherText(text, activeTeacher, lang, () => {
      setIsSpeaking(false);
    });
  };

  // Start exam
  const handleStartExam = async () => {
    const finalSubject = customSubject.trim() || selectedSubject.name;
    const finalTopic = customTopic.trim() || topic;

    if (!finalTopic) {
      toast.error("Molimo unesi ili izaberi temu za ispitivanje!");
      return;
    }

    setIsStarting(true);
    stopSpeaking();

    try {
      const data = await startClassroomSessionApi({
        animalTeacher: activeTeacher,
        subject: finalSubject,
        topic: finalTopic,
        classMode: selectedMode.title,
        totalQuestions: selectedMode.questionCount,
        language: lang,
      });

      const firstTurn: ClassroomTurn = {
        id: `turn-1-${Date.now()}`,
        questionNumber: 1,
        teacherQuestion: data.question,
        hintText: data.hint,
        animalReaction: data.animalReaction,
        createdAt: new Date().toISOString(),
      };

      const newSession: ClassroomSession = {
        id: `classroom-${Date.now()}`,
        teacherId: activeTeacher.id,
        subject: finalSubject,
        topic: finalTopic,
        mode: selectedMode.id,
        turns: [firstTurn],
        currentTurnIndex: 0,
        totalQuestions: selectedMode.questionCount,
        status: "active",
        rewardsCount: 0,
        startedAt: new Date().toISOString(),
        userId: currentUserId,
      };

      setActiveSession(newSession);
      setCurrentHint(data.hint || "");
      setShowHint(false);
      setStudentAnswer("");
      setCurrentEvaluation(null);

      // Speak question
      playVoice(`${data.welcomeMessage} Prvo pitanje: ${data.question}`);
      toast.success(`${activeTeacher.title}: Čas je počeo! Srećno na ispitivanju!`);
    } catch (e) {
      toast.error("Došlo je do greške pri pokretanju časa. Pokušaj ponovo.");
      console.error(e);
    } finally {
      setIsStarting(false);
    }
  };

  // Submit student answer
  const handleSubmitAnswer = async () => {
    if (!activeSession) return;
    const currentTurn = activeSession.turns[activeSession.currentTurnIndex];
    if (!currentTurn) return;

    if (!studentAnswer.trim()) {
      toast.error("Napiši ili izgovori svoj odgovor pre predaje!");
      return;
    }

    setIsSubmitting(true);
    stopSpeaking();

    try {
      const evalData = await evaluateAnswerApi({
        animalTeacher: activeTeacher,
        subject: activeSession.subject,
        topic: activeSession.topic,
        previousQuestion: currentTurn.teacherQuestion,
        studentAnswer: studentAnswer.trim(),
        currentQuestionNumber: currentTurn.questionNumber,
        totalQuestions: activeSession.totalQuestions,
        language: lang,
      });

      setCurrentEvaluation({
        score: evalData.score,
        grade: evalData.grade,
        isCorrect: evalData.isCorrect,
        feedback: evalData.feedback,
        animalReaction: evalData.animalReaction,
        rewardEarned: evalData.rewardEarned,
        rewardItem: evalData.rewardItem,
      });

      // Update current turn with answer & feedback
      const updatedTurns = [...activeSession.turns];
      updatedTurns[activeSession.currentTurnIndex] = {
        ...currentTurn,
        studentAnswer: studentAnswer.trim(),
        teacherFeedback: evalData.feedback,
        score: evalData.score,
        grade: evalData.grade,
        isCorrect: evalData.isCorrect,
        animalReaction: evalData.animalReaction,
        rewardEarned: evalData.rewardEarned,
      };

      const updatedRewardsCount =
        activeSession.rewardsCount + (evalData.rewardEarned ? 1 : 0);

      // Play feedback audio
      playVoice(
        `${evalData.grade}. ${evalData.feedback} ${evalData.animalReaction}`
      );

      // If there is a next question
      if (!evalData.isFinalQuestion && evalData.nextQuestion) {
        const nextTurn: ClassroomTurn = {
          id: `turn-${currentTurn.questionNumber + 1}-${Date.now()}`,
          questionNumber: currentTurn.questionNumber + 1,
          teacherQuestion: evalData.nextQuestion,
          hintText: evalData.nextQuestionHint || "",
          createdAt: new Date().toISOString(),
        };
        updatedTurns.push(nextTurn);

        setActiveSession({
          ...activeSession,
          turns: updatedTurns,
          currentTurnIndex: activeSession.currentTurnIndex,
          rewardsCount: updatedRewardsCount,
        });
      } else {
        // Final question answered - will prompt to see Report Card
        setActiveSession({
          ...activeSession,
          turns: updatedTurns,
          rewardsCount: updatedRewardsCount,
        });
      }
    } catch (e) {
      toast.error("Došlo je do greške pri ocenjivanju odgovora.");
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Move to next question after reviewing feedback
  const handleProceedNextQuestion = () => {
    if (!activeSession) return;
    stopSpeaking();
    const nextIndex = activeSession.currentTurnIndex + 1;

    if (nextIndex < activeSession.turns.length) {
      const nextTurn = activeSession.turns[nextIndex];
      setActiveSession({
        ...activeSession,
        currentTurnIndex: nextIndex,
      });
      setStudentAnswer("");
      setCurrentEvaluation(null);
      setShowHint(false);
      setCurrentHint(nextTurn.hintText || "");

      // Read next question aloud
      playVoice(`Pitanje broj ${nextTurn.questionNumber}: ${nextTurn.teacherQuestion}`);
    } else {
      // Completed all questions -> generate report card
      handleFinishExam();
    }
  };

  // Finish exam and generate report card
  const handleFinishExam = async () => {
    if (!activeSession) return;
    setIsFinishing(true);
    stopSpeaking();

    try {
      const result = await finishClassroomSessionApi({
        animalTeacher: activeTeacher,
        subject: activeSession.subject,
        topic: activeSession.topic,
        turns: activeSession.turns,
        language: lang,
      });

      const completedSession: ClassroomSession = {
        ...activeSession,
        status: "completed",
        finalGrade: result.finalGrade,
        averageScore: result.averageScore,
        finalVerdict: result.finalVerdict,
        keyStrengths: result.keyStrengths,
        topicsToReview: result.topicsToReview,
        completedAt: new Date().toISOString(),
      };

      setActiveSession(completedSession);
      saveClassroomSession(currentUserId, completedSession);
      setPastSessions(getClassroomSessions(currentUserId));

      playVoice(
        `Ispitivanje je završeno! Tvoja konačna ocena je: ${result.finalGrade}. ${result.diplomaPraise}`
      );
      toast.success(`Čestitamo! Tvoja konačna ocena: ${result.finalGrade} 🎓`);
    } catch (e) {
      toast.error("Greška pri zaključivanju ocene.");
      console.error(e);
    } finally {
      setIsFinishing(false);
    }
  };

  // Save session as permanent study note
  const handleSaveToNotes = () => {
    if (!activeSession) return;

    const keyPoints = activeSession.turns.map(
      (t) =>
        `P${t.questionNumber}: ${t.teacherQuestion.slice(0, 70)}... (${t.grade || "Odgovoreno"})`
    );

    const fullNotes = `## Usmeno ispitivanje: ${activeSession.topic} (${activeSession.subject})
**Nastavnik**: ${activeTeacher.title} (${activeTeacher.species})
**Konačna ocena**: ${activeSession.finalGrade || "Odličan 5"}
**Skor**: ${activeSession.averageScore || 90}%
**Osvojene nagrade**: ${activeSession.rewardsCount}x ${activeTeacher.rewardItem}

### Zaključak nastavnika:
${activeSession.finalVerdict || "Uspešno savladano gradivo."}

### Ključne prednosti:
${(activeSession.keyStrengths || ["Dobra priprema"]).map((s) => `- ${s}`).join("\n")}

### Oblasti za proveru pre ispita:
${(activeSession.topicsToReview || ["Ponoviti detalje"]).map((r) => `- ${r}`).join("\n")}

---
### Pitanja i odgovori sa časa:
${activeSession.turns
  .map(
    (t) =>
      `#### Pitanje #${t.questionNumber}: ${t.teacherQuestion}\n` +
      `**Tvoj odgovor**: ${t.studentAnswer || "(Nema odgovora)"}\n\n` +
      `**Komentar nastavnika (${t.grade || ""})**: ${t.teacherFeedback || ""}\n`
  )
  .join("\n---\n")}`;

    saveNote({
      title: `[Učionica] ${activeSession.topic} - Ocena ${activeSession.finalGrade || "5"}`,
      topic: activeSession.subject,
      content: {
        title: activeSession.topic,
        keyPoints: keyPoints.length > 0 ? keyPoints : ["Pregled ispitivanja"],
        summary: `Usmeno ispitivanje iz teme ${activeSession.topic} kod ${activeTeacher.title}. Konačna ocena: ${activeSession.finalGrade || "5"}.`,
        fullNotes,
      },
    }, currentUserId);

    toast.success("Rezultati ispitivanja su sačuvani u tvoju Biblioteku beleški! 📚");
    onOpenNotes?.();
  };

  const handleResetToSetup = () => {
    stopSpeaking();
    setActiveSession(null);
    setCurrentEvaluation(null);
    setStudentAnswer("");
  };

  const handleDeleteHistorySession = (sessionId: string) => {
    deleteClassroomSession(currentUserId, sessionId);
    setPastSessions(getClassroomSessions(currentUserId));
    toast.success("Ispitivanje obrisano iz istorije.");
  };

  // --------------------------------------------------------------------------
  // RENDER VIEW: Active Classroom Oral Exam
  // --------------------------------------------------------------------------
  if (activeSession && activeSession.status === "active") {
    const currentTurn = activeSession.turns[activeSession.currentTurnIndex];
    const progressPercent = Math.round(
      ((activeSession.currentTurnIndex + 1) / activeSession.totalQuestions) * 100
    );

    return (
      <div className="space-y-4 max-w-4xl mx-auto pb-12">
        {/* Classroom Top Bar */}
        <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-2xl shadow-inner">
              {activeTeacher.emoji}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-foreground">
                  {activeTeacher.title}
                </h3>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {activeTeacher.badge}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-md">
                Tema: <strong className="text-foreground">{activeSession.topic}</strong> ({activeSession.subject})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (voiceEnabled) stopSpeaking();
                setVoiceEnabled(!voiceEnabled);
              }}
              className={`cursor-pointer rounded-xl p-2 text-xs transition-all ${
                voiceEnabled
                  ? "bg-primary/15 text-primary hover:bg-primary/25"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              title={voiceEnabled ? "Isključi glas nastavnika" : "Uključi glas nastavnika"}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToSetup}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Prekini
            </Button>
          </div>
        </div>

        {/* Progress & Reward Tracker */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-muted-foreground">
              Pitanje {activeSession.currentTurnIndex + 1} od {activeSession.totalQuestions}
            </span>
            <span className="flex items-center gap-1.5 text-primary font-bold">
              <span>{activeTeacher.rewardIcon}</span>
              <span>{activeSession.rewardsCount} osvojeno</span>
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Teacher Blackboard / Question Card */}
        <div className="rounded-3xl border border-primary/25 bg-gradient-to-b from-primary/5 via-card to-card p-5 sm:p-7 shadow-md relative overflow-hidden">
          {/* Subtle Animal Silhouette / Watermark */}
          <div className="absolute -right-6 -bottom-6 text-9xl opacity-10 pointer-events-none select-none">
            {activeTeacher.emoji}
          </div>

          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-primary/30 shadow-sm text-3xl">
                {activeTeacher.emoji}
              </div>
              {isSpeaking && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-primary text-[8px] text-white items-center justify-center font-bold">
                    ♪
                  </span>
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-extrabold text-primary uppercase tracking-wider">
                  Pitanje #{currentTurn.questionNumber} pred tablom
                </span>
                <button
                  type="button"
                  onClick={() => playVoice(currentTurn.teacherQuestion)}
                  className="cursor-pointer text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-xs"
                  title="Ponovi pitanje glasom"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Pročitaj ponovo</span>
                </button>
              </div>

              <h2 className="text-base sm:text-xl font-bold text-foreground leading-snug">
                {currentTurn.teacherQuestion}
              </h2>

              {currentTurn.animalReaction && (
                <p className="mt-2 text-xs italic text-muted-foreground flex items-center gap-1">
                  <span>🐾</span> {currentTurn.animalReaction}
                </p>
              )}
            </div>
          </div>

          {/* Hint Dropdown Toggle */}
          {currentHint && (
            <div className="mt-4 pt-4 border-t border-border/60">
              {!showHint ? (
                <button
                  type="button"
                  onClick={() => setShowHint(true)}
                  className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all"
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  Treba ti pomoć? Pogledaj nagoveštaj nastavnika
                </button>
              ) : (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-bold flex items-center gap-1.5 mb-1">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                    Nagoveštaj od {activeTeacher.title}:
                  </p>
                  <p className="leading-relaxed">{currentHint}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Evaluation Feedback View (if already answered this question) */}
        {currentEvaluation ? (
          <div className="rounded-3xl border border-primary/30 bg-card p-5 sm:p-6 shadow-md space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div className="flex items-center gap-2">
                {currentEvaluation.isCorrect ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                ) : (
                  <HelpCircle className="h-6 w-6 text-amber-500" />
                )}
                <div>
                  <h3 className="font-extrabold text-base text-foreground">
                    {currentEvaluation.grade} • {currentEvaluation.score}/100 poena
                  </h3>
                  <p className="text-xs text-muted-foreground">{currentEvaluation.animalReaction}</p>
                </div>
              </div>

              {currentEvaluation.rewardEarned && (
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 animate-bounce">
                  <span>{currentEvaluation.rewardItem}</span>
                  <span>Osvojeno!</span>
                </div>
              )}
            </div>

            {/* Student's answer recap */}
            <div className="rounded-xl bg-muted/40 p-3 text-xs">
              <span className="font-bold text-muted-foreground block mb-1">Tvoj odgovor:</span>
              <p className="text-foreground italic">{studentAnswer}</p>
            </div>

            {/* Teacher's detailed pedagogical feedback */}
            <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4">
              <h4 className="text-xs font-extrabold text-primary mb-1 flex items-center gap-1.5">
                <span>{activeTeacher.emoji}</span> Komentar nastavnika:
              </h4>
              <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                {currentEvaluation.feedback}
              </p>
            </div>

            {/* Next Question CTA */}
            <div className="pt-2 flex justify-end">
              <Button
                size="lg"
                onClick={handleProceedNextQuestion}
                disabled={isFinishing}
                className="cursor-pointer font-extrabold text-xs sm:text-sm rounded-xl px-6 gap-2"
              >
                {activeSession.currentTurnIndex + 1 < activeSession.totalQuestions ? (
                  <>
                    Sledeće pitanje
                    <ChevronRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Zaključi ocenu i vidi đačku knjižicu 🎓
                    <Award className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Student Answer Input Card */
          <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span>✍️</span> Tvoj odgovor na pitanje (kucaj ili govori):
              </label>

              {/* Voice Dictation Button */}
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`cursor-pointer inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  isListening
                    ? "bg-rose-500 text-white animate-pulse shadow-md"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
                }`}
                title="Odgovori glasom putem mikrofona"
              >
                {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                <span>{isListening ? "Nastavnik sluša... (Klikni za stop)" : "Govori na mikrofon"}</span>
              </button>
            </div>

            <textarea
              rows={4}
              value={studentAnswer}
              onChange={(e) => setStudentAnswer(e.target.value)}
              placeholder="Objasni suštinu svojim rečima kao pred tablom..."
              className="w-full rounded-2xl border border-border/80 bg-background/60 p-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all resize-y"
              disabled={isSubmitting}
            />

            {/* Quick Answer Helpers */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setStudentAnswer((prev) =>
                      prev
                        ? `${prev} Ključni razlog za ovo je...`
                        : "Ključni razlog za ovo je..."
                    )
                  }
                  className="cursor-pointer rounded-lg bg-muted/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  + "Ključni razlog..."
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setStudentAnswer((prev) =>
                      prev
                        ? `${prev} Kao praktičan primer možemo uzeti...`
                        : "Kao praktičan primer možemo uzeti..."
                    )
                  }
                  className="cursor-pointer rounded-lg bg-muted/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  + "Praktičan primer..."
                </button>
              </div>

              <Button
                size="lg"
                onClick={handleSubmitAnswer}
                disabled={isSubmitting || !studentAnswer.trim()}
                className="cursor-pointer font-extrabold text-xs sm:text-sm rounded-xl px-5 gap-2 ml-auto"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Nastavnik ocenjuje...
                  </>
                ) : (
                  <>
                    Predaj odgovor nastavniku
                    <CheckCircle2 className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER VIEW: Completed Exam Report Card (Đačka knjižica & Svedočanstvo)
  // --------------------------------------------------------------------------
  if (activeSession && activeSession.status === "completed") {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        {/* Certificate Card */}
        <div className="rounded-3xl border-2 border-primary/40 bg-gradient-to-b from-primary/10 via-card to-card p-6 sm:p-8 text-center shadow-xl relative overflow-hidden">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/20 text-4xl mb-4 ring-8 ring-primary/10">
            {activeTeacher.emoji}
          </div>

          <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-extrabold text-primary uppercase tracking-wider">
            Đačka Knjižica & Svedočanstvo 🎓
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mt-2">
            Čestitamo na uspešnom odgovaranju!
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Predmet: <strong className="text-foreground">{activeSession.subject}</strong> • Lekcija:{" "}
            <strong className="text-foreground">{activeSession.topic}</strong>
          </p>

          {/* Grade Display */}
          <div className="my-6 inline-flex flex-col items-center justify-center rounded-3xl border border-primary/30 bg-card px-8 py-5 shadow-inner">
            <span className="text-xs font-bold text-muted-foreground uppercase">Konačna ocena</span>
            <span className="text-4xl sm:text-5xl font-black text-primary my-1">
              {activeSession.finalGrade || "5 (Odličan)"}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Prosečan skor: {activeSession.averageScore || 90}%
            </span>
          </div>

          {/* Rewards Earned */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-xl">{activeTeacher.rewardIcon}</span>
            <span className="text-sm font-bold text-foreground">
              Osvojeno: {activeSession.rewardsCount}x {activeTeacher.rewardItem}
            </span>
          </div>

          {/* Verdict by Animal Teacher */}
          <div className="rounded-2xl bg-card border border-border/80 p-4 sm:p-5 text-left text-xs sm:text-sm text-foreground leading-relaxed mb-6">
            <h4 className="font-extrabold text-primary mb-1 flex items-center gap-2">
              <span>{activeTeacher.emoji}</span> Zaključna reč {activeTeacher.title}:
            </h4>
            <p className="whitespace-pre-line">{activeSession.finalVerdict}</p>
          </div>

          {/* Strengths & Review list */}
          <div className="grid sm:grid-cols-2 gap-4 text-left mb-6">
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4">
              <h5 className="font-bold text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Šta si odlično savladao/la:
              </h5>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {(activeSession.keyStrengths || ["Razumevanje osnovnih pojmova"]).map((s, idx) => (
                  <li key={idx}>• {s}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
              <h5 className="font-bold text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5 mb-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Preporuka za dodatno utvrđivanje:
              </h5>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {(activeSession.topicsToReview || ["Uvežbati dodatne primere"]).map((r, idx) => (
                  <li key={idx}>• {r}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={handleSaveToNotes}
              className="cursor-pointer font-bold text-xs sm:text-sm rounded-xl px-5 gap-2 bg-primary hover:bg-primary/90"
            >
              <BookOpen className="h-4 w-4" />
              Sačuvaj u Biblioteku beleški
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={handleResetToSetup}
              className="cursor-pointer font-bold text-xs sm:text-sm rounded-xl px-5 gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Novo ispitivanje / Druga tema
            </Button>

            {onOpenChat && (
              <Button
                size="lg"
                variant="secondary"
                onClick={() =>
                  onOpenChat(
                    `Nastavljamo sa temom ${activeSession.topic}. Imam još neka pitanja za tebe, profesore!`
                  )
                }
                className="cursor-pointer font-bold text-xs sm:text-sm rounded-xl px-5 gap-2"
              >
                💬 Nastavi u Chatu sa {activeTeacher.name}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER VIEW: Classroom Setup & Animal Teacher Selection
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="rounded-3xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card to-primary/5 p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-extrabold text-primary">
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Interaktivna Učionica • Usmeno Odgovaranje</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Slatki Životinjski Nastavnici te ispituju pred tablom! 🐾
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Izaberi svog omiljenog nastavnika (Lisac, Zeka, Panda, Mačka, Sova ili Kuca) i proveri
              svoje znanje kroz pravo usmeno ispitivanje sa ocenjivanjem (1-5), podpitanjima i nagradama!
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`cursor-pointer rounded-2xl border px-3 py-2 text-xs font-bold transition-all flex items-center gap-2 shadow-2xs ${
                voiceEnabled
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground"
              }`}
              title="Glasovno čitanje pitanja nastavnika"
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <span>{voiceEnabled ? "Glas nastavnika: Uključen" : "Glas: Isključen"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. Pick Your Animal Teacher */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
            <span>1.</span> Izaberi svog slatkog nastavnika:
          </h2>
          <span className="text-xs text-muted-foreground font-medium">
            Aktivno: <strong className="text-primary">{activeTeacher.title}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ANIMAL_TEACHERS.map((teacher) => {
            const isSelected = activeTeacher.id === teacher.id;
            return (
              <div
                key={teacher.id}
                onClick={() => handleSelectTeacher(teacher)}
                className={`group cursor-pointer rounded-2xl border p-3 text-center transition-all relative ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/30"
                    : "border-border/70 bg-card hover:border-primary/50 hover:bg-card/90 shadow-2xs"
                }`}
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-3xl mb-2 group-hover:scale-110 transition-transform">
                  {teacher.emoji}
                </div>
                <h4 className="font-extrabold text-xs text-foreground truncate">{teacher.title}</h4>
                <p className="text-[10px] text-primary font-bold truncate mt-0.5">{teacher.badge}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1 leading-tight">
                  {teacher.species}
                </p>

                {isSelected && (
                  <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
            );
          })}
        </div>

        {/* Teacher Quote / Persona Banner */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 flex items-center gap-3">
          <span className="text-2xl">{activeTeacher.emoji}</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">
              {activeTeacher.title}: <span className="italic font-normal">"{activeTeacher.catchphraseSr}"</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Stil nastave: {activeTeacher.teachingStyle} • Nagrada:{" "}
              <span className="font-bold text-primary">{activeTeacher.rewardIcon} {activeTeacher.rewardItem}</span>
            </p>
          </div>
        </div>
      </div>

      {/* 2. Choose Subject & Topic */}
      <div className="space-y-4">
        <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
          <span>2.</span> Izaberi oblast i lekciju za ispitivanje:
        </h2>

        {/* Subject Chips */}
        <div className="flex flex-wrap gap-2">
          {CLASSROOM_SUBJECT_PRESETS.map((sub) => {
            const isSel = selectedSubject.id === sub.id && !customSubject;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => {
                  setSelectedSubject(sub);
                  setCustomSubject("");
                  setTopic(sub.topics[0]);
                  setCustomTopic("");
                }}
                className={`cursor-pointer inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  isSel
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-card border border-border/80 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <span>{sub.icon}</span>
                <span>{sub.name}</span>
              </button>
            );
          })}
        </div>

        {/* Topic Selection Grid */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground block">
              Popularne lekcije iz oblasti "{selectedSubject.name}":
            </label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {selectedSubject.topics.map((top) => {
                const isTopSel = topic === top && !customTopic;
                return (
                  <button
                    key={top}
                    type="button"
                    onClick={() => {
                      setTopic(top);
                      setCustomTopic("");
                    }}
                    className={`w-full text-left cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold transition-all flex items-center justify-between ${
                      isTopSel
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "bg-card border border-border/70 text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <span className="truncate mr-2">{top}</span>
                    {isTopSel && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground block">
              Ili upiši svoju prilagođenu lekciju / ispit:
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="npr. Druga industrijska revolucija, integrali, fotosinteza..."
                className="w-full rounded-xl border border-border/80 bg-background/80 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden"
              />
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Opcioni naziv predmeta (npr. Hemija, Pravo, Anatomija)..."
                className="w-full rounded-xl border border-border/80 bg-background/80 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden"
              />
              <p className="text-[11px] text-muted-foreground">
                Možeš upisati tačno ono što učiš za sutrašnji kontrolni ili fakultetski ispit!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Choose Classroom Examination Mode */}
      <div className="space-y-3">
        <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
          <span>3.</span> Izaberi format ispitivanja:
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CLASSROOM_MODES.map((mode) => {
            const isSel = selectedMode.id === mode.id;
            return (
              <div
                key={mode.id}
                onClick={() => setSelectedMode(mode)}
                className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                  isSel
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                    : "border-border/70 bg-card hover:border-primary/40 hover:bg-card/80"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xl">{mode.icon}</span>
                  <span className="rounded-lg bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {mode.questionCount} Pitanja
                  </span>
                </div>
                <h4 className="font-extrabold text-xs text-foreground leading-tight">{mode.title}</h4>
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{mode.subtitle}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Start Button CTA */}
      <div className="rounded-3xl border border-primary/30 bg-card p-5 text-center shadow-md space-y-3">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">{activeTeacher.emoji}</span>
          <h3 className="text-base font-extrabold text-foreground">
            Spreman/na za ispitivanje kod {activeTeacher.title}?
          </h3>
        </div>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Izaći ćeš pred tablu sa temom:{" "}
          <strong className="text-foreground">{customTopic.trim() || topic}</strong>. Nastavnik će
          postavljati pitanja jedno po jedno!
        </p>

        <Button
          size="lg"
          onClick={handleStartExam}
          disabled={isStarting}
          className="cursor-pointer font-extrabold text-sm rounded-2xl px-8 py-3 bg-primary hover:bg-primary/90 shadow-md gap-2"
        >
          {isStarting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Nastavnik priprema tablu i dnevnik...
            </>
          ) : (
            <>
              Izađi pred tablu / Započni ispitivanje 🎓
              <Sparkles className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {/* Past Classroom History & Report Cards */}
      {pastSessions.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-border/70">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-primary" />
              Istorija đačke knjižice ({pastSessions.length} završenih odgovaranja)
            </h3>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pastSessions.slice(0, 6).map((ses) => {
              const teacherInfo = ANIMAL_TEACHERS.find((t) => t.id === ses.teacherId) || activeTeacher;
              return (
                <div
                  key={ses.id}
                  className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xs hover:border-primary/40 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{teacherInfo.emoji}</span>
                      <div>
                        <span className="text-xs font-bold text-foreground block leading-tight">
                          {ses.topic}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {teacherInfo.title} • {new Date(ses.startedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteHistorySession(ses.id)}
                      className="cursor-pointer text-muted-foreground hover:text-destructive transition-colors p-1"
                      title="Obriši iz istorije"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="rounded-lg bg-primary/10 px-2 py-0.5 font-extrabold text-primary">
                      Ocena: {ses.finalGrade || "5"}
                    </span>
                    <span className="text-muted-foreground font-semibold">
                      {teacherInfo.rewardIcon} {ses.rewardsCount} nagrada
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
