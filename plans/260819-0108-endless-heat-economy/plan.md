---
title: 'Endless Heat Economy'
description: 'Give Endless a no-fail skill curve around the signature color-sweep: move-indexed combo heat, double-sweep recognition, and post-sweep refill exclusion — all config-gated OFF by default, proven safe by a seeded sim before device.'
status: in-progress
priority: P1
effort: '~4-6 dev-days across 3 phases (Phase 3 gated on an external phase)'
tags: [endless, core, scoring, no-fail]
created: 2026-08-19
blockedBy: []
blocks: []
---

# Endless Heat Economy

## Overview

Enrich **Endless** (the shipped, no-fail, score-attack mode) with a genuine skill curve built around
our signature move — the **color-sweep** (a 2×2 loop close OR a ≥`lineLength` straight run clears every
dot of that color board-wide). Three mechanic-native, no-fail additions:

1. **Move-indexed combo "heat"** — a multiplier that builds on consecutive sweep-quality moves and decays
   one step per plain move. Never wall-clock (a timer would punish the zen player who pauses to think).
2. **Double-sweep recognition** — naming the emergent "sweep right after a sweep" so the meta layer can
   celebrate it.
3. **Post-sweep refill exclusion** — after a color-sweep, the sweep's own refill wave drops **no** dots of
   the swept color, so a just-swept board is deliberately (not luckily) primed for a follow-up sweep. This
   is the "ours, not copycat" idea: the signature move generates the next tactical state.

**Guiding invariant:** every new behavior is a `GameConfig` dial, **OFF in `DEFAULT_CONFIG`**. Endless
opts in via a new `ENDLESS_CONFIG`; Journey (which shares `resolveChain`) and every existing seeded test
stay **byte-identical**. Accepted brainstorm contract:
`plans/brainstorms/260819-0044-endless-mode-enrichment.md` (§ "ACCEPTED DECISIONS & SCOPE LOCK").

## Scope

**In:** move-indexed heat multiplier (linear, capped, **applied to every commit incl. plain chains** — user
override of red-team F5; the sim's farm-then-cash bot bounds the plain-snake cash-in) + double-sweep flag in
the pure-TS core; post-sweep
refill exclusion; an **Endless-only `lineLength` 5→6 sweep retune** (bundled into `ENDLESS_CONFIG`);
per-color lifetime sweep counters in persistence; a seeded Monte-Carlo sim harness that proves the economy
is not degenerate; read-outs + transient (numbers-only) heat surfacing. **Rollout is dark-launch:** the
whole economy lands byte-identical to today and is flipped on in one gated commit after an on-device feel
check (see Validation decisions).

**Non-goals (this plan):**

- **4-color board** → separate future plan (frozen-palette governance, worsens the color-only a11y gap,
  retunes the whole sweep economy).
- **Dot/board skins + any persistent heat glow/warmth** → separate fork. Partially reverses the
  deliberately plain, dead-flat look the user approved 2026-08-18 (`260818-1656-endless-plain-board`).
- **Weekly events / bounded daily mode** (the "C bundle") → reverses the locked v1 "no online/events" scope.
- **Any timer or fail state in Endless.**

## Goals

| #   | Goal                                                                                                    | Priority |
| --- | ------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Consecutive sweeps score higher via a capped, move-indexed multiplier; a plain move cools it one step   | P1       |
| 2   | A color-sweep's own refill excludes the swept color, making sweep→sweep chaining a deliberate strategy  | P1       |
| 3   | All new behavior is inert unless a config dial is on: `DEFAULT_CONFIG`/Journey/existing tests unchanged | P1       |
| 4   | Economy is proven non-degenerate by a seeded sim (numeric bounds) **before** any on-device tuning       | P1       |
| 5   | Lifetime per-color sweep counts persist (survive score reset) as the substrate for read-outs            | P2       |
| 6   | Heat + double-sweep are surfaced without reversing the plain look (numbers + existing celebration only) | P2       |

## Phases

| #   | Phase                                                                                           | Status         | Priority | Depends on                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------- | -------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | [Phase 1: Core heat economy + sim harness](./phase-01-start.md)                                 | Completed      | P1       | —                                                                                                           |
| 2   | [Phase 2: Lifetime sweep counters](./phase-02-lifetime-sweep-counters.md)                       | Completed      | P2       | 1                                                                                                           |
| 3   | [Phase 3: Read-outs + transient heat (gated)](./phase-03-read-outs-and-transient-heat-gated.md) | Pending (held) | P2       | 2, **ext:** `260817-1217-endless-visual-upgrade` Phase 5 + `260818-1656-endless-plain-board` on-device gate |

**Sequencing:** Phases 1–2 are pure-TS core + meta persistence — **zero collision** with the two in-flight
Endless plans, start now. Phase 3 touches `game.tsx`/HUD and is **gated** behind visual-upgrade Phase 5
landing and the plain-board on-device hard gate passing.

## Success Criteria

- [x] With every new dial at its `DEFAULT_CONFIG` value, `npm test` passes **with no existing test edited**
      (refill RNG-consumption contract preserved; `scoreFor`/`resolveChain` deltas identical).
- [x] **Dark-launch:** at Phase-1 land `ENDLESS_CONFIG` mirrors `DEFAULT_CONFIG`, so Endless is
      byte-identical to today; the tuned economy (heat + exclusion + `lineLength: 6`) goes live only in the
      separately-gated flip commit after an on-device feel check.
- [x] Journey's path through `resolveChain`/`applyResolution` is provably inert (its config never enables
      heat/exclusion; new `GameState`/`Resolution` fields default to no-op).
- [ ] Endless (via `ENDLESS_CONFIG`) shows heat: consecutive sweeps escalate the multiplier to the cap;
      one plain move cools it by one tier; floor 0. — implemented + tested; goes live at the gated flip
      commit (dials are OFF in the dark land)
- [ ] A color-sweep's own refill contains zero dots of the swept color; the **next** commit's refill is
      back to full colors. — implemented + tested; goes live at the gated flip commit (dials are OFF in the
      dark land)
- [x] Seeded sim harness runs **three bots** (greedy-score + sweep-whenever-available + farm-then-cash),
      reports P(follow-up sweep) **separately for 2×2-loops and ≥`lineLength` lines** at
      `sweepExclusionWeight ∈ {0, 0.5, 1}`, plus score-rate-vs-baseline ratio (max across greedy-score and
      farm-then-cash) and a policy-collapse metric — all inside the **pre-committed** bounds recorded in this
      plan — as a Vitest merge gate.
- [x] Lifetime per-color sweep counters persist and survive `resetScore()`.
- [x] No persistent glow/warmth/skin introduced; `game.tsx` unstyled-View gesture-root invariant intact.
- [x] `npm run lint` + `npm run typecheck` + `npm run coverage:diff` green.

## Red-team MUST-check (for the adversarial pass)

1. **Config-off byte-identity + Journey isolation** — dials default → existing seeded tests untouched-green;
   Journey inert; no new writes reorder the `publish`→`unlock` settle chain in `use-game-state.ts`.
2. **Economy degeneracy proven by simulation, not vibes** — the seeded sim with numeric bounds is a merge
   gate BEFORE the on-device feel gate (catches the "sweeps become free" self-sustaining escalator).
3. **Visual-scope containment** — no persistent glow/warmth/skins smuggled against the plain-board +
   dead-flat rulings; Phase 3 visible layer gated behind visual-upgrade Phase 5; `game.tsx` gesture-root
   wrapper stays style-free.

## Post-Plan decisions (2026-08-23)

- **Execution scope = Phases 1 & 2 now; Phase 3 held.** Implement the pure-TS core economy + sim (Ph1) and
  lifetime sweep counters (Ph2). Phase 3 (visible read-outs + transient heat) stays `pending` — deferred by
  the user, and independently gated behind visual-upgrade Phase 5 + the plain-board on-device gate.
- **Heat scope (F5) = all commits.** The user overrode the red-team's sweeps-only recommendation: heat
  multiplies every commit, plain chains included. The plain-snake cash-in this opens is bounded by the sim's
  new **farm-then-cash** adversary bot rather than designed out (see Red-team resolutions F5).

## Validation decisions (2026-08-19)

- **Rollout = dark-launch, flip after on-device.** Phase 1 lands with `ENDLESS_CONFIG` **mirroring
  `DEFAULT_CONFIG`** (dials off, `lineLength: 5`) → Endless is **byte-identical to today at land**. A small,
  separately-gated **flip commit** (Phase-1 step 8) turns the tuned economy on only after a heat-economy
  on-device feel check on a real iPhone. No shipped behavior change until a human has felt it.
- **Retune now, in this plan.** The flipped `ENDLESS_CONFIG` raises **Endless-only** `lineLength` `5 → 6`
  (fixing the flagged "≥5-line too cheap at 3 colors" note in `config.ts`) so heat cannot sit on top of an
  already-too-easy sweep. `DEFAULT_CONFIG`/Journey keep `lineLength: 5`. The sim still proves the tuned
  bundle (`lineLength: 6` + heat + exclusion) non-degenerate; if still degenerate, tune
  `heatStep`/`sweepMultiplier` — never drop below `lineLength: 6`.

## Red-team resolutions (2026-08-23)

An adversarial pass (kongming) verified all three MUST-checks against source. Findings folded into the phase
docs; each was confirmed against the named file before applying (not accepted blind).

| #   | Sev  | Finding (verified against source)                                                                                                                                                                                      | Resolution                                                                                                                                                                                                                                                                                                                                                          |
| --- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | HIGH | Required new `GameState`/`Resolution` fields break typecheck: tsconfig `include: **/*.ts` + `strict` compiles every test literal and `journey-state.ts:125`.                                                           | All four fields (`heat`, `lastKind`, and `heat`/`doubleSweep` on `Resolution`) are **optional**, read via `?? 0` / `?? null`. (Phase 1)                                                                                                                                                                                                                             |
| F2  | HIGH | The flip desyncs the gesture layer — `game.tsx` feeds `DEFAULT_CONFIG.lineLength` to the sweep-highlight, which would lie at a 5-run once Endless flips to `lineLength: 6`.                                            | The dark-launch flip commit **repoints `src/app/game.tsx` at `ENDLESS_CONFIG`**. (Phase 1)                                                                                                                                                                                                                                                                          |
| F3  | HIGH | Wiring the counter at the score-persist point double-counts on sweep→deadlock (`publish` fires twice, `:133` then `:117`); and an `src/meta/*.test.ts` guard is neither included by vitest nor runnable (native MMKV). | Increment moves **inside `applyAndDrop` after `applyResolution` (`:125`)**, guarded `kind !== 'plain'` — once per commit; verified by **code review + on-device**, not a fictional Vitest guard. (Phase 2)                                                                                                                                                          |
| F4  | HIGH | Sim used the wrong adversary (a greedy-score bot decays heat via crossover-at-5), ignored the 2×2-loop escalator vector, and the "heat not pinned at cap" bound is unachievable.                                       | Reworked: a **multi-bot roster** (greedy-score + sweep-whenever-available; the F5 override then added a **farm-then-cash** bot → three total), P(follow-up) measured **separately for loops and lines**, a **`sweepExclusionWeight` dial** (0/0.5/1) instead of a hard ban, and defensible **pre-committed** bounds (score-rate ratio + policy-collapse). (Phase 1) |
| F5  | MED  | Heat multiplying **plain** commits enables a "loop-farm heat → cash-in one mega-plain-snake" degenerate cycle.                                                                                                         | **User override (2026-08-23):** heat multiplies **every** commit — `f = 1 + nextHeat*(heatStep ?? 0)`. The exploit is not designed out; it is **bounded by the sim's farm-then-cash bot** (score-rate ratio guard). Post-move cooling means a plain snake scales by the _cooled_ tier. (Phase 1)                                                                    |
| F6  | MED  | Phase 3 named `src/screens/game.tsx` (wrong — it's `src/app/game.tsx`), and a required new arg on the shared `use-board-animation.ts` would break Journey call sites.                                                  | Path corrected; heat factor enters as a **defaulted `heatFactor = 1`** arg so Journey compiles byte-unchanged. (Phase 3)                                                                                                                                                                                                                                            |
| F7  | LOW  | Coverage-ratchet risk: the new sim/harness code could drop the committed coverage baseline and fail `coverage:diff`.                                                                                                   | Called out in Phase 1 risk assessment; the sim harness is itself covered.                                                                                                                                                                                                                                                                                           |

**MUST-check verdicts after rework:** (1) Config-off byte-identity + Journey isolation → **GO** (fields now
optional). (2) Economy degeneracy by simulation → **GO** (multi-bot + loop-metric + partial-exclusion-dial
rework). (3) Visual-scope containment → **GO**.

## Post-implementation record (2026-08-23)

- Phases 1 & 2 implemented on branch `feat/endless-heat-economy-dark`, shipped DARK (dials undefined in
  `DEFAULT_CONFIG` and `ENDLESS_CONFIG`; `ENDLESS_CONFIG` byte-identical to `DEFAULT_CONFIG` — asserted by
  `src/core/config.test.ts`).
- Gates: `npm test` 243 pass; lint 0; typecheck clean; `coverage:diff` 94.61% ≥ baseline. Sim merge-gate at
  24 seeds: inflation 2.76× (bound ≤3.0×), sweep-share Δ0.13 (bound ≤0.20).
- Code review: DONE, all 7 acceptance criteria verified. Two LOW findings, both adjudicated no-change:
  (a) `score-storage.ts` `readSweepCounts`/`resetSweepCounts` exported-but-unwired = deliberate
  CRUD-symmetry groundwork for the held read-out; (b) `refill.ts:40` partial-mode float safety-net is
  provably unreachable (`x = value*total`, `value∈[0,1)` ⇒ `x<total`; mulberry32 max `1−2⁻³²` leaves ~6e-10
  margin) and no shipped config exercises the partial branch — subsequently **removed** (commit `84cef88`)
  by folding the last color into the loop's explicit remainder bucket when it dropped `refill.ts` below its
  coverage-baseline floor; behavior-identical for every input.
- Docs: the Phase-2 sweep counters are NOT dark — `sweeps.N` MMKV keys are written live on every sweep of
  the shipped mechanic — so the "persists the score only" claim was corrected in `CLAUDE.md` and
  `docs/tech-stack-and-infra.md` in this same land. No other evergreen docs change (dark gameplay =
  byte-identical; heat/retune docs belong to the flip commit).
- Flip commit (still pending, separate) risks to honor: (1) it is a one-file config change
  (`src/core/config.ts`) that turns the locked bundle `{heatCap:3, heatStep:0.5, sweepExclusionWeight:1,
lineLength:6}` on; (2) it MUST invert `src/core/config.test.ts` to assert the locked bundle — never
  delete/weaken the guard; (3) the on-device feel gate must specifically probe for loop-machine degeneracy
  (w=1 full-ban on 3 colors drives the post-sweep refill to 2 colors, pushing P(follow-up loop) toward
  ~1.0 — check whether a sweep hands you the next sweep "for free") and whether heat pins at cap in normal
  play; (4) the numeric sim gate is a floor not a ceiling (farm-then-cash bot is known anti-conservative on
  the F5 exploit), so if the flip degenerates on-device, tune `sweepExclusionWeight` or `heatStep` DOWN — do
  not raise the bounds again.

## Follow-ups (2026-08-24)

Landed via PR #17 (merge commit `3f8898a`), all CI green. The two post-merge unresolved items are closed:

- **Counters stay LIVE (owner-confirmed).** The `sweeps.N` tally is intentionally unconditional — not gated
  by the heat-economy dials — so a lifetime count accrues from first play and carries across the flip. A
  "sweep" means the same at `lineLength` 5 or 6; only the line-sweep _rate_ shifts, so any future read-out
  milestone thresholds should be tuned on post-flip data. Decision recorded at the increment site in
  `src/meta/use-game-state.ts`. No behavior change.
- **Coverage baseline ratcheted.** `.github/coverage-baseline.json` regenerated from current coverage
  (ratchet-up `max(old, current)` per metric; no erosions, no new/gone files), locking the merged gains
  (`is-line.ts` and `resolve-chain.ts` to their new highs; total 94.61→95.22 stmts). Gate now reads "at or
  above baseline". The `refill.ts` safety-net that broke the gate on the PR was removed by the
  remainder-bucket refactor (`84cef88`), not by lowering the floor.

## Open questions (for validation)

1. **Heat→multiplier mapping** — linear `1 + heat*step` vs a small tier table; and does the multiplier use
   the **post-move** heat (this sweep benefits immediately) or the **pre-move** heat (carried bonus)?
   (resolved default: post-move, `1 + heat*step`; on-device tune the step at the flip step)
2. ~~**Exclusion strength / sweep retune**~~ — **RESOLVED (validation):** exclusion = the sweep's own
   resolution refill only (1 wave, zero cross-commit state); Endless sweep difficulty retuned now via
   `lineLength: 6`. See Validation decisions above.
3. **Sim acceptance bounds** — **RESOLVED (owner decision, 2026-08-23).** The pre-committed bounds
   (score-rate ratio ≤ 1.8×; policy-collapse ≤ 0.5) proved **infeasible** once the sim's snake finder was
   fixed to cover the whole board (`MAX_SNAKE` 16→36): with the honest full-board cash-in, the target hot
   bundle (`heatCap 3, heatStep 0.5`) exceeds 1.8× **even with exclusion off** (1.82×), because the heat
   _intensity_ — not the exclusion weight — drives inflation. Two instrument fixes also landed: the
   `policy-collapse` metric was replaced by a **greedy score-maximizer sweep-share delta vs baseline** (the
   old `loopFrac(sweep-bot)` was tautological — a bot told to always sweep always sweeps), and P(follow-up
   loop) became a **logged diagnostic, not a gate** (at full exclusion the farm bot inherently draws
   follow-up loops — that is the mechanic).
   - **Owner's call (both softer options declined):** keep the hot bundle and **raise the ceiling** rather
     than soften the economy. Endless is no-fail / no-leaderboard / lifetime-score, so a high-value
     farm-then-cash line reads as skill, not an exploit to design out (consistent with F5).
   - **Locked bundle:** `{ heatCap: 3, heatStep: 0.5, sweepExclusionWeight: 1, lineLength: 6 }` (full
     exclusion). **New bounds:** score-rate ratio **≤ 3.0×**; sweep-share delta **≤ 0.20**. Sim confirms at
     the shipped 24-seed gate: inflation **2.76×** (margin 0.24), sweep-share Δ **0.13** (margin 0.07),
     matching the 200-seed decision run (2.77× / Δ0.14).
   - History: the earlier "heat steady-state cap" bound was dropped as unachievable (red-team F4) — heat
     legitimately pins at cap for a skilled player.

<!-- slug: endless-heat-economy -->
