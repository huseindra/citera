// Evidence strength as a tiered meter — derived from observable signals
// (retrieval rank + grounding method), deliberately NOT a percentage:
// tiers are honest, percentages are false precision.

const TIERS: Record<string, { filled: number; label: string; tone: string }> = {
  strong: { filled: 3, label: "Strong evidence", tone: "bg-emerald-500" },
  moderate: { filled: 2, label: "Moderate evidence", tone: "bg-amber-500" },
  weak: { filled: 1, label: "Weak evidence", tone: "bg-red-400" },
};

export function StrengthMeter({ strength }: { strength: string | null }) {
  if (!strength || !TIERS[strength]) return null;
  const tier = TIERS[strength];
  return (
    <div
      className="mt-2 flex items-center gap-2"
      role="meter"
      aria-valuenow={tier.filled}
      aria-valuemin={0}
      aria-valuemax={3}
      aria-label={tier.label}
    >
      <div className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-5 rounded-full ${
              i <= tier.filled ? tier.tone : "bg-stone-200"
            }`}
          />
        ))}
      </div>
      <span className="text-[11px] text-stone-500">{tier.label}</span>
      <span
        className="cursor-help text-[10px] text-stone-300"
        title="Derived from retrieval rank and grounding method — never from model self-confidence."
      >
        ⓘ
      </span>
    </div>
  );
}
