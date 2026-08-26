---
title: 'Layered cages and first-cage teaching'
description: 'Make cages visible + layered (N hits to break), keep every level provably winnable, and teach the mechanic with a one-time dismissible popup.'
status: done
priority: P1
effort: '5-7d'
tags: [voyage, journey, obstacle, cage, tutorial, render, solver, calibration]
created: 2026-08-24
---

# Layered cages and first-cage teaching

## Overview

Cages today are (a) INVISIBLE on the board in both Journey and Voyage — a caged dot looks
identical to a normal dot, so the player can't tell what to clear — and (b) trivial: freed the
instant the cell is cleared once. This plan makes cages **visible** (a paper cage + remaining-layer
pips drawn in a sibling overlay), **layered** (N hits to break: a caged dot stays linkable and each
same-colour clear that includes it strips one layer; it only pops on the final layer), keeps every
generated level **provably winnable** under re-calibrated budgets, and **teaches** the mechanic once
via a dismissible "don't show again" popup on the first cage encounter.

Source brainstorm (accepted): `plans/brainstorms/260824-2239-cage-layers-and-first-cage-teaching.md`.

## The load-bearing architecture decision (R1 — SETTLED)

A non-final caged dot must **survive a clear in place** ("only pops on the final layer"), yet the
tested colour core (`resolveChain`) has already cleared + gravity-settled any cleared cell before the
Journey/Voyage overlay folds. Resolved via advisory counsel (kongming): **Path 1, refined.**

- Extend `resolveChain(state, chain, protectedCells?: ReadonlySet<CellIndex>)` with a **generic,
  default-off** protected-cells param. The core never learns the words "cage" or "layers".
- Validation (`isCommittable`), classification (`classifyChain`), and colour all run on the **FULL
  chain** — untouched. Only the collected cleared set is split:
  `cleared = collected ∖ protected` (falls / scores / refills exactly as today);
  `protectedHits = collected ∩ protected` echoed on the `Resolution` for the overlay + chip juice.
- **Byte-identical when the param is omitted** — same discipline as the heat economy already added to
  this file (`resolve-chain.ts:52-54`), proven by the existing `resolve-chain.test.ts` passing
  UNMODIFIED plus a new property test `resolveChain(s,c) deepEquals resolveChain(s,c,new Set())`.
- Overlay computes `protectedOf(caged)` = cells with layers ≥ 2 and passes it **unconditionally**
  (protecting a cell that would not clear is a no-op, so the overlay never predicts classify/collect).
  A 1-layer cage is never protected ⇒ clears exactly as today (teach band stays byte-identical).

Rejected: **Path 2** (pure-overlay re-resolve) forks the single resolution authority, duplicates
~50 lines incl. the documented falls/spawns ordering contract, and still needs the private
`isCommittable` — "core untouched" is an illusion. **Path 3** (strip-at-commit) downgrades sweep
classification (stripping a caged corner from a 2×2 loop makes it not-a-loop) — it would cancel the
player's strongest move on the game's very first taught obstacle. Full reasoning in
`plans/reports/` (kongming counsel, this session) and Phase 1.

## Resolved questions (from the brainstorm's "resolve in planning")

| Q                         | Answer                                                                                                                                                                                                                                                                                                                                                                                                                | Where     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Q1 (R1)                   | `protectedCells` param + `protectedHits` echo (Path 1 refined)                                                                                                                                                                                                                                                                                                                                                        | Phase 1   |
| Q2 layer authoring        | Difficulty-**derived**; optional authored `layers?` override; **no `schemaVersion` bump** (optional field is backward-compat)                                                                                                                                                                                                                                                                                         | Phase 2   |
| Q3 N per band             | `CAGE_LAYERS = {teach:1, mid:2, boss:3}` in `voyage-config.ts`; refined by solver sweep + on-device                                                                                                                                                                                                                                                                                                                   | Phase 2/4 |
| Q4 sweep chips one layer  | Yes — automatic, `protectedOf` = layers ≥ 2 (sweep pops 1-layer cages, chips multi-layer once)                                                                                                                                                                                                                                                                                                                        | Phase 1/3 |
| Q5 adjacency vs inclusion | **Inclusion** (caged cell in the collected cleared set); no adjacency component                                                                                                                                                                                                                                                                                                                                       | Phase 3   |
| R3 first-encounter        | First **multi-layer** cage (a level whose overlay has any entry with layers ≥ 2), gated by a **per-install** MMKV flag. NOT the first cage — the teach band is 1-layer (pops instantly) and can't demonstrate chipping (red-team F6). A 2-layer _teaching_ cage is now seeded on a pre-boss Voyage level and japan-01 carries one, so the first encounter is a low-stakes mid cage, not the L10 boss (Validation S1). | Phase 6   |
| clearColor × chip         | **Only pops count** — a chipped caged cell lands in `protectedHits`, never `cleared`, so it does not advance a `clearColor` objective. Documented + mirrored in `foldObjectives` AND the solver heuristic so they can't diverge (red-team F13).                                                                                                                                                                       | Phase 3/4 |

## Goals

| #   | Goal                                                                                     | Priority |
| --- | ---------------------------------------------------------------------------------------- | -------- |
| 1   | Cages are visible on the board with a remaining-layer indicator, both modes              | P1       |
| 2   | Cages take N hits to break (layered), caged dot stays linkable, pops only on final layer | P1       |
| 3   | Every generated ladder level stays provably winnable under re-calibrated budgets         | P1       |
| 4   | First cage encounter shows a one-time popup; "don't show again" survives app restart     | P1       |
| 5   | Tested colour core discipline preserved; core RN-free; render geometry-pure              | P1       |

## Phases

| #   | Phase                                                                                      | Status                          | Depends on |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------- | ---------- |
| 1   | [Core resolve seam](./phase-01-start.md)                                                   | Done                            | —          |
| 2   | [Layer data schema and generator](./phase-02-layer-data-schema-and-generator.md)           | Done                            | —          |
| 3   | [Layered cage overlay and folds](./phase-03-layered-cage-overlay-and-folds.md)             | Done                            | 1, 2       |
| 4   | [Solver winnability and recalibration](./phase-04-solver-winnability-and-recalibration.md) | Done                            | 2, 3       |
| 5   | [Cage overlay render layer](./phase-05-cage-overlay-render-layer.md)                       | Done (on-device verify pending) | 3          |
| 6   | [First-cage teaching popup](./phase-06-first-cage-teaching-popup.md)                       | Done (on-device verify pending) | 3, 5       |
| 7   | [Docs sync](./phase-07-docs-sync.md)                                                       | Done                            | 1-6        |

Phases 1 and 2 are independent and may run in parallel. Phase 5 and 6 are on-device (not
Vitest-testable) and gate on the Phase 3 caged-Map contract. Phases 1-4 are test-first.

**Update (2026-08-26):** Build wall cleared — the app builds + launches crash-free on iPhone 16e and
the render stack initializes. Phases 5 & 6 stay "on-device verify pending": the visible-cage overlay,
chip/pop feedback, and the first-multi-layer-cage teaching popup still need the human visual walk
(Voyage seeded ~L5 + japan-01), tracked in
[`plans/reports/verification-260826-1407-on-device-render-signoff.md`](../reports/verification-260826-1407-on-device-render-signoff.md).

## Constraints (from the accepted brainstorm)

- Keep `board-canvas.tsx` at origin (0,0) — cages draw in a **sibling** overlay layer (the
  `VoyageEffectsLayer` pattern), never by mutating the board canvas.
- Protect the tested colour core: the only edit to `resolve/**` is the generic default-off
  `protectedCells` param on `resolveChain` (+ optional `protectedHits` on `Resolution`). `hot/**`
  untouched. Existing `resolve-chain.test.ts` must pass with **zero edits to existing assertions**.
- `src/core/**` stays RN-free (Vitest-pure); `src/render/geometry.ts` stays pure arithmetic.
- Tuning constants (N per band) live in `src/core/voyage/voyage-config.ts` only.
- "Don't show again" via the established `createMMKV()` pattern (`src/meta/*-storage.ts`).
- Cage art stays paper-craft per the LOCKED `docs/creative-bible.md` (§2.4: folded-paper cage,
  shape carries distinctness — not colour alone; solid + shadow, no texture yet).
- Files ~<200 lines; kebab-case; no `any`; no AI attribution in commits.

## Non-goals

A general multi-mechanic tutorial framework (one popup, cage only); replacing the cage obstacle; new
obstacle types; Android; a `planClear`/`settleClear` core refactor (kongming's option 4b — YAGNI now,
the `protectedCells` param is its degenerate form and can evolve later without changing callers).

## Global acceptance

**Automatable (pre-handoff gate):** new/updated Vitest suites for the resolve seam (incl. byte-identity
property test), the layered overlay + chip logic, the objective fold, and solver winnability;
`npm run lint` / `typecheck` / `test` / `coverage:diff` green; `src/core/**` RN-free (grep anchored to
`from`/`require(`).

**On-device (worklet/native — not Vitest-testable):**

- First cage level shows visible cages with a remaining-layer indicator (pips/number), both modes
  (Journey requires the new Phase-3 `caged`/clear-event plumbing + its first sibling overlay).
- Clearing a caged dot's colour chips one layer; the dot pops only on the final layer; each of a
  mixed chain, a chip-only chain, and a sweep hitting mixed cages gives distinct feedback.
- Chip-only commit returns input cleanly (the incumbent settle path already unlocks — verify no
  empty-`cleared` special-case was introduced).
- `freeCaged` completes only when every cage is fully broken.
- Popup appears on the first **multi-layer** cage encounter (not a 1-layer teach cage); "don't show
  again" survives an app restart; popup never returns after.
- Generated + boss levels still win within their re-calibrated budgets.

## Success Criteria

- [x] Existing `resolve-chain.test.ts` green with zero edits to existing assertions
- [x] Byte-identity property test green (`resolveChain(s,c)` ≡ `resolveChain(s,c,new Set())`)
- [x] `resolveChain`'s new param is defaulted (not a bare optional) so every 2-arg caller is crash-safe
- [x] `generation-sweep.test.ts` proves every **generated + boss** level winnable within recalibrated
      budgets (purely 1-layer curated non-boss levels return raw — not swept; a curated level carrying
      any `layers ≥ 2` cage, e.g. the seeded Voyage teaching level, routes through `calibrateLevel` and
      is swept, Validation S1)
- [x] `caged` is a `Map<CellIndex, number>` end-to-end (core → BOTH hooks → HUD → boss HP bar → overlay)
- [x] `useJourneyState` newly exposes `caged` + a `JourneyClearEvent` (was absent — Journey was not symmetric)
- [x] `clearColor` advances only on an actual pop; chipping a target-colour cage does not count
- [x] Teaching popup wired to fire on the first **multi-layer** cage (`protectedOf(caged).size > 0`), never a 1-layer teach cage
- [ ] On-device: a first-time player chips a 2-layer cage and can narrate why it didn't pop _(on-device verify pending)_
- [x] No input lock after a chip-only commit — the incumbent settle path already unlocks; no empty-`cleared` special-case introduced (F11). _On-device confirmation pending._
- [x] Docs corrected in the same change (`three-dots-game-design.md`, `level-script-schema.md`, `tech-stack-and-infra.md`)

## Risks

- **R1 (settled) — participatory clear vs untouched core.** Resolved with Path 1 refined; residual
  risk is a default-path regression → mitigated by the byte-identity property test + unmodified
  existing suite (any needed edit to an existing assertion is a design smell → stop, re-examine).
- **R2 — solver winnability + budget recalibration.** The real seam is `solver.ts:148`, which today
  calls `resolveChain` with **no** protected set; it must pass `protectedOf(caged)` or the sweep would
  green while the boss ships unwinnable. `objectiveGain` must read `caged.get` (not `caged.has`) and
  count chips, reusing the pure `chipLayersInner` so solver and runtime can't diverge (level-83
  false-halt lesson). The parity test must pin that protected seam, not compare `applyVoyageResolution`
  to itself. Curated non-boss levels are NOT swept (they return raw); only generated + boss recalibrate.
  Re-run the sweep + `calibrateBudget`. Phase 4.
- **Risk A (kongming) — chip-feedback gap = the original complaint reborn.** A chip-only commit
  produces nothing in `resolution.cleared`, so with no chip juice the cage still "feels unsolvable."
  The overlay MUST rattle + decrement pips off `protectedHits`. On-device gate. Phase 5.
- **R3 — first-encounter trigger** per-install, not per-level, and gated on the first **multi-layer**
  cage (`protectedOf(caged).size > 0`) so a 1-layer teach cage never fires it. Phase 6.
- **R4 — tone.** Popup + cage art within the LOCKED creative bible (paper, restrained). Phase 5/6.

## Red Team Review

Adversarial review of this 7-phase plan (Full tier): 4 hostile reviewers in parallel, each carrying a
distinct lens + a verification role, every claim checked against the real codebase at `file:line`
(evidence-less findings auto-rejected). ~29 raw findings deduplicated to **16 with evidence**;
adjudicated **15 accepted + 1 rejected**. Two accepted findings carried a design fork resolved by the
user (F6, F13). All accepted findings are applied inline in the phase files above.

| #    | Sev      | Finding                                                                                                                                                                                                                                             | Verdict       | Applied where                                                                              |
| ---- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------ |
| F1   | Critical | Journey is NOT symmetric to Voyage — `useJourneyState` exposes no `caged` and emits no clear event; `journey.tsx` has no effects layer. "Both modes" was unbuildable as scoped.                                                                     | Accept        | P3 (add `caged`+`JourneyClearEvent` to hook), P5 (first journey overlay), P6 (trigger dep) |
| F2   | Critical | Solver seam: `solver.ts:148` calls `resolveChain` with NO protected set; parity test compared `applyVoyageResolution` to itself (trivial pass); `objectiveGain` used `caged.has` (over-credits chips). Boss could ship unwinnable on a green sweep. | Accept        | P4 (route `protectedOf`, rewrite parity test, `caged.get`, shared `chipLayersInner`)       |
| F3   | High     | Set→Map ripple missed `voyage-juice.ts:68` `fireCageJuice` + `voyage-game.tsx:111-119` `prevCaged` diff.                                                                                                                                            | Accept        | P3 (flag), P5 (edit — chip vs free)                                                        |
| F4   | High     | Boss HP bar path wrong (`src/render/voyage/voyage-boss-hpbar.tsx`); tally is per-colour; needs Map-value sum + `voyage-hud.tsx` prop change; "shows 24" framing wrong.                                                                              | Accept        | P5                                                                                         |
| F5   | High     | Band authority must be single (`cageLayersForIndex`), boss-first (L10 ∈ Episode-1 range); `isBossIndex` is private in `generate-level.ts` → move+export to `voyage-config.ts` to avoid a cycle.                                                     | Accept        | P2                                                                                         |
| F6   | High     | First-cage teaching on a 1-layer teach cage can't demonstrate chipping. **User decision: popup on first MULTI-layer cage** (`protectedOf(caged).size > 0`); teach band stays 1 layer.                                                               | Accept (user) | P6, plan R3                                                                                |
| F7   | Med      | Phase-1 snippet dereferenced a possibly-`undefined` optional param on the byte-identity path → every 2-arg caller throws. Default the param to `EMPTY_PROTECTED`.                                                                                   | Accept        | P1                                                                                         |
| F8   | Med      | `foldObjectives` third param must widen `ReadonlySet → ReadonlyMap`; `objectives.test.ts` Set literals `:77,81,90,107` → Map. Not "unchanged".                                                                                                      | Accept        | P3                                                                                         |
| F9   | Med      | Curated non-boss levels return RAW (`generate-level.ts:214-221`) — NOT recalibrated. Guard Episode-1 cages = 1 layer; route authored overrides through `calibrateLevel`.                                                                            | Accept        | P2, P4                                                                                     |
| F10  | Med      | Second `remapMoves` caller (`voyage-state.ts:213` `shuffle.moves`, `journey-state.ts:126`) must carry Map values.                                                                                                                                   | Accept        | P3                                                                                         |
| F11  | Med      | Settle-path race reframed: `playClear` `onDone` is unconditional (`clearSpan=max(len,1)`), so empty `cleared` already unlocks. Hazard is ADDING an empty-`cleared` special-case; forbid it.                                                         | Accept        | P3, plan                                                                                   |
| F12  | Med      | Add `.max(5)` to `layers` schema; note authored Journey levels are not solver-swept.                                                                                                                                                                | Accept        | P2, P7                                                                                     |
| F13  | Med      | `clearColor` × chip semantics. **User decision: only pops count** — a chip lands in `protectedHits`, never `cleared`; mirror the rule in `foldObjectives` AND the solver heuristic so they can't diverge.                                           | Accept (user) | P3, P4, P7                                                                                 |
| F14  | Low      | `cagedCells` DRY — make it the source, reimplement `cagedCellIndices` (`level-script.ts:411`) as `cagedCells(level).map(c => c.index)`.                                                                                                             | Accept        | P2                                                                                         |
| F15  | Low      | Use ONE shared `resolve-caged-chain.ts`, not two mode-named wrapper modules that would drift.                                                                                                                                                       | Accept        | P3                                                                                         |
| R4F8 | Med      | Widening `Resolution` with `protectedHits?` always-on is scope creep.                                                                                                                                                                               | **Reject**    | Intended, R1-settled boundary; confirming sentence added to P1                             |

### Whole-Plan Consistency Sweep

After applying all 14 accepted findings, re-read `plan.md` + every `phase-*.md` and grep-swept for
stale terms, renamed files, and superseded decisions. Reconciled:

- **`resolveVoyageChain`/`resolveJourneyChain` two-module naming** — fully removed (F15); every
  reference now the single `resolve-caged-chain.ts` / `resolveCagedChain`, consistent across P3, P4, plan.
- **`chipLayers` vs `chipLayersInner`** — P3 defines both (thin adapter + pure inner); P4 consumes
  `chipLayersInner`; plan R2 names it. Consistent.
- **`caged.has` → `caged.get`** — the only surviving `caged.has` mentions are the P4/plan passages that
  explicitly describe the change; no live spec still prescribes `.has`.
- **`caged.size > 0` trigger** — remaining hits are all the P6 contrast (`NOT caged.size > 0`); the
  binding predicate everywhere is `protectedOf(caged).size > 0`.
- **Boss HP bar path** — every reference is now `src/render/voyage/voyage-boss-hpbar.tsx`; no bare
  `boss-hpbar.tsx` and no "flat 24" framing remain (per-colour tally).
- **Sweep scope** — P4 Overview + Requirements + plan R2/success-criteria all now say "generated + boss"
  and call out curated-non-boss-returns-raw (F9); the earlier "every ladder level (generated, curated,
  boss)" phrasing was corrected.
- **`freeCleared`** — appears only as "replaces `freeCleared`" / "mirrors the `freeCleared`→`remapMoves`
  order", i.e. describing the code being replaced. Legitimate.
- **Effort** — phase efforts bumped for the F1 Journey plumbing (P3 → 1.5-2d, P5 → 1.5-2d); plan-level
  effort raised 3-5d → 5-7d to match.

No unresolved contradictions remain. The plan is internally consistent and validated (see Validation
Log below) — ready for `/ak:cook`.

## Validation Log

### Session 1 — 2026-08-24

**Trigger:** `/ak:plan validate` after the red-team apply — pin the content/tuning forks the plan had
flagged for on-device review before cook.
**Questions asked:** 3

#### Questions & Answers

1. **[Scope]** With the current ladder, the first `layers ≥ 2` cage a Voyage player meets — and thus the
   one-time teaching popup — lands on the L10 "Caged Core" boss (3 layers). Teaching a brand-new mechanic
   AT a boss is risky. How should the first teaching moment be placed?
   - Options: Seed an earlier mid cage | Accept teach-at-boss, defer
   - **Answer:** Seed an earlier mid cage
   - **Rationale:** Moves the first layered-cage encounter to a low-stakes pre-boss level so the popup
     teaches chipping before the boss demands it. Adds one authored 2-layer cage to Voyage Episode-1 and
     one calibrated level to the winnability sweep.

2. **[Scope]** japan-01's three cages are all 1-layer (trivial, never demonstrate layering; authored
   Journey levels are NOT solver-swept, red-team F12). What should japan-01 do this slice?
   - Options: Add a 2-layer cage | Keep 1-layer for now
   - **Answer:** Add a 2-layer cage
   - **Rationale:** The vertical-slice Journey level should showcase the headline mechanic. Because
     authored Journey levels aren't solver-swept, its winnability must be hand-verified on-device (F12).
     If Journey is reached before Voyage, this cage is also the natural teaching moment.

3. **[Risk]** Contingency: if the 3-layer × 8-cage "Caged Core" boss (24 required chips) can't reach a
   winnable state at a sane move budget in the Phase 4 sweep, which lever should be pulled first?
   - Options: Fewer cages, keep 3 layers | Reduce layers 3→2, keep 8 cages | Let the solver converge
   - **Answer:** Fewer cages, keep 3 layers
   - **Rationale:** Preserves the boss as the peak of the layer mechanic (3 layers, distinct from the
     2-layer mid band); layer reduction is a last resort only.

#### Confirmed Decisions

- **Seeded Voyage teaching cage:** a 2-layer authored cage on a pre-boss Episode-1 level (default target
  L5, keeping L4 as the 1-layer instant-pop intro; exact level tunable on-device for pacing). Authored via
  an explicit `layers: 2` on that cage — NOT via `cageLayersForIndex`, so the band authority stays clean.
- **japan-01:** gains ≥1 authored 2-layer cage; winnability hand-verified on-device (not solver-swept).
- **Curated sweep rule:** curated non-boss levels containing any `layers ≥ 2` cage route through
  `calibrateLevel` (exception to "curated returns raw"); purely 1-layer curated levels still return raw.
- **Boss-unwinnable fallback:** reduce cage count first (keep 3 layers); reduce layers only as a last resort.

#### Action Items

- [ ] Phase 2: author a `layers: 2` cage on the seeded pre-boss Voyage level (default L5); keep L4 at 1.
      Remove that level from the "byte-identical 1-layer guard" set.
- [ ] Phase 2: bump ≥1 japan-01 cage to `layers: 2` (authored); carry the hand-verify-winnability caveat.
- [ ] Phase 4: route curated levels with any multi-layer cage through `calibrateLevel`; prove the seeded
      Voyage teaching level `won: true`. Set the boss-unwinnable response to "fewer cages first, keep 3 layers."
- [ ] Phase 6: retarget the teaching-popup on-device steps from "L10 boss" to the seeded pre-boss 2-layer
      cage (and japan-01 for Journey); the "L4 does not fire" tripwire stays.
- [ ] Phase 7: document the seeded teaching cage + japan-01's authored 2-layer cage under the F12 caveat.

#### Impact on Phases

- **Phase 2:** +authored 2-layer teaching cage (Voyage) and +japan-01 2-layer cage; the "L4/L5/L9 all
  teach=1, byte-identical" statement is revised (the seeded cage is 2-layer, authored).
- **Phase 4:** curated levels with a multi-layer cage now route through `calibrateLevel`; boss fallback
  ordering pinned (cages first, keep 3 layers).
- **Phase 6:** teaching now fires on a low-stakes pre-boss cage (or japan-01), not the boss; on-device
  steps updated. The "japan-01 never fires it" claim is removed.
- **Phase 7:** the F12 authored-not-swept caveat gains two concrete instances.

### Whole-Plan Consistency Sweep (Validation Session 1)

After propagating the three validation decisions to phases 2/4/6/7, re-read `plan.md` + every
`phase-*.md` and grep-swept for stale claims the decisions could have contradicted (searched:
`japan-01`, `L10`/`Caged Core`, curated `return raw`/`not swept`, cage-level lists `L4/L5/L9`,
`chipping can't be shown`/`never fires`). Result:

- **One live contradiction found and fixed** — Phase 6's "Wrong predicate" risk still named **Voyage L5**
  and **Journey japan-01** as levels where the popup must NOT fire ("chipping can't be shown"). Validation
  S1 made L5 a seeded 2-layer cage and gave japan-01 an authored 2-layer cage, so both SHOULD now fire.
  Rewrote the signal to a purely-1-layer level (L4/L9 / generated teach-band) and noted L5 + japan-01 as
  the intended teaching moments.
- **`layers: 2` authoring path is consistent** — every mention routes the seeded L5 + japan-01 cages
  through the authored `obstacle.layers ?? 1` override (read by `cagedCells`), NEVER through
  `cageLayersForIndex`; the band authority stays a single boss-first rule (P2, P4, P6, P7, plan).
- **"byte-identical" guard is scoped correctly** — only L4 (and any other purely 1-layer curated cage)
  is called byte-identical; the seeded L5 is explicitly excluded (P2:54, P4:51). No file still claims
  "L4/L5/L9 all teach=1, byte-identical".
- **Curated-sweep exception is uniform** — P4 Overview/Requirements/Related-files, plan R2 +
  success-criteria all state: purely 1-layer curated non-boss levels return raw; a curated level with any
  `layers ≥ 2` cage routes through `calibrateLevel` and is swept (`hasMultiLayerCage` predicate). No
  unqualified "curated non-boss returns raw" remains.
- **Teaching lands pre-boss** — every teaching/first-encounter passage (plan R3, P6, P7, design-doc bullet)
  now says the popup fires on the seeded pre-boss L5 (or japan-01), not the L10 boss. The only remaining
  "L10 boss teaches" text is inside this Validation Log's Q1 problem-framing, which is correct to preserve.
- **Boss-unwinnable lever ordering is uniform** — P4 (Overview/Requirements/Risk/Success) and plan
  Validation Log agree: reduce cage count first (keep 3 layers), reduce layers only as a last resort.

No unresolved contradictions remain. Plan is internally consistent and ready for `/ak:cook`.

<!-- CONSISTENCY_SWEEP_ANCHOR -->

<!-- slug: layered-cages-and-first-cage-teaching -->
