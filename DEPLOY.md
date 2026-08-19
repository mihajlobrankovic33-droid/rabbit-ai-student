# Deploying Study Buddy to Vercel

## 1. Push the WHOLE project (not just one file)

Vercel builds from the repo root, so every file matters:

- `package.json` + `package-lock.json`
- `index.html`, `vite.config.ts`, `tsconfig*.json`
- `vercel.json` (valid — see below)
- `src/`, `public/`, `components.json`, `postcss.config.cjs`

Create a **new GitHub repo**, push the whole folder, then import it in Vercel
("Add New… → Project"). Vercel auto-detects Vite.

## 2. `vercel.json` (already valid)

The file in this project is valid — every key is a documented Vercel property:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Copy it exactly. If Vercel says "invalid vercel.json", the file you pushed was
hand-edited — replace it with the exact content above (plain text, no smart
quotes, no trailing commas).

## 3. Env vars on Vercel (frontend)

Vercel project → **Settings → Environment Variables** (all environments):

| Name | Value |
|---|---|
| `VITE_CONVEX_URL` | the Convex deployment URL from this project's Keys tab (ends in `.convex.cloud`) |

`VITE_*` values are baked in at **build** time, so add them BEFORE the first
build, then click **Redeploy**.

## 4. Google sign-in (OAuth)

The code already supports Google (provider in `src/convex/auth.ts`, HTTP routes
in `src/convex/http.ts`). Google login now redirects back to **whatever URL you
opened the app from** — the app sends its own origin (see `src/pages/Auth.tsx`)
and the server's `redirect` callback in `src/convex/auth.ts` accepts it. So it
works on the preview, localhost, and Vercel without extra setup.

**a) Convex backend keys** — this project's Keys tab (Convex env vars):
- `AUTH_GOOGLE_ID` → your OAuth client ID (…`apps.googleusercontent.com`)
- `AUTH_GOOGLE_SECRET` → your client secret
- `SITE_URL` → the backend URL (e.g. `https://<deployment>.convex.site`) — only a fallback now, but set it anyway

**b) Google Cloud Console** → APIs & Services → Credentials → your OAuth client
→ **Authorized redirect URIs** — add exactly:

```
https://<your-convex-site>.convex.site/api/auth/callback/google
```

Replace `<your-convex-site>` with the `.convex.site` domain of the Convex
deployment (the `CONVEX_SITE_URL` value in the Keys tab). **This must be the
Convex site URL — not your Vercel URL.** The Google login happens on Convex's
servers, so Google has to be allowed to redirect back there.

**c) Vercel** — `VITE_CONVEX_URL` from step 3 so the deployed site can reach the
backend that performs the login.

## 5. After changing Convex code or keys

Convex code changes: run `npx convex dev --once` (or `npx convex deploy`) to
push the backend. Then wait ~30s and reload the app.
