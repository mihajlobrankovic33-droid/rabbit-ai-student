import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import {
  Camera,
  Check,
  GraduationCap,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User as UserIcon,
} from "lucide-react";
import { syncAuthorProfileAcrossMarketNotes } from "@/services/study/marketService";
import { toast } from "sonner";

interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publishedCount?: number;
}

const PRESET_AVATARS = [
  { id: "grad", label: "Diplomac", emoji: "🎓" },
  { id: "coder", label: "Programer", emoji: "💻" },
  { id: "rocket", label: "Inženjer", emoji: "🚀" },
  { id: "atom", label: "Naučnik", emoji: "🔬" },
  { id: "brain", label: "Genije", emoji: "⚡" },
  { id: "book", label: "Knjigoljubac", emoji: "📚" },
  { id: "fox", label: "Mudra lisica", emoji: "🦊" },
  { id: "med", label: "Medicina", emoji: "🩺" },
  { id: "art", label: "Kreativac", emoji: "🎨" },
];

export function UserProfileModal({
  open,
  onOpenChange,
  publishedCount = 0,
}: UserProfileModalProps) {
  const { user, updateProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (open && user) {
      setName(user.name || user.email?.split("@")[0] || "Student");
      setAvatar(user.avatar || "");
    }
  }, [open, user]);

  const initials = (name || "Student")
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Compress & resize uploaded photo via canvas to optimize memory
  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Molimo izaberite sliku (JPG, PNG, WEBP).");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.88);
          setAvatar(compressedDataUrl);
          toast.success("Slika uspešno izabrana!");
        }
        setIsUploading(false);
      };
      img.onerror = () => {
        setIsUploading(false);
        toast.error("Greška pri obradi slike.");
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast.error("Greška pri čitanju fajla.");
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPresetAvatar = (emoji: string) => {
    setAvatar(emoji);
    toast.success(`Izabran avatar ${emoji}`);
  };

  const handleRemoveAvatar = () => {
    setAvatar("");
    toast.info("Slika profila uklonjena. Prikazivaće se inicijali.");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("Ime ne može biti prazno.");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Update user profile in auth context and localStorage
      await updateProfile({
        name: cleanName,
        avatar: avatar || "",
      });

      // 2. Synchronize all published market notes for this user to the new author name & avatar!
      if (user?.id) {
        await syncAuthorProfileAcrossMarketNotes(user.id, cleanName, avatar || "");
      }

      toast.success("Profil uspešno sačuvan!", {
        description: `Tvoje ime "${cleanName}" je automatski ažurirano na svim tvojim skriptama i PDF dokumentima.`,
      });

      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save profile:", err);
      toast.error("Došlo je do greške pri čuvanju profila.");
    } finally {
      setIsSaving(false);
    }
  };

  const isEmojiAvatar = avatar && avatar.length <= 4 && !avatar.startsWith("data:");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl border-border/80 bg-card p-6 shadow-2xl">
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <GraduationCap className="h-4 w-4" />
            <span>Korisnički Profil & Nalog</span>
          </div>
          <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
            Uredi Profil i Ime Autora
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Promeni svoje ime i profilnu sliku. Sve tvoje PDF skripte na Tržištu automatski će se ažurirati na novo ime.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-5 mt-2">
          {/* Avatar Picture Management */}
          <div className="flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-muted/30 border border-border/60">
            <div className="relative group">
              {avatar && !isEmojiAvatar ? (
                <img
                  src={avatar}
                  alt={name || "User Avatar"}
                  className="h-24 w-24 rounded-2xl object-cover ring-4 ring-primary/20 shadow-md transition-all group-hover:opacity-90"
                />
              ) : isEmojiAvatar ? (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/15 text-4xl shadow-md ring-4 ring-primary/20">
                  <span>{avatar}</span>
                </div>
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/30 text-2xl font-black text-primary shadow-md ring-4 ring-primary/20">
                  {initials || "S"}
                </div>
              )}

              {/* Quick overlay change button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110 active:scale-95"
                title="Promeni sliku sa uređaja"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-8 gap-1.5 rounded-xl text-xs font-semibold"
              >
                <Upload className="h-3.5 w-3.5 text-primary" />
                <span>Učitaj sliku</span>
              </Button>

              {avatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  className="h-8 gap-1.5 rounded-xl text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Ukloni</span>
                </Button>
              )}
            </div>

            {/* Academic Avatar Quick Pickers */}
            <div className="w-full space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-muted-foreground block text-center">
                Ili izaberi studentski avatar:
              </span>
              <div className="flex flex-wrap justify-center gap-1.5">
                {PRESET_AVATARS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPresetAvatar(preset.emoji)}
                    title={preset.label}
                    className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-base transition-all hover:scale-110 ${
                      avatar === preset.emoji
                        ? "bg-primary/20 ring-2 ring-primary scale-105"
                        : "bg-card border border-border/80 hover:bg-muted"
                    }`}
                  >
                    <span>{preset.emoji}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Name Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Tvoje Ime / Ime Autora</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                Prikazuje se na skriptama i PDF-u
              </span>
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Unesi svoje ime (npr. Mihajlo Branković)"
                className="pl-9 rounded-xl font-medium"
                maxLength={40}
                required
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Ovo ime se upisuje u sve PDF generisane dokumente i na Tržištu beleški.
            </p>
          </div>

          {/* Live Preview on Market Card */}
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Prikaz tvog autorstva na Tržištu
            </span>
            <div className="flex items-center gap-2.5 rounded-xl bg-card border border-border/70 p-2.5">
              {avatar && !isEmojiAvatar ? (
                <img
                  src={avatar}
                  alt={name}
                  className="h-8 w-8 rounded-lg object-cover ring-1 ring-border"
                />
              ) : isEmojiAvatar ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-lg">
                  {avatar}
                </span>
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-xs font-bold text-primary">
                  {initials || "S"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground">
                  {name.trim() || "Student"}
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" /> Verifikovani Autor Beleški
                </p>
              </div>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary shrink-0">
                Tvoja skripta
              </span>
            </div>
          </div>

          {/* Account Details & Stats */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1 border-t border-border/60 pt-3">
            <span>Objavljenih skripti: <strong className="text-foreground">{publishedCount}</strong></span>
            <span>ID: <code className="text-[10px] font-mono">{user?.id?.slice(0, 10) || "guest"}</code></span>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Odustani
            </Button>
            <Button
              type="submit"
              disabled={isSaving || isUploading}
              className="rounded-xl text-xs font-bold gap-1.5 shadow-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Ažuriranje...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Sačuvaj Novo Ime & Sliku</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
