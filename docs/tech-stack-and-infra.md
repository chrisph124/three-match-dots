# Tech Stack & Infra Decisions — three-match-dots

**Date:** 2026-06-17
**Status:** Decided. App not yet scaffolded.

## Problem / Context

Pure mobile game (Two Dots-inspired, endless v1). **iOS first, then Android** — cross-platform from
ONE codebase is the explicit driver. This is why React Native: native (Swift+Kotlin) = 2 codebases;
Unity = heavier/overkill for simple 2D. RN/Expo ships both stores from one TS codebase. **No web version**
planned → no monorepo needed.

## Final Stack

| Concern | Choice | Note |
|---------|--------|------|
| Language | TypeScript | |
| App shell / build | Expo (dev client, NOT Expo Go) + EAS | Skia needs native code |
| Navigation | **expo-router** | file-based; ~4 screens (title/game/game-over/settings) |
| Rendering | `@shopify/react-native-skia` | board as one GPU canvas |
| Animation | `react-native-reanimated` v3 | UI-thread worklets |
| Gestures | `react-native-gesture-handler` | touch→grid hit-test in worklet |
| State | Zustand (UI/meta) + Reanimated shared values (hot loop) | |
| Persistence | `react-native-mmkv` | high score + settings; no backend |
| Audio | `expo-av` | SFX |
| Testing | **Vitest** (pure-TS core only) | see caveat |
| Lint / format | ESLint (`eslint-config-expo`) + Prettier | |
| Package manager | npm | single app, simplest |

## Final Infra

| Area | Choice |
|------|--------|
| Build / release | EAS Build + EAS Submit → TestFlight (iOS), Google Play (Android phase) |
| Crash reporting | Sentry (`@sentry/react-native`) |
| Analytics | **PostHog** (privacy-friendly; no IDFA → no iOS ATT prompt; EU-hosting option) |
| OTA updates | `expo-updates` (`eas update`) — push JS-only fixes without store review |
| CI | GitHub Actions: lint + typecheck + Vitest core — wired at scaffold |
| Git hooks | Husky + lint-staged — wired at scaffold |
| Backend | NONE for v1 (Sentry/PostHog are 3rd-party SaaS, not our servers) |

## Key Decisions & Rationale

- **RN/Expo over native/Unity**: cross-platform 2D from one codebase; Two Dots-class is well within range.
- **Single app, core in `src/core/` (pure TS)**: no web → no monorepo (YAGNI). Core stays RN-free for testability + optional future extraction.
- **Vitest**: fast core testing; chosen over jest-expo since the prime test target is the pure-TS engine.
- **expo-router**: Expo's standard file-based routing; future-proof.
- **PostHog over Firebase**: lighter, privacy-friendlier, avoids ATT/IDFA burden.
- **OTA on**: fast iteration for a game that'll be tuned heavily.

## Caveats / Risks

| Caveat | Detail |
|--------|--------|
| Vitest tests RN-free code ONLY | Core (chain/loop/gravity/scoring) is unit-tested; Skia/Reanimated/gesture layers verified ON-DEVICE, not in Vitest. "We have tests" ≠ "UI tested". |
| Analytics = compliance overhead | App Store Privacy Nutrition Labels + Google Play Data Safety disclosures required; possible GDPR consent. PostHog minimizes this. |
| Android low-end perf | Skia+Reanimated great on iOS; Android device fragmentation → test on a cheap real Android device in the Android phase. |
| OTA limits | `expo-updates` ships JS only; native changes (new native module) still need a store build. |

## Success Criteria

- One TS codebase builds + ships to BOTH App Store and Google Play via EAS.
- Core logic covered by Vitest; CI runs it on every PR (post-scaffold).
- Crashes visible in Sentry from TestFlight/beta; key events in PostHog.
- OTA push delivers a JS fix without a store review.

## Next Steps

1. Update root `CLAUDE.md` stack/infra sections (this round).
2. Scaffold Expo app (expo-router template) → wire Vitest, ESLint+Prettier, Husky, CI, Sentry, PostHog, expo-updates.
3. iOS path first (EAS → TestFlight); Android path second (EAS → Play).

## Unresolved Questions

- Sentry + PostHog account/org setup — who owns the accounts/keys? (store keys outside git)
- EU vs US data hosting for PostHog (GDPR posture)?
- Minimum supported iOS / Android OS versions?
