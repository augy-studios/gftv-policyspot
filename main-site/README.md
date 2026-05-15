# GFTV PolicySpot

The official policy documentation site for **Global Furry Television (GFTV)**.

---

## Project Structure

```bash
gftv-policyspot/
├── api/
│   ├── auth/
│   │   ├── login.js          POST /api/auth/login
│   │   ├── logout.js         POST /api/auth/logout
│   │   ├── me.js             GET  /api/auth/me
│   │   └── register.js       POST /api/auth/register
│   ├── policy/
│   │   ├── sections.js       GET  /api/policy/sections
│   │   ├── section.js        GET  /api/policy/section?slug=...
│   │   └── update-slug.js    PUT  /api/policy/update-slug (admin/editor)
│   └── admin/
│       ├── users.js          GET/PUT /api/admin/users (admin)
│       └── seed.js           POST /api/admin/seed (admin)
├── lib/
│   ├── supabase.js           Supabase client helper
│   ├── auth.js               Session validation
│   └── response.js           API response helpers
├── public/
│   ├── index.html            Main SPA shell
│   ├── style.css             All styles (glassmorphism + 7 themes)
│   ├── app.js                SPA logic, router, auth, content loading
│   ├── manifest.json         PWA manifest
│   ├── sw.js                 Service worker (offline cache)
│   └── favicon.svg           SVG favicon
├── supabase-migration.sql    Run this in Supabase SQL Editor first
├── .env.example              Environment variable reference
├── package.json
└── vercel.json
```

---

## Features

- **SPA Router** — Hash-free client-side routing using History API
- **7 Themes** — Classic mint, 5 non-green variants, and white; persisted via localStorage
- **Glassmorphism UI** — No gradient blobs; clean surface-based glass effect with static background
- **User Accounts** — Register/login via `gftvhello_users` + `gftvhello_sessions`
- **Gitbook-matching URLs** — URL pattern mirrors the live Gitbook at `policy.globalfurry.tv`:
  - `/the-charter` — Charter index with full table of contents
  - `/the-charter/citation` — Standalone page
  - `/the-charter/article-i` — Article I with all subsections rendered inline
  - `/the-charter/article-i#name` — Deep-link anchor to a specific subsection
- **Slug Editing** — Admin/editor users can customise any page's URL slug in-app
- **Copy Toolbar** — Copy as Markdown for LLMs, view as plain text, export as PDF (browser print), open in ChatGPT, open in Claude
- **Admin Panel** — User approval, role management (admin/editor), database seeder
- **PWA** — Installable, offline-capable via service worker
- **Buy Augy a Coffee** — Coffee button in header linking to Stripe donation page

---

## Notes

- Sessions are stored in `gftvhello_sessions` and persist across page refreshes via `localStorage` token.
- No Supabase Auth is used — custom session management only.
- Policy tables use the `gftvpolicy_` prefix: `gftvpolicy_charter`, `gftvpolicy_news`, `gftvpolicy_prs`, `gftvpolicy_rules`, `gftvpolicy_join`.
- The table includes an `anchor` column (text, nullable) — this stores the `#fragment` id for subsection rows so they can be deep-linked within their parent article page (e.g. `anchor = 'name'` → `/the-charter/article-i#name`).
- Article-type rows render all their subsections inline on one page; subsection rows have no standalone URL of their own.
- PDF export uses the browser's native `window.print()` — no server-side PDF generation needed.
- The seeder is idempotent (upserts on slug), so it's safe to re-run after editing content in the code.
