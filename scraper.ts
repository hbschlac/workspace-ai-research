/**
 * workspace-ai scraper
 * Collects Gemini for Workspace feedback from 6 public sources.
 * Part of: https://github.com/hannahschlacter/workspace-ai-research
 */

export type FeedbackSource = "reddit" | "hackernews" | "playstore" | "appstore" | "stackoverflow" | "youtube" | "curated";

export type RawFeedback = {
  id: string;
  source: FeedbackSource;
  text: string;
  author: string;
  url: string;
  score: number;
  date: string;
  subreddit?: string;
};

// ── Reddit ──

const SUBREDDITS = ["GoogleWorkspace", "google", "artificial", "productivity", "ChatGPT"];
const SEARCH_TERMS = ["gemini workspace", "gemini docs", "gemini gmail", "gemini sheets", "google ai workspace", "gemini side panel"];

export async function scrapeReddit(): Promise<RawFeedback[]> {
  const results: RawFeedback[] = [];

  for (const term of SEARCH_TERMS) {
    for (const sub of SUBREDDITS) {
      try {
        const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(term)}&restrict_sr=1&sort=relevance&t=year&limit=25`;
        const res = await fetch(url, { headers: { "User-Agent": "workspace-ai-analyzer/1.0" } });
        if (!res.ok) continue;
        const data = await res.json();

        for (const post of data?.data?.children ?? []) {
          const d = post.data;
          if (!d.selftext && !d.title) continue;
          results.push({
            id: `reddit-${d.id}`,
            source: "reddit",
            text: `${d.title}\n\n${d.selftext ?? ""}`.trim(),
            author: d.author ?? "anonymous",
            url: `https://reddit.com${d.permalink}`,
            score: d.score ?? 0,
            date: new Date((d.created_utc ?? 0) * 1000).toISOString(),
            subreddit: sub,
          });
        }
      } catch { /* skip */ }
    }
  }

  const seen = new Set<string>();
  return results.filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
}

// ── Hacker News (Algolia API) ──

export async function scrapeHackerNews(): Promise<RawFeedback[]> {
  const results: RawFeedback[] = [];
  const queries = ["gemini workspace", "google gemini docs", "gemini gmail", "google ai productivity"];

  for (const query of queries) {
    try {
      const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=30`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();

      for (const hit of data.hits ?? []) {
        results.push({
          id: `hn-${hit.objectID}`,
          source: "hackernews",
          text: hit.title ?? "",
          author: hit.author ?? "anonymous",
          url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          score: hit.points ?? 0,
          date: hit.created_at ?? new Date().toISOString(),
        });
      }

      // Comments (richer feedback)
      const commentRes = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=comment&hitsPerPage=50`);
      if (commentRes.ok) {
        const commentData = await commentRes.json();
        for (const hit of commentData.hits ?? []) {
          if (!hit.comment_text) continue;
          const text = hit.comment_text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          if (text.length < 30) continue;
          results.push({
            id: `hn-comment-${hit.objectID}`,
            source: "hackernews",
            text,
            author: hit.author ?? "anonymous",
            url: `https://news.ycombinator.com/item?id=${hit.story_id ?? hit.objectID}`,
            score: hit.points ?? 0,
            date: hit.created_at ?? new Date().toISOString(),
          });
        }
      }
    } catch { /* skip */ }
  }

  const seen = new Set<string>();
  return results.filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
}

// ── Google Play Store (requires: npm install google-play-scraper) ──

export async function scrapePlayStore(): Promise<RawFeedback[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const gplay = require("google-play-scraper");
    const apps = [
      { id: "com.google.android.gm", name: "gmail" },
      { id: "com.google.android.apps.docs", name: "docs" },
      { id: "com.google.android.apps.docs.editors.sheets", name: "sheets" },
      { id: "com.google.android.apps.docs.editors.slides", name: "slides" },
    ];

    const results: RawFeedback[] = [];
    for (const app of apps) {
      try {
        const reviews = await gplay.reviews({ appId: app.id, sort: gplay.sort.NEWEST, num: 30, lang: "en", country: "us" });
        for (const review of reviews.data ?? []) {
          const text = (review.text ?? "").toLowerCase();
          if (!text.includes("ai") && !text.includes("gemini") && !text.includes("smart") && !text.includes("suggest")) continue;
          results.push({
            id: `play-${app.name}-${review.id ?? crypto.randomUUID()}`,
            source: "playstore",
            text: review.text ?? "",
            author: review.userName ?? "anonymous",
            url: `https://play.google.com/store/apps/details?id=${app.id}`,
            score: review.score ?? 3,
            date: review.date ? new Date(review.date).toISOString() : new Date().toISOString(),
          });
        }
      } catch { /* skip */ }
    }
    return results;
  } catch { return []; }
}

// ── Apple App Store (requires: npm install app-store-scraper) ──

export async function scrapeAppStore(): Promise<RawFeedback[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const store = require("app-store-scraper");
    const apps = [
      { id: 422689480, name: "gmail" },
      { id: 842842640, name: "docs" },
      { id: 842849113, name: "sheets" },
      { id: 879478102, name: "slides" },
      { id: 1013161476, name: "meet" },
    ];

    const AI_KEYWORDS = ["ai", "gemini", "smart", "suggest", "summary", "compose", "write", "draft", "autocomplete", "intelligence", "assistant", "generate", "hallucin", "context", "side panel", "annoying", "useless", "broken", "buggy", "slow"];
    const results: RawFeedback[] = [];

    for (const app of apps) {
      for (let page = 1; page <= 5; page++) {
        try {
          const reviews = await store.reviews({ id: app.id, sort: store.sort.RECENT, page, country: "us" });
          if (!reviews?.length) break;
          for (const review of reviews) {
            const text = (review.text ?? "").toLowerCase();
            if (!AI_KEYWORDS.some((kw) => text.includes(kw))) continue;
            results.push({
              id: `appstore-${app.name}-${review.id ?? crypto.randomUUID()}`,
              source: "appstore",
              text: review.text ?? "",
              author: review.userName ?? "anonymous",
              url: review.url ?? `https://apps.apple.com/app/id${app.id}`,
              score: review.score ?? 3,
              date: review.date ? new Date(review.date).toISOString() : new Date().toISOString(),
            });
          }
        } catch { /* skip */ }
      }
    }
    return results;
  } catch { return []; }
}

// ── YouTube (requires: pip install youtube-transcript-api) ──

async function searchYouTubeVideoIds(query: string): Promise<string[]> {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=CAISBAgCEAE`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" } });
    if (!res.ok) return [];
    const html = await res.text();
    const ids = [...html.matchAll(/\"videoId\":\"([a-zA-Z0-9_-]{11})\"/g)].map((m) => m[1]);
    return [...new Set(ids)].slice(0, 10);
  } catch { return []; }
}

async function getYouTubeTranscript(videoId: string): Promise<string | null> {
  const { execSync } = await import("child_process");
  try {
    const result = execSync(
      `python3 -c "
from youtube_transcript_api import YouTubeTranscriptApi
api = YouTubeTranscriptApi()
try:
    transcript = api.fetch('${videoId}', languages=['en'])
    text = ' '.join([s.text for s in transcript.snippets])
    print(text[:2000])
except:
    print('')
"`,
      { timeout: 10000, encoding: "utf-8" }
    );
    return result.trim() || null;
  } catch { return null; }
}

export async function scrapeYouTube(): Promise<RawFeedback[]> {
  const queries = [
    "gemini google workspace review",
    "gemini docs gmail problems",
    "google ai workspace honest review",
    "gemini for workspace vs chatgpt",
    "google workspace AI features review 2025",
    "gemini side panel review",
  ];

  const allVideoIds = new Set<string>();
  for (const q of queries) {
    const ids = await searchYouTubeVideoIds(q);
    ids.forEach((id) => allVideoIds.add(id));
  }

  const results: RawFeedback[] = [];
  for (const videoId of [...allVideoIds].slice(0, 15)) {
    const transcript = await getYouTubeTranscript(videoId);
    if (!transcript || transcript.length < 50) continue;
    results.push({
      id: `youtube-${videoId}`,
      source: "youtube",
      text: transcript.slice(0, 500),
      author: "YouTube creator",
      url: `https://www.youtube.com/watch?v=${videoId}`,
      score: 0,
      date: new Date().toISOString(),
    });
  }
  return results;
}

// ── Stack Overflow ──

export async function scrapeStackOverflow(): Promise<RawFeedback[]> {
  const results: RawFeedback[] = [];
  const queries = ["gemini+google+workspace", "gemini+docs", "gemini+gmail", "gemini+sheets", "google+ai+workspace"];

  for (const query of queries) {
    try {
      const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${query}&site=stackoverflow&pagesize=30&filter=withbody`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      for (const item of data.items ?? []) {
        const text = (item.title ?? "") + "\n\n" + ((item.body ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
        if (text.length < 30) continue;
        results.push({
          id: `so-${item.question_id}`,
          source: "stackoverflow",
          text: text.slice(0, 500),
          author: item.owner?.display_name ?? "anonymous",
          url: item.link ?? `https://stackoverflow.com/q/${item.question_id}`,
          score: item.score ?? 0,
          date: new Date((item.creation_date ?? 0) * 1000).toISOString(),
        });
      }
    } catch { /* skip */ }
  }

  for (const query of ["gemini+workspace", "google+gemini", "gemini+docs"]) {
    try {
      const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${query}&site=webapps&pagesize=30&filter=withbody`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      for (const item of data.items ?? []) {
        const text = (item.title ?? "") + "\n\n" + ((item.body ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
        if (text.length < 30) continue;
        results.push({
          id: `so-wa-${item.question_id}`,
          source: "stackoverflow",
          text: text.slice(0, 500),
          author: item.owner?.display_name ?? "anonymous",
          url: item.link ?? `https://webapps.stackexchange.com/q/${item.question_id}`,
          score: item.score ?? 0,
          date: new Date((item.creation_date ?? 0) * 1000).toISOString(),
        });
      }
    } catch { /* skip */ }
  }

  const seen = new Set<string>();
  return results.filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
}
