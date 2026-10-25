import React, { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  ArrowLeft,
  Copy,
  Loader2,
  MessageSquare,
  Send,
  Share2,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/services/study/i18n";
import {
  addContact,
  fetchInbox,
  fetchThread,
  getContacts,
  lookupCode,
  lookupUser,
  MAX_CONTACTS,
  registerCode,
  removeContact,
  sendMessage,
  type Contact,
  type Message,
} from "@/services/study/messagesService";
import { getCurrentUserId } from "@/services/study/notesService";
import {
  isCloudUserId,
  isSupabaseConfigured,
} from "@/services/study/supabaseClient";

interface MessagesViewProps {
  userId?: string;
  userName?: string;
}

function MessageBubble({
  msg,
  mine,
  sharedLabel,
}: {
  msg: Message;
  mine: boolean;
  sharedLabel: string;
}) {
  const isShare = msg.kind === "share";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
          mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        }`}
      >
        {isShare && (
          <div
            className={`mb-1.5 flex items-center gap-1.5 rounded-xl border px-2 py-1 text-[11px] font-bold ${
              mine
                ? "border-primary-foreground/30 bg-primary-foreground/10"
                : "border-primary/30 bg-primary/10 text-primary"
            }`}
          >
            <Share2 className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {sharedLabel}
              {msg.title ? `: ${msg.title}` : ""}
            </span>
          </div>
        )}

        {isShare ? (
          <div className="markdown-chat-content max-h-60 overflow-y-auto rounded-xl bg-background/40 p-2 text-xs">
            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {msg.text}
            </Markdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
        )}

        <div
          className={`mt-1 text-right text-[10px] ${
            mine ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          {new Date(msg.createdAt).toLocaleTimeString("sr-RS", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}

export function MessagesView({ userId, userName }: MessagesViewProps) {
  const { t } = useI18n();
  const me = userId || getCurrentUserId();

  const [myCode, setMyCode] = useState("");
  const [registering, setRegistering] = useState(true);

  const [contacts, setContacts] = useState<Contact[]>(() => getContacts(me));
  const [codeInput, setCodeInput] = useState("");
  const [adding, setAdding] = useState(false);

  const [activePeer, setActivePeer] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<string>("");
  const contactsRef = useRef<Contact[]>(contacts);
  contactsRef.current = contacts;

  // 1) Get (or create) my 6-char code
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await registerCode(me, userName || "Učenik");
        if (alive) setMyCode(res.code);
      } catch (err) {
        if (alive) {
          toast.error(err instanceof Error ? err.message : t("codeCreateErr"));
        }
      } finally {
        if (alive) setRegistering(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [me, userName, t]);

  // 2) Discover people who messaged me (resolve them into my contacts)
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const fresh = await fetchInbox(me, lastSeenRef.current);
        if (!alive || fresh.length === 0) return;
        lastSeenRef.current = fresh[fresh.length - 1].createdAt;

        const known = new Set(contactsRef.current.map((c) => c.userId));
        const unknown = [...new Set(fresh.map((m) => m.from))].filter(
          (id) => id !== me && !known.has(id)
        );
        for (const id of unknown) {
          const profile = await lookupUser(id);
          if (profile && alive) {
            addContact(
              { ...profile, addedAt: new Date().toISOString() },
              me
            );
          }
        }
        if (alive && unknown.length > 0) setContacts(getContacts(me));
      } catch {
        // polling is best-effort
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [me]);

  // 3) Live thread with the selected friend (refresh every 4s)
  useEffect(() => {
    if (!activePeer) {
      setMessages([]);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const list = await fetchThread(me, activePeer.userId);
        if (alive) setMessages(list);
      } catch {
        // transient network error — keep the previous messages
      }
    };
    load();
    const id = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [me, activePeer]);

  // Keep the conversation scrolled to the newest message
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleAddContact = useCallback(async () => {
    const code = codeInput.trim().toUpperCase();
    if (code.length !== 6) {
      toast.error(t("codeLengthErr"));
      return;
    }
    if (myCode && code === myCode) {
      toast.error(t("ownCodeErr"));
      return;
    }
    if (contacts.length >= MAX_CONTACTS) {
      toast.error(t("maxFriends"));
      return;
    }
    setAdding(true);
    try {
      const profile = await lookupCode(code, me);
      const saved = addContact(
        { ...profile, addedAt: new Date().toISOString() },
        me
      );
      if (!saved) {
        toast.error(t("maxFriends"));
        return;
      }
      setContacts(getContacts(me));
      setCodeInput("");
      toast.success(`${t("contactAdded")}: ${profile.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("codeNotFound"));
    } finally {
      setAdding(false);
    }
  }, [codeInput, myCode, contacts, me, t]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !activePeer || sending) return;
    setSending(true);
    try {
      const sent = await sendMessage({ from: me, to: activePeer.userId, text });
      setMessages((prev) => [...prev, sent]);
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("sendFailed"));
    } finally {
      setSending(false);
    }
  }, [draft, activePeer, sending, me, t]);

  const handleCopyCode = useCallback(() => {
    if (!myCode) return;
    navigator.clipboard.writeText(myCode);
    toast.success(t("copied"));
  }, [myCode, t]);

  const handleRemoveContact = useCallback(
    (contact: Contact) => {
      removeContact(contact.userId, me);
      setContacts(getContacts(me));
      if (activePeer?.userId === contact.userId) setActivePeer(null);
      toast(t("contactRemoved"));
    },
    [me, activePeer, t]
  );

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* ── My code + add friend ───────────────────────────── */}
      <section className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("myCode")}
            </span>
            <span className="mt-0.5 block text-2xl font-extrabold tracking-[0.25em] text-primary sm:text-3xl">
              {registering ? "······" : myCode || "······"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            disabled={!myCode}
            className="flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl border border-border/70 bg-muted/50 px-3.5 py-2 text-xs font-bold text-foreground transition-all hover:border-primary/50 hover:text-primary disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" />
            {t("copy")}
          </button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">{t("codeHint")}</p>

        {/* Nudge: guests keep messages on this device only */}
        {isSupabaseConfigured && !isCloudUserId(me) && (
          <p className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
            {t("signInToSave")}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={codeInput}
            onChange={(e) =>
              setCodeInput(e.target.value.toUpperCase().slice(0, 6))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddContact();
            }}
            placeholder={t("codePlaceholder")}
            maxLength={6}
            disabled={adding}
            className="min-h-[48px] w-full min-w-0 rounded-2xl border border-border/70 bg-muted/40 px-4 text-base md:text-sm font-bold uppercase tracking-[0.2em] text-foreground outline-none transition-colors placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground focus:border-primary/60 focus:bg-background"
          />
          <button
            type="button"
            onClick={handleAddContact}
            disabled={adding || codeInput.trim().length !== 6}
            className="flex min-h-[48px] shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {t("addFriend")}
          </button>
        </div>
      </section>

      {/* ── Conversation / contact list ─────────────────────── */}
      {activePeer ? (
        <section className="flex flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-md">
          <header className="flex items-center gap-2 border-b border-border/70 bg-muted/30 p-2.5 sm:p-3">
            <button
              type="button"
              onClick={() => setActivePeer(null)}
              className="flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={t("backToList")}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-extrabold text-foreground">
                {activePeer.name}
              </div>
              <div className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                {activePeer.code}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleRemoveContact(activePeer)}
              className="flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
              title={t("removeContactTitle")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={listRef}
            className="flex max-h-[45vh] min-h-[180px] flex-col gap-2 overflow-y-auto p-3 sm:max-h-[52vh]"
          >
            {messages.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {t("emptyThread")}
              </p>
            ) : (
              messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  mine={m.from === me}
                  sharedLabel={t("shared")}
                />
              ))
            )}
          </div>

          <div className="flex gap-2 border-t border-border/70 p-2.5 sm:p-3">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder={t("typeMessage")}
              disabled={sending}
              className="min-h-[48px] w-full min-w-0 flex-1 rounded-2xl border border-border/70 bg-muted/40 px-4 text-base md:text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:bg-background"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="flex min-h-[48px] min-w-[48px] shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              title={t("sendMsg")}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-md">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t("messagesTab")} ({contacts.length}/{MAX_CONTACTS})
          </h3>

          {contacts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-7 text-center">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{t("noContacts")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {contacts.map((c) => (
                <button
                  key={c.userId}
                  type="button"
                  onClick={() => setActivePeer(c)}
                  className="flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3 text-left transition-all hover:border-primary/40 hover:bg-muted/60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-extrabold text-primary">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-foreground">
                      {c.name}
                    </span>
                    <span className="block text-[11px] font-semibold tracking-wider text-muted-foreground">
                      {c.code}
                    </span>
                  </span>
                  <Send className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
