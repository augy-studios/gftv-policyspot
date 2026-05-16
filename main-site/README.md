# GFTV PolicySpot

The official policy documentation site for **Global Furry Television (GFTV)**.

---

## Project Structure

```bash
gftv-policyspot/
├── discord-bot/
│   └── bot.py                Discord bot
├── main-site/
│   ├── .well-known/
│   │   └── assetlinks.json
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login.js          POST /api/auth/login
│   │   │   ├── logout.js         POST /api/auth/logout
│   │   │   ├── me.js             GET  /api/auth/me
│   │   │   ├── register.js       POST /api/auth/register
│   │   │   └── totp-verify.js    POST /api/auth/totp-verify
│   │   ├── policy/
│   │   │   ├── join/
│   │   │   │   ├── section.js    GET  /api/policy/join/section?slug=...
│   │   │   │   └── sections.js   GET  /api/policy/join/sections
│   │   │   ├── news/
│   │   │   │   ├── section.js    GET  /api/policy/news/section?slug=...
│   │   │   │   └── sections.js   GET  /api/policy/news/sections
│   │   │   ├── prs/
│   │   │   │   ├── section.js    GET  /api/policy/prs/section?slug=...
│   │   │   │   └── sections.js   GET  /api/policy/prs/sections
│   │   │   ├── rules/
│   │   │   │   ├── section.js    GET  /api/policy/rules/section?slug=...
│   │   │   │   └── sections.js   GET  /api/policy/rules/sections
│   │   │   ├── add-section.js    POST   /api/policy/add-section (admin/editor)
│   │   │   ├── delete-section.js DELETE /api/policy/delete-section (admin/editor)
│   │   │   ├── reorder-section.js PUT   /api/policy/reorder-section (admin/editor)
│   │   │   ├── section.js        GET    /api/policy/section?slug=...
│   │   │   ├── sections.js       GET    /api/policy/sections
│   │   │   ├── update-section.js PUT    /api/policy/update-section (admin/editor)
│   │   │   └── update-slug.js    PUT    /api/policy/update-slug (admin/editor)
│   │   └── admin/
│   │       └── users.js          GET/PUT /api/admin/users (admin)
│   ├── images/
│   │   ├── screenshot_1.png
│   │   └── screenshot_2.png
│   ├── lib/
│   │   ├── auth.js               Session validation
│   │   ├── response.js           API response helpers
│   │   ├── supabase.js           Supabase client helper
│   │   └── totp.js               TOTP helper
│   ├── 404.css
│   ├── 404.html
│   ├── CODE_OF_CONDUCT.md
│   ├── GHS-192.png               App icon 192×192 (PWA manifest)
│   ├── GHS-512.png               App icon 512×512 (PWA manifest)
│   ├── GHS-icon.png              App icon used in header logo
│   ├── GHS-main.png              App icon used for social/OG embeds
│   ├── browserconfig.xml
│   ├── favicon.ico
│   ├── index.html                Main SPA shell
│   ├── manifest.json             PWA manifest
│   ├── package.json
│   ├── robots.txt
│   ├── script.js                 SPA logic, router, auth, content loading
│   ├── style.css                 All styles (glassmorphism + 7 themes)
│   ├── sw.js                     Service worker (offline cache)
│   └── vercel.json
└── telegram-bot/
    └── bot.py                Telegram bot
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
