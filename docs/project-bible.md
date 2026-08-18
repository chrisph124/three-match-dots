# Project Bible — Three Dots (Docs Index)

**The single entry point to the project's documentation.** This is an **index**: it routes to the
one-doc-per-concern set with a one-line "what / authority" note for each. It does **not** restate
their content — the linked doc is always the authority.

> **Not the creative bible.** This file (`project-bible.md`) is a docs _index_. The look/feel/tone
> authority is [`creative-bible.md`](./creative-bible.md), which is **LOCKED** — edits there require
> a bible update, not a one-off. Don't confuse the two; edits meant for look/feel go in
> `creative-bible.md`, never here.

Authority legend: **[authority]** = the owning source of truth · **[reference]** = supporting detail ·
**[superseded]** = kept for history, not current.

## Product & Design

- [`three-dots-game-design.md`](./three-dots-game-design.md) — **[authority]** what the game is:
  core mechanic, the two modes (Endless shipped, Journey designed), v1 slice, deferred vision.
- [`three-dots-gameplay-script.md`](./three-dots-gameplay-script.md) — **[reference]** beat-by-beat
  walkthrough of the shipped **Endless** experience (screens + gameplay beats → engine layers).
- [`two-dots-game-design.md`](./two-dots-game-design.md) — **[superseded]** original concept.
- [`two-dots-gameplay-script.md`](./two-dots-gameplay-script.md) — **[superseded]** original
  (timer/game-over) walkthrough; replaced by the three-dots script.

## Creative

- [`creative-bible.md`](./creative-bible.md) — **[authority · LOCKED]** look, feel, motion, sound,
  tone; the anti-drift source of truth.
- [`creative-tool-catalog.md`](./creative-tool-catalog.md) — **[reference]** the tools that produce
  art/audio assets.
- [`rnd-department.md`](./rnd-department.md) — **[reference]** the agent workflow for level/art authoring.
- [`game-scripts/index.md`](./game-scripts/index.md) — **[reference]** creative pre-production space
  (ideas, characters, modes, levels, materials, font-style, philosophy, spirit) — see § Game-Scripts.

## Technical

- [`CLAUDE.md`](../CLAUDE.md) — **[authority]** architecture, tech stack, dev rules, team workflow.
- [`tech-stack-and-infra.md`](./tech-stack-and-infra.md) — **[reference]** stack/infra decisions **and**
  the `src/`-layer architecture map (the technical reference).
- [`expo-scaffold-design.md`](./expo-scaffold-design.md) — **[reference]** how the Expo app was scaffolded.
- [`service-setup.md`](./service-setup.md) — **[reference]** Sentry / PostHog external-service setup.

## Security & Supply Chain

- [`security-and-supply-chain.md`](./security-and-supply-chain.md) — **[authority]** Node lifecycle,
  the Expo/native pin set, `audit:diff` + coverage diff-gate, secret scanning, vendored-harness
  vetting, and branch protection.

## Levels / Journey

- [`level-script-schema.md`](./level-script-schema.md) — **[authority]** the level-script contract a
  Journey loader parses (obstacles, objectives, board config).

## Monetization / Compliance

- [`monetization-and-roadmap.md`](./monetization-and-roadmap.md) — **[reference]** the deferred economy
  and expansion roadmap (not in v1).
- [`apple-compliance-checklist.md`](./apple-compliance-checklist.md) — **[reference]** App Store
  compliance, to satisfy before first TestFlight.

## Process / Workflow

- [`team-workflow-design.md`](./team-workflow-design.md) — **[reference]** the team's 6-step workflow design.
- [`stack-and-workflow-cheatsheet.html`](./stack-and-workflow-cheatsheet.html) — **[reference]** one-page cheatsheet.
- Process artifacts (plans, brainstorms, journals, reports, lessons) live under `plans/` — routing in
  [`CLAUDE.md`](../CLAUDE.md) → Team Workflow.

## Game-Scripts

- [`game-scripts/index.md`](./game-scripts/index.md) — **[reference]** the creative pre-production home
  and its doc-sync (Confluence-style) contract. Sections: ideas · characters · game-modes · levels ·
  materials · font-style · philosophy · game-spirit.

---

_When a new doc is added or a concern is renamed, update this index in the same change (the doc-sync
rule in [`CLAUDE.md`](../CLAUDE.md) → Documentation Management). This index links; it never duplicates
authority._
