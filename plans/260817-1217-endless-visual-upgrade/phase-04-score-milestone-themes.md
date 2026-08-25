---
phase: 4
title: 'Score-milestone theme index + cross-fade'
status: dropped
priority: P1
effort: '1-1.5d'
dependencies: [1, 3]
---

# Phase 4: Score-milestone theme index + cross-fade

## Overview

Make the backdrop **evolve at score milestones**. The active theme is a **pure function
of the already-persisted score** — no new persistence, no timer, no fail state, one
continuous board (preserves the shipped zen contract). Crossing a milestone cross-fades
to the next **dark, receded crisp flat-vector scene** (no gradient, no blur — Phase 3's
reworked look); Reduce Motion swaps instantly.

**v1 scope (validation #3):** the themes indexed here are the **dark city-skyline**
identity's **milestone states** (from Phase 3's dark-family ramp of flat-color states),
not distinct cities. The index math is identical whether the catalog later grows to
distinct cities — no rework.

**Static-scene invariant (Phase 3 mitigation 4):** the scene itself never animates. The
only motion here is the milestone cross-fade, which must be **slow and rare** and **must
not fire during active linking** — a scene change mid-drag is the exact peripheral-motion
distraction Phase 3's mitigations exist to avoid.

## Requirements

- Functional: `themeIndexForScore(score)` maps score → an index into `CITY_THEMES`,
  monotonic non-decreasing, clamped at the last theme.
- Functional: when the index changes, the backdrop cross-fades old→new **slowly** and
  **only while the board is idle** (not during an active chain drag or a resolving commit);
  with Reduce Motion on, it swaps with no animation.
- Functional: resetting the score (Settings) returns the backdrop to the first theme —
  because it derives from score, this is automatic (no second source of truth).
- Non-functional: the index function is **pure** and Vitest-covered; the cross-fade is
  Reanimated (on-device verified).

## Architecture

- **Pure index** — `src/render/themes/theme-for-score.ts`: `MILESTONES: readonly
number[]` (ascending score breakpoints) + `themeIndexForScore(score): number` =
  count of milestones `<= score`, clamped to `CITY_THEMES.length - 1`. Imports only
  `city-themes.ts` (pure) — **no Skia**, so it is Vitest-testable. Add this file to the
  Vitest include (mirror how `src/render/geometry.ts` is already included) — the only
  test-config change in this plan; Skia components stay excluded.
- **Cross-fade** — `src/effects/use-theme-crossfade.ts` (or inline in `game.tsx`):
  holds `fromIndex`/`toIndex` + a `fadeT` shared value. On index change: if
  `useReduceMotion()` → set current instantly; else `fadeT: 0→1 withTiming` at a **slow,
  calm duration** (this is a scenery dissolve, not a UI transition — keep it long enough to
  be barely-noticed, e.g. ~600-900ms, dial). Defer the fade start until the board is idle so
  it never overlaps a drag/commit. `backdrop.tsx` gains an overload to render two **flat
  scenes** with a fade opacity (draw `to` over `from`, opacity `fadeT`), collapsing to one
  when idle. Two flat scenes stacked briefly is cheap — no blur, no gradient to composite.
- **Wiring** — `game.tsx` derives `themeIndexForScore(game.score)`; feeds the crossfade
  driver; passes the resolved theme(s) to `BoardCanvas`/`Backdrop`. No MMKV key added.

## Related Code Files

- Create: `src/render/themes/theme-for-score.ts` (pure) + its Vitest spec.
- Create (or inline): `src/effects/use-theme-crossfade.ts`.
- Modify: `src/render/backdrop.tsx` — two-theme cross-fade render path.
- Modify: `src/app/game.tsx` — derive index from score, drive the fade, pass themes.
- Modify: `vitest.config.*` — add `theme-for-score.ts` to the pure-test include.
- **Docs (debt from the brief + a LOCKED-rule tension kongming surfaced):**
  - Modify: `docs/three-dots-game-design.md` — the Endless **"Progression"** table row
    (currently "Endless single board", ~line 93): record score-milestone backdrops
    (still one board, no fail state).
  - Modify: `docs/creative-bible.md` **§2.5 itself** (and the §7 "Locked vs TBD"
    summary line). §2.5 is LOCKED as _"2D isometric parallax sprite layers... Buildings
    unlock/light up as cities are cleared"_ and §7 lists _"2D isometric growing city"_
    as LOCKED. This plan's Endless backdrop is **procedural (not isometric sprites) and
    score-gated (not unlock-on-city-clear)** — a real deviation, not a naming overlap.
    Per the bible's own §6.4 ("changing a LOCKED rule is a real decision recorded
    here — not a silent per-asset exception"), amend §2.5 to explicitly permit the
    Endless procedural, score-milestone backdrop as a scoped variant, and keep the
    isometric-sprite / unlock-on-city-clear approach as the Journey city direction.
    While there, add the disambiguation between **"Endless score-gated backdrop theme"**
    and **"Journey world-map city."** (Ownership note: §2.5's isometric clause sits
    under general "2. Visual language"; if the bible owner intended it Journey-only from
    the start, a one-line scope clarification suffices instead of a carve-out — confirm
    with the owner, non-blocking.)
  - **Colour+shape rule (§2.2, LOCKED) — stays UNMET; record the colour-only choice.** The bible's
    shipped-status note (§2.2, lines ~47-51) already flags the colour+shape identity rule as _not yet
    met_, describing the shipped renderer as drawing _"plain circles: color only, no shape/pattern
    channel."_ Phase 3's fourth pass makes dots **dead-flat colour-only discs** — no shape/pattern
    channel is added, and **the user explicitly chose to accept this gap** over a per-colour
    silhouette. So the note **stays as-is** (still `not yet met`, still colour-only) — do **not**
    rewrite it to "met." The only edit here is to make the gap explicit and durable: append a line
    that the Endless visual upgrade **kept dot identity colour-only by decision**, and that §2.2 must
    **not** be cited as satisfied in store/compliance copy until a shape/pattern channel actually
    ships. (There is **no ink-ring reference in the bible** to touch — the ring was an artifact of the
    uncommitted first cut, never written into the shipped-status note.) Also revert any code comment
    that claims the rule is met — notably `src/render/palette.ts` (lines ~12-16).
  - **"Backgrounds recede" (§2.2 "harmony", LOCKED) — NO exception needed (drop the prior
    one).** The rule lives in **§2.2** (line 54: _"Backgrounds recede; dots pop via
    saturation/shape contrast, not brightness alone"_). The 2026-08-18 re-pivot makes the
    Endless city **dark and receded**, which **complies** with §2.2 — the earlier full-bleed
    "a bit richer" cut needed a documented exception here, but the dark receded scene does
    not. **No §2.2/§6-rule-4 amendment is taken.** If the earlier exception text was already
    drafted into the bible, remove it; otherwise write nothing to §2.2. Journey's backgrounds
    still recede — unchanged.

## Implementation Steps

1. Write `theme-for-score.ts` with `MILESTONES` (start evenly spaced; tune on device)
   and the clamped index function.
2. Add it to the Vitest include; write cases: below first milestone → 0; exactly on a
   milestone → next index; monotonic across the ramp; huge score → clamped last;
   negative/zero guarded.
3. Add the cross-fade driver (Reduce Motion → instant) and the two-theme backdrop path.
4. Wire `game.tsx`: index from `game.score`, drive fade, pass themes.
5. Update the docs: the Endless "Progression" row; the §2.5 + §7 bible amendment for
   the procedural score-gated backdrop; the colour+shape shipped-status note (**stays UNMET —
   colour-only by decision**, add the explicit-gap line; do **not** mark it met) and revert the
   stale `palette.ts` "rule met" comment; the Endless-vs-Journey city disambiguation. **No §2.2
   "backgrounds recede" exception** — the dark, receded scene complies; if the earlier full-bleed
   exception was drafted into the bible, remove it.
6. On-device: cross a milestone, confirm smooth fade + intact dot contrast; toggle
   Reduce Motion → instant swap; reset score in Settings → back to theme 0.

## Success Criteria

- [ ] `themeIndexForScore` is pure and Vitest-covered (boundaries, monotonic, clamp).
- [ ] Backdrop cross-fades on milestone crossing; Reduce Motion swaps instantly.
- [ ] Theme is reproducible from score alone; reset returns to theme 0; no MMKV key
      added.
- [ ] Dot contrast unaffected by theme (opaque panel — dots sit on fixed `panelBase`).
- [ ] Docs updated: Endless "Progression" row; `creative-bible.md` §2.5 + §7 amended
      to record the procedural score-gated backdrop as a scoped exception to the LOCKED
      isometric-sprite approach; Endless-vs-Journey city disambiguation added; the
      colour+shape shipped-status note **stays UNMET (colour-only by decision)** with an explicit
      "not to be cited as satisfied" line added, and the stale `palette.ts` "rule met" comment
      reverted. **No §2.2 "backgrounds recede" exception** — the dark, receded scene complies with
      §2.2 (the prior full-bleed exception is dropped).
- [ ] `lint` + `typecheck` + `test` green.

## Risk Assessment

- **Milestone tuning is guessy.** Signal: themes change too fast/slow on device.
  Response: `MILESTONES` is a single const dial; the mockup values were illustrative —
  set an even ramp, confirm on device. Not a blocker.
- **Vitest include widening leaks Skia into the pure suite.** Signal: the pure test
  run imports a native/Skia module and fails under Node. Response: keep
  `theme-for-score.ts` importing only `city-themes.ts` (pure data); never import
  `backdrop.tsx` from it.
- **Fade hurts contrast mid-transition** (two scenes briefly stacked). Signal:
  dots dip below the contrast floor during the fade. Response: Phase 3's panel is **opaque**
  — dots never sit on the scene, only on the fixed `panelBase` — so a mid-fade cannot touch
  dot contrast at all. Still sanity-check a crossing on device that the flat-disc contrast
  ratio (measured once vs `panelBase`) is visibly unaffected.
