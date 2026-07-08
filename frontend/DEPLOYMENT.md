# RepoHawk Frontend — Vercel Deployment Guide

## Prerequisites

- Vercel account (free tier works)
- GitHub repo with the RepoHawk codebase
- Backend deployed on DigitalOcean (needs its URL)

## Setup

### 1. Import Project

1. Go to https://vercel.com/new
2. Import your GitHub repo
3. Configure:
   - **Root Directory**: `frontend/`
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: `next build` (default — no `--webpack` needed on Vercel's Linux runners)
   - **Output Directory**: `.next` (default)

### 2. Environment Variables

Set these in the Vercel project dashboard (Settings → Environment Variables):

| Variable | Value | Notes |
|---|---|---|
| `FASTAPI_URL` | `https://your-backend-url/api/v1` | Server-side, used by API route handlers |
| `NEXT_PUBLIC_API_BASE_URL` | `https://your-backend-url` | Client-side, used by ReadmeGeneratorModal |

All environments (Production, Preview, Development) need these variables.

**Example values:**
```
FASTAPI_URL=https://repohawk-api-abcde.ondigitalocean.app/api/v1
NEXT_PUBLIC_API_BASE_URL=https://repohawk-api-abcde.ondigitalocean.app
```

### 3. CORS on the Backend

The backend must allow requests from your Vercel domain(s). Update `backend/app/main.py`:

```python
_origins = [
    settings.FRONTEND_URL,                          # production: https://repohawk.vercel.app
    "https://repohawk-git-*.vercel.app",            # preview deployments
    "https://*.vercel.app",                         # all Vercel preview deployments
]
```

Alternatively, set `FRONTEND_URL` env var on the backend to your Vercel domain. The backend reads CORS origins from this setting. For preview deployments, you'll need broader wildcard patterns in the origins list.

### 4. Deploy

Click **Deploy**. First build takes ~2-3 minutes. Vercel auto-deploys on new pushes to `main`.

## Migrated: middleware → proxy

Next.js 16 renamed `middleware.ts` to `proxy.ts`. The old `middleware.ts` has been replaced with `src/proxy.ts` that exports `proxy()` instead of `middleware()`. Functionality is identical — auth guard on private routes, redirect logged-in users away from auth pages.

## Build Notes

- **Local build:** `npm run build -- --webpack` is needed on darwin/arm64 (Turbopack swc bindings unavailable)
- **Vercel build:** `next build` (linux/x64 has native swc bindings, Turbopack is the default)
- **TypeScript:** `ignoreBuildErrors: true` is set in `next.config.ts`. Type errors won't block deployment. Remove this before production if you want strict type checking.

## Post-Deploy Checklist

- [ ] Login/register flow works
- [ ] Paste a repo URL and analysis starts
- [ ] SSE streaming shows real-time progress
- [ ] Diagrams render (Mermaid + D3-zoom)
- [ ] Chat/highlight sync works
- [ ] Share page loads
- [ ] Dashboard shows repos