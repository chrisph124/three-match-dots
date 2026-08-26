---
phase: 5
title: 'Render overlay + HUD (on-device)'
status: done
priority: P2
effort: '4h'
dependencies: [1, 2, 3]
---

# Phase 5: Render overlay and HUD (on-device)

## Overview

Make anchors visible: a paper-weight overlay drawn per anchored cell (mirroring the caged-dot overlay)
and a HUD remaining-count via the existing objective badge. This layer is Skia/Reanimated/RN — NOT
Vitest-testable — so it is verified ON-DEVICE against the brainstorm's acceptance checklist. It depends
on the schema (Phase 1), the Resolution echo (Phase 2), and the state-exposed anchor set (Phase 3), but
NOT on Voyage generation (Phase 4) — an authored Journey level exercises it.

## Requirements

### Functional

- [ ] New `src/render/anchor-overlay-layer.tsx` — `AnchorOverlayLayer({ anchors, event, layout, anim,
  reduceMotion })`, a sibling absolute overlay with `pointerEvents="none"`, mirroring
      `src/render/cage-overlay-layer.tsx` (`CageOverlayLayer`, `:154`). One paper-weight frame per
      anchored cell, positioned via `layout` geometry (reuse `centerX`/`centerY` from
      `src/render/geometry.ts` — no new geometry math in the component).
- [ ] Anchor frames follow gravity using the same `anim` offsets the dots use (a fallen anchor slides
      with its cell); a removed anchor unmounts (its frame disappears) when the anchor set shrinks —
      same lifecycle as a cleared cage. The freed cell's fall/refill is already drawn by the normal dot
      layer (no extra work).
- [ ] Respect `reduceMotion` exactly as `CageOverlayLayer` does (no bespoke animation policy).
- [ ] Wire `<AnchorOverlayLayer .../>` into both screens next to the cage overlay:
      `src/app/journey.tsx` (CageOverlayLayer wiring at `:107`) and `src/app/voyage-game.tsx`
      (CageOverlayLayer at `:184`). Source the `anchors` set from the meta hooks (exposed in Phase 3).
- [ ] HUD remaining-count: extend the objective badge to render the `clearAnchors` type with an
      "Anchors" label + current/target — `ObjectiveBadge` in `src/render/voyage/voyage-hud.tsx` (`:44`,
      used by `VoyageHud` `:66`) and the Journey `ObjectiveBadge` (`src/app/journey.tsx:29`). Mirror the
      existing `freeCaged` "Cages" badge.
- [ ] Art follows `docs/creative-bible.md`: §2.1 paper-craft with a single top-left light source
      (`:38`); §2.4 (`:69-72`) obstacles "must read instantly as different from a normal dot" — the
      anchor reads as a weight by SHAPE/silhouette, not by colour (the underlying cell colour is
      suppressed and irrelevant). Do NOT introduce a new palette entry (`DOT_COLORS[0..2]` frozen).

### Non-functional

- [ ] `src/render/geometry.ts` stays pure arithmetic over plain numbers (the only non-core file Vitest
      runs) — the anchor component consumes it, adds nothing to it.
- [ ] No `any`. Component file ~<200 lines. Endless screens untouched (no anchor overlay wired there).
- [ ] `hot/**` and `src/core/**` untouched by this phase.

## Architecture

The anchor overlay is a pure presentational sibling, identical in structure to the cage overlay: it
subscribes to the anchor set + the shared `anim`/`event` juice channel and draws frames. It holds no
game logic — removal, gravity, and refill are already decided by the core (Phases 2-3) and echoed
through state; the overlay only reflects the current set and animates transitions.

```
meta hook: { anchors, caged, event, ... }
      │
      ├─ <CageOverlayLayer  caged={caged}   ... />   (existing)
      └─ <AnchorOverlayLayer anchors={anchors} ... /> (new, sibling, pointerEvents none)
HUD: <ObjectiveBadge> renders clearAnchors → "Anchors current/target"
```

## Related Code Files

### Create

- `src/render/anchor-overlay-layer.tsx` — the paper-weight overlay.

### Modify

- `src/app/journey.tsx` — wire `AnchorOverlayLayer` (near CageOverlayLayer `:107`); extend
  `ObjectiveBadge` (`:29`) for `clearAnchors`.
- `src/app/voyage-game.tsx` — wire `AnchorOverlayLayer` (near CageOverlayLayer `:184`).
- `src/render/voyage/voyage-hud.tsx` — `ObjectiveBadge` (`:44`) handles `clearAnchors`.

### Delete

- None.

## Implementation Steps

1. Build `anchor-overlay-layer.tsx` by copying `cage-overlay-layer.tsx`'s structure; swap the cage
   frame for the paper-weight silhouette; keep positioning/gravity/reduceMotion identical.
2. Extend both `ObjectiveBadge`s to render `clearAnchors` ("Anchors" label).
3. Wire the overlay + expose `anchors` from the hooks (Phase 3 already exposes it) into both screens.
4. Author or reuse a small Journey test level with 1-2 anchors to exercise the layer on-device.
5. On-device verification against the acceptance checklist (below) on a real iPhone.

## Success Criteria

On-device (real iPhone; not Vitest):

- [ ] Anchors render as visible paper weights, instantly distinguishable from a normal dot by shape.
- [ ] HUD shows the remaining anchor count and decrements as anchors are removed.
- [ ] An anchor cannot be linked; dragging over it does not break a valid chain routed around it.
- [ ] An anchor falls with gravity; it stays in place across a deadlock reshuffle.
- [ ] A plain adjacent clear, a 2x2-loop sweep, and a >=5-line sweep each remove an 8-way-adjacent
      anchor; the freed cell refills with a normal dot.
- [ ] Endless mode is visually + behaviourally unchanged.
- [ ] No `any`; lint + typecheck clean; `docs/creative-bible.md` rules honoured (single light source,
      shape-not-colour distinction, no new palette).

## Risk Assessment

| Risk                                                         | Likelihood x Impact | Observable signal it broke                                         | Pre-decided response                                                                              |
| ------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Overlay z-order / pointer capture blocks gestures            | Med x High          | On-device the board stops responding to drags where an anchor sits | `pointerEvents="none"` like `CageOverlayLayer`; verify a drag near an anchor still registers      |
| Anchor frame desyncs from its cell during a fall             | Med x Med           | The weight visibly lags or detaches from its dot mid-fall          | Reuse the exact `anim` offset pipeline the dots + cages use; do not compute a separate fall tween |
| Removed anchor frame lingers or double-renders               | Low x Med           | A ghost weight remains after removal                               | Key frames by cell index off the live anchor set (like cages); the set shrink drives unmount      |
| Anchor reads as a colour, not a shape (bible §2.4 violation) | Low x Med           | Owner playtest: the weight is confused with a normal dot           | Silhouette/shape-first design; owner sign-off before merge; no palette addition                   |
| HUD badge layout breaks with a third objective type          | Low x Low           | Badge overflows / clips on smaller devices                         | Mirror the existing badge layout constraints; verify on the smallest target device                |
