/**
 * Offline & Service Worker Management Service
 * Provides complete offline app download, PWA caching, and network status tracking.
 */

export interface OfflineStatus {
  isOnline: boolean;
  isServiceWorkerActive: boolean;
  isDownloaded: boolean;
  downloadProgress: number; // 0 to 100
  isDownloading: boolean;
}

const OFFLINE_CACHED_FLAG = "study_buddy_app_cached_offline";

export function isAppLocallyCached(): boolean {
  try {
    return localStorage.getItem(OFFLINE_CACHED_FLAG) === "true";
  } catch {
    return false;
  }
}

export function setAppLocallyCached(cached: boolean): void {
  try {
    localStorage.setItem(OFFLINE_CACHED_FLAG, cached ? "true" : "false");
  } catch (e) {
    console.error(e);
  }
}

export function registerSW(): void {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("Service Worker registered successfully:", reg.scope);
        })
        .catch((err) => {
          console.warn("Service Worker registration notice:", err);
        });
    });
  }
}

export async function downloadAppForOffline(
  onProgress?: (percent: number, currentItem?: string) => void
): Promise<boolean> {
  if (typeof window === "undefined" || !("caches" in window)) {
    throw new Error("Cache Storage is not available in this environment.");
  }

  const cache = await caches.open("study-buddy-cache-v1");

  // Collect all static assets, scripts, styles, and routes currently loaded on page
  const discoveredUrls = new Set<string>([
    "/",
    "/index.html",
    "/manifest.webmanifest",
    "/logo.svg",
    "/auth",
    "/dashboard",
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
  ]);

  // Grab script and stylesheet tags
  document.querySelectorAll("script[src]").forEach((el) => {
    const src = el.getAttribute("src");
    if (src) discoveredUrls.add(src);
  });
  document.querySelectorAll("link[rel='stylesheet'], link[href]").forEach((el) => {
    const href = el.getAttribute("href");
    if (href) discoveredUrls.add(href);
  });

  const urls = Array.from(discoveredUrls);
  let completed = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const response = await fetch(url, { cache: "reload" });
      if (response.ok) {
        await cache.put(url, response);
      }
    } catch (e) {
      console.warn("Could not cache resource:", url, e);
    }
    completed++;
    const percent = Math.round((completed / urls.length) * 100);
    onProgress?.(percent, url);
  }

  setAppLocallyCached(true);
  return true;
}
