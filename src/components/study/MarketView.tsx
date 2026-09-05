import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Download,
  FileCheck,
  FileText,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { saveNote } from "@/services/study/notesService";
import {
  deleteMarketNote,
  downloadMarketNotePdf,
  getMarketNotes,
  parsePdfFile,
  publishMarketNote,
  toggleUpvoteMarketNote,
  type ParsedPdfData,
} from "@/services/study/marketService";
import type { AIVerificationResult, MarketNote, Note } from "@/types/study";
import { toast } from "sonner";

interface MarketViewProps {
  onOpenNotesStudio?: () => void;
}

const SUBJECT_CATEGORIES = [
  "Sve Oblasti",
  "Matematika",
  "Informatika & IT",
  "Biologija & Medicina",
  "Fizika & Tehnika",
  "Ekonomija & Biznis",
  "Društvene Nauke",
  "Jezici & Književnost",
];

export function MarketView({ onOpenNotesStudio }: MarketViewProps) {
  const { user } = useAuth();

  const [notes, setNotes] = useState<MarketNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("Sve Oblasti");
  const [sortBy, setSortBy] = useState<"popular" | "newest" | "pages" | "score">("popular");

  // Upload Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStage, setVerificationStage] = useState<string>("");
  const [verificationResult, setVerificationResult] = useState<AIVerificationResult | null>(null);

  // Form inputs
  const [formTitle, setFormTitle] = useState("");
  const [formSubject, setFormSubject] = useState("Matematika");
  const [formAuthor, setFormAuthor] = useState(user?.name || user?.email?.split("@")[0] || "Student");
  const [formDescription, setFormDescription] = useState("");
  const [formTags, setFormTags] = useState("");
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [parsedPdf, setParsedPdf] = useState<ParsedPdfData | null>(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);

  // Detail Modal State
  const [detailModalNote, setDetailModalNote] = useState<MarketNote | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMarketNotes();
      setNotes(data);
    } catch (err) {
      console.error("Failed to load market notes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Keep formAuthor in sync with user profile
  useEffect(() => {
    if (user?.name) {
      setFormAuthor(user.name);
    }
  }, [user?.name]);

  // Listen for real-time profile updates & market notes updates
  useEffect(() => {
    const handleProfileUpdate = (e: Event) => {
      const customEvt = e as CustomEvent<{ id?: string; name?: string; avatar?: string }>;
      const updatedUser = customEvt.detail;
      if (updatedUser && updatedUser.name) {
        setNotes((prev) =>
          prev.map((n) => {
            if (n.authorId === (updatedUser.id || user?.id)) {
              return {
                ...n,
                authorName: updatedUser.name || n.authorName,
                authorAvatar: updatedUser.avatar !== undefined ? updatedUser.avatar : n.authorAvatar,
              };
            }
            return n;
          })
        );
      } else {
        fetchNotes();
      }
    };

    const handleMarketUpdated = () => {
      fetchNotes();
    };

    window.addEventListener("study_buddy_profile_updated", handleProfileUpdate);
    window.addEventListener("market-notes-updated", handleMarketUpdated);

    return () => {
      window.removeEventListener("study_buddy_profile_updated", handleProfileUpdate);
      window.removeEventListener("market-notes-updated", handleMarketUpdated);
    };
  }, [fetchNotes, user?.id]);

  // Handle PDF file selection & instant parsing (supports 300+ pages)
  const handlePdfSelected = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      toast.error("Greška: Dozvoljeno je postavljanje isključivo PDF fajlova (.pdf)!");
      return;
    }

    setSelectedPdfFile(file);
    setIsParsingPdf(true);
    setVerificationResult(null);

    try {
      const parsed = await parsePdfFile(file);
      setParsedPdf(parsed);
      if (!formTitle) {
        // Pre-fill title from clean filename
        const cleanName = file.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ");
        setFormTitle(cleanName);
      }
      toast.success(
        `PDF uspešno učitan: ${parsed.pageCount} strana (${(file.size / (1024 * 1024)).toFixed(1)} MB)`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Greška pri čitanju PDF fajla";
      toast.error(msg);
      setSelectedPdfFile(null);
    } finally {
      setIsParsingPdf(false);
    }
  };

  // Run AI Verification & Submit
  const handleVerifyAndPublish = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPdfFile || !parsedPdf) {
      toast.error("Molimo izaberite PDF fajl za objavu.");
      return;
    }
    if (!formTitle.trim()) {
      toast.error("Unesite naslov beleški.");
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      // 1. Stage 1: Text sampling & multi-page scan
      setVerificationStage(`Analiza ${parsedPdf.pageCount} strana i uzorkovanje ključnih lekcija...`);
      await new Promise((r) => setTimeout(r, 600));

      // 2. Stage 2: AI Fact-checking & theorem verification
      setVerificationStage("AI provera matematičke i naučne tačnosti, formula i definicija...");
      const { verifyPdfNotesWithAI } = await import("@/services/study/marketService");
      const audit = await verifyPdfNotesWithAI(formTitle, formSubject, parsedPdf);
      setVerificationResult(audit);

      // 3. Decision
      if (audit.status === "approved" && audit.verified) {
        // Create new market note
        const newNote: MarketNote = {
          id: `market-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: formTitle.trim(),
          subject: formSubject,
          authorId: user?.id || "student-guest",
          authorName: formAuthor.trim() || user?.name || "Student",
          authorAvatar: user?.avatar,
          description: formDescription.trim() || `Ispitna skripta i beleške (${parsedPdf.pageCount} str.)`,
          fileName: selectedPdfFile.name,
          fileSize: selectedPdfFile.size,
          pageCount: parsedPdf.pageCount,
          pdfDataUrl: parsedPdf.dataUrl,
          verification: audit,
          upvotes: 1,
          upvotedBy: [user?.id || "student-guest"],
          downloadsCount: 0,
          tags: formTags
            ? formTags.split(",").map((t) => t.trim()).filter(Boolean)
            : [formSubject, "PDF Skripta"],
          createdAt: new Date().toISOString(),
        };

        await publishMarketNote(newNote);
        await fetchNotes();
        toast.success("Čestitamo! AI je odobrio skriptu i objavio je na Tržištu.");
      } else {
        toast.error("AI provera nije odobrila skriptu zbog uočenih netačnosti.");
      }
    } catch (err: unknown) {
      console.error("Verification failed:", err);
      toast.error("Došlo je do greške tokom AI verifikacije.");
    } finally {
      setIsVerifying(false);
      setVerificationStage("");
    }
  };

  const handleUpvote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await toggleUpvoteMarketNote(noteId);
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, upvotes: res.upvotes } : n))
      );
      if (res.hasUpvoted) {
        toast.success("Glas dodat!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveToMyLibrary = (note: MarketNote, e: React.MouseEvent) => {
    e.stopPropagation();
    const topics = Array.isArray(note.verification?.topicsCovered)
      ? note.verification.topicsCovered
      : [note.subject || note.title, "Ispitna skripta i analiza", "Verifikovani ispitni materijal"];

    const myNote: Note = {
      id: `saved-${Date.now()}`,
      title: note.title,
      topic: note.subject,
      content: {
        title: note.title,
        keyPoints: topics,
        summary: note.description || `${note.title} - verifikovana skripta`,
        fullNotes: `### ${note.title}\n\n**Autor:** ${note.authorName}\n**Obim:** ${note.pageCount} strana\n**AI Ocena Tačnosti:** ${note.verification?.accuracyScore ?? 100}/100\n\n${note.verification?.verdictSummary || ""}`,
      },
      createdAt: new Date().toISOString(),
    };
    saveNote(myNote);
    toast.success(`Skripta "${note.title}" dodata u tvoju ličnu biblioteku!`);
  };

  const handleDeleteMarketNote = async (noteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await deleteMarketNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (detailModalNote?.id === noteId) {
        setDetailModalNote(null);
      }
      toast.success("Beleška je uspešno uklonjena sa Tržišta");
    } catch {
      toast.error("Greška pri brisanju sa Tržišta");
    }
  };

  // Filtered and sorted notes
  const filteredNotes = useMemo(() => {
    return notes
      .filter((n) => {
        const matchesQuery =
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.authorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesSubject =
          selectedSubject === "Sve Oblasti" ||
          n.subject.toLowerCase() === selectedSubject.toLowerCase();

        return matchesQuery && matchesSubject;
      })
      .sort((a, b) => {
        if (sortBy === "popular") return b.upvotes - a.upvotes;
        if (sortBy === "newest")
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === "pages") return b.pageCount - a.pageCount;
        if (sortBy === "score")
          return b.verification.accuracyScore - a.verification.accuracyScore;
        return 0;
      });
  }, [notes, searchQuery, selectedSubject, sortBy]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner / Marketplace Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-primary/10 via-card to-background p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-extrabold text-primary">
              <ShieldCheck className="h-4 w-4" />
              <span>AI Verifikovano Tržište Skripti</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Studentska Berza Beleški & Skripti (Samo PDF)
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Deli i preuzimaj ispitne skripte do <span className="font-bold text-foreground">300+ strana</span>.
              Svaki PDF prolazi automatsku <span className="font-bold text-primary">AI akademsku proveru tačnosti</span> pre objave. Netačne skripte se odbijaju.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {onOpenNotesStudio && (
              <Button
                type="button"
                variant="outline"
                onClick={onOpenNotesStudio}
                className="gap-2 rounded-2xl px-4 py-3 text-xs sm:text-sm font-bold border-border/80"
              >
                <span>Otvori Studio</span>
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                setVerificationResult(null);
                setUploadModalOpen(true);
              }}
              className="gap-2 rounded-2xl px-5 py-3 text-xs sm:text-sm font-extrabold shadow-md hover:scale-102 transition-transform"
            >
              <Plus className="h-4 w-4" />
              <span>Postavi PDF Skriptu</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Search, Filter Category Chips & Controls */}
      <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-2xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pretraži skripte po nazivu, temi, predmetu ili fakultetu..."
              className="w-full rounded-xl border border-border/70 bg-background/80 py-2 pl-10 pr-4 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-muted-foreground">Sortiraj:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "popular" | "newest" | "pages" | "score")}
              className="rounded-xl border border-border/70 bg-background py-1.5 px-3 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
            >
              <option value="popular">Najviše Glasova ⭐</option>
              <option value="newest">Najnovije 🕒</option>
              <option value="pages">Najobimnije (Strane) 📄</option>
              <option value="score">Najveća AI Ocena 🎯</option>
            </select>
          </div>
        </div>

        {/* Subject Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none">
          {SUBJECT_CATEGORIES.map((cat) => {
            const isSelected = selectedSubject === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedSubject(cat)}
                className={`cursor-pointer whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "border border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Market Cards Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-xs font-semibold text-muted-foreground">
            Učitavanje verifikovanih PDF skripti sa Tržišta...
          </p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/80 bg-card p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
            <FileText className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">Nema pronađenih skripti</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Pokušaj sa drugačijim terminom pretrage ili budi prvi student koji će postaviti verifikovanu PDF skriptu za ovu oblast!
          </p>
          <Button
            type="button"
            onClick={() => setUploadModalOpen(true)}
            className="mt-4 gap-2 rounded-xl text-xs font-bold"
          >
            <Plus className="h-4 w-4" />
            Objavi Prvi PDF
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              onClick={() => setDetailModalNote(note)}
              className="group relative flex flex-col justify-between rounded-2xl border border-border/75 bg-card p-5 shadow-2xs transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
            >
              <div>
                {/* Badges: Subject, Page count, AI Accuracy */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary truncate max-w-[140px]">
                    {note.subject}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground">
                      <FileText className="h-3 w-3 text-primary" />
                      {note.pageCount} str.
                    </span>

                    <span
                      className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-extrabold ${
                        note.verification.accuracyScore >= 90
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30"
                          : "bg-primary/15 text-primary"
                      }`}
                      title={`AI Tačnost: ${note.verification.accuracyScore}/100`}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {note.verification.accuracyScore}%
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-extrabold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                  {note.title}
                </h3>

                {/* Author info with Avatar & Name */}
                {(() => {
                  const isCurrentUser = Boolean(user?.id && note.authorId === user.id);
                  const authorDisplayName = isCurrentUser ? (user?.name || note.authorName) : note.authorName;
                  const authorAvatarPic = isCurrentUser ? (user?.avatar !== undefined ? user.avatar : note.authorAvatar) : note.authorAvatar;
                  const isEmoji = Boolean(authorAvatarPic && authorAvatarPic.length <= 4 && !authorAvatarPic.startsWith("data:"));
                  const authorInitials = authorDisplayName
                    .split(/\s+/)
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <div className="mt-2.5 flex items-center gap-2">
                      {authorAvatarPic && !isEmoji ? (
                        <img
                          src={authorAvatarPic}
                          alt={authorDisplayName}
                          className="h-5 w-5 rounded-md object-cover ring-1 ring-border/80 shrink-0"
                        />
                      ) : isEmoji ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-xs shrink-0">
                          {authorAvatarPic}
                        </span>
                      ) : (
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/15 text-[9px] font-black text-primary shrink-0">
                          {authorInitials || "S"}
                        </span>
                      )}
                      <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5 min-w-0">
                        <span className="shrink-0">Autor:</span>
                        <span className="font-semibold text-foreground truncate">{authorDisplayName}</span>
                        {isCurrentUser && (
                          <span className="rounded-sm bg-primary/15 px-1 py-0.2 text-[9px] font-extrabold text-primary shrink-0">
                            Ti
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })()}

                {/* Description */}
                <p className="mt-2.5 text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {note.description}
                </p>

                {/* Topics / Tags preview */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {note.verification.topicsCovered.slice(0, 3).map((topic, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground"
                    >
                      {topic}
                    </span>
                  ))}
                  {note.verification.topicsCovered.length > 3 && (
                    <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                      +{note.verification.topicsCovered.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Card Footer: Upvote & Action Buttons */}
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                <button
                  type="button"
                  onClick={(e) => handleUpvote(note.id, e)}
                  className="flex items-center gap-1.5 rounded-xl bg-muted/40 px-2.5 py-1 text-xs font-bold text-foreground transition-all hover:bg-primary/15 hover:text-primary"
                  title="Glasaj za ovu skriptu"
                >
                  <ThumbsUp className="h-3.5 w-3.5 text-primary" />
                  <span>{note.upvotes}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => handleSaveToMyLibrary(note, e)}
                    className="cursor-pointer rounded-xl border border-border/70 bg-card p-1.5 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    title="Dodaj u ličnu biblioteku"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteMarketNote(note.id, e)}
                    className="cursor-pointer rounded-xl border border-border/70 bg-card p-1.5 text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                    title="Ukloni skriptu sa Tržišta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentAuthor = note.authorId === user?.id ? (user?.name || note.authorName) : note.authorName;
                      downloadMarketNotePdf(note, currentAuthor);
                      toast.success(`Preuzimanje "${note.fileName}" započeto.`);
                    }}
                    className="flex cursor-pointer items-center gap-1 rounded-xl bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground transition-all hover:bg-primary/90 shadow-2xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Preuzmi</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 1. UPLOAD & POST PDF NOTE MODAL (With Rigorous AI Verification) */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="relative w-full max-w-2xl rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xl overflow-y-auto max-h-[90vh] duration-200 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-foreground">
                    Postavi PDF Skriptu na Tržište
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Dozvoljeni isključivo PDF fajlovi (do 300+ strana). AI vrši proveru tačnosti.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => setUploadModalOpen(false)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* AI Verification Active State */}
            {isVerifying ? (
              <div className="py-12 text-center space-y-4">
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/15 text-primary">
                  <Sparkles className="h-8 w-8 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-foreground">
                    AI Akademska Verifikacija u toku...
                  </h3>
                  <p className="text-xs text-primary font-semibold animate-pulse">
                    {verificationStage || "Analiziranje i provera tačnosti lekcija..."}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                  AI inspektor proverava matematičke teoreme, formule, tačnost pojmova i odsustvo grešaka. Molimo sačekajte.
                </p>
              </div>
            ) : verificationResult && !verificationResult.verified ? (
              /* REJECTED STATE: Clear Feedback to Student */
              <div className="py-6 space-y-4">
                <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-destructive space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertCircle className="h-5 w-5" />
                    <span>AI je Odbio Objavu (Ocena Tačnosti: {verificationResult.accuracyScore}/100)</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    {verificationResult.verdictSummary}
                  </p>
                </div>

                {verificationResult.correctionsOrIssues.length > 0 && (
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-2">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Uočeni Problemi i Preporuke za Ispravku:
                    </h4>
                    <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-5">
                      {verificationResult.correctionsOrIssues.map((issue, idx) => (
                        <li key={idx} className="leading-snug">{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setVerificationResult(null)}
                    className="rounded-xl text-xs"
                  >
                    Izaberi Drugi PDF / Pokušaj Ponovo
                  </Button>
                </div>
              </div>
            ) : verificationResult && verificationResult.verified ? (
              /* APPROVED STATE: Success Summary */
              <div className="py-6 space-y-4">
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>AI je Uspešno Odobrio Skriptu! (Ocena: {verificationResult.accuracyScore}/100)</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    {verificationResult.verdictSummary}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-2">
                  <h4 className="text-xs font-bold text-foreground">Pokrivena Poglavlja:</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {verificationResult.topicsCovered.map((t, i) => (
                      <span key={i} className="rounded-lg bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setUploadModalOpen(false);
                      setVerificationResult(null);
                    }}
                    className="rounded-xl text-xs font-bold"
                  >
                    Završi i Pogledaj na Tržištu
                  </Button>
                </div>
              </div>
            ) : (
              /* UPLOAD FORM */
              <form onSubmit={handleVerifyAndPublish} className="mt-4 space-y-4">
                {/* PDF Drag & Drop Zone */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Izaberi PDF Fajl <span className="text-primary">* (Samo .pdf, do 300+ strana)</span>
                  </label>

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handlePdfSelected(e.dataTransfer.files[0]);
                      }
                    }}
                    className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
                  >
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handlePdfSelected(e.target.files[0]);
                        }
                      }}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />

                    {isParsingPdf ? (
                      <div className="space-y-2">
                        <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
                        <p className="text-xs font-semibold text-foreground">
                          Skeniranje stranica i strukture PDF-a...
                        </p>
                      </div>
                    ) : selectedPdfFile && parsedPdf ? (
                      <div className="flex items-center gap-3 text-left">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                          <FileCheck className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground line-clamp-1">
                            {selectedPdfFile.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {parsedPdf.pageCount} strana • {(selectedPdfFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto h-7 w-7 text-muted-foreground mb-2" />
                        <p className="text-xs font-bold text-foreground">
                          Prevucite PDF ovde ili kliknite za izbor sa računara
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Podržava velike ispitne skripte, udžbenike i sažetke lekcija
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Title & Subject */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      Naslov Skripte / Predmeta *
                    </label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="npr. Matematička Analiza 2 - Kompletan ispit"
                      className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      Oblast / Predmet *
                    </label>
                    <select
                      value={formSubject}
                      onChange={(e) => setFormSubject(e.target.value)}
                      className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                    >
                      {SUBJECT_CATEGORIES.filter((c) => c !== "Sve Oblasti").map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Author & Tags */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      Autor / Fakultet
                    </label>
                    <input
                      type="text"
                      value={formAuthor}
                      onChange={(e) => setFormAuthor(e.target.value)}
                      placeholder="npr. Marko N. (ETF / PMF)"
                      className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      Oznake (odvojene zarezom)
                    </label>
                    <input
                      type="text"
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                      placeholder="npr. Kolokvijum, Integrali, Zadaci"
                      className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Kratak Opis i Sadržaj
                  </label>
                  <textarea
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Opišite šta skripta sadrži, koja poglavlja pokriva, da li ima rešene zadatke..."
                    className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setUploadModalOpen(false)}
                    className="rounded-xl text-xs"
                  >
                    Otkaži
                  </Button>
                  <Button
                    type="submit"
                    disabled={!selectedPdfFile || isParsingPdf}
                    className="gap-2 rounded-xl text-xs font-extrabold shadow-sm"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Pokreni AI Verifikaciju & Objavi</span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 2. DETAIL MODAL: View Full AI Audit & Note Overview */}
      {detailModalNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="relative w-full max-w-2xl rounded-3xl border border-border/80 bg-card p-6 shadow-2xl overflow-y-auto max-h-[90vh] duration-200 animate-in zoom-in-95 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border/60 pb-4">
              <div className="space-y-1">
                <span className="rounded-lg bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                  {detailModalNote.subject}
                </span>
                <h2 className="text-lg font-extrabold text-foreground leading-snug">
                  {detailModalNote.title}
                </h2>
                {(() => {
                  const isCurrentUser = Boolean(user?.id && detailModalNote.authorId === user.id);
                  const detailAuthor = isCurrentUser ? (user?.name || detailModalNote.authorName) : detailModalNote.authorName;
                  const detailAvatar = isCurrentUser ? (user?.avatar !== undefined ? user.avatar : detailModalNote.authorAvatar) : detailModalNote.authorAvatar;
                  const isEmoji = Boolean(detailAvatar && detailAvatar.length <= 4 && !detailAvatar.startsWith("data:"));
                  const detailInitials = detailAuthor
                    .split(/\s+/)
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <div className="flex items-center gap-2 pt-1">
                      {detailAvatar && !isEmoji ? (
                        <img
                          src={detailAvatar}
                          alt={detailAuthor}
                          className="h-6 w-6 rounded-md object-cover ring-1 ring-border"
                        />
                      ) : isEmoji ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-sm">
                          {detailAvatar}
                        </span>
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-[10px] font-black text-primary">
                          {detailInitials || "S"}
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        <span>Objavio:</span>
                        <span className="font-semibold text-foreground">{detailAuthor}</span>
                        {isCurrentUser && (
                          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-extrabold text-primary">
                            Tvoj nalog
                          </span>
                        )}
                        <span>• Obim: {detailModalNote.pageCount} strana • {new Date(detailModalNote.createdAt).toLocaleDateString()}</span>
                      </p>
                    </div>
                  );
                })()}
              </div>
              <button
                type="button"
                onClick={() => setDetailModalNote(null)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* AI Verification Certificate Box */}
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-extrabold text-sm">
                  <ShieldCheck className="h-5 w-5" />
                  <span>AI Akademski Sertifikat Tačnosti</span>
                </div>
                <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-black text-white">
                  {detailModalNote.verification.accuracyScore}/100 Tačno
                </span>
              </div>
              <p className="text-xs leading-relaxed text-emerald-950 dark:text-emerald-100">
                {detailModalNote.verification.verdictSummary}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Opis i Sadržaj
              </h3>
              <p className="text-xs leading-relaxed text-foreground whitespace-pre-line">
                {detailModalNote.description}
              </p>
            </div>

            {/* Topics Covered */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Potvrđena Poglavlja ({detailModalNote.verification.topicsCovered.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {detailModalNote.verification.topicsCovered.map((topic, i) => (
                  <span key={i} className="rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-semibold text-foreground">
                    {topic}
                  </span>
                ))}
              </div>
            </div>

            {/* Strengths */}
            {detailModalNote.verification.strengths && detailModalNote.verification.strengths.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Glavne Prednosti Skripte
                </h3>
                <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-5">
                  {detailModalNote.verification.strengths.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => handleUpvote(detailModalNote.id, e)}
                  className="flex items-center gap-1.5 rounded-xl border border-border/70 px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
                >
                  <ThumbsUp className="h-4 w-4 text-primary" />
                  <span>Glasaj ({detailModalNote.upvotes})</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    handleDeleteMarketNote(detailModalNote.id, e);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/20 transition-colors"
                  title="Obriši ovu skriptu sa Tržišta"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Obriši</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    handleSaveToMyLibrary(detailModalNote, e);
                  }}
                  className="gap-1.5 rounded-xl text-xs font-bold"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Sačuvaj u Biblioteku</span>
                </Button>

                <Button
                  type="button"
                  onClick={() => {
                    const currentAuthor = detailModalNote.authorId === user?.id ? (user?.name || detailModalNote.authorName) : detailModalNote.authorName;
                    downloadMarketNotePdf(detailModalNote, currentAuthor);
                    toast.success(`Preuzimanje "${detailModalNote.fileName}" započeto.`);
                  }}
                  className="gap-1.5 rounded-xl text-xs font-extrabold shadow-sm"
                >
                  <Download className="h-4 w-4" />
                  <span>Preuzmi PDF ({detailModalNote.pageCount} str.)</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
