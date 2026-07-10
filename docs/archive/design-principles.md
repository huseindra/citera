# Design Principles

## Philosophy

Design for evidence, not dashboards.

The interface should feel like an AI research workspace where users investigate evidence rather than browse reports.

Every interaction should increase understanding and reviewer confidence.

---

## Inspiration

The overall experience should take inspiration from products such as:

* FutureSearch
* Perplexity
* Linear
* Notion
* GitHub

These products prioritize clarity, focus, and progressive disclosure instead of information density.

---

## Workspace First

The application should behave like a workspace rather than a CRUD application.

Prefer:

* split layouts
* resizable panels
* contextual sidebars
* persistent document viewer

Avoid multi-page workflows whenever possible.

---

## Evidence First

Evidence should always appear before AI conclusions.

Preferred hierarchy:

Evidence

↓

Regulation

↓

AI Finding

↓

Suggested Rewrite

Users should never need to trust the model without seeing supporting evidence.

---

## Progressive Disclosure

Show only the information necessary for the current task.

Reveal additional details only when users request them.

Avoid overwhelming reviewers with excessive information.

---

## Primary Workspace

The default review screen should include:

* Document Viewer
* Findings Panel
* Evidence Explorer
* Citation Panel
* Evidence Heatmap
* Semantic Evidence Map

Everything should remain visible within a single workspace.

---

## Visual Style

The interface should be:

* clean
* minimal
* professional
* calm
* information-dense without feeling cluttered

Avoid decorative UI elements.

Every visual component should communicate useful information.

---

## Interaction Principles

Every finding should be clickable.

Every citation should be inspectable.

Every similarity score should reveal its supporting evidence.

Every visualization should support drill-down exploration.

---

## Color System

Colors represent information rather than branding.

Examples:

* Green → Strong evidence
* Yellow → Partial alignment
* Red → Missing or conflicting evidence
* Blue → Navigation and interaction

Never use color only for decoration.

---

## Motion

Animations should explain transitions.

Keep motion subtle and fast.

Avoid distracting effects.

---

## User Experience Goal

The application should feel less like chatting with AI and more like working alongside an expert research assistant.

Users should spend their time exploring evidence, not managing the interface.
