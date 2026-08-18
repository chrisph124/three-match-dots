---
title: 'Project Governance Docs Tooling'
description: "Reconcile + gap-fill the repo's governance layer: branch protection, coverage diff-gate, dependabot auto-merge, guardrail hooks, doc-sync policy, bible index, game-scripts folder, three.js on-demand — extend existing infra, don't rebuild it."
status: implemented — owner actions pending
priority: P1
effort: '~1.5-2d (excl. owner action)'
tags: [governance, ci, docs, security, tooling]
created: 2026-08-18
---

# Project Governance Docs Tooling

## Overview

Extend the repo's already-mature governance layer (CI gates, gitleaks, audit-diff, vendored-pin-check,
dependabot grouping, Husky) with the genuinely-missing pieces from the 12-item request. This is
**reconciliation + gap-fill, not greenfield** — merge new rules into existing CLAUDE.md sections, mirror
established patterns (`check-audit.mjs`), and route every process artifact to one predictable place.

Source of truth: `plans/brainstorms/260818-1943-project-governance-docs-tooling.md` (accepted contract).

## Goals

| #   | Goal                                                                                                   | Priority |
| --- | ------------------------------------------------------------------------------------------------------ | -------- |
| 1   | Make governance real, not habit-only: branch protection + required checks                              | P1       |
| 2   | Close the coverage gap with an honest diff-gate (no misleading repo-wide %)                            | P1       |
| 3   | Safe dependabot auto-merge (dev-tooling minor/patch only; github-actions + expo-native review-only)    | P2       |
| 4   | One predictable home per artifact type; end `docs/superpowers/` drift                                  | P2       |
| 5   | Consolidate CLAUDE.md policy (pre-PR checklist, doc-sync, no-leak, three.js) — merged, honestly framed | P1       |
| 6   | Advisory session guardrails labeled "reminder, not enforcement"                                        | P2       |
| 7   | Reconcile docs: bible = index, gameplay walkthrough, technical reference — zero duplication            | P2       |
| 8   | Creative pre-production home: `docs/game-scripts/` + confluence sync rule                              | P3       |
| 9   | three.js/r3f/drei allowed on-demand, not installed; Skia stays primary                                 | P3       |

## Phases

| #   | Phase                                                                                           | Status                                                                 |
| --- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | [Phase 1: Branch Protection (owner action)](./phase-01-branch-protection.md)                    | Docs ready — owner action pending                                      |
| 2   | [Phase 2: Folder Topology & Drift Reconcile](./phase-02-folder-topology-and-drift-reconcile.md) | Done                                                                   |
| 3   | [Phase 3: Coverage Diff-Gate](./phase-03-coverage-diff-gate.md)                                 | Done                                                                   |
| 4   | [Phase 4: Dependabot Auto-Merge](./phase-04-dependabot-auto-merge.md)                           | Authored + gated (inert until owner enables Phase 1 + 2 repo settings) |
| 5   | [Phase 5: Guardrail Hooks & No-Leak Policy](./phase-05-guardrail-hooks-and-no-leak-policy.md)   | Done                                                                   |
| 6   | [Phase 6: CLAUDE.md Policy Consolidation](./phase-06-claude-md-policy-consolidation.md)         | Done                                                                   |
| 7   | [Phase 7: Docs Reconcile & Bible Index](./phase-07-docs-reconcile-and-bible-index.md)           | Done                                                                   |
| 8   | [Phase 8: Game-Scripts Content Folder](./phase-08-game-scripts-content-folder.md)               | Done                                                                   |
| 9   | [Phase 9: three.js On-Demand Allowance](./phase-09-threejs-on-demand-allowance.md)              | Done                                                                   |

## Execution Status (2026-08-18)

Implementation complete; 2 owner actions remain: enable branch protection + 2 repo settings, then verify the auto-merge workflow with a synthetic PR.

Code review: DONE_WITH_CONCERNS — 2 should-fix doc defects + 1 coverage-gate hardening applied and re-verified.

Known deferred drift (out of governance scope): docs/three-dots-game-design.md and CLAUDE.md still say Journey is "not yet implemented on main", but src/core/journey/ + src/core/level/ + src/core/obstacles/ are committed on main (commit 93e1553). docs/tech-stack-and-infra.md documents this and is the ground-truth map. Reconcile the design-doc + CLAUDE.md status lines in a dedicated game-side pass.

## Dependencies

- **Phase 1 is the keystone** (owner-only GitHub-admin action). Phase 4 (auto-merge) MUST land after it —
  GitHub native auto-merge requires branch protection with required status checks, or it is silently inert.
- **Real execution order:** `1 → {2, 3, 5, 7, 8, 9} → 6 → 4`.
  - Phases 2, 3, 5, 7, 8, 9 carry the content Phase 6 references; run them (in any mutually-safe order,
    honoring **8 → 7**) before Phase 6.
  - Phase 6 (CLAUDE.md consolidation) lands after 2/3/5/7/8/9 so every path/script/rule it names already
    exists (its own Risk section warns against naming a path Phases 7/9 didn't create yet).
  - Phase 4 (auto-merge) is gated on Phase 1 and **soft-depends on Phase 3** — `@vitest/coverage-v8` must be
    in the same dependabot `dev-tooling` group before auto-merge goes live, or coverage tooling can version-skew
    on `main` unattended (see Phase 3/4).
- **Same-file coordination:** Phases 6 and 7 both edit `CLAUDE.md` Key References. Running 6 after 7 removes
  the conflict (7 writes the doc paths, 6 consolidates). Do NOT run 6 and 7 as parallel edits to `CLAUDE.md`.
- Phase 8 → Phase 7: the bible index (Phase 7) links the game-scripts space (Phase 8), so 8 lands first.
- Already done during planning: `docs/superpowers/` archived → `plans/reports/_archive/superpowers/`.

## Success Criteria

- [ ] `main` protected with required checks `quality` + `secret-scan` (owner-confirmed). — owner action
- [x] `npm run coverage` scoped to the testable include-list; CI fails only on a coverage **drop** vs the committed baseline.
- [x] authored + gated — activation pending owner (Phase 1 + repo settings). Dependabot auto-merge workflow exists, default-deny gated to dev-tooling(minor/patch); github-actions + expo-native provably excluded (review-only); CI-green gated; `@vitest/coverage-v8` in the `dev-tooling` group. NOT yet active — inert until owner enables Phase 1 + the two repo settings.
- [x] `docs/project-bible.md` index exists; `creative-bible.md` untouched; no duplicated authority.
- [x] `docs/three-dots-gameplay-script.md` + technical reference exist and are linked from the bible.
- [x] `docs/game-scripts/` seeded (8 sections + index); confluence sync rule in CLAUDE.md.
- [x] `.claude/settings.local.json` created: guardrail reminder hook (labeled advisory) + three.js on-demand allowance.
- [x] CLAUDE.md updated in-place (Definition of Done / Code Standards / Team Workflow), not appended.
- [x] Process folders consolidated under `plans/`; routing documented; `docs/superpowers/` gone.
- [x] `npm run lint`, `npm run typecheck`, `npm test`, coverage all green; code review + red-team before merge
      (session-run code review / red-team are a **reminder, not enforcement** — the CI required checks are the hard gate).

## Non-Goals

- No game-logic/feature work. No new standalone bible/tech/gameplay docs that duplicate existing files.
- No installing three.js now. No arbitrary coverage % floor. No new top-level folders.

<!-- slug: project-governance-docs-tooling -->
