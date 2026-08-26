---
title: 'Voyage Infinite Mode'
description: 'A generated, Candy-Crush-scale level ladder (thousands of levels, boss every 10th) with a shadow-box paper-diorama environment — a third mode beside Endless and Journey.'
status: in-progress
priority: P1
effort: ''
tags: [voyage, generation, level-design, render, environment]
created: 2026-08-24
---

# Voyage Infinite Mode

## Overview

Add a third mode — **Voyage** — a near-infinite, generated level ladder in the
Candy-Crush _skeleton_ (level progression, a boss every 10th level, episode theming) but with a
**Two-Dots soul** (papery restraint, no confetti-spam). Levels are emitted at runtime by a pure-TS
generator, each validated against the existing `LevelScript` schema. A "shadow-box diorama"
environment replaces the near-black canvas without breaking the proven dot-contrast floor.

This plan builds the **full architecture** (schema v2, difficulty model, generator, variety budget,
headless solver, state machine, render system) and ships a **vertical slice**: Voyage playable through
**Episode 1 (levels 1–10, incl. the level-10 boss "The Caged Core")** with **2 biomes**, the
virtualized navigation ribbon, all three constraint types, and per-level progress persistence.
Levels 11+ _generate and validate_ on the same 2 biomes and the extended palette — extending biomes
(3–5) is a separate art track (see Non-goals).

Design authority: `plans/brainstorms/` Voyage brainstorm (this session) + the environment report
`plans/reports/design-260824-0746-saga-environment-strategy.md`. Grounded in the shipped
`src/core/level/level-script.ts`, `src/core/journey/*` (the pattern Voyage mirrors), and
`docs/level-script-schema.md`.

## Goals

| #   | Goal                                                                                            | Priority |
| --- | ----------------------------------------------------------------------------------------------- | -------- |
| 1   | A generated level ladder that scales to thousands without per-level art or authoring            | P1       |
| 2   | Levels stay fresh: nearby levels differ in ≥40% of a feature signature                          | P1       |
| 3   | A boss every 10th level that reads as a boss with zero bespoke art; level-10 = "The Caged Core" | P1       |
| 4   | Kill the black background via the shadow-box diorama, preserving the WCAG dot-contrast floor    | P1       |
| 5   | Provably winnable generated levels via a headless solver bot that gates move/time budgets       | P1       |
| 6   | Episode 1 (levels 1–10) playable on-device with 2 biomes and the navigation ribbon              | P1       |

## Scope

**In:** schema v2 (mode `voyage`, constraint union, `voyage`/`theme` blocks); the pure difficulty model
(curve → budget → dials); the generator (archetypes + variety metric + episode-1 curated ladder +
boss pool); the headless solver + budget calibration; the pure Voyage state machine + RN hook
(moves/timed/mistakes fail-states); the render system (backdrop diorama, board panel, navigation
ribbon, boss modifier, HUD, juice) shipping **2 biomes** and an **extended dot palette (target up to
5 hues)**; packed per-level progress persistence.

**Vertical slice content:** Episode 1 levels 1–10 curated (teaching ramp + Caged Core boss).

## Non-goals (this plan)

- Biomes 3–5 (art track). _(Palette extension IS in scope this plan — see Phase 6.)_
- Multi-layer "guardian" cage and spreading "blight" obstacles (future `schemaVersion` bumps; see
  the roadmap note in Phase 4 — guardian before blight).
- Android, monetization/IAP, leaderboards/accounts. Journey and Endless modes stay untouched.

## Phases

| #   | Phase                                                                                | Status | Depends on |
| --- | ------------------------------------------------------------------------------------ | ------ | ---------- |
| 1   | [Schema v2 — the LevelScript contract](./phase-01-start.md)                          | Done   | —          |
| 2   | [Voyage state machine](./phase-02-voyage-state-machine.md)                           | Done   | 1          |
| 3   | [Difficulty curve and budget](./phase-03-difficulty-curve-and-budget.md)             | Done   | 1          |
| 4   | [Generation engine and variety](./phase-04-generation-engine-and-variety.md)         | Done   | 1, 3       |
| 5   | [Solver bot and calibration](./phase-05-solver-bot-and-calibration.md)               | Done   | 2, 4       |
| 6   | [Environment diorama render](./phase-06-environment-diorama-render.md)               | Done   | 1          |
| 7   | [Navigation ribbon and persistence](./phase-07-navigation-ribbon-and-persistence.md) | Done   | 2, 4, 6    |
| 8   | [Boss visuals, HUD and juice](./phase-08-boss-visuals-hud-and-juice.md)              | Done   | 2, 6       |

Parallelism: after Phase 1, Phases 2/3/6 run concurrently. Phase 4 follows 3; Phase 5 follows 4+2;
Phases 7/8 are render close-out after their deps.

**Status (2026-08-24):** ALL phases code-complete. The pure-TS engine — **Phases 1–5** — is green
(353 tests, typecheck/lint/coverage clean, `src/core/voyage/**` RN-free). **Phases 6–8 (the Skia
render layer: diorama backdrop, navigation ribbon, boss visuals/HUD/juice) are now built** and pass
every automatable gate (typecheck/lint clean, 353 tests, coverage ≥ baseline) plus a `code-reviewer`
pass (findings H1 push→replace nav, M1 effects-bundle memo, L1 cleared-level unlock — all fixed).
Because these layers are worklet/native, the **remaining gate is owner on-device verification** —
visual appearance, raw frame rate, and persistence surviving a real app restart. The Voyage mode is
wired into the title menu (`/voyage` → ladder → `/voyage-game`) and playable.

**Update (2026-08-26):** Build wall cleared. The app now builds, installs, and launches
**crash-free** on iPhone 16e after the worklets pin-back (SDK-57 0.10.1), and the title screen renders
(Skia + Reanimated + worklets init clean; the persisted score survives via MMKV). This removes the
blocker that prevented any on-device verification — the render stack is confirmed to initialize. The
remaining gate is unchanged: the human visual/feel walk of the diorama/ribbon/boss/moves-fail
criteria below, tracked in
[`plans/reports/verification-260826-1407-on-device-render-signoff.md`](../reports/verification-260826-1407-on-device-render-signoff.md).

## Success Criteria

- [x] `npm test` green, incl. new pure-core suites: schema v2 (accepts v1 + v2, rejects bad voyage
      levels), curve/budget math, generator output validity, variety-window rule, solver winnability.
- [x] Every generated level for indices 1..N passes `parseLevelScript` (CI sweep).
- [x] Episode 1 ladder matches the designed teaching order; "The Caged Core" = bottom-anchored 8
      cages spanning ≥2 colors, solver-winnable within its calibrated budget.
- [x] `src/core/voyage/**` has zero RN/Skia imports (Vitest-pure); render-math stays geometry-pure.
- [ ] On-device: the diorama replaces the black, the ribbon navigates episode 1, the boss reads as a
      boss, and the moves fail-state (out-of-moves → soft fold) works. _(Phases 6–8 — handoff.)_
- [x] `npm run lint`, `npm run typecheck`, and `npm run coverage:diff` all green.

## Decisions (validate gate, 2026-08-24)

1. **Mode name = "Voyage"** (locked): `mode: 'voyage'`, level ids `voyage-NNN-…`, MMKV keys
   `voyage.progress.epN`, and the internal code namespace `src/core/voyage/` · `src/render/voyage/`.
2. **Palette extended** (target up to 5 hues) — moved from a Non-goal into scope: Phase 3 gains color-
   dial headroom, Phase 6 adds the new dot colors (each gated by the contrast + colorblind checks).
3. **Tuning defaults accepted** as starting points — solver budget = p75 + slack (Phase 5); variety =
   differ ≥40% within a window of 8 (Phase 4). Refined from the solver sweep + playtest, not final now.
4. **Slice = Episode 1** (levels 1–10 + the Caged Core boss) with **2 biomes**, playable on-device.

## Residual (resolve during implementation)

1. **Exact added hue count/values** — chosen in Phase 6 (target up to 5 total), each clearing WCAG 3:1
   on `PANEL_BASE` (L ≤ 0.058) **and** colorblind-distinguishable from the existing hues.
2. **Final tuning constants** — set from the Phase 5 solver sweep and on-device playtest; all live in
   `voyage-config.ts` (one edit point), never pre-committed as gospel.

<!-- slug: voyage-infinite-mode -->
