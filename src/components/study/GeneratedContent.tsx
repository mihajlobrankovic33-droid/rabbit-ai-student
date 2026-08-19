import React from "react";
import type { StudyContent } from "@/types/study";
import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck, CheckCircle2, Copy, FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface GeneratedContentProps {
  content: StudyContent | null;
  isGenerating: boolean;
  onSave: () => void;
  saved: boolean;
}

export function GeneratedContent({
  content,
  isGenerating,
  onSave,
  saved,
}: GeneratedContentProps) {
  const handleCopy = () => {
    if (!content) return;
    const text = `${content.title}\n\nKEY POINTS:\n${content.keyPoints
      .map((k) => `• ${k}`)
      .join("\n")}\n\nSUMMARY:\n${content.summary}${
      content.fullNotes ? `\n\nDETAILED NOTES:\n${content.fullNotes}` : ""
    }`;
    navigator.clipboard.writeText(text);
    toast.success("Notes copied to clipboard!");
  };

  if (isGenerating) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-pulse mb-4">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
        <h3 className="text-base font-bold text-foreground">Creating your study notes</h3>
        <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">
          Synthesizing key insights, active recall prompts, and clean summaries…
        </p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-center p-6 border border-dashed border-border/70 rounded-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">No notes selected or generated yet</h3>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Enter a topic on the left to create structured revision notes, or pick one from your library.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{content.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Structured study companion notes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            variant={saved ? "secondary" : "default"}
            className="gap-1.5"
            disabled={saved}
          >
            {saved ? (
              <>
                <BookmarkCheck className="h-3.5 w-3.5 text-emerald-500" />
                Saved to Library
              </>
            ) : (
              <>
                <Bookmark className="h-3.5 w-3.5" />
                Save Note
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Key Points */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Key Learning Objectives & Points
          </h3>
        </div>
        <div className="space-y-2">
          {content.keyPoints.map((point, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-foreground/90 leading-relaxed"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
              <span>{point}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Summary
        </h3>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-foreground">
          {content.summary}
        </div>
      </div>

      {/* Full Notes if available */}
      {content.fullNotes && (
        <div className="space-y-2.5 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Detailed Explanation
          </h3>
          <div className="rounded-xl border border-border/70 bg-card p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {content.fullNotes}
          </div>
        </div>
      )}
    </div>
  );
}
