# App directory layout

This folder is split so **frontend** and **backend** are easy to find:

- **`(frontend)/`** — All page routes (UI). The parentheses are a [Next.js route group](https://nextjs.org/docs/app/building-your-application/routing/route-groups); they don’t change URLs (e.g. `(frontend)/report/page.tsx` still serves `/report`).
- **`api/`** — Backend: all API route handlers (REST endpoints).
- **`layout.tsx`** — Root layout (wraps both frontend pages and any other app routes).
- **`globals.css`** — Global styles.

Frontend pages live under `(frontend)/` so that next to `api/` it’s clear which code is UI and which is server/API.
