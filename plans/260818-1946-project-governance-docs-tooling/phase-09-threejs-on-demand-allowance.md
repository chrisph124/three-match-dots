---
title: 'Phase 9: three.js On-Demand Allowance'
status: done
priority: P3
effort: '1-2h'
dependencies: [5]
---

# Phase 9: three.js On-Demand Allowance

## Overview

Permit `three`, `@react-three/fiber` (r3f), and `@react-three/drei` on-demand via context7 lookups, WITHOUT
installing them now (item 11). Document in CLAUDE.md that the workspace doesn't have them, that they are
allowed to be installed+enabled only when one is actually invoked, and that they DO NOT replace Skia — and
once added, join the Expo native pin set discipline.

## Requirements

- Functional: `.claude/settings.local.json` (created in Phase 5) carries a note/permission allowing context7
  doc lookups for three/r3f/drei and allowing their install when first invoked (not before).
- Functional: CLAUDE.md states: not installed; allowed on-demand; Skia remains the primary renderer (three.js
  does not replace it); on install, `expo-gl`/`expo-three` join the Expo native pin set (never auto-merged,
  `expo install --fix`-only — Phase 4 exclusion + security doc apply).
- Non-functional: no dependency added to `package.json` in this phase.

## Architecture

Policy + permission only. three.js in RN needs `expo-gl` (+ `expo-three` for r3f) — a second render path
alongside Skia. Allowance is documented and gated on first real use; install discipline inherits the existing
pin-set rules in `docs/security-and-supply-chain.md`.

## Related Code Files

- Modify: `.claude/settings.local.json` (add three/r3f/drei allow-on-demand note; created in Phase 5)
- Modify: `CLAUDE.md` (Tech Stack — the on-demand note; coordinate with Phase 6)
- Reference (no edit): `docs/security-and-supply-chain.md` § Expo/native pin set

## Implementation Steps

1. Add to `settings.local.json`: a comment/permission allowing context7 lookups + on-demand install of
   `three`, `@react-three/fiber`, `@react-three/drei` (install only when invoked).
2. Add the CLAUDE.md Tech Stack note: not installed; on-demand; does-not-replace-Skia; joins the native pin
   set (never auto-merged; `expo install --fix` where the SDK owns the version).
3. State the install trigger explicitly: "install only when a task actually uses three/r3f/drei; prefer
   `npx expo install` so the SDK picks compatible `expo-gl`/`expo-three` versions."

## Todo

- [x] Add three/r3f/drei on-demand allowance to `.claude/settings.local.json`
- [x] Add CLAUDE.md Tech Stack note (not installed; on-demand; Skia-primary; joins pin set)
- [x] Document the install trigger (only on invocation; via `expo install`)
- [x] Confirm `package.json` unchanged (nothing installed this phase)

## Success Criteria

- [x] settings.local allows three/r3f/drei context7 + on-demand install; nothing installed now.
- [x] CLAUDE.md states on-demand policy, Skia-primary, and pin-set discipline on install.
- [x] `package.json` has no three.js deps after this phase.

## Risk Assessment

- **Silent install / architecture drift**: three.js quietly becomes a parallel renderer. Signal: `expo-gl`/
  `three` appears in `package.json` without a task needing it. Response: policy says install only on
  invocation; reviewer checks the diff.
- **Pin-set exemption assumption**: someone auto-merges an `expo-gl` bump. Signal: native bump auto-merged.
  Response: the note explicitly folds three.js deps into the never-auto-merge `expo-native` group discipline.
