/**
 * workspace-ai theme analysis engine
 * Matches raw feedback to opportunity themes via keyword search.
 * Part of: https://github.com/hannahschlacter/workspace-ai-research
 */

import type { RawFeedback } from "./scraper";

export type WorkspaceApp = "gmail" | "docs" | "sheets" | "slides" | "meet" | "drive" | "calendar" | "chat" | "general";

export type PainPointTheme = {
  id: string;
  name: string;
  description: string;
  severity: number; // 1–5, manually assessed
  frequency: number; // computed: count of raw feedback items that match
  apps: WorkspaceApp[];
  quotes: { text: string; source: string; url: string; author: string; date: string }[];
  competitorAlternatives: { tool: string; reason: string }[];
  scope: "platform" | "app-level";
};

// ── Theme definitions ──

export function getDefaultThemes(): PainPointTheme[] {
  return [
    {
      id: "hallucination",
      name: "Trust & Grounding",
      description: "Opportunity to strengthen source-grounded AI output — users want reliable, citable results for business-critical work",
      severity: 5,
      frequency: 0,
      apps: ["docs", "gmail", "meet"],
      quotes: [],
      competitorAlternatives: [
        { tool: "ChatGPT", reason: "Users value its source grounding and citation approach" },
        { tool: "Notion AI", reason: "Praised for staying within document context" },
      ],
      scope: "platform",
    },
    {
      id: "cross-app-memory",
      name: "Cross-App Context & Memory",
      description: "Users want Gemini to carry context across Workspace apps — a shared memory layer would unlock Workspace's unique integration advantage",
      severity: 5,
      frequency: 0,
      apps: ["general", "gmail", "docs", "sheets", "drive"],
      quotes: [],
      competitorAlternatives: [
        { tool: "Microsoft Copilot", reason: "Unified memory across Outlook, Word, Teams, and SharePoint" },
        { tool: "ChatGPT", reason: "Persistent conversation memory across sessions" },
      ],
      scope: "platform",
    },
    {
      id: "mobile-voice",
      name: "Mobile & Voice-First AI",
      description: "Huge opportunity in mobile-native AI — voice workflows and on-the-go AI could reach frontline and field workers that desktop tools miss",
      severity: 4,
      frequency: 0,
      apps: ["general", "gmail", "docs", "meet"],
      quotes: [],
      competitorAlternatives: [
        { tool: "ChatGPT mobile app", reason: "Sets the bar for voice mode and mobile-native AI" },
        { tool: "Apple Intelligence", reason: "Shows value of system-level mobile integration" },
      ],
      scope: "platform",
    },
    {
      id: "writing-quality",
      name: "Context-Aware Writing",
      description: "Users want 'Help me write' to match their tone, style, and org context — personalized writing is the next quality bar",
      severity: 4,
      frequency: 0,
      apps: ["docs", "gmail"],
      quotes: [],
      competitorAlternatives: [
        { tool: "Notion AI", reason: "Better at matching existing document tone and context" },
        { tool: "ChatGPT", reason: "More customizable tone and style with custom instructions" },
        { tool: "Jasper", reason: "Brand voice learning and enterprise style consistency" },
      ],
      scope: "app-level",
    },
    {
      id: "formula-weakness",
      name: "Deeper Spreadsheet Intelligence",
      description: "Room to grow in complex formula generation, array functions, and data analysis",
      severity: 3,
      frequency: 0,
      apps: ["sheets"],
      quotes: [],
      competitorAlternatives: [
        { tool: "ChatGPT", reason: "Generates correct complex formulas with explanations" },
        { tool: "Microsoft Copilot in Excel", reason: "Deep Excel formula knowledge and pivot table generation" },
      ],
      scope: "app-level",
    },
    {
      id: "meeting-attribution",
      name: "Meeting Intelligence Upgrade",
      description: "Users want more accurate speaker attribution, better action-item extraction, and searchable meeting history",
      severity: 4,
      frequency: 0,
      apps: ["meet"],
      quotes: [],
      competitorAlternatives: [
        { tool: "Otter.ai", reason: "More accurate speaker diarization and action item extraction" },
        { tool: "Fireflies.ai", reason: "Better meeting analytics and searchable transcripts" },
        { tool: "Microsoft Copilot in Teams", reason: "Integrated meeting recap with task creation in Planner" },
      ],
      scope: "app-level",
    },
    {
      id: "pricing-value",
      name: "Value Perception",
      description: "Users want the Workspace AI tier to deliver clear, measurable ROI",
      severity: 3,
      frequency: 0,
      apps: ["general"],
      quotes: [],
      competitorAlternatives: [
        { tool: "ChatGPT Team", reason: "Users compare value at $25/user/month" },
        { tool: "Claude Pro", reason: "Users cite strong reasoning and document analysis at $20/month" },
      ],
      scope: "platform",
    },
  ];
}

// ── Keyword mapping ──

export const THEME_KEYWORDS: Record<string, string[]> = {
  hallucination: ["hallucinate", "hallucination", "made up", "fabricat", "incorrect", "wrong information", "inaccurate", "not true", "false", "imagin", "invented"],
  "cross-app-memory": ["context", "memory", "remember", "forget", "loses context", "switch", "cross-app", "between apps", "side panel", "persistent"],
  "mobile-voice": ["mobile", "phone", "voice", "hands-free", "android", "ios", "cramped", "small screen", "touch"],
  "writing-quality": ["help me write", "generic", "bland", "corporate", "tone", "style", "rewrite", "fluff", "cookie-cutter", "boilerplate"],
  "formula-weakness": ["formula", "spreadsheet", "sheets", "vlookup", "array", "pivot", "calculation", "function"],
  "meeting-attribution": ["meeting", "summary", "action item", "transcript", "speaker", "attribution", "notes", "minutes", "meet"],
  "pricing-value": ["price", "pricing", "cost", "expensive", "worth", "value", "per user", "subscription", "tier", "pay"],
};

// ── Analysis engine ──

/**
 * Match raw feedback items to themes via keyword search.
 * Returns themes sorted by severity × frequency (highest impact first).
 * Up to 5 representative quotes are stored per theme.
 */
export function analyzeFeedback(raw: RawFeedback[], themes: PainPointTheme[]): PainPointTheme[] {
  const updated = themes.map((t) => ({ ...t, quotes: [] as PainPointTheme["quotes"], frequency: 0 }));

  for (const feedback of raw) {
    const lower = feedback.text.toLowerCase();
    for (const theme of updated) {
      const keywords = THEME_KEYWORDS[theme.id] ?? [];
      if (keywords.some((kw) => lower.includes(kw))) {
        theme.frequency++;
        if (theme.quotes.length < 5) {
          theme.quotes.push({
            text: feedback.text.slice(0, 300) + (feedback.text.length > 300 ? "..." : ""),
            source: feedback.source,
            url: feedback.url,
            author: feedback.author,
            date: feedback.date,
          });
        }
      }
    }
  }

  return updated.sort((a, b) => b.severity * b.frequency - a.severity * a.frequency);
}
