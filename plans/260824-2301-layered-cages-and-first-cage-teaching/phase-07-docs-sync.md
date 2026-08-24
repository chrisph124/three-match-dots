---
phase: 7
title: 'Docs sync'
status: done
priority: P2
effort: '0.5d'
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: Docs sync

## Overview

Update the evergreen docs so they describe cages as visible + layered, correct the stale "can't be
linked while caged" claim, and document the optional `layers?` schema field and derived-layer defaults.
Docs are synchronized in the SAME change as the behaviour (project rule) — this phase is the paper
trail that behaviour has already landed in Phases 1-6.

<!-- Updated: Validation Session 1 - document japan-01's 2-layer cage + the seeded pre-boss teaching cage; note teaching lands pre-boss, and that multi-layer curated levels route through calibrateLevel -->

## Requirements

- Functional (each an evidence-backed edit against the shipped code):
  - `docs/three-dots-game-design.md:132` — currently says a caged dot "can't be linked while caged".
    That is now WRONG: the caged dot **stays linkable**, and each same-colour clear including it strips
    one layer; it pops only on the final layer. Correct the mechanic description and the freeing rule.
  - `docs/level-script-schema.md` — document the optional `layers?: number` field on the `cagedDot`
    obstacle (integer 1–5, default 1 = today's behaviour, no `schemaVersion` bump), the derived-by-band
    default (`CAGE_LAYERS = {teach:1, mid:2, boss:3}`) with the note that an authored value overrides it,
    and the caveat that authored Journey levels are NOT solver-swept so a `layers ≥ 2` authored cage must
    be hand-verified winnable (red-team F12). Name the two concrete authored `layers: 2` instances shipped
    this slice (Validation S1): **japan-01's** 2-layer cage (hand-verified on-device) and the **seeded
    pre-boss Voyage teaching cage** (default L5 — a curated `layers: 2` cage, which is why curated levels
    with a multi-layer cage now route through `calibrateLevel`, unlike purely 1-layer curated levels).
  - `docs/three-dots-game-design.md` (ladder/teaching section) — note the layered mechanic is first
    taught on a **low-stakes pre-boss mid cage** (and japan-01), not on the L10 Caged Core boss, via a
    one-time popup gated to the first `layers ≥ 2` cage (Validation S1).
  - `docs/three-dots-game-design.md` (objective section) — document that a `clearColor` objective
    advances **only on an actual pop**; chipping a cage of the target colour (a `protectedHits` hit)
    does not count (red-team F13, user decision). Same rule holds in both the runtime `foldObjectives`
    and the solver heuristic.
  - `docs/tech-stack-and-infra.md` (the `src/` architecture map) — add the new modules if they
    constitute a real boundary: the cage overlay render layer (`src/render/cage-overlay-layer.tsx`),
    the resolve-chain protected-cells seam, `tutorial-flags.ts`. Note `caged` is now
    `Map<CellIndex, number>`.
  - `docs/creative-bible.md` §2.4 — only if the built cage art introduced a decision worth locking
    (pip vs numeric indicator). LOCKED file — touch deliberately, not as a side effect; if the build
    matched the existing spec, leave it.
  - `docs/project-bible.md` (index) — add/rename entries only if a doc was added or a concern renamed.
  - Record the final recalibrated per-band budgets (from Phase 4) wherever budgets are documented.
- Non-functional: update the smallest owning surface; cross-link, don't duplicate. Verify every claim
  against the shipped `src/` + tests before writing (docs rule: read before update, verify after).

## Architecture

Documentation-only. The gameplay walkthrough, the schema contract, and the architecture map each own
one concern; edit the owning surface and link. Do not restate mechanics across files.

## Related Code Files

- Modify: `docs/three-dots-game-design.md` (caged mechanic + freeing rule, ~L132)
- Modify: `docs/level-script-schema.md` (`layers?` field, derived defaults)
- Modify: `docs/tech-stack-and-infra.md` (architecture map: new modules, caged Map)
- Modify (conditional): `docs/creative-bible.md` §2.4, `docs/project-bible.md`
- Reference (source of truth for the edits): the Phase 1-6 code + tests

## Implementation Steps

1. Re-read each target doc section BEFORE editing (docs rule).
2. Correct `three-dots-game-design.md` mechanic/freeing text against the shipped `chipLayers` behaviour.
3. Document `layers?` + derived defaults in `level-script-schema.md`.
4. Update the architecture map + note the `Map<CellIndex, number>` type change.
5. Conditionally touch the creative bible / project-bible index only if warranted.
6. Verify links resolve and every claim matches source/tests.

## Success Criteria

- [ ] `three-dots-game-design.md` no longer says the caged dot can't be linked; freeing rule correct
- [ ] `three-dots-game-design.md` states `clearColor` counts only pops, not chips (F13)
- [ ] `level-script-schema.md` documents `layers?` (optional, int 1–5, default 1, no version bump) +
      band defaults + the authored-Journey-not-swept caveat (F12), naming japan-01's 2-layer cage and the
      seeded curated teaching cage as the shipped instances (Validation S1)
- [ ] `three-dots-game-design.md` notes the mechanic is first taught pre-boss (seeded mid cage / japan-01),
      not at the L10 boss (Validation S1)
- [ ] Architecture map lists the new modules and the caged `Map` type
- [ ] Final recalibrated budgets recorded
- [ ] All doc claims verified against shipped code/tests; links resolve
- [ ] No accidental edits to LOCKED creative-bible content

## Risk Assessment

- **Docs drift from code.** The whole point of this phase; risk is describing intended-not-shipped
  behaviour. Signal: a doc claim no test/code backs. Response: verify each edit against `src/` + the
  passing suites before writing; if a claim can't be sourced, fix the code or drop the claim.
- **Editing the LOCKED bible casually.** Response: touch §2.4 only for a genuine locked art decision;
  otherwise leave it and note the decision in the PR instead.
