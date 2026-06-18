# Expo Scaffold — Design (Approved)

**Date:** 2026-06-18
**Status:** Approved via brainstorm. Ready for `superpowers:writing-plans`.
**Supersedes scaffold notes in:** `tech-stack-and-infra.md` → "Next Steps", `team-workflow-design.md` → "wire at scaffold".

## Problem

Greenfield repo, stack fully decided (see `CLAUDE.md`, `tech-stack-and-infra.md`) but app never
scaffolded — no `package.json`, no `src/`. This round scaffolds a **lean, runnable, CI-green** Expo
dev-client skeleton and proves Skia renders. Heavy infra (Sentry/PostHog/EAS/expo-updates) deferred.

## Decisions (this round)

- **Scope:** lean runnable core. Defer Sentry/PostHog/EAS/`expo-updates` to a later observability+release round (need accounts that don't exist yet → wiring now = dead config).
- **Done =** two gates:
  - *Automated (CI):* `npm run lint` (sonarjs + no-`any`) + `npm run typecheck` (tsc strict) + `npm test` (Vitest) all green; CI green on PR.
  - *Manual (local, not CI):* `npx expo run:ios` builds a dev client and a minimal **Skia canvas renders** on the iPhone 17 simulator. De-risks the #1 documented pain (Skia↔Reanimated↔Expo version pinning).
- **Structure:** expo-router `app/` with 4 placeholder routes (title / game / game-over / settings) + stubbed layer folders `src/core|render|input|effects|meta/`.
- **Extra deps:** MMKV / Zustand / expo-av **deferred** (YAGNI — unused until game logic).

## Out of scope

Game logic (chain/loop/gravity/scoring beyond a trivial sample), Sentry, PostHog, EAS/`expo-updates`,
Android run, real art/audio, MMKV/Zustand/expo-av installs.

## Constraints

Stack locked per `docs/`; **no `/ck:*`** (superpowers flow); npm; kebab-case files; files <200 lines;
`src/core/` stays RN-free; strict **no-`any`**; no AI attribution in commits.

## Environment (verified 2026-06-18)

Xcode 26.2, CocoaPods 1.16.2, iPhone 17 simulators present, node v24.16.0, npm 11 → local dev-client
build via `npx expo run:ios` feasible without EAS. **watchman MISSING** (optional: `brew install watchman`).
**Node 24** ahead of Expo's tested LTS — fall back to Node 20/22 (nvm) if Metro/CLI warns.

## Method (gotcha-bearing parts)

- **Scaffold into existing repo:** `create-expo-app` wants an empty dir, but repo has `.git`, `CLAUDE.md`,
  `docs/`, `.claude/`, `.github/`. → generate in a **temp dir, then merge** into root, preserving all existing files. Do NOT clobber.
- **Template:** Expo default **expo-router + TypeScript**, then strip example down to the 4 routes.
- **Versions:** latest stable Expo SDK; add Skia / Reanimated / Gesture-Handler via **`npx expo install`**
  (SDK locks compatible versions). Reanimated babel plugin **last** in `babel.config`; Gesture Handler root
  import at entry; rebuild dev client after adding native deps.
- **Vitest:** scoped to `src/core/**` only (node env); never imports RN. Sample = trivial RN-free fn
  (e.g. `are-adjacent.ts`) + test → establishes testable-core boundary pattern.
- **CI:** JS/TS gates only (lint+typecheck+vitest) — runner does NOT build native; Skia proof stays local.
- **Husky:** pre-commit → lint-staged (eslint --fix + prettier on staged); pre-push → typecheck + vitest;
  auto-installs via `prepare` on `npm install`.

## Build order (plan shape)

1. Create app (temp→merge); app boots; commit baseline.
2. Strict tsconfig + ESLint(`eslint-config-expo` + `eslint-plugin-sonarjs`, no-`any`=error) + Prettier; lint/typecheck green.
3. `app/` 4 routes + `src/` layer folders + sample core fn.
4. Vitest + sample core test; `npm test` green.
5. `expo install` Skia/Reanimated/Gesture-Handler + minimal Skia canvas; `expo run:ios` renders it.
6. Husky + lint-staged + `.github/workflows/ci.yml`; open PR; CI green.

## Touchpoints (created)

`package.json`, `app.json`/`app.config.ts`, `tsconfig.json`, `app/` (`_layout` + 4 routes),
`src/core|render|input|effects|meta/`, `eslint.config.*`, `.prettierrc`, `vitest.config.ts`, `.husky/`,
`.github/workflows/ci.yml`, `CLAUDE.md` Commands section update.

## Risks

| Risk | Mitigation |
|---|---|
| `create-expo-app` clobbering existing repo files | temp-dir → selective merge; commit clean baseline first |
| Reanimated babel-plugin order / GH root import | follow Expo's exact setup; verify dev-client rebuild |
| Node 24 ahead of Expo LTS | proceed; fall back to Node 20/22 (nvm) if warned |
| First `expo run:ios` slow (pod install + native build) | expected; one-time per native-dep change |
| CI can't prove Skia (no device) | acceptance splits: CI = JS/TS gates; Skia = local manual proof |

## Success criteria

- `npx expo start --dev-client` / `npx expo run:ios` launches; minimal Skia canvas renders on simulator.
- `npm run lint`, `npm run typecheck`, `npm test` green locally and in CI on the PR.
- Repo structure matches documented architecture (RN-free `src/core/`, 4 routes, layer folders).

## Defaults (changeable)

- App slug/name: `three-match-dots` (placeholder; real branding + bundle id at EAS round).
- Scaffold branch: `scaffold/expo-app`.

## Unresolved questions

- Exact Expo SDK + locked Skia/Reanimated/Gesture-Handler versions — resolve at implement via `expo install`.
- ESLint flat-config vs legacy — follow whatever `eslint-config-expo` ships for the chosen SDK.
- Min iOS/Android OS versions — deferred to EAS/release round.
