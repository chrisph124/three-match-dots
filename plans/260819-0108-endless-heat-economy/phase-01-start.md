---
title: 'Phase 1: Core heat economy + sim harness'
status: completed
---

# Phase 1: Core heat economy + sim harness

## Overview

Add move-indexed combo heat, double-sweep recognition, and post-sweep refill exclusion to the **pure-TS
core**, all behind `GameConfig` dials that are OFF in `DEFAULT_CONFIG` and ON in a new `ENDLESS_CONFIG`.
Prove the enabled economy is not degenerate with a seeded Monte-Carlo Vitest harness before any device
work. TDD throughout (regression-test-first per the repo DoD).

## Requirements

- Functional:
  - Consecutive **sweep** commits (`kind !== 'plain'`) raise a heat tier; a **plain** commit lowers it one
    tier; floor 0, cap `heatCap`. The score of a commit is multiplied by a heat factor.
  - A **color-sweep** commit's own refill draws **no** dots of the swept color (exactly one wave).
  - `Resolution` reports the resulting `heat` and a `doubleSweep` flag so the meta layer can read them.
- Non-functional:
  - **Config-off byte-identity:** with `DEFAULT_CONFIG` (dials off), `scoreFor`/`resolveChain` deltas and
    `refill` RNG consumption are unchanged; **no existing test is edited**.
  - `src/core/` stays RN-free and Vitest-testable. `src/core/hot/` untouched (no allocation/worklet rules
    at risk here — all changes live in `resolve/`, `config.ts`, `types.ts`, `game.ts`).
  - Journey shares `resolveChain`; with its (future) config dials off it is provably inert.

## Architecture

**New config dials (`src/core/types.ts` `GameConfig`, all optional so existing configs stay valid):**

```ts
/** Max heat tier. 0 disables heat entirely (multiplier always 1). Default 0. */
readonly heatCap?: number;
/** Multiplier per heat tier: factor = 1 + heat * heatStep. Default 0. */
readonly heatStep?: number;
/**
 * How strongly a color-sweep's OWN refill wave avoids the swept color:
 * 0 (or undefined) = off, byte-identical refill; 1 = full ban (zero swept-color
 * dots that wave); 0<w<1 = down-weight the swept color's spawn probability.
 * A weighted dial (not a boolean) from day one because the sim (see below) may
 * show full exclusion is degenerate and only a partial weight passes bounds.
 */
readonly sweepExclusionWeight?: number;
```

> **Why the state/result fields below are OPTIONAL, not required (red-team F1):** `tsconfig.json`
> `include: ["**/*.ts", ...]` + `strict` means `npm run typecheck` compiles **every** `.ts`, including
> tests and `src/core/journey/`. Required fields would break existing `GameState`/`Resolution` object
> literals in `resolve-chain.test.ts`, `game.test.ts`, `caged-dot.test.ts`, `journey/*.test.ts`, **and the
> Journey source `journey-state.ts:125`** (`game: { config, board, score, rngState }`) — making "no
> existing test edited" and "Journey untouched" impossible. Optional fields read via `?? 0` / `?? null`
> keep the default path byte-identical and Journey compiling untouched. No snapshot tests exist; the two
> full-object `toEqual`s (`resolve-chain.test.ts:86`, `game.test.ts:34`) are self-vs-self, so runtime
> equality is unaffected either way.

**`DEFAULT_CONFIG` (`src/core/config.ts`)** — unchanged values; dials absent/off → identical behavior.
**New `ENDLESS_CONFIG`** — **dark-launched** (validation decision, 2026-08-19). It lands in this phase
**behaviorally identical to `DEFAULT_CONFIG`** (`= { ...DEFAULT_CONFIG }`, dials off, `lineLength: 5`), so
Phase 1 ships **no live change** to Endless. A small, separately-gated **flip step** (step 8, gated on the
heat-economy on-device feel check) turns the bundle ON in one commit:
`{ ...DEFAULT_CONFIG, heatCap: 3, heatStep: 0.5, sweepExclusionWeight: 1, lineLength: 6 }` (w=1 locked by
owner decision 2026-08-23; see open-Q3)
— heat + exclusion + the **sweep retune** (`lineLength: 5 → 6`, validation decision: fix the flagged
"≥5-line too cheap at 3 colors" note so heat can't sit on an already-too-easy sweep) all flip together as
"the new Endless feel," felt on-device before it ships. Final numeric values are the sim-proven +
on-device-tuned ones. Endless is the only consumer that ever turns the dials on.

> **`lineLength` is Endless-only.** `DEFAULT_CONFIG`/Journey keep `lineLength: 5`. Raising it to 6 for
> Endless changes only the straight-run sweep threshold on the Endless board; the 2×2-loop sweep and every
> seeded core test (which run under `DEFAULT_CONFIG`) are untouched.

**`GameState` (`src/core/types.ts`)** gains two carried **optional** fields:

```ts
readonly heat?: number;              // current tier, 0..heatCap (undefined ⇒ treated as 0)
readonly lastKind?: ChainKind | null; // kind of the previous committed chain (undefined/null at newGame)
```

**`Resolution`** gains two **optional** fields:

```ts
readonly heat?: number;        // resulting heat tier after this commit (undefined ⇒ 0)
readonly doubleSweep?: boolean; // this commit AND the previous were sweeps (undefined ⇒ false)
```

**Heat update (in `resolveChain`, reading `state.heat ?? 0`/`state.lastKind ?? null`):**

- `isSweep = kind !== 'plain'`
- `nextHeat = isSweep ? min(heatCap, heat + 1) : max(0, heat - 1)` (with `heatCap ?? 0`)
- `doubleSweep = isSweep && (state.lastKind ?? null) !== null && state.lastKind !== 'plain'`
- **Heat multiplies EVERY commit (user decision 2026-08-23, overriding red-team F5's sweeps-only):**
  `f = 1 + nextHeat * (heatStep ?? 0)` → `scoreDelta = round(scoreFor(kind, cleared.length, config) * f)`.
  Both sweep and plain commits are scaled by the same post-move heat factor.
  - **Consequence the sim MUST discharge (was red-team F5):** applying `f` to plain chains opens a
    "loop-farm heat → cash in a heat-boosted mega-plain-snake on the 2-color board" cycle
    (crossover-at-5, `scoring.ts:9-12`). This is the user's chosen scope, so it is **not** designed out —
    it is instead **bounded by the sim**: the **greedy-score bot** (which will farm heat then cash in the
    longest plain snake) is precisely this adversary, and its **score-rate ratio** is the guard. The bound
    is not satisfied → lower `heatStep`/`heatCap` (never re-restrict to sweeps-only without the user).
    Note the _plain_ commit uses the **cooled** heat (`nextHeat = max(0, heat-1)`), so a snake never gets
    the full pre-cash-in tier — the first snake after a cap-3 run scales by `1 + 2·heatStep`, not `1 + 3·heatStep`.
  - When `heatCap`/`heatStep` are off (0), `f === 1` for every commit → **byte-identical** score
    (`Math.round(x*1)` is identity for the integer `scoreFor`).
  - Decision (plan open-Q1): multiplier uses **post-move** heat so a commit benefits immediately.

**`applyResolution` (`src/core/game.ts`)** folds the new fields: `heat: resolution.heat ?? 0`,
`lastKind: resolution.kind`. `newGame` may leave `heat`/`lastKind` unset (optional ⇒ read as 0/null); if
set explicitly, `heat: 0, lastKind: null`. Because the fields are optional, Journey's `applyResolution`
path folds them harmlessly (its config never enables heat, so `resolution.heat` is always 0/undefined).

**Refill exclusion (`src/core/resolve/refill.ts` + `resolve-chain.ts`):**

- Add optional `excludeColor?: Color` **and** `exclusionWeight?: number` to `refill`. When `excludeColor`
  is `undefined` (or weight 0), the loop is **unchanged** — byte-identical RNG (the literal current loop;
  guarded by a fixed-seed snapshot test).
- **Full ban (weight 1):** draw `nextInt(state, colors - 1)` and remap `value >= excludeColor ? value + 1 : value`.
- **Partial (0<w<1):** a single weighted draw that down-weights `excludeColor`'s probability by `(1-w)`.
  Keep it to **one** `nextInt` per cell so the RNG stream stays legible; document the exact draw so it is
  reproducible. (Fractional weights are a **sim-tuning lever**, not necessarily shipped — see sim below.)
- In `resolveChain`: pass `excludeColor = (kind !== 'plain' && (config.sweepExclusionWeight ?? 0) > 0) ? color : undefined`
  and `exclusionWeight = config.sweepExclusionWeight` into the existing `refill(...)` call
  (`resolve-chain.ts:51`). Only sweeps with the dial on change RNG draw.
- Effect: after a sweep, every swept-color dot is already gone (board-wide clear); down-weighting/banning
  it on this refill means the board returns with few/zero of that color for **one wave**, priming (not
  guaranteeing, at w<1) a follow-up sweep of a different color. The **next** commit's refill uses full
  colors again → exactly one wave.

**Sim harness (`src/core/resolve/heat-economy.sim.test.ts`, seeded, pure TS) — reworked per red-team F4.**
It validates the **flipped** target bundle (`heatCap: 3, heatStep: 0.5, sweepExclusionWeight: w, lineLength: 6`)
against a `DEFAULT_CONFIG` baseline (dials off, `lineLength: 5`), over many fixed seeds.

- **Three bots (F4a + heat-on-all-commits override).** A greedy-highest-score bot alone is the WRONG
  adversary: `scoring.ts:9-12`'s crossover-at-5 means on the 2-color boards exclusion creates, a long plain
  snake outscores a sweep, so a myopic greedy-score bot draws snakes and _decays_ heat — it cannot trigger
  the escalator. And because heat now scales **plain** commits too (user override of F5), the true worst case
  is a _planner_, not a myopic bot. Run THREE: (1) **greedy-score** (myopic inflation), (2)
  **sweep-whenever-available** (worst-case sweep escalator), and (3) **farm-then-cash** — a scripted
  adversary that builds heat to `heatCap` via sweeps/loops, then plays the **longest available plain chain**
  at high heat. Bot (3) is the exact worst case the F5 override opens; its score-rate ratio is the binding
  guard on the plain-snake cash-in.
- **Bot move-gen (F4a note).** There is **no chain enumerator to reuse** — `hasLegalMove` (`deadlock.ts:60-75`)
  is only a component-size check. The bots need a **bounded heuristic DFS** from each cell (depth-capped),
  scoring candidate chains via `scoreFor` + sweep detection. Keep it small; it is test infrastructure.
- **Metrics (measured, then bounded):**
  - `P(follow-up sweep available)` immediately after a sweep, reported **separately for 2×2 LOOPS and for
    LINES**, at exclusion weights `w ∈ {0, 0.5, 1}`. (F4b: `lineLength: 6` does **not** touch the loop
    vector; on a 2-color board E[mono 2×2] ≈ 3.1 ⇒ P(follow-up loop) ≳ 0.9 at `w=1`. The **exclusion
    weight**, not `lineLength`, is the lever that moves this.)
  - **Score-rate ratio** vs baseline — the primary inflation bound — taken as the **worst (max) across the
    greedy-score AND farm-then-cash bots**, since the F5 override makes the plain-snake cash-in the likely
    binding case.
  - **Policy-collapse metric** — **corrected during Phase 1 (2026-08-23).** The original `loopFrac` of the
    _sweep bot_ was tautological (a bot told to always sweep always sweeps ⇒ measured the base-game loop
    density, not economy-induced collapse). Replaced by the **greedy score-maximizer's sweep-share delta vs
    baseline**: how much MORE a myopic score bot sweeps under the flip than in the shipped game. That
    measures whether the economy forces degenerate normal play, not whether a dedicated farmer _can_ sweep.
    P(follow-up loop) is retained as a **logged diagnostic, not a gate** — at full exclusion the farm bot
    inherently draws follow-up loops (that IS the chosen mechanic), so gating on it would re-block the
    owner's `w=1` decision through the back door.
- **Acceptance bounds — RESOLVED (owner decision, 2026-08-23).** The pre-committed `1.8× / 0.5` bounds were
  **infeasible** once `MAX_SNAKE` was fixed 16→36 (the old cap truncated exactly the long cash-in snake the
  F5 exploit needs). With the honest full-board snake, the hot bundle exceeds 1.8× even with exclusion off
  (1.82×) — the heat _intensity_, not the exclusion weight, is the driver. Per plan open-Q3, the owner
  declined both softer curves and chose to **raise the ceiling**: locked bundle
  `{ heatCap: 3, heatStep: 0.5, sweepExclusionWeight: 1, lineLength: 6 }`; bounds **score-rate ratio ≤ 3.0×**
  and **sweep-share delta ≤ 0.20**. `EXCLUSION_WEIGHTS` is pinned to `[1]` (owner's full-exclusion choice),
  not a sweep. A later bound change remains a visible plan edit, never a mid-implementation "tune to green".
- **Runtime budget.** The sim runs inside `npm test` on every husky pre-push — cap seeds × moves to a stated
  budget (~10 s wall). This is a **merge gate**.

## Related Code Files

- Modify: `src/core/types.ts` (GameConfig dials; GameState.heat/lastKind; Resolution.heat/doubleSweep)
- Modify: `src/core/config.ts` (add `ENDLESS_CONFIG`; `DEFAULT_CONFIG` values untouched)
- Modify: `src/core/game.ts` (`newGame` init; `applyResolution` folds heat/lastKind)
- Modify: `src/core/resolve/resolve-chain.ts` (read heat, compute nextHeat/doubleSweep/multiplier; pass excludeColor)
- Modify: `src/core/resolve/refill.ts` (optional `excludeColor`, remap; undefined path byte-identical)
- Modify: `src/meta/use-game-state.ts` (swap `DEFAULT_CONFIG` → `ENDLESS_CONFIG` at the `newGame` call, line 65; at land this is **byte-identical** because `ENDLESS_CONFIG` mirrors `DEFAULT_CONFIG` until the flip step)
- Modify: `src/app/game.tsx` (red-team F2) — repoint the gesture-layer `minChain`/`lineLength` (lines 46-47),
  `CELL_COUNT` (line 15) and `makeLayout` (line 26) at `ENDLESS_CONFIG` **in the dark-launch commit**
  (byte-identical then), so the flip stays a true single-file config change and the sweep-armed highlight
  (`use-board-gesture.ts:94` `isCollinearRun(..., lineLength)`) can never promise a 5-run sweep the core
  (scoring at `lineLength: 6`) then scores plain. `rows`/`cols` are unchanged, so `CELL_COUNT` is identical —
  repointed for consistency, not because it drifts.
- Create: `src/core/resolve/heat-economy.sim.test.ts`
- Create/extend tests: `refill.test.ts` (exclusion + byte-identical default), `scoring`/`resolve-chain` heat tests, `game.test.ts` (fold + init), an **Endless-vs-Default byte-identity test** proving no live change at land

## Implementation Steps (TDD)

1. **Red:** write `refill` exclusion tests — (a) no `excludeColor` ⇒ output identical to today for a fixed
   seed (guards the RNG contract); (b) with `excludeColor`, spawns never equal it and colors remap correctly.
2. **Green:** add optional `excludeColor` to `refill` with the remap; keep the `undefined` branch the exact
   current loop.
3. **Red:** write heat tests against `resolveChain`/`applyResolution` under an explicit heat-on config —
   sweep raises tier, plain lowers, floor/cap respected, `doubleSweep` correct, multiplier applied; and a
   dials-off config yields identical `scoreDelta` to a pre-change snapshot.
4. **Green:** add `GameConfig` dials + `GameState`/`Resolution` fields; implement heat in `resolveChain`;
   fold in `applyResolution`; init in `newGame`; wire `excludeColor` into the resolve refill call.
5. **Green (dark-launch):** add `ENDLESS_CONFIG = { ...DEFAULT_CONFIG }` (dials off, `lineLength: 5`); point
   `useGameState` **and** `src/app/game.tsx` (gesture `minChain`/`lineLength`, `CELL_COUNT`, `makeLayout`)
   at it (F2 — byte-identical now, so the flip is a true one-file change). Assert Endless behavior is
   byte-identical to `DEFAULT_CONFIG` at this stage — the plumbing lands with **no live change**.
6. **Gate:** write the seeded sim harness (three bots incl. farm-then-cash, loop/line P(follow-up), exclusion-weight sweep) with
   the pre-committed bound constants from the plan; validate the **target flipped bundle**
   (`heatCap: 3, heatStep: 0.5, sweepExclusionWeight: w, lineLength: 6`) vs the `DEFAULT_CONFIG` baseline;
   pick the largest `w` (and, if needed, `heatStep`/`sweepMultiplier`, never below `lineLength: 6`) that
   satisfies the pre-committed bounds. Record the sim-passing values.
7. **Verify:** `npm test` (no existing test edited), `npm run lint`, `npm run typecheck`, `npm run coverage:diff`.
8. **Flip (separate, gated commit):** after the **heat-economy on-device feel check** on a real iPhone,
   set `ENDLESS_CONFIG` to the sim-tuned bundle (`heatCap`, `heatStep`, `sweepExclusionWeight: w`,
   `lineLength: 6`). The gesture layer is already reading `ENDLESS_CONFIG` (from step 5), so the highlight
   threshold tracks the core automatically. **This is the only step that changes live Endless behavior.**
   Re-run the full gate. Until this step lands, Endless ships exactly as today.

## Todo

- [ ] `refill` weighted exclusion (`excludeColor?` + `exclusionWeight?`; byte-identical default) + fixed-seed snapshot test
- [ ] `GameConfig` dials (`heatCap?`,`heatStep?`,`sweepExclusionWeight?`; Endless-only `lineLength: 6` retune) + `DEFAULT_CONFIG` untouched
- [ ] `GameState`/`Resolution` heat fields **OPTIONAL** (F1); `newGame`/`applyResolution` fold via `?? 0`/`?? null`; typecheck passes across tests + `journey/`
- [ ] heat + double-sweep + multiplier (**all commits**, F5 user override) in `resolveChain` + tests
- [ ] `ENDLESS_CONFIG` dark-launched (mirrors `DEFAULT_CONFIG`); `useGameState` **and `game.tsx`** point at it (F2); behavior byte-identical at land + explicit byte-identity test
- [ ] seeded sim harness (three bots incl. farm-then-cash, loop/line P(follow-up), exclusion-weight sweep, pre-committed bounds) validates the flipped bundle (merge gate) + tuning
- [ ] full gate green (test/lint/typecheck/coverage), no existing test edited
- [ ] **flip step** (separate gated commit): `ENDLESS_CONFIG` → sim-tuned bundle after heat-economy on-device feel check

## Success Criteria

- [x] All existing tests pass **unmodified** and `npm run typecheck` is green across `*.test.ts` + `journey/`
      (fields are optional — F1); a fixed-seed snapshot proves dials-off `scoreDelta` and `refill` output are
      byte-identical.
- [x] **At Phase-1 land, Endless is byte-identical to today** (`ENDLESS_CONFIG` mirrors `DEFAULT_CONFIG`,
      both core AND `game.tsx` gesture layer point at it); an Endless-vs-Default behavior test proves no live
      change until the flip step.
- [ ] Under an enabled config: heat rises to cap on consecutive sweeps, cools one tier per plain move,
      floor 0; the multiplier applies to **every commit** (both sweep and plain, using post-move heat — F5
      user override); `doubleSweep` flags consecutive sweeps. — implemented + tested; goes live at the gated
      flip commit (dials are OFF in the dark land)
- [ ] A sweep's own refill down-weights/bans the swept color for exactly one wave (per `sweepExclusionWeight`);
      the next commit's refill is back to full colors. — implemented + tested; goes live at the gated flip
      commit (dials are OFF in the dark land)
- [x] Sim harness green within the **pre-committed** bounds (score-rate ratio + policy-collapse), run with
      all three bots (incl. farm-then-cash) over the exclusion-weight sweep; no bound was changed to force green.
- [x] Journey / `DEFAULT_CONFIG` path inert (no config enables the dials; `lineLength` stays 5 there).
- [ ] **Flip step**: after the heat-economy on-device feel check, `ENDLESS_CONFIG` carries the sim-tuned
      bundle and the full gate is re-run green. — not yet done; flip commit still pending (gated on
      on-device feel check)

## Risk Assessment

- **BIGGEST RISK — the sim gate silently becomes a rubber stamp (red-team F4/biggest-risk).** With full
  exclusion, `P(follow-up loop sweep) ≳ 0.9` is _structural_, not tunable by `lineLength`/`heatStep`; an
  implementer who hits that wall will be tempted to widen the numeric bounds until green. _Signal:_ a bound
  constant changes during Phase-1 implementation. _Response:_ the bounds, three-bot roster, and
  exclusion-weight lever are **pre-committed in this plan doc** — any change is a visible user decision, not
  a tuning detail; the exclusion **weight** (`sweepExclusionWeight`) is the real lever, not `lineLength`.
- **Implementer "fixes" a typecheck break by editing existing tests (F1).** _Signal:_ a diff touches
  `*.test.ts` GameState/Resolution literals or `journey-state.ts`. _Response:_ the new fields are OPTIONAL —
  a typecheck break means a field was declared required; make it optional, do not edit the test/Journey.
- **Self-sustaining sweep escalator** (sweep → few-color board → loop sweep → …). _Signal:_ sweep-bot
  policy-collapse metric high / score-rate ratio over ceiling. _Response:_ lower `sweepExclusionWeight`
  (partial exclusion) first; then `heatStep`; keep `lineLength: 6`. Do NOT flip to device until bounds pass.
- **RNG-contract break** (exclusion changes draw order on the default path). _Signal:_ an existing seeded
  test changes. _Response:_ the `undefined`/weight-0 `excludeColor` branch must be the literal current loop;
  assert byte-identity via a fixed-seed snapshot in step 1. The partial-weight draw must use exactly one
  `nextInt` per cell to keep the stream legible.
- **Plain-snake cash-in inflating the lifetime odometer (F5 user override).** Heat scales plain commits, so
  a farm-then-cash player can loop-farm heat and cash it in on a long plain snake. _Signal:_ the
  farm-then-cash bot's score-rate ratio breaches the ceiling. _Response:_ lower `heatStep`/`heatCap`; the
  post-move cooling (plain uses `heat-1`) and `Math.round`-once/linear-mapping/cap keep the worst case
  bounded. Do NOT silently revert to sweeps-only — that reverses a user decision (surface it if the bound
  can't be met).
- **Coverage ratchet (F7).** The sim test raises the committed coverage baseline; later trimming sim scope
  trips `coverage:diff`. _Response:_ commit the baseline deliberately when the sim lands.
