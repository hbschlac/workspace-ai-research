# Gemini for Workspace — User Feedback Research

This repository contains the data collection code and raw dataset behind the analysis at [schlacter.me/google-workspace-ai-feedback](https://schlacter.me/google-workspace-ai-feedback).

**Goal:** Map where Gemini for Workspace has the most user-reported friction, using public feedback signals from Reddit, Hacker News, App Store reviews, Play Store reviews, Stack Overflow, and YouTube.

---

## What's here

| File | Description |
|------|-------------|
| `scraper.ts` | Multi-source scraper — Reddit, HN, Play Store, App Store, YouTube, Stack Overflow |
| `analysis.ts` | Theme analysis engine — keyword matching, frequency scoring, competitor mapping |
| `data/curated-feedback.json` | 15 manually sourced pain points with real URLs |
| `data/raw-feedback.json` | Full scraped dataset (auto-updated via the live analysis pipeline) |

---

## Data sources

| Source | Method | Volume |
|--------|--------|--------|
| Reddit | Public JSON API (`/search.json`) | ~300–500 posts |
| Hacker News | Algolia search API | ~100–200 stories + comments |
| Google Play Store | `google-play-scraper` npm package | ~100–150 reviews |
| Apple App Store | `app-store-scraper` npm package | ~100–200 reviews |
| Stack Overflow | StackExchange public API v2.3 | ~50–100 questions |
| YouTube | Search HTML + `youtube-transcript-api` | ~10–15 transcripts |
| Curated | Manually sourced from forums/reports | 15 entries |

### Search terms (Reddit)
```
"gemini workspace", "gemini docs", "gemini gmail",
"gemini sheets", "google ai workspace", "gemini side panel"
```

### Subreddits searched
```
r/GoogleWorkspace, r/google, r/artificial, r/productivity, r/ChatGPT
```

### App IDs scraped

**Play Store:**
- `com.google.android.gm` (Gmail)
- `com.google.android.apps.docs` (Docs)
- `com.google.android.apps.docs.editors.sheets` (Sheets)
- `com.google.android.apps.docs.editors.slides` (Slides)

**App Store:**
- `422689480` (Gmail)
- `842842640` (Google Docs)
- `842849113` (Google Sheets)
- `879478102` (Google Slides)
- `1013161476` (Google Meet)

---

## Themes & keyword mapping

Seven opportunity themes were defined based on user research patterns. Each piece of raw feedback is matched to themes via keyword search:

| Theme | Keywords |
|-------|----------|
| Trust & Grounding | hallucinate, fabricat, incorrect, wrong information, false, imagin |
| Cross-App Context | context, memory, remember, forget, loses context, switch, cross-app, side panel |
| Mobile & Voice | mobile, phone, voice, hands-free, android, ios, cramped |
| Context-Aware Writing | help me write, generic, bland, corporate, tone, style, fluff |
| Spreadsheet Intelligence | formula, spreadsheet, sheets, vlookup, array, pivot |
| Meeting Intelligence | meeting, summary, action item, transcript, speaker, attribution |
| Value Perception | price, pricing, cost, expensive, worth, value, per user |

Severity (1–5) is set manually based on user sentiment patterns and business impact potential.

---

## How to reproduce

### Requirements
- Node.js 18+
- Python 3 with `youtube-transcript-api` (`pip install youtube-transcript-api`)
- npm packages: `google-play-scraper`, `app-store-scraper`, `@upstash/redis`

### Run the scraper
The scraper is embedded in the live Next.js app at `schlacter-me/lib/workspace-ai.ts`.

To trigger a fresh scrape and save to the KV store:
```bash
curl -X POST "https://schlacter.me/workspace-ai-gaps/api/scrape?secret=YOUR_SECRET"
```

To download the current raw dataset:
```bash
curl "https://schlacter.me/workspace-ai-gaps/api/export" -o raw-feedback.json
```

To get the analyzed snapshot (themes, frequencies, competitor data):
```bash
curl "https://schlacter.me/workspace-ai-gaps/api/analyze"
```

---

## Methodology notes

- **No ML/embeddings** — theme matching uses keyword search, not semantic similarity. This is intentional: it's fully transparent, reproducible, and auditable.
- **Curated baseline** — the 15 curated entries in `data/curated-feedback.json` represent hand-verified pain points. They're included alongside scraped data to ensure key themes have representative quotes even when scrapers return low volume.
- **Deduplication** — each item has a stable `id` (source + platform ID). Duplicates are filtered before analysis.
- **Frequency counts** reflect how many data points matched each theme's keywords, not unique users. A single detailed Reddit post can match multiple themes.

---

## Live demo

→ [schlacter.me/google-workspace-ai-feedback](https://schlacter.me/google-workspace-ai-feedback)

→ [Full methodology page](https://schlacter.me/workspace-ai-gaps/methodology)

---

Built by [Hannah Schlacter](https://schlacter.me) — Product Manager
