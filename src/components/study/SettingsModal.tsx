import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Sparkles, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const API_KEY_STORAGE = "study_buddy_gemini_key";

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(API_KEY_STORAGE) || "";
    setApiKey(stored);
    setSavedKey(stored);
  }, [open]);

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem(API_KEY_STORAGE, trimmed);
      setSavedKey(trimmed);
      toast.success("AI API key saved successfully!");
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
      setSavedKey("");
      toast("API key cleared. Using built-in study assistant.");
    }
    onOpenChange(false);
  };

  const handleClear = () => {
    localStorage.removeItem(API_KEY_STORAGE);
    setApiKey("");
    setSavedKey("");
    toast("API key removed.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <DialogTitle>AI Assistant Settings</DialogTitle>
          </div>
          <DialogDescription>
            Configure cloud AI integration or use the built-in offline study companion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground leading-relaxed">
            <p className="font-semibold text-primary mb-1">Built-in Offline Intelligence</p>
            <p className="text-muted-foreground">
              Study Buddy has an integrated knowledge brain that runs completely offline with zero setup. If you have a Google Gemini API key, you can enter it below for advanced explanations.
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Google Gemini API Key (Optional)</span>
              {savedKey && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500 lowercase">
                  <Check className="h-3 w-3" /> active
                </span>
              )}
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {savedKey ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove Key
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              Save Settings
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
