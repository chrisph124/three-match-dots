---
title: Reconcile endless visual-upgrade plan (phases 3/4/7) + fix board-memo exhaustive-deps warnings
date: 2026-08-25
summary: 'Listed shared-value deps to clear 2 lint warnings; reconciled phase 3/4 frontmatter, closed the plan truthfully'
---

# Reconcile endless visual-upgrade plan (phases 3/4/7) + fix board-memo exhaustive-deps warnings

**Reconcile Endless Visual Upgrade (phases 3/4/7) + fix the 2 pre-existing board-memo lint warnings.** `/ak-cook --parallel`. Branch `feat/endless-ui-reskin`.

## Bug fix — 2 `react-hooks/exhaustive-deps` warnings

Both were empty-deps `useMemo`s flagged by the React Compiler lint rule:

- `src/effects/use-board-animation.ts:101` — `useBoardAnimation` bundling 13 shared values.
- `src/input/use-board-gesture.ts:34` — `useChainState` bundling 5 shared values.

Chosen fix (user pick): **list the shared values in the deps arrays** rather than an eslint-disable. Safe + behavior-equivalent because Reanimated `useSharedValue` returns an identity-stable object (const-bound, never reassigned) — the deps array is therefore constant, so the memo still never recomputes and `anim`/`state` keep the same identity downstream (the pan-gesture memo + animation wiring still don't rebuild). Comments updated to explain the reasoning. code-reviewer pressure-tested the identity claim → ship as-is, no issues.

## Reconcile — the drift was two-layered

`ak` computes phase-done from **checkboxes**, not the frontmatter `status:` field (confirmed via `ak plan phase update --help`: "status via its checkboxes"). So two separate drifts:

1. **Frontmatter vs plan.md table:** phase-03 `in-progress`→`superseded`, phase-04 `pending`→`dropped` (both from the 2026-08-18 plain-board pivot). phase-07 already `deferred` — no change. `ak plan validate` accepts the non-enum `superseded`/`dropped` tokens (phase frontmatter is lenient; plan-level `--status` enum is pending|in-progress|completed|cancelled|unknown).
2. **Misleading metric:** `ak plan status` read 3/7 · 50% (20/40) for a plan whose _active_ scope is complete — because phases 3/4/7 are terminal (never-to-be-checked) and phase-6 has 1 owner-gated box (on-device Rive animate, needs real .riv art + dev-client rebuild).

Resolution (truthful, not cosmetic): left phase-6's owner-gated box **honestly unchecked** (no fake-check), added a "Plan closed — active scope complete (2026-08-25)" note to plan.md documenting that residual unchecked boxes are deliberately-not-done work, set plan-level `status: completed`, and `ak plan close`d it (now excluded from `ak plan list`). The checkbox-based 50% is expected for a plan with dropped/superseded/deferred phases; the honest signal is the closed state.

## Gates

lint 0 warnings (was 2), typecheck clean, 402/402 tests, coverage:diff OK (metrics rose), audit:diff OK, vendored:check OK. code-reviewer DONE (ship as-is). project-manager sync-back verified 7 phase files + plan.md internally consistent.

## Follow-ups (owner-gated, outside this plan)

1. On-device Rive title animate — needs real `title.riv` art + dev-client rebuild.
2. Phase 7 mascot moment — gated on mascot art (bible: character/tone LOCKED; a wrong mascot is worse than none).

## Note

Branch base carries 16 Voyage/core files not in the coverage baseline (pre-existing drift, gate still passes) — a baseline ratchet is available but left out of scope for this focused change.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
