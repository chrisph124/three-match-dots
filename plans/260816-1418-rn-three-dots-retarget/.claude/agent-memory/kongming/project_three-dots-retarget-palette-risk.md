---
name: three-dots-retarget-palette-risk
description: Residual accessibility/visual-parity gap found in Decision C (palette extension) during the 260816 red-team go/no-go review
metadata:
  type: project
---

Plan: `plans/260816-1418-rn-three-dots-retarget/` (plan.md + phase-01/02/03). User overrode
kongming's recommended ≤3-color cap (Decision C in `plan.md` Red Team Review) — chose to extend
`src/render/palette.ts#DOT_COLORS` to ≥5 hues instead of capping levels at 3 colors.

**Two concrete gaps this override opens, not yet covered in plan text as of 2026-08-16:**

1. **Accessibility contradiction with the doc Phase 2 is about to port.** The archived
   `docs/creative-bible.md` (source: `archive/swift-pivot-260816:docs/creative-bible.md`, §2.2)
   states a LOCKED rule: "dot identity is carried by color AND a shape/pattern... No state is
   communicated by color alone." Phase 3 only extends hues (`palette.ts`) — `src/render/dot-layer.tsx:40`
   renders `<Circle color={colorFor(colorId)} />` only, no shape/pattern prop, and Phase 3's
   Related Code Files never touches `dot-layer.tsx`. So the moment Phase 2 lands the ported
   creative-bible verbatim, `main` will carry a LOCKED accessibility rule its own renderer visibly
   violates — the exact spec/code drift class Phase 2 exists to eliminate, reintroduced by Phase 3
   in the same plan. Not a hard blocker (vertical slice, not full ship) but should be an explicit
   scoped caveat in the ported doc + Phase 3 step 7, not silent.
2. **Palette index-stability / Endless visual parity not pinned in text.** `palette.ts` is a
   render file, not Vitest-covered (test boundary is `src/core/` only), and no test greps
   `DOT_COLORS`/hex values. Nothing in Phase 3 explicitly requires indices 0-2 keep their current
   hex values when "extending" — if the palette author reshuffles all 5 hues for coherence instead
   of appending, Endless's on-screen dot colors change with zero core-file diff, so the plan's own
   "no diffs under `src/core/resolve/**`, `hot/**`, `game.ts`, `game.tsx`" Endless-unaffected check
   would not catch it. Archived creative-bible §2.2 already has the right rule for this ("index
   stability: append-only") — just needs to be pulled into Phase 3's Architecture/Success Criteria.

**Also flagged, lower severity:** `src/core/shuffle.ts:73-78`'s pigeonhole-legality comment
(`colors * minChain <= rows * cols`) is an unenforced invariant. Decision C is what makes
`colors > 3` reachable via level scripts; Phase 2's zod fail-fast rules (phase-02 §3 step 3) don't
encode this cross-field bound. Low risk for the one shipping level (`japan-01`, fixed seed, tested
winnable) but a future/careless level author could ship a soft-locked Journey board. Cheap fix:
add the invariant to the fail-fast bounds list next to the other zod rules.

**Verdict given (2026-08-16 go/no-go):** none of these are Critical/blocking — all three are
small textual additions (a caveat sentence + an index-stability note + one more zod bound), not a
redesign. Did not re-litigate Decision C itself (confirmed user creative call). If re-consulted on
this plan, check whether these three landed in text before re-auditing from scratch.

See [[three-dots-retarget-plan-review-workflow]] for how this project runs plan review rounds.
