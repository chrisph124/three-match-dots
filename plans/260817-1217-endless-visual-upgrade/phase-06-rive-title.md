---
phase: 6
title: 'Animated title via rive-react-native'
status: pending
priority: P2
effort: '1-1.5d'
dependencies: [5]
---

# Phase 6: Animated title via `rive-react-native`

## Overview

Add the meta-UI motion layer. Per bible §4 ("one tool per layer, no mixing":
Reanimated + Skia in-scene, **Rive for meta-UI micro-motion**), animate the title
lockup with `rive-react-native` — the plan's **single** new dependency. A placeholder
state machine is acceptable for v1; Reduce Motion renders a static fallback.

## Requirements

- Functional: the title screen shows an animated Rive title on mount; with Reduce
  Motion on, it shows a static frame / fallback (the Phase 5 static title).
- Functional: exactly one dependency added (`rive-react-native`); no other runtime dep.
- Non-functional: native module → the dev client must be rebuilt (`expo run:ios`);
  cannot ship via OTA (`eas update`) alone.

## Dependency choice — verify at implementation time (do NOT skip)

The creative bible names **`rive-react-native`** (§4 / §7 motion split), so that is the
default. But this is a live package migration and this repo has a specific conflict to
check **before** installing:

- As of 2026-08-17 there are two packages: legacy **`rive-react-native`** and a
  Nitro-based successor **`@rive-app/react-native`** (repo `rive-app/rive-nitro-react-native`),
  both recently republished — a migration signature.
- The Nitro successor declares peer `react-native-nitro-modules ">=0.35.10 <0.36"`.
  **This repo already pins `react-native-nitro-modules: ^0.36.5`** (required by
  `react-native-mmkv` v4) — which does **not** satisfy that range. Picking the Nitro
  package therefore forces a nitro-modules decision.
- The project is on React Native New Architecture (RN 0.86 / Expo 57 default; Nitro
  modules structurally require it). Confirm the chosen Rive package supports New Arch /
  Fabric before committing.

**Procedure:** at Phase 6 start, re-check both packages' current New-Arch/Nitro status
and Expo-SDK-57 compatibility. If the legacy `rive-react-native` is New-Arch-ready,
prefer it (matches the bible, no nitro-modules churn). If only the Nitro successor is
viable, first verify a `react-native-nitro-modules` version exists that satisfies
**both** mmkv v4 and Nitro-Rive, and bump nitro **up** (never pin it down and break
mmkv). This mirrors the repo's known "cryptic vendored-module Swift error = version-floor
mismatch" failure mode — treat a peer-dep warning naming `nitro-modules` as the signal.

## Architecture

- Install via **`npx expo install <chosen-rive-package>`** (Expo-managed pinning) —
  never hand-edit the version, never `npm audit fix --force`. Add its native peer only
  via `npx expo install` if the installer requires one.
- **Component** — `src/render/rive-title.tsx` (or `src/effects/`): wraps the Rive
  runtime with a placeholder `.riv` state machine; exposes the title. Reduce-Motion
  branch renders the Phase 5 static title lockup instead of the Rive view.
- **Asset** — a placeholder `assets/rive/title.riv` (authored later via
  rnd-department / creative tooling; a minimal state machine is fine for v1).
- **Mount** — `index.tsx` swaps the static title `Text` for `<RiveTitle/>` with the
  static lockup as the Reduce-Motion / load fallback.

## Related Code Files

- Add dependency: `rive-react-native` (via `npx expo install`).
- Create: `src/render/rive-title.tsx`.
- Add asset: `assets/rive/title.riv` (placeholder).
- Modify: `src/app/index.tsx` — mount `RiveTitle` with static fallback.

## Implementation Steps

0. Run the "Dependency choice" verification above; pick the Rive package and confirm
   `react-native-nitro-modules` stays compatible with `react-native-mmkv` v4.
1. `npx expo install <chosen-rive-package>`; rebuild the dev client (`expo run:ios`).
2. Add the placeholder `.riv` asset + `rive-title.tsx` (with Reduce-Motion static
   fallback via `useReduceMotion()` from Phase 1).
3. Mount in `index.tsx`, keeping the static title as fallback.
4. On-device: title animates; Reduce Motion → static; other screens unaffected.

## Success Criteria

- [ ] Title animates via Rive on device; Reduce Motion → static fallback.
- [ ] Exactly one new dependency (`rive-react-native`), Expo-pinned; dev client rebuilt.
- [ ] No Skia/Reanimated used for this meta-UI motion (bible §4 respected).
- [ ] `lint` + `typecheck` + `test` green; no OTA-only assumption documented away.

## Risk Assessment

- **Native rebuild / iOS integration friction.** Signal: Rive fails to link or the dev
  client crashes on launch. Response: rebuild via `expo run:ios`; if integration is
  unstable, keep the Phase 5 static title as the shipped default and gate Rive behind
  the fallback until stable (feature is additive, blocks nothing).
- **Version drift vs Skia/Reanimated/Expo SDK — and specifically `nitro-modules`.**
  Signal: a peer-dep or SDK mismatch warning naming `react-native-nitro-modules` (the
  Nitro-Rive successor wants `<0.36`; mmkv v4 pins `^0.36.5`). Response: run the
  Dependency-choice procedure above; install only via `npx expo install`; if forced
  onto Nitro-Rive, bump nitro up to a version satisfying both, never down. Do not
  force-resolve.
- **No real `.riv` art yet.** Signal: placeholder looks unfinished. Response:
  placeholder state machine is explicitly acceptable for v1 (brainstorm); real art is a
  later rnd-department slice and does not block this wiring.
