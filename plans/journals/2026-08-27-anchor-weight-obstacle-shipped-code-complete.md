---
title: Anchor / weight obstacle shipped code-complete
date: 2026-08-27
summary: 'A single-hit paper weight that blocks a cell, is unlinkable, falls with gravity, and is removed by any 8-way-adjacent clear of any colour; a new clearAnchors objective in Journey + Voyage. Threaded through a generic overlay-blind core seam; gates green, full-diff review clean (ship-it), on-device verification handed to owner.'
---

# Anchor / weight obstacle shipped code-complete

## What happened

Executed the accepted 6-phase plan end-to-end under phase-by-phase-with-gates. A second board
obstacle now ships alongside the caged dot: the **anchor / weight** — a paper weight that occupies
a cell (a real colour underneath), is **unlinkable**, **falls with gravity**, and is **removed by
ANY clear whose cleared cell is 8-way adjacent to it** (any colour, single-hit, no layers). Its
freed cell empties → falls → refills in the SAME resolution. New `clearAnchors` objective; ships in
both Journey (authored) and Voyage (generated, provably winnable). Endless never uses it.

Built this pass:

- **Core module (Phase 1):** `src/core/obstacles/anchor.ts` — `buildAnchors`, `removeAdjacent`
  (the ONE 8-way removal rule: an anchor is removed iff a cleared cell is `areAdjacent` to it),
  `dropAnchors`/`remapAnchors` (gravity + shuffle follow), `toMask` (0/1 worklet input). Schema
  gained an `anchor` obstacle arm + a `clearAnchors` objective; the accepted-version union bumped
  to `{1,2,3}` with anchor/`clearAnchors` **additive and un-gated** (v3 is a doc marker, not a
  behavioural gate — Voyage still requires v2).
- **Core seam (Phase 2):** `resolveChain` gained a generic, mechanic-agnostic
  `{ skipCollect?, expandCleared? }` argument echoing `Resolution.expandedCleared` — the colour core
  never learns the word "anchor". `skipCollect` keeps an anchor cell out of a colour-sweep's
  collection; `expandCleared` maps the scored `cleared` set to the extra cells to empty in ONE
  gravity/refill pass. `src/core/resolve-anchor-chain.ts` is the single bridge; `resolve-caged-chain.ts`
  was refactored to delegate through it with an empty anchor set, so both obstacles compose through
  one path (pinned byte-identical by test).
- **State + objective (Phase 3):** anchor set threaded through `use-journey-state.ts` +
  `use-voyage-state.ts` (removal → gravity remap); `clearAnchors` folded in `journey/objectives.ts`;
  `shuffle.ts` + `deadlock.ts` made anchor-aware; input suppression + a worklet-readable anchor mask
  in `use-board-gesture.ts`, so `hot/**` stays byte-identical.
- **Solver + generator (Phase 4):** `voyage/solver.ts` + `enumerate-moves.ts` model anchors
  (unlinkable + adjacency-removal) through the SAME `removeAdjacent`, so the winnability proof can't
  diverge from real play (the level-83 lesson); placed by `generate-level.ts` / `archetypes.ts`,
  recalibrated budgets.
- **Render (Phase 5):** `src/render/anchor-overlay-layer.tsx` — a sibling `pointerEvents="none"`
  overlay, gravity-follow via the shared board-animation offsets; wired into `journey.tsx` +
  `voyage-game.tsx`; HUD remaining-count via the existing objective badge ("Anchors").

## Decision

- **The R1 mechanism is a generic seam, not a duplicated orchestrator** (D-SEAM). Emptying a cell
  that was never in the chain rides the same gravity/refill pass via `expandCleared`, because
  `applyGravity` reads only `.index`. The echo field is generic `expandedCleared` (D-NAME), absent
  when empty ⇒ byte-identical for every existing caller.
- **One removal rule, two callers.** `removeAdjacent` is shared verbatim by the runtime fold and the
  solver heuristic — the structural guarantee that a level passing the winnability sweep is beatable
  with the real mechanic.
- **Overlays are disjoint.** The schema dedups obstacles by cell, so a cage and an anchor can never
  share a cell; their echo channels (`protectedHits` / `expandedCleared`) never overlap, so gravity
  never double-punches.

## Verification

- Gates green on the final tree: `lint` 0, `typecheck` 0, `test` 487/487 (43 files),
  `coverage:diff` OK. Coverage baseline refreshed (97.43 / 95.92 / 99.03 / 97.44; 40 files).
- Full-diff code review: **clean (ship-it)** — all 7 invariants (RN-free core, `hot/**` untouched,
  Endless untouched, shared removal rule, disjoint overlays, no `any`/AI-attribution/plan-IDs,
  gravity+reshuffle follow) and 4 acceptance criteria verified against source; docs match code. Two
  cosmetic nits only — a "Skia overlay" doc wording slip (fixed → "overlay layer") and two
  pre-existing >200-line files the reviewer recommended NOT splitting.

## Remaining gate

On-device acceptance (Phase 5 render overlay + HUD on a real iPhone): the Skia/Reanimated/gesture
layers are code-complete but not Vitest-testable, so the anchor's visible weight, unlinkability,
gravity-fall, reshuffle-preservation, adjacency-removal, and HUD countdown await an owner playtest —
the one open item on the plan's On-device success criteria. All uncommitted on `feat/anchor-obstacle`.

## Reusable lesson

The pattern — a generic `{ skipCollect, expandCleared }` seam on an overlay-blind colour core, plus
"one removal rule shared verbatim by runtime and solver" — will recur for the remaining obstacle
catalog. It is already captured in `docs/tech-stack-and-infra.md` (the 2026-08-27 seam note) and
mirrors the caged-dot spine documented in `CLAUDE.md`, so it stays a documented convention rather
than a new `.claude/skills/` skill (noted in the PR description instead).
