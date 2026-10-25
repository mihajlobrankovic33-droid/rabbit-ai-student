import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Share2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/services/study/i18n";
import { ShareDialog } from "@/components/study/ShareDialog";
import {
  deletePuskice,
  deletePuskiceCloud,
  fetchBatchDigest,
  fetchFinalPuskice,
  getPuskice,
  loadPuskice,
  newPuskiceId,
  savePuskice,
  savePuskiceCloud,
  type Puskice,
  type UploadImage,
} from "@/services/study/puskiceService";
import { getCurrentUserId } from "@/services/study/notesService";

/** Hard limits agreed with the user. */
const MAX_IMAGES = 330;
const MAX_PDF_BYTES = 9.5 * 1024 * 1024; // ~13MB base64 → safely under Gemini's 20MB inline cap
const IMAGES_PER_BATCH = 10;
const CONCURRENCY = 2;

interface PuskiceViewProps {
  userId?: string;
}

/** Downscale + JPEG-compress one image to base64 (keeps memory low for 330 files). */
async function compressImage(file: File): Promise<UploadImage> {
  const maxDim = 1400;
  let source: ImageBitmap | HTMLImageElement;

  try {
    source = await createImageBitmap(file);
  } catch {
    // Fallback for formats createImageBitmap can't decode
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Ne mogu da otvorim sliku: ${file.name}`));
      };
      img.src = url;
    });
  }

  const srcW = "width" in source ? source.width : 0;
  const srcH = "height" in source ? source.height : 0;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH, 1));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nije dostupan u ovom browseru.");
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  if ("close" in source) source.close();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  return {
    data: dataUrl.slice(dataUrl.indexOf(",") + 1),
    mimeType: "image/jpeg",
  };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error(`Ne mogu da pročitam ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function PuskiceView({ userId }: PuskiceViewProps) {
  const { t } = useI18n();
  const currentUserId = userId || getCurrentUserId();

  const [subject, setSubject] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });

  const [result, setResult] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [saved, setSaved] = useState<Puskice[]>(() => getPuskice(currentUserId));

  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const hasFiles = imageFiles.length > 0 || pdfFile !== null;
  const fileCount = imageFiles.length + (pdfFile ? 1 : 0);

  const refreshSaved = useCallback(async () => {
    setSaved(await loadPuskice(currentUserId));
  }, [currentUserId]);

  // Load saved puškice — from the cloud when signed in, local cache otherwise
  useEffect(() => {
    let alive = true;
    loadPuskice(currentUserId)
      .then((list) => {
        if (alive) setSaved(list);
      })
      .catch((err) => console.warn("Puškice load failed:", err));
    return () => {
      alive = false;
    };
  }, [currentUserId]);

  const acceptFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      const pdfs = list.filter(
        (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
      );
      const imgs = list.filter((f) => f.type.startsWith("image/"));

      if (pdfs.length > 1) {
        toast.info("Možeš priložiti najviše jedan PDF — uzeo sam prvi.");
      }

      let nextPdf: File | null = pdfs[0] ?? null;
      if (nextPdf && nextPdf.size > MAX_PDF_BYTES) {
        toast.error("PDF je prevelik (limit je 9.5 MB / oko 30 strana).");
        nextPdf = null;
      }

      setImageFiles((prev) => {
        const merged = [...prev, ...imgs];
        if (merged.length > MAX_IMAGES) {
          toast.error(`Maksimalno je ${MAX_IMAGES} slika.`);
          return prev.slice(0, MAX_IMAGES);
        }
        return merged;
      });
      if (nextPdf) setPdfFile(nextPdf);

      if (imgs.length === 0 && !nextPdf) {
        toast.error("Priloži slike (JPG/PNG) ili PDF fajl.");
      }
    },
    []
  );

  const removeImage = (index: number) =>
    setImageFiles((prev) => prev.filter((_, i) => i !== index));

  const handleGenerate = useCallback(async () => {
    const cleanSubject = subject.trim();
    if (!cleanSubject) {
      toast.error("Unesi ime predmeta.");
      return;
    }
    if (!hasFiles) {
      toast.error("Priloži slike ili PDF fajl.");
      return;
    }

    setBusy(true);
    const tasks: Array<{ label: string; run: () => Promise<string> }> = [];

    if (pdfFile) {
      tasks.push({
        label: `PDF: ${pdfFile.name}`,
        run: async () => {
          const data = await readFileAsBase64(pdfFile);
          return fetchBatchDigest({
            subject: cleanSubject,
            kind: "pdf",
            part: 1,
            total: 1,
            pdf: { data },
          });
        },
      });
    }

    const chunks: File[][] = [];
    for (let i = 0; i < imageFiles.length; i += IMAGES_PER_BATCH) {
      chunks.push(imageFiles.slice(i, i + IMAGES_PER_BATCH));
    }
    chunks.forEach((chunk, i) => {
      tasks.push({
        label: `Slike ${i + 1}/${chunks.length}`,
        run: async () => {
          const images: UploadImage[] = [];
          for (const file of chunk) {
            images.push(await compressImage(file));
          }
          return fetchBatchDigest({
            subject: cleanSubject,
            kind: "images",
            part: i + 1,
            total: chunks.length,
            images,
          });
        },
      });
    });

    const totalSteps = tasks.length + 1;
    setProgress({ done: 0, total: totalSteps, label: "Priprema..." });

    try {
      let next = 0;
      const results: string[] = new Array(tasks.length);
      const failed: string[] = [];

      const worker = async () => {
        while (next < tasks.length) {
          const index = next++;
          const task = tasks[index];
          setProgress((p) => ({ ...p, label: task.label }));
          try {
            results[index] = await task.run();
          } catch (err) {
            failed.push(
              err instanceof Error ? err.message : "Greška pri obradi fajla"
            );
          }
          setProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () =>
          worker()
        )
      );

      const parts = results.filter((r) => r && r.trim());
      if (parts.length === 0) {
        throw new Error(
          failed[0] || "Nijedan fajl nije uspešno obrađen. Pokušaj ponovo."
        );
      }
      if (failed.length > 0) {
        toast.warning(`${failed.length} deo(a) nije obrađen — nastavljam sa ostatkom.`);
      }

      setProgress({
        done: totalSteps - 1,
        total: totalSteps,
        label: "Pravim puskice...",
      });
      const final = await fetchFinalPuskice(cleanSubject, parts);
      if (!final.markdown.trim()) {
        throw new Error("AI nije vratio sadržaj. Pokušaj ponovo.");
      }

      setResult(final.markdown);
      const item: Puskice = {
        id: newPuskiceId(),
        subject: cleanSubject,
        markdown: final.markdown,
        kind: pdfFile ? "pdf" : "images",
        fileCount,
        userId: currentUserId,
        createdAt: new Date().toISOString(),
      };
      savePuskice(item);
      try {
        await savePuskiceCloud(item); // keeps it on every device when signed in
      } catch (err) {
        toast.warning(
          err instanceof Error
            ? `Sačuvano lokalno, u oblak nije uspelo: ${err.message}`
            : "Sačuvano lokalno, u oblak nije uspelo."
        );
      }
      refreshSaved();
      setProgress({ done: totalSteps, total: totalSteps, label: "Gotovo!" });
      toast.success("Puškice sačuvane!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setProgress({ done: 0, total: 0, label: "" });
      toast.error(err instanceof Error ? err.message : "Nešto je pošlo naopako.");
    } finally {
      setBusy(false);
    }
  }, [subject, hasFiles, imageFiles, pdfFile, fileCount, currentUserId, refreshSaved]);

  const clearFiles = useCallback(() => {
    setImageFiles([]);
    setPdfFile(null);
  }, []);

  const openSaved = useCallback((item: Puskice) => {
    setResult(item.markdown);
    setSubject(item.subject);
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const removeSaved = useCallback(
    async (id: string) => {
      deletePuskice(id, currentUserId);
      try {
        await deletePuskiceCloud(id, currentUserId);
      } catch (err) {
        console.warn("Cloud delete failed:", err);
      }
      refreshSaved();
      toast("Puškice obrisane");
    },
    [currentUserId, refreshSaved]
  );

  const progressPercent = useMemo(
    () =>
      progress.total > 0
        ? Math.min(100, Math.round((progress.done / progress.total) * 100))
        : 0,
    [progress]
  );

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* ── Box 1: subject name ─────────────────────────────── */}
      <section className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-md">
        <label
          htmlFor="puskice-subject"
          className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          1. Ime predmeta
        </label>
        <input
          id="puskice-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="npr. Matematika — Integrali"
          maxLength={80}
          disabled={busy}
          className="w-full min-h-[48px] rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-base md:text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:bg-background"
        />
      </section>

      {/* ── Box 2: big drop zone ────────────────────────────── */}
      <section className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-md">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            2. Slike ili PDF
          </span>
          {hasFiles && (
            <button
              type="button"
              onClick={clearFiles}
              disabled={busy}
              className="flex min-h-[36px] cursor-pointer items-center gap-1 rounded-xl px-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
              Ukloni sve
            </button>
          )}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!busy) acceptFiles(e.dataTransfer.files);
          }}
          onClick={() => !busy && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !busy)
              inputRef.current?.click();
          }}
          className={`flex min-h-[170px] sm:min-h-[210px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-all ${
            dragOver
              ? "border-primary bg-primary/10 scale-[1.01]"
              : "border-border/70 bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
          }`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Upload className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              Prevuci slike ili PDF ovde
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ili klikni za izbor fajla sa uređaja
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold">
            <span className="flex items-center gap-1 rounded-full bg-muted/70 px-2.5 py-1 text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" /> do {MAX_IMAGES} slika
            </span>
            <span className="flex items-center gap-1 rounded-full bg-muted/70 px-2.5 py-1 text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> PDF do 30 strana
            </span>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) acceptFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Selected files */}
        {hasFiles && (
          <div className="mt-3 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {pdfFile && (
              <span className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary">
                <FileText className="h-3.5 w-3.5" />
                <span className="max-w-[160px] truncate">{pdfFile.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPdfFile(null);
                  }}
                  disabled={busy}
                  className="flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center -my-2 text-muted-foreground hover:text-destructive"
                  title="Ukloni PDF"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {imageFiles.map((f, i) => (
              <span
                key={`${f.name}-${i}`}
                className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-muted/50 px-2.5 py-1.5 text-xs text-foreground"
              >
                <ImageIcon className="h-3.5 w-3.5 text-primary" />
                <span className="max-w-[130px] truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(i);
                  }}
                  disabled={busy}
                  className="flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center -my-2 text-muted-foreground hover:text-destructive"
                  title="Ukloni sliku"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy || !hasFiles || !subject.trim()}
          className="mt-4 flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Obrađujem...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Napravi puskice
            </>
          )}
        </button>

        {/* Progress */}
        {busy && progress.total > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="truncate pr-2">{progress.label}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* ── Result ──────────────────────────────────────────── */}
      {result && (
        <section
          ref={resultRef}
          className="rounded-3xl border border-primary/30 bg-card p-4 sm:p-6 shadow-md"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <h2 className="truncate text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Tvoje puskice{subject.trim() ? ` — ${subject.trim()}` : ""}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="flex min-h-[40px] shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-extrabold text-primary transition-all hover:bg-primary/20"
            >
              <Share2 className="h-3.5 w-3.5" />
              {t("share")}
            </button>
          </div>
          <div className="markdown-chat-content text-sm leading-relaxed text-foreground">
            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {result}
            </Markdown>
          </div>
        </section>
      )}

      {/* ── Saved puskice ───────────────────────────────────── */}
      {saved.length > 0 && (
        <section className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-md">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Sačuvane puskice ({saved.length})
          </h3>
          <div className="flex flex-col gap-2">
            {saved.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-muted/30 p-3 transition-all hover:border-primary/40 hover:bg-muted/60"
              >
                <button
                  type="button"
                  onClick={() => openSaved(item)}
                  className="flex min-h-[44px] flex-1 min-w-0 cursor-pointer items-center gap-2.5 text-left"
                >
                  {item.kind === "pdf" ? (
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <ImageIcon className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-foreground">
                      {item.subject}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("sr-RS")} ·{" "}
                      {item.fileCount} fajl(a)
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => removeSaved(item.id)}
                  className="flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-destructive/15 hover:text-destructive"
                  title="Obriši puskice"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Share picker for the generated puskice */}
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title={subject.trim() || "Puškice"}
        content={result}
      />
    </div>
  );
}
