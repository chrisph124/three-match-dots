---
title: 'Phase 3: Read-outs and transient heat (gated)'
status: todo
---

# Phase 3: Read-outs and transient heat (gated)

Held by user (2026-08-23); also externally gated (visual-upgrade Phase 5 + plain-board on-device gate).

## Overview

Surface the Phase 1–2 substrate **without reversing the deliberately plain, dead-flat look** the user
approved (`260818-1656-endless-plain-board`). Two visible additions, both non-persistent and
numbers/existing-celebration only: (a) a **transient** heat indicator expressed in the score numbers /
existing pop feedback — no persistent glow, warmth, or skin; (b) a **lifetime sweep-count read-out**
(per-color totals) reachable from an existing surface (HUD tap or settings), not a new always-on panel.

**GATED.** This phase touches `game.tsx` / HUD and is deliberately **not** started until:

1. `260817-1217-endless-visual-upgrade` **Phase 5** has landed (owns the current HUD/visible layer), and
2. the `260818-1656-endless-plain-board` **on-device hard gate** has passed (confirms plain look is signed
   off on a real device).
   Starting earlier would collide on `game.tsx` and risk re-litigating the plain-look ruling.

## Requirements

- Functional:
  - **Transient heat:** while heat > 0, reflect it in the numbers (e.g. the score delta shown on a sweep
    scales with the multiplier) and/or the existing clear-pop celebration intensity. It resets with heat
    (a plain move cools it) and leaves **no** persistent on-board mark between moves.
  - **Double-sweep:** when `resolution.doubleSweep` is true, fire a one-shot celebration reusing the
    existing pop/feedback path — a moment, not a persistent state.
  - **Read-out:** a per-color lifetime sweep-count display (from `readSweepCounts`) on an existing surface,
    read-only, non-modal-blocking.
- Non-functional (the guardrails — red-team MUST-check 3):
  - **No persistent glow / warmth / gradient / skin.** No board-wide tint that outlives a move. The
    dead-flat board rule stays intact.
  - `game.tsx`'s gesture-root wrapper stays an **unstyled `View`** (documented invariant) — heat visuals
    live in the HUD / existing Skia celebration layer, not on the gesture root.
  - No new persisted display state; the read-out reads existing Phase 2 keys.

## Architecture

**Heat → numbers (no new persistent visual):** the HUD already renders the score. On a sweep with heat > 0,
show the multiplied delta (data already in `resolution.heat`/`scoreDelta`) using the existing score-pop
animation. Reuse `use-board-animation.ts`'s existing clear-pop worklet; scale its existing parameters by a
heat factor. The factor MUST enter the shared animation function as a **defaulted parameter**
(e.g. `heatFactor = 1`) so Journey's existing call sites stay **byte-unchanged** and get the identity
scale for free — Journey and Endless share `use-board-animation.ts`, so a required new arg would break the
Journey caller. Per the React-Compiler rule the mutation stays in the module-level animation function, not
the component body. **No new Skia node that persists across frames.**

**Double-sweep one-shot:** branch inside the existing celebration trigger when `doubleSweep` is true —
stronger pop / distinct SFX (SFX only if `expo-av` is wired by then; otherwise visual-only). One-shot,
self-clearing.

**Read-out:** a small read-only view (HUD affordance or a settings row) calling `readSweepCounts(colors)`.
Uses `render/geometry.ts` color mapping for swatches if colors are shown; no new persisted state. Placed on
whatever HUD/settings surface visual-upgrade Phase 5 establishes (confirm exact host when this phase opens).

**Config gate:** heat visuals only render when `heat`/`doubleSweep` are meaningfully non-default — i.e.
Endless via `ENDLESS_CONFIG`. With `DEFAULT_CONFIG` heat is always 0, so the visible layer is inert for any
non-Endless surface for free.

## Related Code Files

_(exact hosts confirmed when the gate opens — visual-upgrade Phase 5 may move them)_

- Modify: HUD/score component (transient multiplied-delta display + read-out affordance)
- Modify: `src/effects/use-board-animation.ts` (scale existing pop by a **defaulted** `heatFactor = 1` arg so Journey call sites stay byte-unchanged; double-sweep one-shot — mutations stay module-level)
- Read-only consumer: `src/meta/score-storage.ts` `readSweepCounts` (from Phase 2)
- Invariant to preserve: `src/app/game.tsx` gesture-root stays an unstyled `View`
- On-device verification only (Skia/Reanimated/gesture = not Vitest-testable)

## Implementation Steps

1. **Precondition check:** confirm visual-upgrade Phase 5 landed and plain-board on-device gate passed. If
   not, **do not start** — this phase stays `pending`.
2. Add the heat factor as a **defaulted** argument (`heatFactor = 1`) into the existing clear-pop animation
   function so Journey's call sites compile unchanged and get the identity scale; render the multiplied
   score delta through the existing score-pop. No persistent node.
3. Add the `doubleSweep` one-shot branch in the existing celebration trigger.
4. Add the read-only per-color read-out to the host surface Phase 5 established.
5. **On-device verify** (iPhone first): heat feels transient, no smear/persistent glow between moves; plain
   board unchanged when heat == 0; double-sweep reads as a distinct moment; read-out shows correct totals.
6. Confirm `game.tsx` gesture-root diff is still a style-free `View`.

## Todo

- [ ] gate precondition confirmed (Phase 5 landed + plain-board on-device pass)
- [ ] transient multiplied-delta via existing score-pop (no persistent node)
- [ ] double-sweep one-shot via existing celebration path
- [ ] read-only per-color sweep read-out on the established host surface
- [ ] on-device pass: transient (no smear), plain-when-cold, gesture-root style-free
- [ ] lint / typecheck green (no Vitest for this layer)

## Success Criteria

- [ ] Heat is visible only as transient numbers / existing celebration intensity; **nothing persists**
      on-board between moves.
- [ ] No glow, warmth, gradient, or skin introduced; dead-flat plain board intact when heat == 0.
- [ ] `game.tsx` gesture-root remains an unstyled `View`.
- [ ] Double-sweep produces a one-shot celebration; read-out shows correct lifetime per-color totals.
- [ ] On-device pass on iPhone; no regression to the plain-board look.

## Risk Assessment

- **Scope creep into persistent warmth/skins** (the exact thing the user deferred). _Signal:_ a review
  finds any board node whose style outlives a move, or a gradient/tint on the board. _Response:_ reject in
  review; heat is numbers + one-shot pop only. This is red-team MUST-check 3.
- **`game.tsx` gesture-root gets styled** to host a heat effect. _Signal:_ the gesture-root `View` gains a
  style prop. _Response:_ invariant check in step 6; move the effect to the HUD/Skia celebration layer.
- **Starting before the gate** collides with visual-upgrade Phase 5 on `game.tsx`. _Signal:_ merge
  conflicts / duplicated HUD work. _Response:_ the precondition in step 1 blocks the phase from starting;
  keep status `pending` until both conditions hold.
- **Heat visual depends on `expo-av` SFX not yet installed.** _Signal:_ double-sweep SFX has no player.
  _Response:_ ship visual-only; add SFX when audio lands (out of this plan's scope).
