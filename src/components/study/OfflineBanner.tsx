import React, { useState, useEffect } from "react";
import { Download, CheckCircle2, Wifi, WifiOff, HardDriveDownload } from "lucide-react";
import { downloadAppForOffline, isAppLocallyCached } from "@/services/study/offlineService";
import { toast } from "sonner";

interface OfflineBannerProps {
  onOpenSettings?: () => void;
}

export function OfflineBanner({ onOpenSettings }: OfflineBannerProps) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isDownloaded, setIsDownloaded] = useState(isAppLocallyCached());
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleDownload = async () => {
    setIsDownloading(true);
    setProgress(5);
    try {
      await downloadAppForOffline((percent) => {
        setProgress(percent);
      });
      setIsDownloaded(true);
      toast.success("Study Buddy is fully downloaded and ready for 100% offline use!");
    } catch (err: unknown) {
      console.error(err);
      toast.error("Offline download encountered an issue. Service Worker cache active.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/70 bg-card/90 px-3.5 py-2 text-xs backdrop-blur">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-2.5 w-2.5 rounded-full ${
            isOnline ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-amber-500 animate-pulse"
          }`}
        />
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          {isOnline ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              <span>Online Mode</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-amber-500" />
              <span>Offline Mode Active</span>
            </>
          )}
        </div>
        <span className="text-muted-foreground">•</span>
        <span className="text-muted-foreground hidden sm:inline">
          {isDownloaded
            ? "App & Models cached for offline study"
            : "Download to study anywhere without internet"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {isDownloaded ? (
          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Ready Offline</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-all hover:bg-primary/20 disabled:opacity-50"
          >
            {isDownloading ? (
              <>
                <HardDriveDownload className="h-3.5 w-3.5 animate-bounce" />
                <span>Downloading {progress}%</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>Download App for Offline ({progress > 0 ? `${progress}%` : "1-Click"})</span>
              </>
            )}
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="cursor-pointer text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            AI Models & Offline Config
          </button>
        )}
      </div>
    </div>
  );
}
