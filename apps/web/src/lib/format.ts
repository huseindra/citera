export function displayName(filename: string | null | undefined): string {
  if (!filename) return "Document";
  return filename.replace(/\.(md|markdown|txt|pdf)$/i, "").replace(/[-_]/g, " ");
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const RULESET_NAMES: Record<string, string> = {
  "fda-21cfr50": "FDA 21 CFR 50.25 — Informed Consent",
};

export function rulesetName(id: string): string {
  return RULESET_NAMES[id] ?? id;
}
