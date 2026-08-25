# CLAUDE.md — three-match-dots

Guidance for Claude Code when working in this repository.

## Project Overview

**Three Dots** (repo: `three-match-dots`) is a mobile puzzle game in the **Two Dots** mold (NOT a
Candy Crush / match-3 clone). iOS-first, built with **React Native**. The concept ships two modes:
**Endless** (score-attack, no fail state — built and playable) and **Journey** (timed, level-based,
world-map progression — core engine on `main`, render/on-device verification in progress; see "Scope" below).

**Core loop:** drag through ADJACENT same-color dots (8-way — orthogonal AND diagonal) to link a
chain; chains of ≥3 clear on release; closing a 2×2 loop OR drawing a straight run of ≥5 clears
EVERY dot of that color on the board (a shipped bonus mechanic beyond the classic Two Dots ruleset —
see `docs/three-dots-game-design.md`); survivors fall via gravity and new dots spawn from the top.
A board with no legal chain reshuffles. Endless is zen — no fail state.

**Current status:** Endless is playable. The game core (`src/core/`), Skia render layer
(`src/render/`), gesture input (`src/input/`), animation (`src/effects/`), and score persistence
(`src/meta/`) are all built and wired for Endless. 6×6 board, 3 colors, endless play with a
persisted score. Journey's core is now implemented on `main` — `src/core/level/` (level-script
loader + `parseLevelScript`), `src/core/journey/` (journey state), `src/core/obstacles/` (layered
caged dots), and the infinite-variant engine `src/core/voyage/` are committed and unit-tested. What
remains is on-device verification of the Skia render layers (Voyage diorama/ribbon/boss; the
layered-cage overlay + first-cage teaching) — code-complete, not yet signed off on a device.
Game design: `docs/three-dots-game-design.md` (current authority; `docs/two-dots-game-design.md`
is superseded, kept for history). Team workflow design: `docs/team-workflow-design.md`.

## Tech Stack (decided)

**Why React Native:** pure mobile, **iOS first then Android** — one TS codebase ships both stores via EAS.
Native (Swift+Kotlin) = 2 codebases; Unity = overkill for simple 2D. No web version → no monorepo.

| Concern           | Choice                                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language          | TypeScript                                                                                                                                                            |
| App shell / build | **Expo** (dev client — NOT Expo Go, because Skia needs native code) + **EAS Build/Submit** (iOS first, then Android)                                                  |
| Navigation        | **`expo-router`** — file-based; 3 screens (title / game / settings) — no game-over screen, endless has no fail state                                                  |
| Rendering         | **`@shopify/react-native-skia`** — board drawn as one GPU canvas (dots, link path)                                                                                    |
| Animation         | **`react-native-reanimated`** v4 (worklets plugin auto-wired by `babel-preset-expo`, no `babel.config.js` needed) — falling/spring/clear tweens in UI-thread worklets |
| Gestures          | **`react-native-gesture-handler`** — pan gesture; touch→grid hit-test + chain logic in worklet                                                                        |
| State             | One board + one score number, owned by `src/meta/use-game-state.ts`; Zustand deferred until settings/meta UI grow                                                     |
| Persistence       | **`react-native-mmkv`** — persists the score (key `'score'`) and per-color lifetime sweep counts (keys `'sweeps.N'`). No settings persisted yet. No backend in v1.    |
| Audio             | **`expo-av`** — SFX (decided, not yet installed)                                                                                                                      |
| Testing           | **Vitest** — unit-tests the pure-TS core ONLY (see Development Rules)                                                                                                 |
| Lint / format     | **ESLint** (`eslint-config-expo`) + **Prettier**                                                                                                                      |
| Package manager   | **npm**                                                                                                                                                               |

**Performance principle:** keep gesture + hit-test + animation on the UI thread (worklets) to avoid
the JS↔native bridge — that bridge is the classic cause of RN game jank. Entity count is tiny
(~36–64 dots), no physics sim beyond falling tweens, no 3D, no networking.

**3D / three.js (on-demand — NOT installed):** `three`, `@react-three/fiber`, `@react-three/drei`
are not dependencies. Reading their docs (context7) is fine anytime; install them ONLY when a task
actually needs 3D, and only via `npx expo install` so the SDK picks compatible `expo-gl` / `expo-three`.
**Skia stays the primary renderer — three.js does not replace it.** Once installed, treat these as part
of the Expo/native pin set: never auto-merged, realigned only by `expo install --fix` (see
`docs/security-and-supply-chain.md` § The Expo/native pin set).

## Infrastructure (decided — wired at scaffold)

| Area            | Choice                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build / release | **EAS Build + EAS Submit** → TestFlight (iOS), Google Play (Android phase)                                                                                     |
| Crash reporting | **Sentry** (`@sentry/react-native`)                                                                                                                            |
| Analytics       | **PostHog** — privacy-friendly; no IDFA → avoids iOS ATT prompt; EU-hosting option                                                                             |
| OTA updates     | **`expo-updates`** (`eas update`) — push JS-only fixes without a store review                                                                                  |
| Code quality    | **`eslint-plugin-sonarjs`** (SonarLint rules) — local + CI, free. No SonarCloud SaaS (redundant).                                                              |
| Security scan   | **CodeQL** (`.github/workflows/codeql.yml`) + **Dependabot** (`.github/dependabot.yml`) — active, free on public repo                                          |
| CI              | **GitHub Actions** (`ci.yml`): `quality` job = lint (sonarjs) + typecheck (strict) + Vitest + coverage/audit/vendored diff-gates; `secret-scan` job = gitleaks |
| Git hooks       | **Husky + lint-staged** (wired at scaffold)                                                                                                                    |
| Backend         | **None for v1** — Sentry/PostHog are 3rd-party SaaS, not our servers                                                                                           |

**Privacy/compliance:** analytics requires App Store Privacy Nutrition Labels + Google Play Data Safety
disclosures (PostHog keeps this minimal). Keep Sentry/PostHog keys OUT of git (use EAS secrets / env).

**Android phase caveat:** Skia + Reanimated run great on iOS; Android device fragmentation means
testing on a cheap real Android device is required before the Play release.

## Architecture (layered)

- **Game core** (`pure TS`, engine-agnostic, no RN deps): grid model, adjacency + chain validation,
  loop detection, clear→gravity→refill resolution, scoring. ← unit-testable; reusable for a web version.
- **Render layer** (Skia): subscribes to core state; draws dots and the active link path.
- **Input layer** (Gesture Handler worklet): maps touch xy → cell; appends valid cells to chain;
  commits/cancels on release.
- **Effects layer**: dot pop, fall/spawn slide, shuffle slide, sweep-armed highlight (Reanimated + Skia).
- **Meta UI** (RN components): title, HUD (score only — no high-score/best tracking), settings.
  No game-over screen — endless has no fail state.

## Scope

**Shipped:** Two Dots-derived mechanic (8-way linking, 2×2-loop and ≥5-line sweeps, shuffle on
deadlock), endless score-attack mode, juicy visuals, a persisted score, iOS.

**Vertical slice in progress:** Journey mode — timed levels, a (now layered) caged-dot obstacle, one
hand-authored Japan level, world-map progression — plus the infinite variant **Voyage**. Design
authority: `docs/three-dots-game-design.md`, `docs/level-script-schema.md` (the level-script
contract), `docs/creative-bible.md` (look/feel). The pure-TS engine, level system, obstacles, and
Voyage generator/solver are on `main` and unit-tested (`src/core/{level,journey,obstacles,voyage}/`);
the Skia render layers are code-complete but pending on-device verification — the remaining gate.

**Out of scope for now (do not build unless asked):** levels/campaign beyond the vertical slice,
monetization/ads/IAP, online/leaderboards, accounts/cloud-save, Android. Architecture must not
block these later — see `docs/monetization-and-roadmap.md` for the deferred economy and
`docs/apple-compliance-checklist.md` for compliance-when-added. Android is deferred, not
architecturally blocked: it ships from the same RN codebase when it's time, no separate native
track needed.

## Commands

- `npm start` — start Metro for the dev client (`expo start --dev-client`)
- `npm run ios` — build + run the dev client on iOS (`expo run:ios`)
- `npm run android` — build + run the dev client on Android
- `npm run lint` — ESLint (incl. sonarjs, no-any)
- `npm run typecheck` — `tsc --noEmit` (strict)
- `npm test` — Vitest (pure-TS core in `src/core/`)
- `npm run test:watch` — Vitest watch mode

> EAS build/submit + OTA (`eas update`) are deferred to the release round (see `docs/expo-scaffold-design.md`).

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
- **`src/core/hot/` is worklet-safe:** no object allocation, no module state, no classes, and no
  imports from `src/core/resolve/`. Dependencies point one way — `resolve/` may use `hot/`, never
  the reverse. Every exported function opens with the `'worklet';` directive.
- **`src/render/geometry.ts` follows the same rule** and is the only file outside `src/core/`
  that Vitest runs. Keep it pure arithmetic over plain numbers.
- **Zustand is not used yet.** State is one board and one number, owned by
  `src/meta/use-game-state.ts`. Introduce a store when settings and meta UI actually grow.
- **React Compiler lint rules (`react-hooks/immutability`, `react-hooks/refs`) error on
  Reanimated `.value` writes and ref writes inside hook/component bodies.** Do not disable the
  rule — move the mutation into a plain module-level function taking what it needs as arguments
  (see `playClear`/`playMove`/`resetClear` in `src/effects/use-board-animation.ts`,
  `buildPanGesture` in `src/input/use-board-gesture.ts`, `writeBoardMirror`/`unlock` in
  `src/meta/use-game-state.ts`).
- **`react-native-mmkv` is v4:** `MMKV` is a type-only export; instances come from a
  `createMMKV()` factory, not `new MMKV()`. It also requires the native peer dependency
  `react-native-nitro-modules`, declared explicitly in `package.json`.
- **Anchor RN-free verification greps to `from`/`require(`.** A bare `grep -rE "expo" src/core/`
  matches the substring inside every `export` line and falsely flags the whole core as dirty.

## Code Standards (enforced — CI-blocking)

- **TypeScript: never `any`.** Use `unknown`, `Record<string, unknown>`, or generics `<T>` instead.
  Enforced via `@typescript-eslint/no-explicit-any` (error) + strict tsconfig (`strict: true`, `noImplicitAny`).
  Escape hatch ONLY via an inline `// eslint-disable-next-line ...` WITH a justification comment
  (e.g. genuinely untyped 3rd-party lib). No silent `any`.
- **Lint clean — SonarLint rules.** Follow SonarLint via `eslint-plugin-sonarjs` (code smells,
  cognitive complexity). Lint errors block commit, push, and CI.
- **No secrets in git (no-leak policy).** Never commit keys, tokens, API secrets, `.env` files, or
  credentials — runtime keys live in EAS secrets / env, never the repo. Enforcement is gitleaks: the
  `.husky/pre-commit` hook (local, `--no-verify`-bypassable) plus the `secret-scan` CI job, which runs
  on every PR and becomes a **merge-blocking required check once branch protection is enabled**
  (pending owner action — see Team Workflow § Enforcement). Scope a false positive in `.gitleaks.toml`
  (path or rule); never disable the hook wholesale. Full policy:
  `docs/security-and-supply-chain.md` § Secret scanning.

## Definition of Done (every scaffold / bug fix / feature)

A change is NOT done until ALL hold:

1. **Unit tests** — check for existing tests covering the touched core logic; create/update if missing.
   - **Bug fix → regression test FIRST**: write a failing test that reproduces the bug (red), then fix (green),
     so it can never silently return. Pairs with `superpowers:systematic-debugging`.
   - RN / Skia / gesture layers (not Vitest-testable) → verify on-device instead.
2. **Code review** run via `superpowers:requesting-code-review` before merge.
3. **Lint + typecheck + tests + coverage all green:** `npm run lint`, `npm run typecheck`, `npm test`,
   and `npm run coverage:diff` (the coverage diff-gate — fails on a drop below the committed baseline;
   see `docs/security-and-supply-chain.md` § Coverage). These are the CI-blocking standards above.
4. **Pre-PR checklist** — before pushing a commit or opening a PR, re-run the four commands in (3),
   confirm the code review (2) landed, and red-team the diff for leaked keys / tokens / `.env`. The CI
   checks (`quality` + `secret-scan`) run on every PR and become **merge-blocking required checks once
   branch protection is enabled** (pending owner action — see Team Workflow § Enforcement); the gitleaks
   pre-commit hook is a local backstop. The local session prompt (`.claude/settings.local.json`) and
   this manual red-team are a **reminder, not enforcement** — a green local run does not replace the CI
   checks on the PR.

## Commit & PR Conventions

- **No AI attribution — ever.** Never add Claude (or any AI/tool) as author, co-author, or contributor.
  No `Co-Authored-By: Claude`, no "Generated with…", no AI references in commit messages, PR
  descriptions, or code comments. Commits are authored solely by the human committer.
- Conventional commits: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`. Describe the change, not the tool.

## Team Workflow (everyone follows this, every task)

This team uses **superpowers** (free) — NOT claudekit (`/ck:*`). Do not use `/ck:*` commands here.

**The flow — every change goes through all 6 steps:**

| #   | Step           | Superpowers skill to invoke                                     | Output                                                    |
| --- | -------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | Brainstorm     | `superpowers:brainstorming`                                     | design doc in `docs/`                                     |
| 2   | Plan           | `superpowers:writing-plans`                                     | plan in `plans/`                                          |
| 3   | Implement      | `superpowers:executing-plans` (+ `subagent-driven-development`) | code on a feature branch                                  |
| 4   | Unit tests     | `superpowers:test-driven-development`                           | tests written with/before code                            |
| 5   | Review         | `superpowers:requesting-code-review` → `receiving-code-review`  | PR + review (AI + human)                                  |
| 6   | Lesson-learned | `superpowers:writing-skills`                                    | a committed skill in `.claude/skills/` (only if reusable) |

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

### Where work-artifacts live (one home per artifact type)

Every stateful record has exactly one home. Each folder's `README.md` is the authority for its own
naming; don't scatter copies across `docs/`. `docs/` holds evergreen authority only (see Key References).

| Artifact                       | Home                                       | Naming                         |
| ------------------------------ | ------------------------------------------ | ------------------------------ |
| Plan (index + phases)          | `plans/<YYMMDD-HHMM-slug>/`                | `plan.md` + `phase-NN-*.md`    |
| Brainstorm / design contract   | `plans/brainstorms/`                       | `YYMMDD-HHMM-<slug>.md`        |
| Report (progress/audit/review) | `plans/reports/` (`_archive/` once landed) | `<type>-YYMMDD-HHMM-<slug>.md` |
| Journal                        | `plans/journals/`                          | `YYYY-MM-DD-<slug>.md`         |
| Lesson-learned (one-off)       | `plans/lessons-learned/`                   | `YYMMDD-HHMM-<slug>.md`        |
| Reusable lesson                | `.claude/skills/<slug>/SKILL.md`           | promote via step 6             |

### Enforcement (Husky + CI active; branch protection is a pending owner action)

- **Husky + lint-staged**: pre-commit lints staged files and runs `gitleaks protect --staged` (when
  the binary is present); pre-push runs typecheck + unit tests. Auto-installs on `npm install`.
- **GitHub Actions CI** (`.github/workflows/ci.yml`): the `quality` job runs lint + typecheck + unit
  tests + the coverage / audit / vendored-pin diff-gates; the `secret-scan` job runs gitleaks. Both on
  every PR.
- **Branch protection** (repo owner sets on GitHub — not automated here): require the `quality` and
  `secret-scan` checks to pass before merge. This repo runs the **solo flow**
  (`required_approving_review_count: 0` — self-merge allowed once checks pass); raise it to `1` when a
  second reviewer joins. `main` is currently unprotected — enabling it is the documented owner action
  in `docs/security-and-supply-chain.md` § Branch protection, and it is the precondition that makes the
  Dependabot auto-merge workflow safe to activate.

## Key References

**Docs are synchronized — one home per concern, plus an index.** Start at `docs/project-bible.md`, the
docs index that routes to every concern. When a change touches architecture, the codebase, a feature, or
a visual style — OR edits `docs/game-scripts/` — update the owning docs in the **same change**: the
technical reference (`docs/tech-stack-and-infra.md`, the `src/` architecture map), the gameplay
walkthrough (`docs/three-dots-gameplay-script.md`), and the bible index if a doc was added or a concern
renamed. Cross-link; don't duplicate. `docs/creative-bible.md` is LOCKED (look/feel) — change it
deliberately, not as a side effect.

- Docs index / bible (start here): `docs/project-bible.md`
- Game design (current authority): `docs/three-dots-game-design.md`
- Gameplay walkthrough (Endless, current): `docs/three-dots-gameplay-script.md`
- Game design (superseded, kept for history): `docs/two-dots-game-design.md`
- Creative bible (look, tone, LOCKED rules): `docs/creative-bible.md`
- Game-scripts (creative pre-production content): `docs/game-scripts/index.md`
- Level-script schema (Journey level contract): `docs/level-script-schema.md`
- Monetization & expansion roadmap (deferred): `docs/monetization-and-roadmap.md`
- Apple compliance checklist: `docs/apple-compliance-checklist.md`
- RnD department (agent workflow for level/art authoring): `docs/rnd-department.md`
- Creative tool catalog: `docs/creative-tool-catalog.md`
- Tech stack & infra (technical reference, `src/` architecture map): `docs/tech-stack-and-infra.md`
- Security & supply chain (guardrails, gates, branch protection): `docs/security-and-supply-chain.md`
- External service setup (Sentry/PostHog): `docs/service-setup.md`
- Team workflow design: `docs/team-workflow-design.md`
- Genre reference: Two Dots (Playdots/Zynga) — mechanic source of truth.
