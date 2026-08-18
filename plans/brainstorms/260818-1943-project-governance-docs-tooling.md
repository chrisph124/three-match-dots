# Brainstorm — Project Governance, Docs & Tooling Hardening

**Date:** 2026-08-18 · **Mode:** `/ak-brainstorm --advice` (kongming-supervised)
**Status:** Contract accepted — ready for planning handoff
**Scope source:** 12-item user request (structure, dependabot auto-merge, bible, coverage,
pre-PR policy, guardrail hooks, technical+gameplay docs, game-scripts folder, doc-sync rules,
no-leak policy, three.js on-demand, folder-discipline pipeline).

> This is a stateful pre-delivery record, not evergreen product authority. It feeds the plan;
> it does not supersede `docs/` authority.

---

## Outcome

A reconciled governance layer that **extends the repo's already-mature infra** (CI gates, gitleaks,
audit-diff, vendored-pin-check, dependabot grouping, Husky) rather than rebuilding it — adding the
genuinely-missing pieces (coverage diff-gate, dependabot auto-merge, project bible index, game-scripts
content home, doc-sync rules, session guardrail reminders, three.js on-demand allowance) and wiring
folder discipline so every process artifact lands in one predictable place.

## Constraints

- **`main` is currently unprotected** (`docs/security-and-supply-chain.md`). Branch protection +
  required CI checks is the keystone that makes auto-merge / pre-PR review / guardrails _real_ instead
  of habit-only. Owner-only GitHub-admin action → **Task 0, blocking, manual.**
- **Skia-first render pin set is sacred:** `expo`/`react*`/`react-native*`/skia move together via
  `expo install --fix`, **never auto-merged** (already encoded in `.github/dependabot.yml`). three.js
  deps (`expo-gl`/`expo-three`) join this same pin set once invoked.
- **Only pure-TS is Vitest-testable** (`src/core/**`, `render/geometry|move-offsets|contrast`). Skia/
  gesture/worklet layers verify on-device → no repo-wide coverage %.
- **Session hooks (`.claude/settings.local.json`) are advisory, bypassable** — label everywhere as
  "reminder, not enforcement." Real enforcement = Husky + CI required checks. Reuse the honest wording
  already in `docs/security-and-supply-chain.md`.
- **CLAUDE.md is ~220 lines and already coherent** — merge new rules INTO existing sections
  (Definition of Done, Code Standards, Team Workflow); do not append disconnected rules.
- KISS · DRY · no `any` · sonarjs clean · no AI attribution in commits (existing standards hold).

## Non-goals

- No game-logic / gameplay-feature work (this is infra + docs only).
- No net-new "bible.md" or standalone technical/gameplay docs that duplicate existing files
  (reconcile/index instead — name-collision risk with **LOCKED** `creative-bible.md`).
- No installing three.js/r3f/drei now (allowance only; install on first invocation).
- No arbitrary coverage % floor at launch.
- No new top-level folders (esp. no `superpowers/`-style dumps); no `docs/superpowers/` drift growth.
- No Android / monetization / Journey-mode scope.

## Acceptance criteria

1. Branch protection on `main` enabled with required CI checks (owner-confirmed).
2. `npm run coverage` exists, scoped to the testable include-list; CI reports coverage + **fails only
   on a drop vs `main`** (diff-gate mirroring `audit:diff`). No absolute floor.
3. Dependabot auto-merge workflow merges **only** dev-tooling(minor/patch) + github-actions on CI
   green; expo-native group is provably excluded.
4. `docs/project-bible.md` exists as an **index** linking the one-doc-per-concern set; no duplicated
   authority; `creative-bible.md` untouched.
5. `docs/three-dots-gameplay-script.md` (supersedes `two-dots-gameplay-script.md`) + technical
   reference (extends `tech-stack-and-infra.md`) exist and are linked from the bible index.
6. `docs/game-scripts/` exists with seeded sections (ideas, characters, game-modes, levels, materials,
   font-style, philosophy, game-spirit) + an index.
7. CLAUDE.md updated (merged, not appended): pre-PR checklist (review + lint + coverage-diff + test +
   red-team/security), doc-sync rule (game-scripts/arch/feature/style change → update technical +
   gameplay + general docs), three.js on-demand note, no-leak policy — all with correct
   enforcement-vs-reminder framing.
8. `.claude/settings.local.json` created: guardrail reminder hook before `git push`/`gh pr create`;
   three.js/r3f/drei on-demand allowance note. Labeled advisory.
9. Process folders consolidated under `plans/`: `plans/brainstorms/`, `plans/journals/` (exists),
   `plans/reports/` (exists), `plans/lessons-learned/`; stale `docs/superpowers/{plans,specs}`
   reconciled; routing documented in CLAUDE.md.
10. `npm run lint`, `npm run typecheck`, `npm test`, coverage all green; code review before merge.

---

## Accepted decisions (user-confirmed 2026-08-18)

| #   | Decision                          | Choice                                                                                                                                                                                 |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Process-folder topology           | **Nest under `plans/`** — `plans/brainstorms/`, `plans/journals/`, `plans/reports/`, `plans/lessons-learned/`. Reusable lessons still promote to `.claude/skills/` (step-6 mechanism). |
| D2  | Bible + technical + gameplay docs | **Reconcile / index** — `project-bible.md` indexes existing docs; gameplay doc supersedes two-dots version; technical doc extends `tech-stack-and-infra.md`.                           |
| D3  | Coverage gate                     | **Diff-gate, no floor** — scoped to testable include-list; CI fails only on drop vs `main`; ratchet a floor later.                                                                     |

## Decided-by-default (stated, not asked — objectable)

- **Auto-merge scope:** dev-tooling(minor/patch)+github-actions only; expo-native excluded; CI-green
  gated; **sequenced after Task 0**.
- **Guardrail/red-team "before PR":** documented process + advisory session reminder (red-team is a
  Claude skill, not a CLI — cannot be a hard CI gate). Never called a "guardrail/guarantee."
- **three.js/r3f/drei:** allowed on-demand, not installed; "does not replace Skia"; joins the Expo
  native pin set (never-auto-merge, `expo install --fix`-only) once added.
- **No-leak policy:** merged into Definition of Done, leaning on existing gitleaks (local + CI) +
  `audit:diff`; no new secret scanner.
- **game-scripts/** = creative content → lives in `docs/game-scripts/` (like `creative-bible.md`).

---

## Phased approach (for the plan)

- **Phase 0 — Branch protection (owner, blocking, manual).** Enable via the `gh api` command drafted
  in `docs/security-and-supply-chain.md`; required checks = CI `quality` + `secret-scan`.
- **Phase 1 — Folder topology & drift reconcile.** Create `plans/brainstorms/`, `plans/lessons-learned/`;
  reconcile stale `docs/superpowers/`; research superpowers output-path config; document routing in CLAUDE.md.
- **Phase 2 — Coverage diff-gate.** `@vitest/coverage-v8`, `npm run coverage`, diff script (mirror
  `check-audit.mjs`), CI wiring.
- **Phase 3 — Dependabot auto-merge workflow.** Scoped + CI-gated; after Phase 0.
- **Phase 4 — Guardrail hooks + no-leak policy.** `settings.local.json` reminder hook; CLAUDE.md no-leak.
- **Phase 5 — CLAUDE.md policy consolidation.** Pre-PR checklist, doc-sync rule, three.js note — merged
  into existing sections.
- **Phase 6 — Docs reconcile & bible index.** `project-bible.md`, `three-dots-gameplay-script.md`,
  technical reference.
- **Phase 7 — game-scripts content folder.** Seed sections + index + confluence sync wiring.
- **Phase 8 — three.js on-demand allowance.** `settings.local.json` allow-note + CLAUDE.md.

Phase 0 is strictly first. 1–2 unblock CI signals. 3 depends on 0. 4–8 are docs/policy, low coupling.

## Evidence (verified this session)

- `src/` already layered (core/render/input/effects/meta). `.github/dependabot.yml` groups + excludes
  expo-native from auto-merge. `ci.yml` = lint+typecheck+test+audit:diff+vendored:check+gitleaks;
  `codeql.yml` present. Husky pre-commit (gitleaks+lint-staged) + pre-push (typecheck+test).
- **No coverage** anywhere (no dep, no script, no config). **No auto-merge** workflow.
- `.claude/settings.json` = only `enabledPlugins`; **no `settings.local.json`; no project hooks.**
- `docs/` = 17 files incl. `creative-bible.md` (LOCKED), `tech-stack-and-infra.md`,
  `two-dots-gameplay-script.md`, `security-and-supply-chain.md`. `plans/journals/` + `plans/reports/`
  in active use. `docs/superpowers/` stale drift present.

## Risks / watch-list

- **R1 (keystone):** everything governance-flavored is theater until Phase 0 lands. Owner action —
  cannot be automated by an agent.
- **R2 (drift recurs):** if superpowers has no configurable output path, a CLAUDE.md sentence alone
  won't hold routing — needs a concrete mechanism (research task in Phase 1).
- **R3 (false confidence):** any "guardrail" wording on advisory session hooks manufactures false
  security. Enforce the reminder-vs-enforcement label review before merge.
- **R4 (auto-merge silently inert):** if shipped before Phase 0, it won't wait on checks. Hard sequence.

## Unresolved questions

- None blocking. Two to confirm during planning:
  1. Does the `superpowers` plugin expose a configurable artifact output path (R2)? — research, not a user Q.
  2. Should `docs/superpowers/{plans,specs}` stale content be **migrated** into the new convention or
     **archived** (`plans/reports/_archive/`)? — default: archive, confirm at Phase 1.

## Handoff

→ `ak:plan --advice` (or `superpowers:writing-plans`) to expand Phases 0–8 into an executable plan at
`plans/260818-1943-project-governance-docs-tooling/`. `--advice` persists (kongming go/no-go per phase,
PR review at ship). Then `ak:cook` / `superpowers:executing-plans` per phase.
