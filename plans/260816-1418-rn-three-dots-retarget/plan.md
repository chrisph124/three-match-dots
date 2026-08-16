---
title: 'RN Three Dots Retarget'
description: 'React-Native-first retarget of the shipped game to the Three Dots concept: harden the harness, reconcile spec↔code, and ship a Journey vertical slice.'
status: done # all three phases implemented + gate-green; residual = human gates (on-device QA, branch-protection PUT)
priority: P1
effort: '3-4d'
tags: [react-native, expo, security, game-design, three-dots]
created: 2026-08-16
blockedBy: []
blocks: []
---

# RN Three Dots Retarget

## Overview

The React Native game already ships: a pure-TS core (`src/core/`), Skia render,
worklet gesture input, and MMKV score — 8-way linking, ≥3-chain clears, a
≥5-line/2×2-loop color-sweep, deadlock reshuffle, endless zen. This plan takes
the **locked RN-first direction** (the Swift pivot was evaluated and reversed;
its work is preserved on `archive/swift-pivot-260816`) and retargets the game to
the **Three Dots** concept — first hardening the harness, then reconciling the
docs with the shipped code, then proving Journey mode end-to-end on the existing
engine.

Base: `main` @ `c5fbd8e`. Deliverable of this plan step is the plan itself — no
code changes until `/ak:cook`.

## Locked Decisions (do not relitigate)

1. **Direction: React Native**, not Swift/SpriteKit. The greenfield premise that
   justified the pivot is void (a polished RN game already exists).
2. **Adjacency: keep 8-way** (orthogonal + diagonal) — code wins; the archived
   4-way GDD is updated to match. Any future flip is a bugfix with a regression
   test first, never a silent edit.
3. **Guardrails scope: Security + CI + AI-agent-harness audit** (Phase 1).
4. **Versions: already correctly Expo-pinned — do not bump.** Expo SDK 57 owns
   the mutually-compatible native pin set. Upgrade only via `npx expo install
--fix`. **`npm audit fix --force` is forbidden** (false path → Expo 53/RN 0.72
   downgrade). The one real version issue is CI Node 20 (EOL) → 24.

## Goals

| #   | Goal                                                                                                                                          | Priority |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Harden harness: Node lifecycle, toolchain floor, Dependabot split, gitleaks, advisory-diff audit, vendored-harness vetting, branch protection | P1       |
| 2   | Reconcile docs with shipped code and bring the Three Dots concept onto `main` (retarget Swift → RN)                                           | P1       |
| 3   | Ship a Three Dots Journey vertical slice (level-script + timer + objectives + one caged obstacle + one Japan city) on the existing engine     | P1       |

## Phases

| #   | Phase                                                                        | Status                                                                                                                                              |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [Version & Guardrail Audit](./phase-01-guardrails-and-versions.md)           | Done (2 owner-action caveats: local gitleaks binary, branch-protection PUT)                                                                         |
| 2   | [Spec ↔ Code Reconciliation](./phase-02-spec-code-reconciliation.md)         | Done (7 concept docs ported+RN-retargeted; CLAUDE.md reframed; report in plans/reports/)                                                            |
| 3   | [Three Dots Journey Vertical Slice](./phase-03-three-dots-vertical-slice.md) | Done (level-script + journey-state + objectives + caged-dot + palette + route/HUD wired; 209 tests green; on-device QA is the remaining human gate) |

Phase 1 is deliberately first: cheap, zero product risk, and it makes the
pipeline trustworthy before any product code lands. Phase 3 depends on Phase 2
(the level-script schema doc is the contract the slice implements).

## Deferred Scope (explicitly out — do not build unless asked)

EAS build/submit, Sentry, PostHog, StoreKit/IAP, Game Center, Apple
privacy-manifest submission prep, Android, additional countries/obstacles/levels,
stars, the isometric city map. Architecture must not block these later.

## Test Boundary & Definition of Done

Vitest unit-tests the **pure `src/core/`** only; Skia/Reanimated/gesture layers
are verified **on-device**. Every change follows the repo Definition of Done:
regression-test-first for behavior changes, code review before merge, and
lint + typecheck + tests all green (no-any, sonarjs clean).

## Success Criteria

- [x] CI builds on Node 24; toolchain floor pinned; Dependabot split; gitleaks
      pre-commit + CI; advisory-diff audit gate; vendored-harness vetted (Phase 1).
      **Owner action outstanding:** `branch-protection PUT` on `main` (currently
      unprotected, `gh api …/protection` → 404) — a human GitHub-settings step, not
      code; the PR banner is the interim merge guard.
- [x] Three Dots concept docs live on-branch, retargeted to RN; spec matches the
      shipped 8-way core; CLAUDE.md reframed with resolving references (Phase 2).
      _(Reach `main` on merge of this PR.)_
- [x] A Japan Journey level is built on the existing engine (timer, mistake
      penalty, objectives, caged obstacle, win/lose) with all new core logic
      Vitest-tested (209 green) and Endless statically unchanged (protected files
      diff-clean). **On-device play/win-lose QA is the remaining human gate**
      (route/timer/HUD are RN/worklet, not Vitest-testable) — Phase 3.

## Validation Log

### Session 1 — 2026-08-16 (`/ak:plan validate --advice`)

**Verification Results** (Standard tier — 3 phases, Fact Checker + Contract Verifier)

- Claims checked: 13 · Verified: 13 · Failed: 0 · Unverified: 0
- Evidence: `ci.yml` pins Node 20 (only Node pin); no `engines`, no `.nvmrc`;
  `main` unprotected (`gh api …/protection` → 404); `dependabot.yml` present; all
  9 Expo/native pins present at stated versions; `two-dots-game-design.md:6`
  already carries a supersede banner (→ "update", not "add") and `:31` documents
  the ≥5-line/8-direction sweep; core seams confirmed (`GameState`,
  `resolveChain → Resolution|null`, `applyGravity` emits `falls`, uniform
  `refill.ts`); no `journey`/`level`/`obstacles` dirs or `journey.tsx` yet
  (Phase 3 creates are collision-free).

**kongming advisory (draft review): Conditional GO — both findings patched**

- Cage overlay must remap surviving indices through `resolution.falls`, not only
  narrow by `resolution.cleared` (Phase 3 Architecture + test case added).
- `spawnWeights` is a dead Swift-era field — marked reserved/unwired (Phase 2 §3).

**Decisions confirmed (interview)**

- **Cage gravity semantics:** a caged dot **falls like a normal dot** (Journey-layer
  overlay; tested color-core untouched). The immovable-blocker variant stays
  deferred. → matches Phase 3 as written; no change.
- **`spawnWeights`:** **keep as reserved/unwired** in the ported schema (future
  tuning dial, not part of the current `GameConfig` contract). → matches
  Phase 2 §3 as written; no change.
- **Node target:** 24 (Active LTS) — kept as the default, not contested.

**Propagation:** none required — both confirmed decisions already match the
drafted phases.

### Whole-Plan Consistency Sweep

Re-read `plan.md` + all three phase files after validation. No stale terms, no
contradictions: `spawnWeights` appears only as the corrected reserved/unwired
note; cage handling consistently states overlay + `resolution.falls` remap across
Architecture, Implementation Steps, and Success Criteria. **0 unresolved
contradictions** — plan eligible for implementation.

## Red Team Review

### Session 1 — 2026-08-16 (`/ak:plan red-team --advice`)

**Setup** — 3 adversarial reviewers (one per phase), each carrying a hostile lens
(Security Adversary, Failure-Mode Analyst, Assumption Destroyer, Scope Critic) +
the Standard-tier verification roles (Fact Checker + Contract Verifier). 21 raw
findings → all survived the grep-evidence filter → deduped to **15 accepted**,
every one adjudicated **Accept**. kongming go/no-go run per `--advice`.

**Severity (post-kongming recalibration): 5 Critical · 7 High · 3 Medium.**
kongming downgraded F04 Critical→High (the plan's audit _conclusion_ survives
fresh triage; only its stale `image-size`/`nanoid`/`uuid` example list was wrong,
and the one runtime-capable leaf `@react-native/virtualized-lists` is confirmed
unreachable — `grep FlatList\|VirtualizedList\|SectionList src/` → 0).

| #   | Sev      | Phase | Finding                                                                                                                                                    | Resolution                                                                                                                               |
| --- | -------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | Critical | 3     | Deadlock reshuffle desyncs the cage overlay — `shuffleBoard.moves` never remapped, so cages point at stale cells                                           | Generic `remapMoves(caged, readonly CellMove[])` runs after both gravity **and** shuffle; `settleJourney` added; test added (Decision A) |
| F02 | Critical | 3     | Journey persistence undefined; a naive impl reuses `score-storage`'s single `'score'` key → Endless score corrupted                                        | Explicit non-goal: Journey writes **no** MMKV, `score-storage.ts` untouched, in-session only (Decision B)                                |
| F05 | Critical | 2,3   | Level `colors` (schema example `5`) exceeds 3-entry `DOT_COLORS`; `colorFor` silently falls back to color 0 → unrenderable/ambiguous board                 | Extend `DOT_COLORS` to ≥5 colorblind-considerate hues; zod caps `colors ≤ palette length` (Decision C — user override of the ≤3 cap)     |
| F10 | Critical | 3     | `remapMoves` drops caged indices **absent** from the move list (gravity emits a move only when `from !== to`) → cage silently lost, `freeCaged` unwinnable | Contract: iterate `caged`, default identity `map.get(idx) ?? idx`; explicit identity test case                                           |
| F14 | Critical | 2,3   | Zod schema lacks cross-field bounds — out-of-range `obstacle.cell` / `objective.color` → crash or silently dead objective                                  | Fail-fast bounds rules stated in schema doc + enforced in `parseLevelScript`                                                             |
| F03 | High     | 1     | gitleaks pre-commit hard-fails when the Go binary is absent → blocks every commit on a clean clone                                                         | Presence-gate the hook (`command -v gitleaks` → warn-and-skip); CI is the enforcement backstop                                           |
| F04 | High     | 1     | Audit "build-tool-only / not runtime-reachable" **asserted, not proven**; highs sit on `isDirect` packages                                                 | Prove per-advisory via the `via` chain (build-time vs runtime); name/clear runtime-capable leaves by evidence                            |
| F06 | High     | 3     | Timer uses tick counts + no `AppState` pause → returning from background snaps straight to `'lost'`                                                        | Timestamp-delta `dtMs` (clamped) + explicit `AppState` pause listener; on-device Success Criterion                                       |
| F11 | High     | 3     | `use-journey-state` wrapping `useGameState` inherits `newGame(DEFAULT_CONFIG,…)` → board ignores level dims                                                | Independent hook calling `newGame(levelToConfig(level), seed)` directly; on-device dim check                                             |
| F12 | High     | 2,3   | No `seed` → level winnability and caged-cell colors not deterministically checkable at authoring time                                                      | Optional `seed` on `LevelScript`; `japan-01` authored with a fixed seed; winnable-under-seed test (Decision D)                           |
| F13 | High     | 3     | `journey` route not registered in `_layout.tsx`'s explicit `Stack.Screen` set → missing title/options, route-config drift                                  | Register `journey` `Stack.Screen` (with title) in `_layout.tsx`; added to Related Files + steps                                          |
| F15 | High     | 2,3   | Obstacle carries an authored `color` the engine can't honor; "freed by adjacent chain" wording ignores board-wide sweeps                                   | Drop `color` (positional-only, deterministic under seed); reword freeing to "any clear of its color, incl. board-wide sweep"             |
| F07 | Medium   | 1     | `npm audit … \|\| true` is an always-green gate — new advisories become invisible                                                                          | Advisory-**diff** gate: fail/flag only when advisory IDs grow past a recorded allowlist                                                  |
| F08 | Medium   | 1     | Vendored-harness vetting list hand-typed/stale (`.agentkit` archive-only; `.github/skills` symlinks missed) and one-time                                   | Empirical discovery (`git ls-files \| grep …`); include `.github/skills/`; add a pin-drift check                                         |
| F09 | Medium   | 1     | "keys can never land in git" overclaims a `--no-verify`-bypassable pre-commit hook                                                                         | Reword to detection + (branch-protection-)conditional enforcement                                                                        |

**Scope decisions (user, this session):**

- **A — Deadlock:** keep reshuffle-on-deadlock (reuse the shipped core path);
  generalize the remap helper to cover shuffle moves + add a test. _(default)_
- **B — Persistence:** Journey is fully ephemeral — no MMKV writes,
  `score-storage.ts` untouched. _(default)_
- **C — Colors:** **extend the render palette now** (add real hues), not cap
  levels at ≤3. **User override** of the recommended cap — moves a bounded
  `src/render/palette.ts` change into Phase 3; colorblind-safety check folded in
  (kongming flagged this as an art/design decision worth the creative-bible pass).
- **D — Winnability:** add an optional `seed` field; author `japan-01` with a
  fixed seed. _(default)_

**kongming advisory (red-team go/no-go): GO once F01/F02/F05/F10 land in text.**
Biggest residual risk it named was the cage-overlay/shuffle desync (F01+F10) — now
resolved in Phase 3 Architecture, Implementation Steps, and Success Criteria. All
four Critical fixes are reflected in the plan text below.

**kongming close-out (after all 15 + decisions applied): Conditional GO.** It
verified against source that the palette override adds **no** new Critical/High
risk (`DEFAULT_CONFIG.colors = 3` is untouched — `config.ts:12`; the core is
already N-color generic), but named 3 cheap, source-verified edge gaps the
override opens — all now folded into the plan:

- **A1 — palette append-only:** `palette.ts` is outside the Vitest boundary, so
  reordering indices 0-2 would change Endless's colors with zero core diff.
  Phase 3 step 7 now mandates append-only, indices 0-2 hex frozen, Okabe–Ito ramp.
- **A2 — accessibility contradiction:** Phase 2 ports the creative-bible's LOCKED
  "color + shape, never color-alone" rule, but `dot-layer.tsx` draws plain
  circles and 3→5 hues widens the gap. Phase 2 step 1 now annotates the rule as
  _shipped-status: not yet met — shape/pattern deferred_ so the doc doesn't assert
  what the code doesn't do.
- **A3 — pigeonhole bound:** `shuffle.ts:73-78`'s reshuffle guarantee assumes
  `colors × minChain ≤ rows × cols`; Decision C makes `colors>3` reachable and
  Journey's timer makes a soft-lock worse than endless zen. Added to the Phase 2
  fail-fast bounds (and Phase 3 `parseLevelScript`).

### Whole-Plan Consistency Sweep

- Files reread: `plan.md`, `phase-01-guardrails-and-versions.md`,
  `phase-02-spec-code-reconciliation.md`, `phase-03-three-dots-vertical-slice.md`.
- Decision deltas checked: 11 — `remapFalls`→`remapMoves` rename; drop "byte-for
  -byte" criterion → on-device replay; "informational" → "advisory-diff" audit
  gate; palette 3→≥5 + zod cap; optional `seed`; positional-only `cagedDot`
  (dropped `color`); Journey-no-MMKV non-goal; `node-version` literal → `.nvmrc`;
  palette append-only/index-frozen (A1); accessibility shipped-status caveat (A2);
  pigeonhole bound `colors × minChain ≤ rows × cols` (A3).
- Reconciled stale references: 5 — `remapFalls` (0 remain), `byte-for-byte` (0
  remain), 4× "informational audit" precision hits in `plan.md`/`phase-01`
  reconciled to "advisory-diff", audit-triage wording in Phase 1 Requirements +
  Architecture, `colors:5` schema example now consistent with the extended palette.
- Cross-file consistency of the 3 kongming close-out amendments confirmed: A1 in
  Phase 3 step 7 + Risk; A2 in Phase 2 step 1 + Phase 3 step 7 deferral note; A3
  in Phase 2 §3 bounds + Phase 3 `parseLevelScript` bounds list.
- Unresolved contradictions: **0** — plan eligible for implementation.

<!-- slug: rn-three-dots-retarget -->
