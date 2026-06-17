# CLAUDE.md — three-match-dots

Guidance for Claude Code when working in this repository.

## Project Overview

**three-match-dots** is a mobile puzzle game in the **Two Dots** mold (NOT a Candy Crush / match-3 clone).
iOS-first, built with **React Native**.

**Core loop:** drag through ADJACENT same-color dots (up/down/left/right) to link a chain;
chains of ≥2 clear on release; closing a 2×2 loop clears EVERY dot of that color on the board;
survivors fall via gravity and new dots spawn from the top.

**Current status:** greenfield — app not yet scaffolded. Game design approved via brainstorm.
Game design doc: `docs/two-dots-game-design.md`. Team workflow design: `docs/team-workflow-design.md`.

## Tech Stack (decided — not yet scaffolded)

**Why React Native:** pure mobile, **iOS first then Android** — one TS codebase ships both stores via EAS.
Native (Swift+Kotlin) = 2 codebases; Unity = overkill for simple 2D. No web version → no monorepo.

| Concern | Choice |
|---------|--------|
| Language | TypeScript |
| App shell / build | **Expo** (dev client — NOT Expo Go, because Skia needs native code) + **EAS Build/Submit** (iOS first, then Android) |
| Navigation | **`expo-router`** — file-based; ~4 screens (title / game / game-over / settings) |
| Rendering | **`@shopify/react-native-skia`** — board drawn as one GPU canvas (dots, link path, particles) |
| Animation | **`react-native-reanimated`** v3 — falling/spring/clear tweens in UI-thread worklets |
| Gestures | **`react-native-gesture-handler`** — pan gesture; touch→grid hit-test + chain logic in worklet |
| State | **Zustand** (UI/meta: HUD, settings); board sim state in Reanimated shared values for the hot loop |
| Persistence | **`react-native-mmkv`** — high score + settings. No backend in v1. |
| Audio | **`expo-av`** — SFX |
| Testing | **Vitest** — unit-tests the pure-TS core ONLY (see Development Rules) |
| Lint / format | **ESLint** (`eslint-config-expo`) + **Prettier** |
| Package manager | **npm** |

**Performance principle:** keep gesture + hit-test + animation on the UI thread (worklets) to avoid
the JS↔native bridge — that bridge is the classic cause of RN game jank. Entity count is tiny
(~36–64 dots), no physics sim beyond falling tweens, no 3D, no networking.

## Infrastructure (decided — wired at scaffold)

| Area | Choice |
|------|--------|
| Build / release | **EAS Build + EAS Submit** → TestFlight (iOS), Google Play (Android phase) |
| Crash reporting | **Sentry** (`@sentry/react-native`) |
| Analytics | **PostHog** — privacy-friendly; no IDFA → avoids iOS ATT prompt; EU-hosting option |
| OTA updates | **`expo-updates`** (`eas update`) — push JS-only fixes without a store review |
| Code quality | **SonarCloud** + **`eslint-plugin-sonarjs`** — code smells, complexity, coverage tracking |
| CI | **GitHub Actions**: lint (incl. sonarjs) + typecheck (strict, no-any) + Vitest core (+ coverage → SonarCloud) |
| Git hooks | **Husky + lint-staged** (wired at scaffold) |
| Backend | **None for v1** — Sentry/PostHog/SonarCloud are 3rd-party SaaS, not our servers |

**Privacy/compliance:** analytics requires App Store Privacy Nutrition Labels + Google Play Data Safety
disclosures (PostHog keeps this minimal). Keep Sentry/PostHog keys OUT of git (use EAS secrets / env).

**SonarCloud cost caveat:** free for **public** repos only — if `three-match-dots` is **private**, SonarCloud
is a paid plan (`eslint-plugin-sonarjs` still works locally/CI for free regardless).

**Android phase caveat:** Skia + Reanimated run great on iOS; Android device fragmentation means
testing on a cheap real Android device is required before the Play release.

## Architecture (layered)

- **Game core** (`pure TS`, engine-agnostic, no RN deps): grid model, adjacency + chain validation,
  loop detection, clear→gravity→refill resolution, scoring. ← unit-testable; reusable for a web version.
- **Render layer** (Skia): subscribes to core state; draws dots, active link path, particles.
- **Input layer** (Gesture Handler worklet): maps touch xy → cell; appends valid cells to chain;
  commits/cancels on release.
- **Effects layer**: pop, fall-bounce, particle burst, combo flair, screen shake (Reanimated + Skia).
- **Meta UI** (RN components): title, HUD (score / high score), game-over, settings.

## Scope

**v1 (current):** Two Dots-exact mechanic, **endless score-attack mode only**, juicy visuals, local high score, iOS.

**Out of scope for v1 (do not build unless asked):** levels/campaign, monetization/ads/IAP,
online/leaderboards, accounts/cloud-save, Android. Architecture must not block these later.

## Commands

> Not yet scaffolded. Populate once `package.json` exists. Expected (Expo):
- `npx expo start --dev-client` — run dev client
- `npx expo run:ios` / `npx expo run:android` — local build/run
- `npm test` — Vitest (pure-TS core)
- `eas build --platform ios|android` — cloud build
- `eas submit --platform ios|android` — submit to TestFlight / Google Play
- `eas update` — push an OTA (JS-only) update

## Development Rules

- Principles: **YAGNI · KISS · DRY**. Keep code files focused (~<200 lines); split by responsibility.
- File naming: kebab-case for TS/JS with descriptive names.
- Keep the game core (`src/core/`) free of RN/Skia imports — Vitest can ONLY test RN-free code.
- **Test boundary:** Vitest unit-tests the pure-TS core (chain/loop/gravity/scoring). The Skia /
  Reanimated / gesture layers are NOT Vitest-testable (worklets, native) → verify them ON-DEVICE.
- Pin Skia ↔ Reanimated ↔ Expo SDK versions together (top setup-pain source) — let the Expo SDK lock them.
- No fake data / mocks just to pass builds. Implement real logic.
- Test on a REAL device for "feel" (touch ≠ simulator mouse) — iPhone first, then a low-end Android.
- Keep Sentry/PostHog keys OUT of git (EAS secrets / env vars).

## Code Standards (enforced — CI-blocking)

- **TypeScript: never `any`.** Use `unknown`, `Record<string, unknown>`, or generics `<T>` instead.
  Enforced via `@typescript-eslint/no-explicit-any` (error) + strict tsconfig (`strict: true`, `noImplicitAny`).
  Escape hatch ONLY via an inline `// eslint-disable-next-line ...` WITH a justification comment
  (e.g. genuinely untyped 3rd-party lib). No silent `any`.
- **Lint clean — SonarLint rules.** Follow SonarLint via `eslint-plugin-sonarjs` (code smells,
  cognitive complexity) + the SonarCloud dashboard. Lint errors block commit, push, and CI.

## Definition of Done (every scaffold / bug fix / feature)

A change is NOT done until ALL hold:
1. **Unit tests** — check for existing tests covering the touched core logic; create/update if missing.
   - **Bug fix → regression test FIRST**: write a failing test that reproduces the bug (red), then fix (green),
     so it can never silently return. Pairs with `superpowers:systematic-debugging`.
   - RN / Skia / gesture layers (not Vitest-testable) → verify on-device instead.
2. **Code review** run via `superpowers:requesting-code-review` before merge.
3. **Lint + typecheck + tests all green** (the CI-blocking standards above).

## Commit & PR Conventions

- **No AI attribution — ever.** Never add Claude (or any AI/tool) as author, co-author, or contributor.
  No `Co-Authored-By: Claude`, no "Generated with…", no AI references in commit messages, PR
  descriptions, or code comments. Commits are authored solely by the human committer.
- Conventional commits: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`. Describe the change, not the tool.

## Team Workflow (everyone follows this, every task)

This team uses **superpowers** (free) — NOT claudekit (`/ck:*`). Do not use `/ck:*` commands here.

**The flow — every change goes through all 6 steps:**

| # | Step | Superpowers skill to invoke | Output |
|---|------|-----------------------------|--------|
| 1 | Brainstorm | `superpowers:brainstorming` | design doc in `docs/` |
| 2 | Plan | `superpowers:writing-plans` | plan in `plans/` |
| 3 | Implement | `superpowers:executing-plans` (+ `subagent-driven-development`) | code on a feature branch |
| 4 | Unit tests | `superpowers:test-driven-development` | tests written with/before code |
| 5 | Review | `superpowers:requesting-code-review` → `receiving-code-review` | PR + review (AI + human) |
| 6 | Lesson-learned | `superpowers:writing-skills` | a committed skill in `.claude/skills/` (only if reusable) |

Support skills: `systematic-debugging` (bugs), `verification-before-completion` &
`finishing-a-development-branch` (close-out), `using-git-worktrees` (parallel work).

### Superpowers setup (one-time, per teammate)

In Claude Code: opening this repo prompts you to enable the plugin declared in `.claude/settings.json`.
If not, install manually:

```
/plugin install superpowers@claude-plugins-official
```

(Source: official Anthropic marketplace `anthropics/claude-plugins-official`. Latest/bleeding-edge
alternative: `/plugin marketplace add obra/superpowers` then install — not the team default.)

### Lessons-learned (step 6) — avoid repeat bugs

After a bug fix or review, ask: **is this lesson reusable / will it recur?**
- **Yes** → codify it as a project skill via `superpowers:writing-skills`, committed to
  `.claude/skills/<lesson-slug>/SKILL.md`. Committed skills auto-load for every teammate. See
  `.claude/skills/README.md` for the template.
- **No (one-off)** → note it in the PR description / commit message. Do NOT author a skill.

### Enforcement (wired at the Expo scaffold step, not yet active)

- **Husky + lint-staged**: pre-commit lints staged files; pre-push runs typecheck + unit tests.
  Auto-installs on `npm install` once `package.json` exists.
- **GitHub Actions CI**: lint + typecheck + unit tests on every PR.
- **Branch protection** (repo owner sets on GitHub): require CI green + 1 approval before merge —
  this is what forces step 5.

## Key References

- Game design: `docs/two-dots-game-design.md`
- Tech stack & infra: `docs/tech-stack-and-infra.md`
- Team workflow design: `docs/team-workflow-design.md`
- Genre reference: Two Dots (Playdots/Zynga) — mechanic source of truth.
