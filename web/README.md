# Analog Explorer web

Next.js app (App Router, TypeScript, Tailwind). Vercel root directory is `web/`.

```bash
cp .env.example .env.local
npm install        # also copies Cesium's runtime assets to public/cesium
npm run dev        # http://localhost:3000, expects the API on http://localhost:8000
```

Checks: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` (unit, set `API_URL` for the live API tests).

Vercel: import the repo, root directory `web`, production branch `main`. Env var names are in `.env.example`.
