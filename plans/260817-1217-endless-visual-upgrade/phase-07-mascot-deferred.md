---
phase: 7
title: 'Mascot moment (deferred — gated on art)'
status: deferred
priority: P3
dependencies: [5]
---

# Phase 7: Mascot moment (deferred — gated on art)

## Overview

A small paper-craft **mascot moment** on the title (and optionally a subtle HUD
reaction) that gives Endless a signature character beat. **Deferred and gated on mascot
art** (Procreate / rnd-department authoring). It blocks nothing else in this plan and
ships whenever the art lands. Documented here so the "fuller redesign" scope is
complete and honest, not silently dropped.

## Requirements

- Functional (when built): a mascot appears on the title screen with a light idle/
  reaction motion; Reduce Motion → static pose.
- Non-functional: reuse existing layers — meta-UI motion via Rive (Phase 6) or a static
  Skia/RN asset; **no new dependency** beyond what Phases 1–6 already added.
- Gate: does not start until mascot art exists and its placement is designed.

## Architecture (provisional — finalize when art lands)

- Art authored out-of-repo (creative tooling), exported as a `.riv` (preferred, reuses
  the Phase 6 Rive layer) or a static asset.
- Mount on `index.tsx` near the title lockup; optional subtle HUD reaction on a scoring
  event later. Reduce-Motion static fallback via `useReduceMotion()` (Phase 1).

## Related Code Files (provisional)

- Add asset: `assets/rive/mascot.riv` (or a static image).
- Create: `src/render/mascot.tsx`.
- Modify: `src/app/index.tsx` — mount the mascot.

## Implementation Steps

1. (Gate) Receive mascot art + agreed placement.
2. Add the asset + `mascot.tsx` with a Reduce-Motion static fallback.
3. Mount on the title; optional HUD reaction as a follow-up.
4. On-device verification.

## Success Criteria

- [ ] Mascot present on the title with a light motion beat; Reduce Motion → static.
- [ ] No new dependency introduced beyond Phases 1–6.
- [ ] `lint` + `typecheck` + `test` green.

## Risk Assessment

- **Indefinite art gate.** Signal: no mascot art is produced. Response: this phase
  stays `deferred`; it is explicitly non-blocking, so the plan is complete without it.
  Do not build a placeholder mascot that ships — a missing mascot is better than a
  wrong one (bible: character/tone are LOCKED).
