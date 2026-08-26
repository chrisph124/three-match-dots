---
title: 'Anchor / weight obstacle'
description: 'A paper weight that blocks a cell, is unlinkable, falls with gravity, and is removed by any 8-way-adjacent same-colour clear — a new clearAnchors objective in Journey + Voyage.'
status: pending
priority: P1
effort: '25h'
branch: feat/anchor-obstacle
tags: [journey, voyage, obstacle, anchor, weight, resolve, solver, generator, render]
created: 2026-08-26
---

# Anchor / weight obstacle

## Overview

Add the **anchor / weight** obstacle: a paper "weight" that occupies a board cell, is **not
linkable**, **falls with gravity**, and is **removed by ANY 8-way-adjacent same-colour clear**
(single-hit). When removed, the freed cell empties → falls → refills in the SAME resolution. A new
`clearAnchors` objective completes when the board holds no anchors. It ships in BOTH Journey
(authored) and Voyage (generated); generated levels stay provably winnable.

Design authority (LOCKED): `plans/brainstorms/260826-1640-anchor-weight-obstacle.md`. This plan
translates that contract into six executable phases; it does not re-open any locked decision.

The obstacle mirrors the shipped **caged-dot overlay** spine
(`src/core/obstacles/caged-dot.ts` → `src/core/resolve-caged-chain.ts` → folded in
`journey-state.ts` / `voyage-state.ts` → modelled by `solver.ts` → placed by `generate-level.ts` →
drawn by `src/render/cage-overlay-layer.tsx`). Anchor is a `Set<CellIndex>` overlay (single-hit, no
layers) that parallels each of those seams. The one genuinely new integration is R1: emptying a cell
that was NOT in the chain, in the same gravity/refill pass — handled by a generic, mechanic-agnostic
seam on `resolveChain`, never by teaching the colour core the word "anchor".

## Architecture at a glance (data flow)

```
INPUT (worklet)                CORE (pure TS, Vitest)                       STATE FOLD (pure TS)
─────────────                  ──────────────────────                       ───────────────────
finger → cellAtPoint           resolveChain(state, chain,                   applyJourney/VoyageResolution:
  → anchor mask? drop cell       protectedCells, {skipCollect,                caged  = remapMoves(chipLayers(...))
  → canAppend (UNCHANGED)        expandCleared})                              anchors = remapAnchors(
                                   collectCleared(skip anchors)                        survivors(resolution), falls)
                                   cleared / protectedHits / expandedCleared   objectives = foldObjectives(
                                   applyGravity(cleared ++ expanded)                     ..., cagedRemaining, anchorsRemaining)
                                   refill → Resolution(+ expandedCleared)
```

- Anchor never enters `chain` (INPUT suppression) so `hot/can-append.ts` and every `hot/**` worklet
  stay byte-identical (Approach ①).
- `removeAdjacent` is ONE pure function shared by the runtime seam AND the solver heuristic — no drift
  (the level-83 divergence lesson).

## Goals

| #   | Goal                                                                                                                      | Priority |
| --- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Anchor obstacle authorable (Journey) + generatable (Voyage), validated by the level schema                                | P1       |
| 2   | Anchor is unlinkable, falls with gravity, and is removed by any 8-way-adjacent same-colour clear (single-hit)             | P1       |
| 3   | Removed anchor's cell empties → falls → refills in ONE resolution pass; scores 0; not counted toward colour objectives    | P1       |
| 4   | New `clearAnchors` objective completes when every anchor is gone (mirrors `freeCaged`)                                    | P1       |
| 5   | Solver models anchors (unlinkable + adjacency-removal); every generated level stays winnable within a recalibrated budget | P1       |
| 6   | Anchors render as paper weights (creative-bible tone) with a HUD remaining-count; Endless untouched                       | P2       |
| 7   | `src/core/**` stays RN-free; `hot/**` untouched; one shared removal rule; no `any`; docs synced                           | P1       |

## Decisions (locked — from the brainstorm decision table)

| #   | Decision       | Choice                                                                                                 |
| --- | -------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Clear model    | Adjacent chain clears it (not sink-to-bottom)                                                          |
| 2   | Trigger rule   | 8-way adjacency, ANY colour of same-colour clear (incl. diagonals)                                     |
| 3   | Resistance     | Single-hit — one qualifying adjacent clear removes it (no weight-N / HP)                               |
| 4   | Role           | Objective + blocker — new `clearAnchors` objective, mirroring `freeCaged`                              |
| 5   | Scope (modes)  | BOTH Journey (authored) + Voyage (generated)                                                           |
| 6   | Representation | Approach ① — `Set<CellIndex>` overlay + threaded seams; `hot/**` and Board value domain byte-identical |

### Plan-level decisions (settled here; each has a documented alternative)

- **D-SCHEMA — version handling.** Bump the accepted-version union to `{1,2,3}` and keep `anchor` +
  `clearAnchors` **additive and un-gated** (accepted at any version, exactly like the `cagedDot`
  `layers` field precedent — added optional at `level-script.ts:54-58` with the explicit "so no
  `schemaVersion` bump" rationale at `:50`). Rationale: gating anchor behind v3 would force
  the Voyage generator's anchor-bearing levels to emit v3, breaking the ladder-wide assertions at
  `generate-level.test.ts:37-39` and `episode-1.test.ts:16-23` (both assert every level is v2) for
  zero compatibility gain. The ONLY version-assertion test that must change is
  `level-script.test.ts:181` (the "rejects an unknown schemaVersion" case sets `i.schemaVersion = 3` at
  `:185`; change it to
  `4`). Alternative rejected: bump-and-gate (breaks two ladder-wide test suites).
- **D-SEAM — R1 mechanism.** A generic `expandCleared` seam on `resolveChain` (brainstorm option a),
  NOT a duplicated `resolve-anchor-chain` orchestrator (option b). Recommended and pre-confirmed after
  reading `gravity.ts` (reads only `.index`, so extra empties feed straight into one pass),
  `refill.ts`, and `collect-cleared.ts`. Detail + the final go/no-go checkpoint live in Phase 2.
- **D-NAME — Resolution echo field is generic (`expandedCleared`), not `anchorsRemoved`.** The LOCKED
  constraint (brainstorm lines 74-75) says the core "never learns anchor". So `resolveChain` echoes the
  seam's extra-emptied indices on a mechanic-agnostic field `expandedCleared?: readonly CellIndex[]`
  (same spirit as `protectedHits?`), absent when empty ⇒ byte-identical for every current caller. The
  anchor-aware state/objective layer is what interprets them as removed anchors. (The brainstorm's
  shorthand "anchorsRemoved" maps to this field.)

## Phases

| #   | Phase                                                                                | Depends on | Effort | Status  |
| --- | ------------------------------------------------------------------------------------ | ---------- | ------ | ------- |
| 1   | [Schema + core anchor module](./phase-01-start.md)                                   | —          | 4h     | Pending |
| 2   | [Resolve integration (R1 seam)](./phase-02-resolve-integration.md)                   | 1          | 5h     | Pending |
| 3   | [State folds, objective, input suppression](./phase-03-state-folds-and-objective.md) | 2          | 5h     | Pending |
| 4   | [Solver + generator (winnability)](./phase-04-solver-and-generator.md)               | 3          | 5h     | Pending |
| 5   | [Render overlay + HUD (on-device)](./phase-05-render-overlay-and-hud.md)             | 1, 2, 3    | 4h     | Pending |
| 6   | [Docs sync + review close-out](./phase-06-docs-sync-and-review.md)                   | 1-5        | 2h     | Pending |

Dependency chain: **1 → 2 → 3 → 4**; **5** depends on **1-3** (render needs the schema, the
Resolution echo, and the state-exposed anchor set); **6** depends on **all**.

## Scope

- New pure-TS core module `src/core/obstacles/anchor.ts` (+ tests): `buildAnchors`, `removeAdjacent`
  (the one shared rule), `remapAnchors`, `toMask`.
- Schema: `anchor` obstacle + `clearAnchors` objective in `src/core/level/level-script.ts`.
- Resolve: a generic seam on `src/core/resolve/resolve-chain.ts` + a skip-set on
  `src/core/resolve/collect-cleared.ts`; a combined bridge `src/core/resolve-anchor-chain.ts`.
- State: anchor set threaded through `journey-state.ts` + `voyage-state.ts`; `clearAnchors` in
  `journey/objectives.ts`; `shuffle.ts` + `deadlock.ts` made anchor-aware.
- Input: anchored-cell suppression in `src/input/use-board-gesture.ts` (+ a worklet-readable mask).
- Solver/generator: anchors modelled in `voyage/solver.ts` + `voyage/enumerate-moves.ts`; placed by
  `voyage/generate-level.ts` + `voyage/archetypes.ts` + `voyage/cage-layout.ts`; tuning constants in
  `voyage/voyage-config.ts`.
- Render: new `src/render/anchor-overlay-layer.tsx`, wired into `journey.tsx` + `voyage-game.tsx`; HUD
  remaining-count via the existing objective badge.
- Docs: `docs/level-script-schema.md`, `docs/three-dots-game-design.md`, `docs/tech-stack-and-infra.md`,
  `docs/project-bible.md` (index only if a module is added).

## Non-goals (explicit)

- **No multi-hit / weight-N / HP anchors** — single-hit only; weight-N is the cage's identity.
- **No sink-to-bottom "exit the board" gravity model** — adjacent-clear removal only.
- **No specific-colour-vulnerability anchors** — 8-way ANY colour only; no per-anchor `color`/`layers`
  field.
- **No new biome or palette; Endless mode untouched** — `DOT_COLORS[0..2]` frozen.
- **No general multi-obstacle framework; no locked-tile / colour-lock; no Android.**
- **No mixed cage+anchor generated Voyage levels for v1** — an anchor archetype places only anchors
  (collision-free bottom placement). Mixed levels remain possible via authored Journey levels
  (schema's duplicate-cell guard protects them).

## Success Criteria

Maps the brainstorm's Acceptance (on-device) + Automatable gate.

**Automatable (Vitest / CI — the pre-handoff gate):**

- [ ] `anchor.test.ts`: 8-way adjacency incl. diagonals; single-hit removal; `removeAdjacent` returns
      `{ removed, survivors }`; `remapAnchors` follows a fall and a shuffle permutation; `toMask` pure.
- [ ] Schema accept/reject: `anchor` obstacle + `clearAnchors` objective parse; off-board / duplicate
      / `clearAnchors`-without-anchor rejected; version union accepts 3; `level-script.test.ts:181`
      updated (unknown version = 4).
- [ ] Resolve: an 8-adjacent clear empties the anchor cell in ONE pass; `Resolution.expandedCleared`
      carries the removed indices; anchor cell scores 0 and does not advance any `clearColor`; a sweep
      does not collect an anchor cell.
- [ ] Objective + state fold: `clearAnchors` done only at empty anchor set; a full commit threads
      the anchor set through removal → gravity remap; `shuffle`/`deadlock` correct with anchors.
- [ ] Solver winnability sweep with anchors passes; every generated level parses via
      `parseLevelScript` and is solver-winnable within its recalibrated budget.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage:diff` all green;
      `src/core/**` RN-free; `hot/**` unchanged.

**On-device (worklet/native — not Vitest-testable):**

- [ ] Anchors render as visible paper weights; HUD shows the remaining anchor count.
- [ ] An anchor cannot be linked; dragging over it does not break a valid chain routed around it.
- [ ] An anchor falls with gravity; it is preserved in place across a deadlock reshuffle.
- [ ] Any 8-way-adjacent same-colour clear (plain / loop-sweep / line-sweep) removes the anchor; its
      cell refills with a normal dot; the HUD counts down.
- [ ] Endless mode is visually + behaviourally unchanged.

## Open questions (for the implementer / owner)

1. **Anchor count per difficulty band** — starting recommendation is a small per-band constant in
   `voyage-config.ts` (Phase 4), finalised by the solver sweep + on-device playtest, not pre-committed.
2. **Render motif** — exact paper-weight silhouette + HUD label ("Anchors"), owner sign-off on-device
   (Phase 5), within the LOCKED `docs/creative-bible.md`.

## Validation Log

### Session 1 — 2026-08-26 (ak-plan validate)

**Verification pass (Full tier, 6 phases).** Re-grepped every load-bearing citation against
source — all VERIFIED, no drift:

- Resolve seam: `resolveChain(state, chain, protectedCells)` at `resolve-chain.ts:54` already carries
  a generic `protectedCells` seam echoing `protectedHits?` (the exact precedent D-SEAM/D-NAME extend);
  `applyGravity` reads only `.index` (`gravity.ts:17`), so the R1 one-pass mechanism is sound.
- Schema: version union `{1,2}` at `:154`; `obstacleSchema:54`; no-bump comment `:50`; `checkObjectives:269`
  - freeCaged gate `:283-288`; `cagedCells:434` + anticipatory type-filter comment `:431-432`.
- Caged template, state folds, solver/enumerator, generator, render, meta hooks, input — all citations
  accurate (`buildCaged:17`/`chipLayers:76`/`remapMoves:101`; `hasLegalMove@deadlock.ts:78`;
  `shuffleBoard@shuffle.ts:51`; `enumerateMoves:253`; `stepOnce@solver.ts:178`; `CageOverlayLayer:154`).

**Git state reconciled.** Repo is on `main @ ce6daf9`; `design/level-ladder-and-environment` is merged
and gone. Frontmatter `branch:` corrected to `feat/anchor-obstacle` (the implementation branch).

**Decisions (interview).**

- **D-SCHEMA — confirmed as written (owner choice).** Bump the version union to `{1,2,3}` and keep
  `anchor`/`clearAnchors` additive + un-gated; edit only the `level-script.test.ts` unknown-version case
  (`schemaVersion = 3` → `4`). The alternative (leave the union at `{1,2}`, purest `layers`-field
  precedent, zero test edit) was presented and declined. No phase content changes — the plan already
  reflects this choice (Phase 1).
- **D-NAME — confirmed (no interview needed).** Resolution echo field stays generic `expandedCleared?`,
  settled by the LOCKED brainstorm constraint "core never learns anchor" + the verified `protectedHits?`
  precedent.
- **D-SEAM — confirmed (no interview needed).** Generic `expandCleared`/`skipCollect` seam on
  `resolveChain`, validated by `gravity.ts` reading only `.index` and `refill` running after the merged
  empties.

**Consistency sweep.** Zero unresolved contradictions. Only stale item was the `branch:` frontmatter
(fixed). Dependency chain (1→2→3→4; 5←1-3; 6←all) is acyclic and matches the phase files.

**Terminal handoff.** Plan validated and ready for `/ak:cook`. Implementation authorization is a separate
owner go-ahead. Plan + spec committed on `feat/anchor-obstacle`.

<!-- slug: anchor-weight-obstacle -->
