# Citera Design System v1

The interface communicates **evidence, trust, precision, calm, professionalism** —
not "AI". Warm neutrals everywhere; color only where it carries meaning.
Implementation: Tailwind v4 `@theme` tokens in `apps/web/src/index.css` — spec
hexes are pinned there so utility classes resolve to exact values.

## Typography

**Geist Variable** (self-hosted via `@fontsource-variable/geist`), fallback Inter →
system. Applied globally through `--font-sans`. Generous line-height (`leading-5/6`
on prose), no compressed layouts.

## Neutrals (stone)

| Token | Hex | Use |
|---|---|---|
| `stone-50` | `#FAFAF9` | App background |
| `white` | `#FFFFFF` | Surface (cards) |
| `slate-50` | `#F8FAFC` | Secondary surface |
| `stone-200` | `#E7E5E4` | Borders, selected sidebar |
| `stone-900` | `#1C1917` | Primary text |
| `stone-500` | `#78716C` | Secondary text |
| `stone-400` | `#A8A29E` | Muted text |
| `sidebar` | `#FCFCFB` | Sidebar surfaces (`bg-sidebar`) |

## Brand blue — five permitted uses only

`blue-600 #2563EB` (hover `blue-700 #1D4ED8`, light `blue-100 #DBEAFE`): primary
buttons, links, focused inputs (global `:focus-visible` outline), selected
navigation/rows, important actions (checked controls). **Never** as a page
background, never decorative.

## Evidence palette (the visual identity)

| Meaning | Fg | Bg |
|---|---|---|
| Verified | `green-600 #16A34A` | `green-50 #F0FDF4` |
| Weak evidence | `amber-600 #CA8A04` | `amber-50 #FEFCE8` |
| Missing / conflicting | `red-600 #DC2626` | `red-50 #FEF2F2` |
| Information / evidence accent | `sky-600 #0284C7` | `sky-50 #F0F9FF` |

Finding status mapping (`lib/status.ts`): conflicting=red, partial=amber,
not_found=sky (evidence of absence is information, distinct from conflicting),
evaluation_failed=stone, satisfied=green. Severity chips: critical=red,
major=amber, minor=blue, passed=green. Soft backgrounds only.

## Ruleset identity (`components/RulesetBadge.tsx`)

FDA=blue · HSA=emerald · TGA=teal · BPOM=amber · preview/roadmap=slate.
Subtle: tinted chip or a 6px dot next to the authority name.

## Evidence Block (`components/EvidenceBlock.tsx`)

The one shape evidence always takes — used in the dossier, the report, and any
future surface:

- left `sky-500` accent border (4px), `sky-50/50` surface, 8px radius
- label ("Evidence" / "Protocol says"), the quoted text
- reference row: source · Page N · Section · char span
- `✓ Verified` in green **only** when the quote passed the span-grounding gate;
  ungrounded citations (e.g. protocol references from analysis) make no claim
- `accent="conflict"` variant (red) for the contradicting protocol passage

## Shape & depth

Borders over shadows; cards feel lightweight (`border-stone-200`, shadow only on
popovers/dialogs). Radius: inputs & buttons 8px (`rounded-lg`), cards 12px
(`rounded-xl`), dialogs 16px (`rounded-2xl`).

## Icons

lucide-react, outlined, minimal, never filled. Status icons live in
`STATUS_META`/`STEP_META` so every surface renders the same glyph.

## Sidebar

`bg-sidebar` (#FCFCFB), hover `stone-100`, selected `stone-200`; selected
navigation in the top bar uses the blue treatment.

## Litmus test

Every screen should feel printable, trustworthy, and focused on evidence —
"if Stripe built software for regulatory reviewers."
