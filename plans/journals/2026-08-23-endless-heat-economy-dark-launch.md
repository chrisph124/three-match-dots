---
title: 'Endless heat economy: dark-launch (Ph1+2)'
date: 2026-08-23
summary: 'Phases 1 & 2 of the endless heat economy landed dark on feat/endless-heat-economy-dark (3 commits); dials off, ENDLESS_CONFIG byte-identical; sim bounds proved infeasible → owner raised ceiling; flip + Phase 3 held'
---

# Endless heat economy: dark-launch (Ph1+2)

## What happened

Executed Phases 1 & 2 of `plans/260819-0108-endless-heat-economy/` under ak-cook
`--advice --tdd`. Shipped **dark** on `feat/endless-heat-economy-dark` in 3 commits
(`ffafa5b` core+sim, `64e0bd5` sweep counters+docs, `64e597e` plan records). Not
pushed. Phase 3 (visible read-outs) and the flip commit itself are held.

- **Dark-launch shape:** new behavior sits behind optional `GameConfig` dials
  (`heatCap`/`heatStep`/`sweepExclusionWeight`) undefined in **both**
  `DEFAULT_CONFIG` and the new `ENDLESS_CONFIG` (`= { ...DEFAULT_CONFIG }`).
  `src/core/config.test.ts` asserts the two deep-equal — the real dark gate.
  Turning dials on is a separate later commit after on-device feel.
- **Ph1 core:** move-indexed heat + double-sweep flag in `resolve-chain.ts`;
  weighted post-sweep refill color exclusion in `refill.ts` (one RNG step per
  cell in every branch — RNG-consumption contract preserved); heat fold in
  `game.ts`; `game.tsx` sweep-highlight repointed at `ENDLESS_CONFIG`.
- **Ph1 sim gate:** seeded 3-bot Monte-Carlo (greedy-score, sweep-whenever,
  farm-then-cash) in `heat-economy.sim.test.ts`, a Vitest merge gate.
- **Ph2 counters:** per-color lifetime sweep tallies in MMKV (`sweeps.N`),
  incremented once/commit from `applyAndDrop` (NOT `publish` — that fires twice
  on the sweep→deadlock path), independent of `resetScore`.

## Non-obvious decisions

- **F5 — heat multiplies every commit incl. plain (user override of red-team).**
  `f = 1 + nextHeat*(heatStep ?? 0)` on all commits. The plain-snake cash-in is
  **bounded by the farm-then-cash sim bot**, not designed out. Rule honored:
  don't silently revert to sweeps-only.
- **Pre-committed sim bounds proved infeasible → escalated, not fudged.** Once
  the snake finder was fixed to cover the full board (`MAX_SNAKE` 16→36), the hot
  bundle exceeded the 1.8× ceiling **even with exclusion off** (1.82×) — heat
  _intensity_, not exclusion weight, drives inflation. Surfaced to owner (the
  scripted "surface it if the bound can't be met" path). Owner declined both
  softer curves: **keep the hot bundle, raise ceiling 1.8→3.0, full exclusion
  w=1.** Justified: Endless is no-fail / no-leaderboard / lifetime-score, so a
  high farm-then-cash line reads as skill, not an exploit.
- **Locked bundle:** `{ heatCap:3, heatStep:0.5, sweepExclusionWeight:1,
lineLength:6 }`. Bounds: score-rate ≤3.0×, sweep-share Δ≤0.20. Gate green at
  24 seeds (2.76× / Δ0.13), matching the 200-seed decision run (2.77× / Δ0.14).
- **kongming corrections that mattered:** (1) collapse metric must be greedy
  score-maximizer sweep-share **delta vs baseline** — the old `loopFrac(sweep-bot)`
  was tautological; (2) `MAX_SNAKE` must be full board or the exploit tail is
  truncated (anti-safe); (3) P(follow-up loop) is a **logged diagnostic, not a
  gate** — at w=1 it's ~0.97 by the mechanic itself.

## Review + finalize

- code-reviewer: DONE, all 7 acceptance criteria verified. Two LOW findings,
  both adjudicated **no code change**: (a) `readSweepCounts`/`resetSweepCounts`
  exported-but-unwired = deliberate CRUD-symmetry groundwork for the held
  read-out; (b) `refill.ts:40` partial-mode float net is **provably unreachable**
  (`x = value*total`, `value ∈ [0,1)` ⇒ `x < total`; mulberry32 max `1−2⁻³²`
  leaves ~6e-10 margin) and no shipped config hits the partial branch.
- **Docs carve-out (kongming caught):** the sweep counters are NOT dark — they
  write live on the shipped lineLength-5 mechanic — so "persists the score only"
  was corrected in `CLAUDE.md` + `docs/tech-stack-and-infra.md` in this same
  land. No other evergreen docs churn (dark gameplay = byte-identical).

## Held / flip risks (for the eventual flip commit)

- Flip is **one file** (`src/core/config.ts`) turning the locked bundle on; it
  MUST also **invert `config.test.ts`** to assert the bundle (never delete/weaken).
- On-device feel gate must probe **loop-machine degeneracy** (w=1 full-ban on 3
  colors makes the post-sweep refill 2-color → a sweep may hand you the next
  sweep "for free") and whether heat pins at cap in normal play.
- The numeric gate is a **floor, not a ceiling** (farm-then-cash bot is
  anti-conservative on the F5 exploit). If the flip degenerates on-device, tune
  `sweepExclusionWeight` or `heatStep` **down** — do not raise bounds again.

## Unresolved questions — resolved 2026-08-24

1. **Sweep-counter gating → keep LIVE (owner-confirmed).** The lifetime `sweeps.N`
   tally stays unconditional — not gated behind the flip — so early players' sweeps
   are never lost and the count carries across the eventual economy tuning change.
   Decision recorded at the increment site in `src/meta/use-game-state.ts`. No
   behavior change (the counters already wrote live at land); the follow-up only
   documents the intent.
2. **Journal-commit question → moot.** The 2026-08-23 entry was committed with the
   PR #17 land (merge `3f8898a`), not left dangling.

Also closed in the same follow-up: the coverage baseline was ratcheted up
(`.github/coverage-baseline.json`, `max(old, current)` per metric, no erosions) to
lock the merged gains. See the plan's "## Follow-ups (2026-08-24)" section.
