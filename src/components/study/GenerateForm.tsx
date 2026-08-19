import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

interface GenerateFormProps {
  onGenerate: (title: string, topic: string) => Promise<void> | void;
  isLoading: boolean;
}

export function GenerateForm({ onGenerate, isLoading }: GenerateFormProps) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !topic.trim()) return;
    onGenerate(title.trim(), topic.trim());
  };

  const samplePrompts = [
    { title: "Photosynthesis", desc: "Light and dark reactions in plants" },
    { title: "Calculus Limits", desc: "Evaluating one-sided and algebraic limits" },
    { title: "World War I Causes", desc: "Militarism, Alliances, Imperialism, Nationalism" },
    { title: "Neural Networks", desc: "Weights, biases, activation functions, and backpropagation" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Study Topic Title
        </label>
        <Input
          placeholder="e.g. Organic Chemistry Reactions"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isLoading}
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Subtopics, specific questions, or notes
        </label>
        <textarea
          rows={3}
          placeholder="e.g. Focus on nucleophilic substitution (SN1 vs SN2), solvents, and stereochemistry"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={isLoading}
          className="w-full rounded-xl border border-input bg-background p-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">Quick inspiration:</p>
        <div className="flex flex-wrap gap-1.5">
          {samplePrompts.map((p) => (
            <button
              key={p.title}
              type="button"
              onClick={() => {
                setTitle(p.title);
                setTopic(p.desc);
              }}
              className="cursor-pointer rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {p.title}
            </button>
          ))}
        </div>
      </div>

      <Button
        type="submit"
        disabled={isLoading || (!title.trim() && !topic.trim())}
        className="w-full gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating study notes…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Notes
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
