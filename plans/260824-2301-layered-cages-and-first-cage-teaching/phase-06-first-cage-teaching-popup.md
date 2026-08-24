---
phase: 6
title: 'First-cage teaching popup'
status: done
priority: P1
effort: '0.5d'
dependencies: [3, 5]
---

# Phase 6: First-cage teaching popup

## Overview

Show a one-time, dismissible popup the first time a player enters a level containing a **multi-layer**
cage (any cage with `layers ≥ 2`), with a "don't show again" checkbox that survives an app restart via
MMKV. This is the locked brainstorm decision (static popup, not a guided demo), refined by the red-team

- user decision (F6): teach when the _layered_ mechanic actually manifests, not on a 1-layer teach cage
  that pops in a single clear and can't demonstrate chipping. On-device verified (RN modal — not
  Vitest-testable).

<!-- Updated: Validation Session 1 - first multi-layer cage is now the seeded pre-boss teaching cage (default L5) or japan-01's 2-layer cage, NOT the L10 boss; teaching lands before the boss -->

## Requirements

- Functional:
  - New `src/meta/tutorial-flags.ts` — `createMMKV()` factory (NOT `new MMKV()`; MMKV v4), boolean
    stored as `'1'` string under a dot-prefixed key (e.g. `'tutorial.cageIntroSeen'`), with
    `hasSeenCageIntro(): boolean` + `markCageIntroSeen(): void`. Mirror the established
    `*-storage.ts` pattern in `src/meta/`.
  - New `src/render/cage-intro-popup.tsx` — an absolute `Modal`/overlay (follow the existing
    game-over/settings overlay pattern), paper-craft styled per the LOCKED creative bible: one static
    illustration/diagram of a layered cage, a short line of copy ("Clear its colour to peel a layer —
    it breaks when the paper's gone"), a "Got it" dismiss, and a "Don't show again" checkbox.
  - Trigger: on entering a level whose overlay has **any cage with `layers ≥ 2`** for the FIRST time
    (per-install), gated by `hasSeenCageIntro()`. Concretely: `[...caged.values()].some((n) => n >= 2)`,
    i.e. `protectedOf(caged).size > 0` — NOT `caged.size > 0` (red-team F6, user decision). A purely
    1-layer cage (Voyage L4 and any other 1-layer curated cage, the remaining 1-layer `japan-01` cages)
    never fires the popup; it pops in one clear and would teach nothing about layers. With Validation S1
    the first `layers ≥ 2` cage is the **seeded pre-boss teaching cage (default L5)** in Voyage or
    **japan-01's authored 2-layer cage** in Journey — so the popup fires on a low-stakes mid cage, not
    the boss. The gate is per-install, not per-level, so whichever mode reaches its first multi-layer
    cage first fires it once, ever.
  - **Ladder placement (resolved — Validation S1):** teaching a brand-new mechanic AT a boss was the
    risk. Phase 2 now seeds a 2-layer teaching cage on a pre-boss Voyage level (default L5) and gives
    japan-01 a 2-layer cage, so the first `layers ≥ 2` cage a player meets is that **low-stakes mid cage,
    BEFORE the L10 Caged Core boss** — the popup teaches chipping ahead of the boss that demands it. If
    on-device pacing still feels off, adjust the _seed level_ (a Phase-2 content tweak), NEVER move the
    trigger back to `caged.size > 0`. Because the flag is per-install, whichever mode reaches its first
    multi-layer cage first (seeded L5 in Voyage, or japan-01 in Journey) fires the popup once, ever.
  - Reading `caged` in Journey depends on Phase 3 having added `caged` to `useJourneyState` (red-team
    F1) — before that the journey screen has no cage state to test.
  - "Don't show again" checked + dismiss → `markCageIntroSeen()`; popup never returns. Dismiss WITHOUT
    the checkbox → allowed to reappear on the next fresh cage encounter (design choice: default the
    checkbox ON so one dismissal is the common path; confirm on device).
- Non-functional: keys OUT of git (this is local device state, no secret). Copy + art within LOCKED
  `creative-bible.md` tone (restrained, paper). Popup must not block the gesture layer once dismissed.
  Files <200 lines. No `any`.

## Architecture

Two tiny pieces: a persistence helper (the only new MMKV surface) and a presentational modal. The
trigger lives at the screen level (voyage-game / journey), reading the same `caged` Map the overlay
reads (Phase 3) and the flag helper. The predicate is `protectedOf(caged).size > 0` (a multi-layer cage
is present), not mere presence of cages. Because the flag is per-install, the first multi-layer cage
level in EITHER mode fires it once, ever; subsequent cage levels never re-teach.

## Related Code Files

- Create: `src/meta/tutorial-flags.ts` (MMKV flag)
- Create: `src/render/cage-intro-popup.tsx` (modal)
- Modify: `src/app/voyage-game.tsx` + `src/app/journey.tsx` (trigger on first
  `protectedOf(caged).size > 0`, gated by `hasSeenCageIntro`)
- Reference: existing `src/meta/*-storage.ts` (MMKV pattern), existing overlay/modal (game-over)
- No new Vitest (RN/MMKV native) — verify on device. (A thin Vitest over `tutorial-flags` boolean
  round-trip is optional if the MMKV mock already used by other meta tests is available.)

## Implementation Steps

1. Write `tutorial-flags.ts` (createMMKV, `'1'`-string boolean, getter/setter).
2. Build `cage-intro-popup.tsx` (static modal, checkbox default ON, paper style).
3. Wire the trigger in both screens: first render where `protectedOf(caged).size > 0 &&
!hasSeenCageIntro()` shows the popup; dismiss-with-checkbox calls `markCageIntroSeen()`.
4. On-device: pass the 1-layer teach level (L4) FIRST and confirm it does NOT fire; then reach the first
   MULTI-layer cage — the seeded 2-layer teaching cage (default L5) in Voyage, or japan-01's 2-layer cage
   in Journey → popup appears; check "don't show again" + dismiss → gone; kill and relaunch the app →
   does NOT reappear; reach the OTHER mode's first multi-layer cage level → still does not reappear
   (per-install).

## Success Criteria

- [ ] Popup appears on the first MULTI-layer cage encounter — the seeded L5 teaching cage (Voyage) or
      japan-01's 2-layer cage (Journey), whichever mode is reached first (on-device)
- [ ] A 1-layer teach cage (Voyage L4) does NOT fire the popup (on-device)
- [ ] "Don't show again" + dismiss persists across an app restart (on-device)
- [ ] Popup never reappears after being dismissed-with-checkbox, in EITHER mode (per-install, on-device)
- [ ] Once dismissed, the popup does not block board gestures (on-device)
- [ ] Uses `createMMKV()` (not `new MMKV()`), `'1'`-string boolean, dot-prefixed key
- [ ] Tone/art within LOCKED creative bible; `typecheck` + `lint` green; no `any`

## Risk Assessment

- **R3 — per-level vs per-install trigger.** A per-level flag would re-teach on every multi-layer cage
  level. Signal: popup reappears on a later boss/mid level. Response: gate on ONE per-install key, not a
  level id — as specified. Tested by the "reach the other mode's multi-layer cage level" on-device step.
- **Wrong predicate (fires on a purely 1-layer cage level).** Signal: the popup appears on entering a level
  whose cages are ALL 1-layer — Voyage L4/L9 or a generated teach-band level — where chipping can't be
  shown. (It SHOULD fire on the seeded 2-layer L5, and on japan-01 which now carries an authored 2-layer
  cage — those are the intended teaching moments, Validation S1.) Response: gate on
  `protectedOf(caged).size > 0` (layers ≥ 2), never `caged.size > 0` — the on-device "L4 does not fire"
  check is the tripwire.
- **R4 — tone.** An intrusive or over-animated popup breaks the paper calm. Response: static
  illustration, one line of copy, restrained per bible; review art on device.
- **Modal swallows gestures after dismiss.** Signal: board unresponsive post-dismiss. Response: fully
  unmount the modal (not just hide), verify the gesture layer regains touches.
- **MMKV write timing.** If `markCageIntroSeen` is called after navigation, a fast relaunch could miss
  it. Response: write synchronously on dismiss before any navigation.
