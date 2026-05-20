# GFTV PolicyBot

A Telegram bot that delivers the full GFTV PolicySpot experience in your DMs — browse every policy document, paginate through long articles, search across all categories, and sort by view popularity.

---

## Features

| Feature | Description |
|---|---|
| **Browse by category** | Explore all six policy documents from a single menu |
| **Paginated articles** | Long articles are split into pages with ◀ / ▶ navigation |
| **Inline keyboard UI** | Tap buttons to navigate — no commands required beyond the first |
| **Search** | Full-text search across all categories, including subsection content |
| **Sort by views** | Toggle article lists between editorial order and most-viewed |
| **View tracking** | Every article opened records a visit in the same database as the main site |
| **Embed links** | Embedded documents (Google Docs, Sheets, PDFs) appear as tappable links |
| **DMs only** | All interactions are private; the bot ignores group messages |
| **Local caching** | Supabase responses are cached in SQLite to minimise latency |

---

## Policy Categories

| Emoji | Category |
|---|---|
| 📜 | The Charter |
| 📰 | News Standards |
| 🎬 | Programme Rating System |
| 📋 | Community Rules |
| 🤝 | Join GFTV |
| ⚖️ | Legal |

---

## Commands

| Command | Description |
|---|---|
| `/start` | Open the main menu |
| `/browse` | Jump straight to the category list |
| `/search <query>` | Search all policies for a term |
| `/help` | Show the help message |

All commands work only in DMs with the bot.

---

## Navigation Flow

```
Main Menu
 ├── 📚 Browse Policies
 │    └── Category List
 │         └── Article List  (paginated · sort: order / views)
 │              └── Article  (paginated pages)
 └── 🔍 Search
      └── Search Results  (paginated)
           └── Article
```

### Tips

- In any article list, tap **↕ Sort: Views** to rank by most viewed, or **↕ Sort: Order** to return to editorial order. The view count is shown next to each title when sorting by views.
- Search matches article titles and body text. A result marked with ↳ is a subsection; tapping it opens the parent article.
- The page indicator button (e.g. `2 / 5`) in an article is not interactive — it shows your current position.
- Tap **◀◀ Back to List** from any article to return to that category's article list.

---

## Database

The bot shares the following Supabase tables with the main PolicySpot website:

| Table | Purpose |
|---|---|
| `gftvpolicy_charter` | The Charter content |
| `gftvpolicy_news` | News Standards content |
| `gftvpolicy_prs` | Programme Rating System content |
| `gftvpolicy_rules` | Community Rules content |
| `gftvpolicy_join` | Join GFTV content |
| `gftvpolicy_legal` | Legal content |
| `gftvpolicy_pagevisits` | View tracking (shared with the website) |

A local SQLite database (`data/bot.db`) is used for:
- **Response cache** — Supabase query results cached with a configurable TTL (default 5 min)
- **Search state** — Most recent search results per user, used for result pagination
- **User state** — Tracks whether a user is in the middle of typing a search query
