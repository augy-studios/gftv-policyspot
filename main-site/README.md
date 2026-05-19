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
│   │   │   │   ├── section.js        GET  /api/policy/join/section?slug=...
│   │   │   │   └── sections.js       GET  /api/policy/join/sections
│   │   │   ├── news/
│   │   │   │   ├── section.js        GET  /api/policy/news/section?slug=...
│   │   │   │   └── sections.js       GET  /api/policy/news/sections
│   │   │   ├── privacy/
│   │   │   │   ├── section.js        GET  /api/policy/privacy/section?slug=...
│   │   │   │   └── sections.js       GET  /api/policy/privacy/sections
│   │   │   ├── prs/
│   │   │   │   ├── section.js        GET  /api/policy/prs/section?slug=...
│   │   │   │   └── sections.js       GET  /api/policy/prs/sections
│   │   │   ├── rules/
│   │   │   │   ├── section.js        GET  /api/policy/rules/section?slug=...
│   │   │   │   └── sections.js       GET  /api/policy/rules/sections
│   │   │   ├── terms/
│   │   │   │   ├── section.js        GET  /api/policy/terms/section?slug=...
│   │   │   │   └── sections.js       GET  /api/policy/terms/sections
│   │   │   ├── add-section.js        POST   /api/policy/add-section (admin/editor)
│   │   │   ├── delete-section.js     DELETE /api/policy/delete-section (admin/editor)
│   │   │   ├── documents.js          GET    /api/policy/documents (admin)
│   │   │   ├── images.js             GET    /api/policy/images (admin)
│   │   │   ├── manage-document.js    DELETE /api/policy/manage-document (admin)
│   │   │   ├── manage-image.js       DELETE/PATCH /api/policy/manage-image (admin)
│   │   │   ├── manage-sound.js       DELETE /api/policy/manage-sound (admin)
│   │   │   ├── reorder-section.js    PUT    /api/policy/reorder-section (admin/editor)
│   │   │   ├── section.js            GET    /api/policy/section?slug=...
│   │   │   ├── section-views.js      POST   /api/policy/section-views
│   │   │   ├── sections.js           GET    /api/policy/sections
│   │   │   ├── sounds.js             GET    /api/policy/sounds (admin)
│   │   │   ├── track-visit.js        POST   /api/policy/track-visit
│   │   │   ├── update-section.js     PUT    /api/policy/update-section (admin/editor)
│   │   │   ├── update-slug.js        PUT    /api/policy/update-slug (admin/editor)
│   │   │   ├── upload-document.js    POST   /api/policy/upload-document (admin)
│   │   │   ├── upload-image.js       POST   /api/policy/upload-image (admin)
│   │   │   └── upload-sound.js       POST   /api/policy/upload-sound (admin)
│   │   └── admin/
│   │       └── users.js              GET/PUT /api/admin/users (admin)
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
│   ├── GHS-main.png              App icon used in header logo
│   ├── GHS-main.png              App icon used for social/OG embeds
│   ├── browserconfig.xml
│   ├── favicon.ico
│   ├── index.html                Main SPA shell
│   ├── manifest.json             PWA manifest
│   ├── package.json
│   ├── robots.txt
│   ├── script.js                 SPA logic, router, auth, content loading
│   ├── style.css                 All styles (glassmorphism + 2 themes)
│   ├── sw.js                     Service worker (offline cache)
│   └── vercel.json
└── telegram-bot/
    └── bot.py                Telegram bot
```

---

## Features

- **SPA Router** — Hash-free client-side routing using History API
- **2 Themes** — Classic Light, HelloTheme; persisted via localStorage
- **Glassmorphism UI** — No gradient blobs; clean surface-based glass effect with static background
- **User Accounts** — Register/login via `gftvhello_users` + `gftvhello_sessions`
- **Gitbook-matching URLs** — URL pattern mirrors the live Gitbook at `policy.globalfurry.tv`:
  - `/the-charter` — Charter index with full table of contents
  - `/the-charter/citation` — Standalone page
  - `/the-charter/article-i` — Article I with all subsections rendered inline
  - `/the-charter/article-i#name` — Deep-link anchor to a specific subsection
- **Legal pages** — `/legal/terms` (Terms of Service) and `/legal/privacy` (Privacy Policy), each backed by their own Supabase table (`gftvpolicy_terms`, `gftvpolicy_privacy`) and fully editable by admins via the same section system; linked from the About page
- **Slug Editing** — Admin/editor users can customise any page's URL slug in-app
- **Copy Toolbar** — Copy as Markdown for LLMs, view as plain text, export as PDF (browser print), open in ChatGPT, open in Claude
- **Media Library** — Upload and manage images (`policy-images`), documents/PDFs (`policy-documents`), and audio files (`policy-sounds`) from the "Insert Media" picker in the editor
- **Rich Embeds** — `{{embed: url}}` markdown syntax renders inline audio players, PDF viewers, Google Docs/Sheets/Slides iframes, and generic iframes
- **Image Lightbox** — Clicking any image in section content opens it full-screen in a lightbox overlay
- **Admin Panel** — User approval, role management (admin/editor), database seeder; Images/Documents/Sounds tabs each support upload, Copy URL, and Delete (with modal confirmation) directly from the admin panel
- **PWA** — Installable, offline-capable via service worker
- **Buy Augy a Coffee** — Coffee button in header linking to Stripe donation page

---

## Editor Keyboard Shortcuts

These shortcuts work inside the content editor textarea (admin/editor role):

| Shortcut | Action |
| --- | --- |
| `Ctrl+B` | Bold (`**text**`) |
| `Ctrl+I` | Italic (`*text*`) |
| `Ctrl+U` | Underline (`__text__`) |
| `Ctrl+K` | Insert link (`[text](url)`) |
| `Ctrl+Shift+I` | Open Insert Media modal (images, documents, audio, embeds) |
| `Ctrl+`` ` `` ` | Inline code (`` `text` ``) |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+S` | Save section |

### Insert Media modal tabs

| Tab | Inserts | Formats |
| --- | --- | --- |
| Upload New | `![alt](url)` or caption figure | JPG, PNG, GIF, WebP — max 8 MB, auto-compressed |
| Images | `![alt](url)` from library | — |
| Documents | `![filename]{doc}(url)` → renders as a download card | PDF, DOCX — max 20 MB |
| Sounds | `![filename]{audio}(url)` → renders as `<audio controls>` | MP3, AAC, M4A — max 20 MB |
| Embeds | `{{embed: url}}` | Google Docs, Sheets, Slides, PDF, audio, any iframe URL |

### Embed syntax

Paste `{{embed: <url>}}` anywhere in markdown content. The renderer auto-detects:

- `.mp3 / .aac / .m4a` → `<audio controls>`
- `.pdf` → PDF `<iframe>`
- `docs.google.com/document/` → Google Doc preview
- `docs.google.com/spreadsheets/` → Google Sheet preview
- `docs.google.com/presentation/` → Google Slides embed
- Anything else → generic `<iframe>`

### Document card syntax

Documents inserted from the media library use `![filename]{doc}(url)` and render as a styled card with a file icon, filename, extension label, and **Download** / **Open** buttons (no iframe).

---

## Notes

- Sessions are stored in `gftvhello_sessions` and persist across page refreshes via `localStorage` token.
- No Supabase Auth is used — custom session management only.
- Policy tables use the `gftvpolicy_` prefix: `gftvpolicy_charter`, `gftvpolicy_news`, `gftvpolicy_prs`, `gftvpolicy_rules`, `gftvpolicy_join`, `gftvpolicy_terms`, `gftvpolicy_privacy`.
- The table includes an `anchor` column (text, nullable) — this stores the `#fragment` id for subsection rows so they can be deep-linked within their parent article page (e.g. `anchor = 'name'` → `/the-charter/article-i#name`).
- Article-type rows render all their subsections inline on one page; subsection rows have no standalone URL of their own.
- PDF export uses the browser's native `window.print()` — no server-side PDF generation needed.
- The seeder is idempotent (upserts on slug), so it's safe to re-run after editing content in the code.
