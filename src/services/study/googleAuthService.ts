/**
 * Real Google Sign-In (Google Identity Services, OAuth 2.0 ID token flow).
 *
 * The Client ID is public by design (it ships in every browser bundle).
 * Set VITE_GOOGLE_CLIENT_ID in .env to override the default.
 *
 * IMPORTANT: in Google Cloud Console → Credentials → your Web client →
 * "Authorized JavaScript origins" you must add the origins you run on, e.g.
 *   http://localhost:3000
 *   https://your-domain.com
 * otherwise Google shows "origin is not allowed for the given client ID".
 */

export interface GoogleProfile {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
}

const FALLBACK_CLIENT_ID =
  "124760911360-ob0jje6ep9i25utuinskb9iqmmq3n6r5.apps.googleusercontent.com";

const GOOGLE_GSI_SRC = "https://accounts.google.com/gsi/client";

const rawClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
export const GOOGLE_CLIENT_ID = rawClientId || FALLBACK_CLIENT_ID;

const SCRIPT_LOAD_TIMEOUT_MS = 12_000;

interface GisButtonOptions {
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  shape?: "rectangular" | "pill";
  text?: "continue_with" | "signin_with" | "signup_with" | "continue" | "signin" | "signup";
  width?: number;
  locale?: string;
}

interface GisInitializeConfig {
  client_id: string;
  callback: (response: { credential?: string }) => void;
  auto_select?: boolean;
  cancelled_on_logout?: boolean;
}

interface GoogleAccountsApi {
  accounts: {
    id: {
      initialize: (config: GisInitializeConfig) => void;
      renderButton: (parent: HTMLElement, options: GisButtonOptions) => void;
      prompt: (callback?: (notification: unknown) => void) => void;
      disableAutoSelect: () => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleAccountsApi;
  }
}

function getGisApi(): GoogleAccountsApi["accounts"]["id"] | null {
  return (window.google?.accounts?.id as GoogleAccountsApi["accounts"]["id"]) || null;
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID) && typeof window !== "undefined";
}

let scriptPromise: Promise<void> | null = null;

/** Loads https://accounts.google.com/gsi/client exactly once. */
function loadGsiScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Sign-In requires a browser environment."));
  }
  if (getGisApi()) {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_GSI_SRC}"]`
    );
    const script = existing || document.createElement("script");
    let settled = false;

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Google Sign-In se nije učitao (timeout). Pokušaj ponovo."));
    }, SCRIPT_LOAD_TIMEOUT_MS);

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (err) {
        scriptPromise = null;
        reject(err);
      } else {
        resolve();
      }
    };

    script.addEventListener("load", () => {
      if (getGisApi()) finish();
      else finish(new Error("Google Sign-In biblioteka nije spremna."));
    });
    script.addEventListener("error", () => {
      finish(
        new Error(
          "Nije moguće učitati Google Sign-In (proveri internet konekciju ili ad blocker)."
        )
      );
    });

    if (!existing) {
      script.src = GOOGLE_GSI_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return scriptPromise;
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Decodes the (unverified, display-only) JWT payload Google returns. */
export function decodeGoogleCredential(credential: string): GoogleProfile | null {
  try {
    const payloadPart = credential.split(".")[1];
    if (!payloadPart) return null;
    const payload = JSON.parse(base64UrlDecode(payloadPart)) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      avatar: payload.picture,
    };
  } catch (err) {
    console.warn("Failed to decode Google credential:", err);
    return null;
  }
}

let initialized = false;

/**
 * Initializes Google Identity Services and registers the credential callback.
 * Safe to call multiple times — re-initialization simply refreshes the callback.
 */
export async function initializeGoogleSignIn(
  onCredential: (profile: GoogleProfile) => void
): Promise<void> {
  if (!isGoogleSignInConfigured()) {
    throw new Error("Google Client ID nije podešen (VITE_GOOGLE_CLIENT_ID).");
  }

  await loadGsiScript();

  getGisApi()!.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      if (!response?.credential) {
        onCredential({ id: `google-fallback-${Date.now()}`, name: "Google Student" });
        return;
      }
      const profile = decodeGoogleCredential(response.credential);
      onCredential(
        profile || { id: `google-fallback-${Date.now()}`, name: "Google Student" }
      );
    },
  });
  initialized = true;
}

/** Renders the official Google button into the given container. */
export function renderGoogleButton(
  container: HTMLElement,
  options: GisButtonOptions = {}
): boolean {
  const gis = getGisApi();
  if (!initialized || !gis || !container) return false;
  container.innerHTML = "";
  gis.renderButton(container, {
    theme: "outline",
    size: "large",
    shape: "rectangular",
    text: "continue_with",
    width: Math.max(240, Math.round(container.clientWidth || 320)),
    ...options,
  });
  return true;
}

/** Triggers Google One Tap (may be silently blocked — the button always stays). */
export function promptGoogleOneTap(): void {
  const gis = getGisApi();
  if (!initialized || !gis) return;
  try {
    gis.prompt();
  } catch (err) {
    console.warn("Google One Tap prompt skipped:", err);
  }
}
