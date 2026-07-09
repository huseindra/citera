// Ruleset identity — identifiable but subtle. Each authority owns a hue
// (FDA blue, HSA emerald, TGA teal, BPOM amber); preview/roadmap packs
// are slate until they ship. Soft backgrounds only, per the evidence-first
// color philosophy: color communicates which regulator, nothing else.

const AUTHORITY_TONES: [prefix: string, chip: string, dot: string][] = [
  ["fda", "bg-blue-100/70 text-blue-700", "bg-blue-600"],
  ["hsa", "bg-emerald-100/70 text-emerald-700", "bg-emerald-600"],
  ["tga", "bg-teal-100/70 text-teal-700", "bg-teal-600"],
  ["bpom", "bg-amber-100/70 text-amber-700", "bg-amber-600"],
];

const PREVIEW_TONE = ["bg-slate-100 text-slate-600", "bg-slate-400"] as const;

export function rulesetTone(
  rulesetId: string,
  status?: string,
): { chip: string; dot: string } {
  if (status && status !== "available") {
    return { chip: PREVIEW_TONE[0], dot: PREVIEW_TONE[1] };
  }
  for (const [prefix, chip, dot] of AUTHORITY_TONES) {
    if (rulesetId.startsWith(prefix)) return { chip, dot };
  }
  return { chip: PREVIEW_TONE[0], dot: PREVIEW_TONE[1] };
}

export function RulesetBadge({
  rulesetId,
  label,
  status,
}: {
  rulesetId: string;
  label: string;
  status?: string;
}) {
  const tone = rulesetTone(rulesetId, status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${tone.chip}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {label}
    </span>
  );
}
