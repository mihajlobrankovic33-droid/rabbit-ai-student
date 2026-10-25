import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/services/study/i18n";
import { toast } from "sonner";
import { Loader2, Send, Share2, UserPlus } from "lucide-react";
import {
  getContacts,
  sendMessage,
  type Contact,
} from "@/services/study/messagesService";
import { getCurrentUserId } from "@/services/study/notesService";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is being shared, e.g. "Matematika — Integrali" or "Odgovor AI". */
  title: string;
  /** Markdown content of the puskice / AI answer. */
  content: string;
}

/**
 * "Deli" picker — used from the puskice result bubble and from AI answers
 * in the chat. Picks a friend (added via their 6-char code) and sends the
 * content to them as a "share" message.
 */
export function ShareDialog({ open, onOpenChange, title, content }: ShareDialogProps) {
  const { t } = useI18n();
  const me = getCurrentUserId();
  const [contacts, setContacts] = useState<Contact[]>(() => getContacts(me));
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (next) setContacts(getContacts(me));
    onOpenChange(next);
  };

  const handleShare = async (contact: Contact) => {
    if (busyId) return;
    setBusyId(contact.userId);
    try {
      await sendMessage({
        from: me,
        to: contact.userId,
        text: content,
        kind: "share",
        title: title || t("shared"),
      });
      toast.success(`${t("shared")}: ${contact.name}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("shareFailed"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4 text-primary" />
            {t("share")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {title ? `“${title}”` : t("share")}
          </DialogDescription>
        </DialogHeader>

        {contacts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-center">
            <UserPlus className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{t("noContacts")}</p>
          </div>
        ) : (
          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
            {contacts.map((c) => (
              <button
                key={c.userId}
                type="button"
                disabled={!!busyId}
                onClick={() => handleShare(c)}
                className="flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-left transition-all hover:border-primary/50 hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-foreground">
                    {c.name}
                  </span>
                  <span className="block text-[11px] font-semibold tracking-wider text-muted-foreground">
                    {c.code}
                  </span>
                </span>
                {busyId === c.userId ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <Send className="h-4 w-4 shrink-0 text-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
