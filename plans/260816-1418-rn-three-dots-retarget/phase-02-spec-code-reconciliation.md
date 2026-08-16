---
phase: 2
title: 'Spec ↔ Code Reconciliation'
status: done # todo | in-progress | done
priority: P1
effort: '0.5d'
dependencies: [1]
---

# Phase 2: Spec ↔ Code Reconciliation

## Overview

Bring the "Three Dots" concept onto `main` and make the docs describe the game
that actually ships. The concept docs live only on `archive/swift-pivot-260816`;
`main` still frames the game as "Two Dots mold, endless-only." Port the concept
docs (retargeting Swift → RN), reconcile them with the shipped 8-way core, and
repoint CLAUDE.md. Docs-only phase — no code, no behavior change.

## Requirements

- Functional:
  - The Three Dots concept docs exist on `main` under `docs/`, retargeted from
    Swift/SpriteKit to React Native / Skia / Reanimated.
  - The design spec matches shipped code on the one confirmed divergence:
    **adjacency is 8-way** (orthogonal + diagonal). (Locked decision — code wins;
    the archived GDD's 4-way spec is updated, not the code.)
  - The shipped **≥5-straight-line color-sweep** mechanic (present + tested in
    code, absent from the archived GDD) is documented as a kept bonus mechanic
    flagged for on-device tuning.
  - CLAUDE.md reframes the game as **Three Dots (Endless + Journey)** and its
    Key References resolve to real files on `main`.
  - The reversed Swift pivot is recorded as history without resurrecting it as
    authority.
- Non-functional:
  - No edits to `src/`. `docs/two-dots-game-design.md` is superseded, not
    deleted (history preserved).
  - Retargeting replaces engine-specific lines only; the engine-agnostic design
    intent is preserved verbatim where possible.

## Architecture

Source of truth for the port is the archive branch; read each file with
`git show archive/swift-pivot-260816:docs/<file>` and land a retargeted copy on
`main`. Retarget map (engine-specific → RN):

- `SKAction` / SpriteKit animation → `react-native-reanimated` worklets + Skia.
- `Rive` runtime → `rive-react-native`.
- `Codable` level decoding → TypeScript types + a `zod` validator (this is the
  contract Phase 3 implements).
- Any `.swift` / Xcode / SpriteKit scene references → the RN layer names already
  in use (`src/core`, `src/render`, `src/input`, `src/effects`, `src/meta`).

Ported set (archive → `docs/` on main):
`three-dots-game-design.md`, `creative-bible.md`, `level-script-schema.md`,
`monetization-and-roadmap.md`, `apple-compliance-checklist.md`,
`rnd-department.md`, `creative-tool-catalog.md`.
Explicitly **not** ported as authority: `native-swift-pivot-design.md` (stays on
archive; a one-line tombstone note records the reversal).

Confirmed code facts to fold into the ported GDD:

- `DEFAULT_CONFIG.minChain = 3` already ships → the "Three Dots" (≥3) namesake is
  already the default; no code change needed.
- `ChainKind` includes `'line'`, `ClearReason` includes `'color-sweep'`, and
  `lineLength = 5` → the straight-5 sweep is live and tested.
- 8-way adjacency lives in `src/core/hot/adjacency.ts` and is reflected in the
  current CLAUDE.md core-loop description.

## Related Code Files

- Create (port + retarget from archive): `docs/three-dots-game-design.md`,
  `docs/creative-bible.md`, `docs/level-script-schema.md`,
  `docs/monetization-and-roadmap.md`, `docs/apple-compliance-checklist.md`,
  `docs/rnd-department.md`, `docs/creative-tool-catalog.md`
- Modify: `CLAUDE.md` (reframe Overview to Three Dots / Endless + Journey; update
  Scope so a Journey vertical slice is in-progress not out-of-scope; repoint Key
  References to the ported docs; keep 8-way; note the ≥5-line sweep bonus)
- Modify: `docs/two-dots-game-design.md` (it already carries a supersede banner
  pointing at an older spec — **update** it to point at the three-dots GDD)
- Modify (or note in CLAUDE.md history): a one-line record that the Swift pivot
  was evaluated and reversed (RN retained); point to the archive branch

## Implementation Steps

1. For each ported doc, read the archive version, apply the retarget map, and
   write the RN-facing copy to `docs/` on `main`. Preserve engine-agnostic
   content; change only engine-specific lines. **Accessibility caveat:**
   `creative-bible.md` carries a LOCKED rule that dot identity is color **plus**
   shape/pattern (never color alone). The shipped renderer (`dot-layer.tsx` draws
   plain circles) does not satisfy it, and Phase 3's palette extension
   (Decision C) adds hues without a shape channel. Annotate that rule in the
   ported doc as **shipped-status: not yet met — shape/pattern deferred**, so the
   doc does not assert on `main` a guarantee the code doesn't keep (the exact
   drift Phase 2 exists to kill).
2. In `docs/three-dots-game-design.md`: change the adjacency spec from
   4-way/no-diagonals to **8-way**; add a short "shipped bonus mechanic" note
   documenting the ≥5-straight-line color-sweep and flagging it for on-device
   tuning (with only 3 colors a straight-5 is easy — expect to raise `lineLength`
   or lower `sweepMultiplier`, per the `config.ts` comment).
3. In `docs/level-script-schema.md`: replace `Codable`/Swift decoding language
   with the TS-types-plus-`zod` contract that Phase 3 implements.
   - **Board → `GameConfig`:** `cols`, `rows`, `colors`, `minChain` (plus
     `lineLength`, `baseScore`, `sweepMultiplier` if the level overrides them);
     objectives/obstacles map to Journey config.
   - **`colors` bound:** the render palette is extended in Phase 3 to ≥5 hues, so
     the schema allows `colors` up to the palette length and the zod validator
     **rejects `colors` beyond it** (a level can't request a hue the renderer
     can't draw). Keep the schema example (`colors: 5`) — valid against the
     extended palette.
   - **`seed` (new, optional):** add an optional integer `seed`. When present the
     board is dealt deterministically (Phase 3 threads it through
     `newJourney(level, seed)`); this is what makes a level's winnability and its
     caged-cell colors checkable at authoring time. Pure schema addition — does
     **not** touch `GameConfig`/`config.ts`.
   - **`spawnWeights`:** does NOT map to `GameConfig` — the shipped `refill.ts`
     does uniform color selection and `GameConfig` has no weighting field. Mark it
     **reserved / not yet wired** AND **optional with no length constraint** —
     explicitly delete/rewrite the archived doc's _validation rule_
     `spawnWeights.length == colors`, not just the field prose, so Phase 3's zod
     schema is never pushed to enforce it and touch `config.ts`/`refill.ts`.
   - **`cagedDot` is positional-only:** drop the obstacle's authored `color` from
     the ported schema — the shipped `newGame` fills cells by RNG with no per-cell
     override, so a `color` field would be decorative/misleading; under the new
     `seed` the cell's dealt color is deterministic and asserted in the level's
     fixture test instead. Cage shape: `{ type:'cagedDot', cell:{ col, row } }`.
   - **Freeing semantics:** a caged cell is freed by **any** clear of its color —
     a normal ≥3 chain, a 2×2-loop sweep, or a ≥5-line sweep — and loop/line
     sweeps clear that color **board-wide** (one sweep can free every cage of a
     color at once). Document as a tuning consideration, not just chain-adjacency.
   - **Fail-fast validation rules** (doc states them; Phase 3 zod enforces):
     `obstacle.cell.col ∈ [0,cols-1]`, `obstacle.cell.row ∈ [0,rows-1]`,
     `objective.color ∈ [0,colors-1]`, non-empty `objectives`, sane numeric ranges
     (`cols`/`rows`/`colors` > 0 under a ceiling; `timeMs` > 0); the board-legality
     invariant **`colors × minChain ≤ rows × cols`** (`shuffle.ts`'s reshuffle
     guarantee assumes it, and Journey's timer makes a soft-lock worse than endless
     zen — so a level that violates it must fail at parse, not at play); unknown
     `objective.type`/`obstacle.type` → validation error.
4. Update `CLAUDE.md`: reframe the game as Three Dots (Endless + timed Journey);
   move Journey from "out of scope" to "vertical slice in progress"; repoint Key
   References to the ported `docs/three-dots-*` set; confirm 8-way and the
   ≥5-line sweep are described.
5. Update the existing supersede banner in `docs/two-dots-game-design.md` to
   point at the three-dots GDD, and add the Swift-pivot reversal tombstone.
6. Verify every doc cross-link resolves on `main` (no dangling references to
   archive-only files).

## Success Criteria

- [ ] All seven concept docs exist on `main`, retargeted to RN (no `SKAction` /
      `Rive` / `Codable` / Xcode references remain as authority).
- [ ] `docs/three-dots-game-design.md` specifies 8-way adjacency and documents
      the ≥5-line color-sweep bonus.
- [ ] `docs/level-script-schema.md` describes a TS + `zod` contract, not Swift
      `Codable`, including the optional `seed`, the `colors ≤ palette length`
      bound, positional-only `cagedDot` (no authored `color`), reserved
      `spawnWeights` (no length rule), and the fail-fast bounds rules.
- [ ] CLAUDE.md frames the game as Three Dots (Endless + Journey) and every Key
      Reference link resolves to a file on `main`.
- [ ] `docs/two-dots-game-design.md` carries a supersede banner; the Swift-pivot
      reversal is recorded as history.
- [ ] No doc on `main` links to an archive-only file.

## Risk Assessment

- **Silent spec drift on adjacency reintroduced later.** Signal: a future doc or
  code change flips to 4-way. Response: treat any adjacency change as a bugfix
  with a regression test first (locked decision), never a silent doc edit.
- **Retarget loses design intent.** Signal: a ported doc reads as engine notes,
  not design. Response: retarget only engine-specific lines; keep the
  engine-agnostic prose verbatim; have `art-director-reviewer` sanity-check
  `creative-bible.md` against the shipped palette/feel.
- **Level-schema doc and Phase 3 code diverge.** Signal: Phase 3 zod types don't
  match the doc's JSON shape. Response: Phase 3 imports the doc's shape as the
  contract; if they must differ, update the doc in the same PR (single source).
