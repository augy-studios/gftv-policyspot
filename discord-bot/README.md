# GFTV PolicySpot — Discord Bot

A Discord slash-command bot that makes the GFTV PolicySpot policy documentation interactive — browse, search, and track engagement directly from any Discord server.

---

## Features

- **Interactive table of contents** — paginated embed with a section dropdown, letting users navigate and read any section without leaving Discord
- **Full-text search** — searches both section titles and body content across all six policy documents simultaneously, or within a specific one
- **View-count leaderboard** — ranks the most-read sections by total bot views, across all documents or filtered to one
- **Direct section access** — jump to any section instantly using its slug, with autocomplete that filters by document as you type
- **Content pagination** — long sections are automatically split into pages with Prev/Next controls so no content is cut off
- **View tracking** — every section opened through the bot records a view in the shared analytics database (`gftvpolicy_pagevisits`), counting toward the same stats visible on the main site
- **Session-safe buttons** — interactive controls disable themselves cleanly after the 5-minute session window expires
- **Published-only** — only sections marked `is_published = true` are visible, matching the main site's behaviour

---

## Commands

| Command | Description |
|---|---|
| `/help` | Lists all available commands (ephemeral — only visible to you) |
| `/browse <document>` | Opens an interactive TOC for the chosen document |
| `/search <query> [document]` | Searches section titles and content; optionally scoped to one document |
| `/top [document]` | Shows the 10 most-viewed sections, optionally filtered by document |
| `/section <document> <slug>` | Jumps directly to a section by slug with autocomplete |

### `/browse` — document values

| Value | Document |
|---|---|
| `charter` | Charter of Global Furry Television |
| `news` | News Standards |
| `prs` | Programme Rating System |
| `rules` | Community Rules |
| `join` | Join GFTV |
| `legal` | Legal |

### Navigation controls

After `/browse` opens, the message contains interactive elements:

- **Section dropdown** — pick any section from the current TOC page to read it
- **◀ Prev / Next ▶** — page through the table of contents (10 entries per page)
- **📋 Table of Contents** — return to the TOC from a section view
- **◀ Prev Page / Next Page ▶** — page through long section content
- **◀ Prev Section / Next Section ▶** — step to the adjacent section without returning to the TOC

Controls automatically disable after **5 minutes** of inactivity.

---

## Document structure

Each policy document contains **sections** and **subsections**. Subsections are indented with `↳` in the table of contents and labelled accordingly in section footers. Section numbers (e.g. `Article I`, `Section 2.1`) are displayed when present.

---

## View tracking

Every time a section embed is displayed — via `/browse`, `/search`, or `/section` — one record is written to the `gftvpolicy_pagevisits` table with:

- `section_id` — the section's UUID
- `doc` — document key (e.g. `charter`)
- `slug` — section slug
- `device_type` — `Others` (Discord bot source)

These views are counted by `/top` and are visible on the main PolicySpot site analytics.
