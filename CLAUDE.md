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

## Tech Stack (draft — decided in brainstorm, not yet scaffolded)

| Concern | Choice |
|---------|--------|
| App shell / build | **Expo** (dev client — NOT Expo Go, because Skia needs native code) + **EAS Build/Submit** for iOS |
| Rendering | **`@shopify/react-native-skia`** — board drawn as one GPU canvas (dots, link path, particles) |
| Animation | **`react-native-reanimated`** v3 — falling/spring/clear tweens in UI-thread worklets |
| Gestures | **`react-native-gesture-handler`** — pan gesture; touch→grid hit-test + chain logic in worklet |
| Meta UI state | **Zustand** (title/HUD/settings); board sim state in Reanimated shared values for the hot loop |
| Persistence | **`react-native-mmkv`** (or AsyncStorage) — high score + settings. No backend in v1. |
| Audio | **`expo-av`** — SFX |
| Language | TypeScript |

**Performance principle:** keep gesture + hit-test + animation on the UI thread (worklets) to avoid
the JS↔native bridge — that bridge is the classic cause of RN game jank. Entity count is tiny
(~36–64 dots), no physics sim beyond falling tweens, no 3D, no networking.

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
- `npx expo run:ios` — local iOS build/run
- `eas build --platform ios` — cloud iOS build
- `eas submit --platform ios` — submit to App Store / TestFlight

## Development Rules

- Principles: **YAGNI · KISS · DRY**. Keep code files focused (~<200 lines); split by responsibility.
- File naming: kebab-case for TS/JS with descriptive names.
- Keep the game core free of RN/Skia imports so it stays unit-testable and web-portable.
- Pin Skia ↔ Reanimated ↔ Expo SDK versions together (top setup-pain source) — let the Expo SDK lock them.
- No fake data / mocks just to pass builds. Implement real logic.
- Test on a REAL iPhone for "feel" (touch ≠ simulator mouse) before calling drag UX done.

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
- Team workflow design: `docs/team-workflow-design.md`
- Genre reference: Two Dots (Playdots/Zynga) — mechanic source of truth.
