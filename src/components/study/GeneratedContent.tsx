import React, { useState, useMemo } from "react";
import type { StudyContent } from "@/types/study";
import { Button } from "@/components/ui/button";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  FileText,
  HelpCircle,
  Lightbulb,
  Loader2,
  Printer,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";

interface GeneratedContentProps {
  content: StudyContent | null;
  isGenerating: boolean;
  onSave: () => void;
  saved: boolean;
  onPlayResponse?: (content: StudyContent) => void;
  isPlayingResponse?: boolean;
  isLoadingAudio?: boolean;
}

export function GeneratedContent({
  content: rawContent,
  isGenerating,
  onSave,
  saved,
  onPlayResponse,
  isPlayingResponse = false,
  isLoadingAudio = false,
}: GeneratedContentProps) {
  const [copied, setCopied] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);

  // Normalize content to ensure keyPoints, summary, and title are always safe
  const content = useMemo<StudyContent | null>(() => {
    if (!rawContent) return null;
    const rawObj = rawContent as unknown as Record<string, unknown>;
    const inner = (
      rawObj.content && typeof rawObj.content === "object"
        ? rawObj.content
        : rawObj
    ) as Record<string, unknown>;

    const safeKeyPoints = Array.isArray(inner.keyPoints)
      ? (inner.keyPoints as unknown[]).map(String)
      : typeof inner.keyPoints === "string"
      ? [inner.keyPoints]
      : [];

    return {
      title: typeof inner.title === "string" ? inner.title : "Study Notes",
      keyPoints: safeKeyPoints,
      summary: typeof inner.summary === "string" ? inner.summary : "",
      fullNotes: typeof inner.fullNotes === "string" ? inner.fullNotes : "",
    };
  }, [rawContent]);

  const handleCopy = () => {
    if (!content) return;
    const safePoints = content.keyPoints || [];
    const text = `${(content.title || "STUDY NOTES").toUpperCase()}\n\nKEY POINTS & MECHANISMS:\n${safePoints
      .map((k, i) => `${i + 1}. ${k}`)
      .join("\n")}\n\nEXECUTIVE SUMMARY:\n${content.summary || ""}${
      content.fullNotes ? `\n\nDETAILED NOTES:\n${content.fullNotes}` : ""
    }`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Complete study notes copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isGenerating) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center text-center p-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 text-primary animate-pulse mb-5 shadow-lg">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Creating your exam-ready notes</h3>
        <p className="mt-2 max-w-sm text-xs text-muted-foreground leading-relaxed">
          Extracting key formulas, core takeaways, intuitive analogies, and active recall revision prompts…
        </p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border/70 rounded-3xl bg-muted/10">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border/80 text-muted-foreground mb-4 shadow-sm">
          <FileText className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-base font-bold text-foreground">No study note selected</h3>
        <p className="mt-1.5 max-w-xs text-xs text-muted-foreground leading-relaxed">
          Choose a subject on the left to generate new notes, or select one from your library to review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
              Study Sheet
            </span>
            <span className="text-xs text-muted-foreground">• Exam Revision Ready</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">{content.title}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onPlayResponse && (
            <Button
              type="button"
              variant={isPlayingResponse ? "default" : "outline"}
              size="sm"
              onClick={() => onPlayResponse(content)}
              className={`h-9 gap-1.5 rounded-xl text-xs font-semibold transition-all ${
                isPlayingResponse
                  ? "bg-primary text-primary-foreground shadow-sm animate-pulse"
                  : "hover:border-primary/50 hover:bg-primary/5 text-foreground"
              }`}
              title="Slušaj lekciju uz ElevenLabs AI glas"
            >
              {isLoadingAudio ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : isPlayingResponse ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-primary" />
              )}
              <span>
                {isLoadingAudio
                  ? "Učitavanje glasa..."
                  : isPlayingResponse
                  ? "Zaustavi govor"
                  : "Slušaj lekciju (ElevenLabs)"}
              </span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-9 gap-1.5 rounded-xl text-xs font-semibold"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy All"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-1.5 rounded-xl text-xs font-semibold hidden sm:flex"
            title="Print or save as PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onSave}
            variant={saved ? "secondary" : "default"}
            className="h-9 gap-1.5 rounded-xl text-xs font-bold shadow-xs"
            disabled={saved}
          >
            {saved ? (
              <>
                <BookmarkCheck className="h-4 w-4 text-emerald-500" />
                Saved to Library
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                Save to Library
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Key Takeaways & Mechanisms */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Core Principles & Formulas
            </h3>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            {(content.keyPoints?.length ?? 0)} Key Takeaways
          </span>
        </div>

        <div className="grid gap-2.5">
          {(content.keyPoints || []).map((point, i) => (
            <div
              key={i}
              className="flex items-start gap-3.5 rounded-2xl border border-border/70 bg-card p-3.5 text-sm leading-relaxed text-foreground shadow-2xs transition-all hover:border-primary/30"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </div>
              <span className="pt-0.5">{point}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Box */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Executive Summary
          </h3>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 text-sm leading-relaxed text-foreground">
          {content.summary}
        </div>
      </div>

      {/* Detailed Notes if present */}
      {content.fullNotes && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            In-Depth Notes
          </h3>
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {content.fullNotes}
          </div>
        </div>
      )}

      {/* Active Recall Prompt Toggle */}
      <div className="rounded-2xl border border-border/80 bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-bold text-foreground">Active Recall Self-Test</span>
          </div>
          <button
            type="button"
            onClick={() => setShowQuiz(!showQuiz)}
            className="cursor-pointer text-xs font-semibold text-primary hover:underline"
          >
            {showQuiz ? "Hide Test" : "Show Test Prompt"}
          </button>
        </div>
        {showQuiz && (
          <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">
              ❓ Question: Without looking above, explain the 3 main mechanisms of {content.title} in your own words.
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              Practicing active recall enhances long-term memory retention by up to 50% compared to passive re-reading.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
