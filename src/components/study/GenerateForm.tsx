import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Calculator, Code2, Dna, FlaskConical, History, Loader2, Sparkles } from "lucide-react";

interface GenerateFormProps {
  onGenerate: (title: string, topic: string) => Promise<void> | void;
  isLoading: boolean;
}

const CATEGORY_PROMPTS = [
  { icon: Calculator, label: "Calculus", title: "Calculus: Integration Techniques", desc: "Integration by parts, u-substitution, and partial fraction decomposition" },
  { icon: FlaskConical, label: "Chemistry", title: "Organic Chemistry: SN1 vs SN2", desc: "Reaction kinetics, nucleophile strength, solvent effects, and carbocation stability" },
  { icon: Dna, label: "Biology", title: "Cellular Respiration & ATP", desc: "Glycolysis, Krebs cycle, electron transport chain, and ATP synthase yield" },
  { icon: Code2, label: "Computer Science", title: "Data Structures: Balanced Trees", desc: "AVL Trees, Red-Black Trees, rotational balance, and time complexity O(log n)" },
  { icon: History, label: "History", title: "World War II Turning Points", desc: "Battle of Midway, Stalingrad, D-Day invasion, and post-war geopolitical impact" },
];

export function GenerateForm({ onGenerate, isLoading }: GenerateFormProps) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !topic.trim()) return;
    onGenerate(title.trim(), topic.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Category Shortcuts */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Subject Inspiration
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CATEGORY_PROMPTS.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.label}
                type="button"
                onClick={() => {
                  setTitle(cat.title);
                  setTopic(cat.desc);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/70 bg-card/80 p-2.5 text-left text-xs transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="font-semibold truncate">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          Study Topic Title
        </label>
        <div className="relative">
          <Input
            placeholder="e.g. Quantum Mechanics & Wavefunctions"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isLoading}
            className="h-11 rounded-xl"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          Specific Subtopics or Focus Questions (Optional)
        </label>
        <textarea
          rows={3}
          placeholder="e.g. Focus on Schrödinger equation, infinite potential wells, and quantum tunneling with intuitive analogies"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={isLoading}
          className="w-full rounded-xl border border-input bg-background p-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <Button
        type="submit"
        disabled={isLoading || (!title.trim() && !topic.trim())}
        className="w-full h-11 rounded-xl font-bold gap-2 shadow-md text-sm"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Synthesizing study notes…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Structured Notes
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
