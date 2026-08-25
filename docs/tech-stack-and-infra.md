# Tech Stack & Infra Decisions — three-match-dots

**Date:** 2026-06-17
**Status:** Decided. App not yet scaffolded.

## Problem / Context

Pure mobile game (Two Dots-inspired, endless v1). **iOS first, then Android** — cross-platform from
ONE codebase is the explicit driver. This is why React Native: native (Swift+Kotlin) = 2 codebases;
Unity = heavier/overkill for simple 2D. RN/Expo ships both stores from one TS codebase. **No web version**
planned → no monorepo needed.

## Final Stack

| Concern           | Choice                                                                       | Note                                                                                                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language          | TypeScript                                                                   |                                                                                                                                                                                                                                                           |
| App shell / build | Expo (dev client, NOT Expo Go) + EAS                                         | Skia needs native code                                                                                                                                                                                                                                    |
| Navigation        | **expo-router**                                                              | file-based; ~4 screens (title/game/game-over/settings)                                                                                                                                                                                                    |
| Rendering         | `@shopify/react-native-skia`                                                 | board as one GPU canvas                                                                                                                                                                                                                                   |
| Animation         | `react-native-reanimated` v3                                                 | UI-thread worklets                                                                                                                                                                                                                                        |
| Gestures          | `react-native-gesture-handler`                                               | touch→grid hit-test in worklet                                                                                                                                                                                                                            |
| Meta-UI motion    | `rive-react-native` (iOS-scoped)                                             | legacy pkg, chosen over the Nitro successor `@rive-app/react-native` because it has zero `react-native-nitro-modules` dep — keeps the nitro pin `react-native-mmkv` v4 requires intact; one-tool-per-layer split with Reanimated+Skia (creative-bible §4) |
| State             | Zustand (UI/meta) + Reanimated shared values (hot loop)                      |                                                                                                                                                                                                                                                           |
| Persistence       | `react-native-mmkv`                                                          | high score + settings; no backend                                                                                                                                                                                                                         |
| Audio             | `expo-av`                                                                    | SFX                                                                                                                                                                                                                                                       |
| Testing           | **Vitest** (pure-TS core only)                                               | see caveat                                                                                                                                                                                                                                                |
| Lint / format     | ESLint (`eslint-config-expo`) + **`eslint-plugin-sonarjs`** + Prettier       | SonarLint rules in ESLint                                                                                                                                                                                                                                 |
| Type safety       | strict tsconfig; **no `any`** (`@typescript-eslint/no-explicit-any` = error) | use `unknown`/`Record<string, unknown>`/`<T>`                                                                                                                                                                                                             |
| Package manager   | npm                                                                          | single app, simplest                                                                                                                                                                                                                                      |

## Final Infra

| Area            | Choice                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Build / release | EAS Build + EAS Submit → TestFlight (iOS), Google Play (Android phase)                                      |
| Crash reporting | Sentry (`@sentry/react-native`)                                                                             |
| Analytics       | **PostHog** (privacy-friendly; no IDFA → no iOS ATT prompt; EU-hosting option)                              |
| OTA updates     | `expo-updates` (`eas update`) — push JS-only fixes without store review                                     |
| Code quality    | **`eslint-plugin-sonarjs`** (SonarLint rules) — local + CI, free. No SonarCloud SaaS (redundant).           |
| Security scan   | **CodeQL** (`.github/workflows/codeql.yml`, JS/TS) + **Dependabot** (npm + actions) — free on public repo   |
| CI              | GitHub Actions: lint (incl. sonarjs) + typecheck (strict, no-any) + Vitest (+ coverage) — wired at scaffold |
| Git hooks       | Husky + lint-staged — wired at scaffold                                                                     |
| Backend         | NONE for v1 (Sentry/PostHog are 3rd-party SaaS, not our servers)                                            |

## Key Decisions & Rationale

- **RN/Expo over native/Unity**: cross-platform 2D from one codebase; Two Dots-class is well within range.
- **Single app, core in `src/core/` (pure TS)**: no web → no monorepo (YAGNI). Core stays RN-free for testability + optional future extraction.
- **Vitest**: fast core testing; chosen over jest-expo since the prime test target is the pure-TS engine.
- **expo-router**: Expo's standard file-based routing; future-proof.
- **PostHog over Firebase**: lighter, privacy-friendlier, avoids ATT/IDFA burden.
- **OTA on**: fast iteration for a game that'll be tuned heavily.
- **No `any` + SonarLint**: strict TS (`unknown`/`Record<string, unknown>`/generics over `any`), Sonar rules
  via `eslint-plugin-sonarjs` (no SonarCloud SaaS — redundant). Lint/typecheck CI-blocking; `any` escape hatch needs a justification comment.
- **Definition of Done**: every bug fix / feature → unit test checked-or-created (bug = regression test first), code review run.

## Caveats / Risks

| Caveat                          | Detail                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest tests RN-free code ONLY  | Core (chain/loop/gravity/scoring) is unit-tested; Skia/Reanimated/gesture layers verified ON-DEVICE, not in Vitest. "We have tests" ≠ "UI tested". |
| Analytics = compliance overhead | App Store Privacy Nutrition Labels + Google Play Data Safety disclosures required; possible GDPR consent. PostHog minimizes this.                  |
| Android low-end perf            | Skia+Reanimated great on iOS; Android device fragmentation → test on a cheap real Android device in the Android phase.                             |
| OTA limits                      | `expo-updates` ships JS only; native changes (new native module) still need a store build.                                                         |
| Strict no-`any` friction        | Untyped 3rd-party libs may force `any` — allowed only via inline `eslint-disable` + justification comment.                                         |

## Success Criteria

- One TS codebase builds + ships to BOTH App Store and Google Play via EAS.
- Core logic covered by Vitest; CI runs it on every PR (post-scaffold).
- Crashes visible in Sentry from TestFlight/beta; key events in PostHog.
- OTA push delivers a JS fix without a store review.

## Next Steps

1. Update root `CLAUDE.md` stack/infra sections (this round).
2. Scaffold Expo app (expo-router template) → wire Vitest, ESLint+sonarjs+Prettier, strict tsconfig, Husky, CI, Sentry, PostHog, expo-updates.
3. iOS path first (EAS → TestFlight); Android path second (EAS → Play).

## Unresolved Questions

- Sentry + PostHog account/org setup — who owns the accounts/keys? (store keys outside git)
- EU vs US data hosting for PostHog (GDPR posture)?
- Minimum supported iOS / Android OS versions?

---

## Technical reference — `src/` architecture map

_Added 2026-08-18. The concrete map of the shipped layers, extending the "Architecture (layered)"
overview in [`CLAUDE.md`](../CLAUDE.md) (the tech authority). This section is the technical
reference the doc-sync rule points at — update it in the same change as any architecture/engine
work. Indexed from [`project-bible.md`](./project-bible.md)._

The app is split so the game logic is engine-agnostic and unit-testable, and the RN/Skia/worklet
layers stay out of Vitest (verified on-device). Dependencies point one way: `resolve/` → `hot/`,
never the reverse (`CLAUDE.md` → Development Rules).

| Layer                 | Path                                        | RN-free?               | Responsibility                                                                                                                                                          | Key files                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core**              | `src/core/`                                 | Yes (Vitest)           | Board model, orchestration, config, RNG, deadlock + reshuffle                                                                                                           | `game.ts`, `config.ts` (`DEFAULT_CONFIG`: `minChain=3`, `lineLength`, `sweepMultiplier`), `types.ts`, `rng.ts`, `deadlock.ts`, `shuffle.ts`                                                                                                                                                                                                                     |
| **Core · hot**        | `src/core/hot/`                             | Yes · **worklet-safe** | Pure hit-test/validation run on the UI thread (no alloc, no module state, `'worklet'`)                                                                                  | `adjacency.ts` (8-way), `can-append.ts`, `closes-square.ts` (2×2 loop), `is-line.ts` (≥5 run)                                                                                                                                                                                                                                                                   |
| **Core · resolve**    | `src/core/resolve/`                         | Yes                    | Chain resolution pipeline                                                                                                                                               | `classify-chain.ts`, `collect-cleared.ts` (color-sweep), `gravity.ts`, `refill.ts`, `resolve-chain.ts`, `scoring.ts`                                                                                                                                                                                                                                            |
| **Core · journey**    | `src/core/journey/`                         | Yes                    | Journey mode state + objectives (vertical slice, landing)                                                                                                               | `journey-state.ts`, `objectives.ts`                                                                                                                                                                                                                                                                                                                             |
| **Core · level**      | `src/core/level/`                           | Yes                    | Level-script loader/validator + first city                                                                                                                              | `level-script.ts` (schema = [`level-script-schema.md`](./level-script-schema.md)), `japan-01.test.ts` (validates `assets/levels/japan-01.json`)                                                                                                                                                                                                                 |
| **Core · obstacles**  | `src/core/obstacles/`                       | Yes                    | Obstacle behavior (v1 seed); layered-cage state (`Map<CellIndex, number>` = index→layers)                                                                               | `caged-dot.ts` (`protectedOf` = cages with ≥2 layers; `chipLayers` peel)                                                                                                                                                                                                                                                                                        |
| **Render**            | `src/render/`                               | No (Skia)              | Draw board, dots, active link path; cage overlay (layer pips, chip rattle)                                                                                              | `board-canvas.tsx`, `dot-layer.tsx`, `link-path.tsx`, `cage-overlay-layer.tsx`, `cage-intro-popup.tsx`, `palette.ts` (`DOT_COLORS`, append-only), `ui-theme.ts` (paper-craft chrome tokens for the `src/app` meta screens; reuses palette's dark ground), `rive-title.tsx` (`<RiveTitle>` — Rive-driven title, falls back to the static lockup; see note below) |
| **Render · geometry** | `src/render/geometry.ts`, `move-offsets.ts` | Yes (Vitest)           | Pure arithmetic over plain numbers — the **only** non-`core` source files Vitest covers; `contrast.test.ts` is a standalone WCAG guard (inline logic, no source module) | `geometry.ts`, `move-offsets.ts`                                                                                                                                                                                                                                                                                                                                |
| **Input**             | `src/input/`                                | No (worklet)           | Touch xy → cell; build/commit/cancel chain                                                                                                                              | `use-board-gesture.ts`                                                                                                                                                                                                                                                                                                                                          |
| **Effects**           | `src/effects/`                              | No (Reanimated)        | Pop, fall/spawn, shuffle slide, reduce-motion                                                                                                                           | `use-board-animation.ts`, `use-reduce-motion.ts`                                                                                                                                                                                                                                                                                                                |
| **Meta**              | `src/meta/`                                 | No (RN/MMKV)           | One board + one score; Journey/Voyage state; persistence; one-shot tutorial flags                                                                                       | `use-game-state.ts`, `use-journey-state.ts`, `use-voyage-state.ts`, `score-storage.ts` (MMKV keys `'score'`, `'sweeps.N'`), `tutorial-flags.ts` (key `'tutorial.cageIntroSeen'`)                                                                                                                                                                                |
| **App (screens)**     | `src/app/`                                  | No (expo-router)       | File-based screens                                                                                                                                                      | `_layout.tsx`, `index.tsx` (title), `game.tsx`, `journey.tsx`, `settings.tsx` — no game-over (Endless has no fail state)                                                                                                                                                                                                                                        |

**Test boundary:** Vitest runs `src/core/**` plus the three pure `src/render` files above
(`vitest.config.ts` `include`); everything else is verified on-device. Coverage is gated on that
same testable surface — see the coverage diff-gate in
[`security-and-supply-chain.md`](./security-and-supply-chain.md).

**Related:** governance/supply-chain = [`security-and-supply-chain.md`](./security-and-supply-chain.md);
team process = [`team-workflow-design.md`](./team-workflow-design.md); gameplay beats =
[`three-dots-gameplay-script.md`](./three-dots-gameplay-script.md).

> **Note (2026-08-18):** `src/core/journey/`, `src/core/level/`, and `src/core/obstacles/` exist
> in the tree (Journey vertical-slice scaffolding has begun landing). `three-dots-game-design.md`
> still reads "not yet implemented"; treat this map as the ground truth for what is present and
> reconcile that design-doc status line in a dedicated game-side pass (out of this governance scope).

> **Note (2026-08-25) — layered cages.** Cage state is `Map<CellIndex, number>` (index → layers
> remaining), threaded by both `use-journey-state.ts` and `use-voyage-state.ts`. The single core seam
> is `resolve-chain.ts`'s optional `protectedCells: ReadonlySet<CellIndex>` argument: cells in that set
> link, count, and classify on the full chain/sweep but are partitioned into `Resolution.protectedHits`
> instead of `cleared` (they chip, not pop). `src/core/resolve-caged-chain.ts` is the one bridge both
> mode hooks call — it derives the protected set via `protectedOf(caged)` (cages with ≥2 layers) and the
> post-commit layer peel via `chipLayers`. The **solver** shares the same pure rule (`chipLayersInner`),
> so a level that passes the winnability sweep is beatable with the real freeing mechanic. Per-level
> budgets stay **solver-derived at runtime** (no hardcoded per-band budget table) from the `SOLVER_*`
> knobs in `voyage-config.ts` (`SOLVER_PERCENTILE 0.75`, `SOLVER_SLACK 0.5`, `SOLVER_BOSS_SLACK 0.8`);
> generated + boss levels and any curated level carrying a `layers ≥ 2` cage route through
> `calibrateLevel` (`generate-level.ts`), while purely 1-layer curated levels return raw (byte-identical).

> **Note (2026-08-25) — Rive title (meta-UI motion).** `src/render/rive-title.tsx`'s `<RiveTitle
fallback>` wraps the `rive-react-native` dependency added to the Final Stack table above. The
> repo-root `metro.config.js` exists for one reason: registering `.riv` in `resolver.assetExts` so
> Metro can bundle the asset — reset it to the Expo default if the Rive title is ever removed. The
> component falls back to the static Phase 5 lockup on Reduce Motion, on a native Rive `onError`, or
> (today) because its `riveTitleSource()` null-guard has no real `.riv` to return — **wiring is
> code-complete with all automated gates green, but the animated title itself is not yet shipped**:
> it needs authored `.riv` art (a later rnd-department slice) and a native dev-client rebuild
> (`expo run:ios`) before it can animate on-device.
