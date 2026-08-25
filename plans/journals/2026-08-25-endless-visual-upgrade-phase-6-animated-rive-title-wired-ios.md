---
title: 'Endless visual-upgrade Phase 6 — animated Rive title wired (iOS, static fallback)'
date: 2026-08-25
summary: 'Phase 6 wiring code-complete: rive-react-native ^9.8.5 (legacy, zero-nitro), metro .riv assetExts, RiveTitle with Reduce-Motion/onError/no-art static fallback; animate + native rebuild owner-gated.'
---

# Endless visual-upgrade Phase 6 — animated Rive title wired (iOS, static fallback)

**Phase 6 — Animated title via `rive-react-native` (Endless visual-upgrade plan).** Scope: "Full wiring, iOS-scoped" (user-approved). Wiring code-complete; on-device animate + real art deferred.

## Shipped

- Dep `rive-react-native ^9.8.5` via `npx expo install`. Legacy pkg — ZERO nitro dep. Rejected the Nitro successor `@rive-app/react-native` (peers nitro `<0.36`), which would break `react-native-mmkv` v4's `nitro ^0.36.5` pin (score persistence).
- `metro.config.js` — Expo default + `.riv` in `resolver.assetExts`.
- `src/render/rive-title.tsx` — `<RiveTitle fallback>`: renders the static Phase 5 lockup on Reduce Motion, on native `onError`, or when no `.riv` is bundled. `riveTitleSource()` returns `null` today.
- `src/app/index.tsx` — title lockup extracted once, mounted `<RiveTitle fallback={lockup} />`; readScore/useFocusEffect + 4 nav links + score card unchanged.

## Key decision — no placeholder `.riv` binary

A fabricated/empty `.riv` = native hard-crash + violates the no-fake-assets rule. The `riveTitleSource()` null-guard renders the static fallback until real authored art lands — same UX today, zero crash surface, no fake asset. `assets/rive/` intentionally absent for now (deviates from the phase file's literal "add placeholder .riv" step, on purpose).

## Rive v9 API notes (via context7)

`source?: number | {uri}` (a `require('./x.riv')` is a numeric asset id); `onError` MUST be provided or the default RN error screen shows on a load failure; `autoplay` default true; `style?: ViewStyle`.

## Verification

typecheck clean; lint 0 errors (2 pre-existing warnings, untouched files); test 402/402; audit:diff + vendored:check + coverage:diff all OK. `code-reviewer` verdict DONE, no blockers (dependency-pin safety, no index.tsx regression, correct API usage all confirmed against the tree).

## Open (owner-gated, honestly deferred)

1. Title animates on device — needs real `.riv` art (a later rnd-department slice).
2. Native dev-client rebuild (`expo run:ios`) — owner's device step; native module added, OTA alone won't pick it up.

## Flagged (pre-existing, NOT introduced by Phase 6)

Phase 3/4 frontmatter drift vs `plan.md` table: phase-03 `in-progress` / phase-04 `pending` in frontmatter vs Superseded/Dropped in the table (from the 2026-08-18 plain-board pivot). Needs a follow-up reconciliation.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
