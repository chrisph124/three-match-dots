---
title: Voyage Infinite Mode — pure-TS engine (Phases 1–5)
date: 2026-08-24
summary: Shipped the Vitest-testable Voyage engine; fixed a shipped-core hasLegalMove soundness bug that soft-locked a 4-cell star at minChain 4.
---

# Voyage Infinite Mode — pure-TS engine (Phases 1–5)

## What happened

Implemented Voyage (a third mode beside Endless and Journey) — the **pure-TS engine only**, Phases 1–5 of the accepted plan `plans/260824-1106-voyage-infinite-mode/`. All Vitest-testable, all landed in `src/core/voyage/**` + `src/meta/use-voyage-state.ts` (RN hook):

- **Phase 1** — schema v2 (`src/core/level/level-script.ts`): `mode: 'voyage'`, a constraint union (moves/timed/mistakes), `voyage`/`theme` blocks. Accepts v1 + v2, rejects malformed voyage levels.
- **Phase 2** — pure Voyage state machine (`voyage-state.ts`): moves/timed/mistakes fail-states.
- **Phase 3** — difficulty model (`voyage-config.ts`, `difficulty-curve.ts`): a saturating curve → point budget → dial spender. One tuning edit-point.
- **Phase 4** — generator (`generate-level.ts`, `archetypes.ts`) + variety metric (≥40%-different within a window of 8; measured shortfall ≈0.038 under the 0.06 ceiling via the sanctioned least-similar fallback).
- **Phase 5** — headless solver + calibration (`enumerate-moves.ts`, `solver.ts`): greedy chain-picker + sweep-opportunist; `calibrateBudget` = p75(movesUsed) + slack; a `1..N` winnability sweep gates generation.

## Root-cause event (the reason Phase 5 mattered)

The `1..N` winnability sweep **false-halted on level 83**. Cause was **not** the solver — it was a latent soundness bug in the _shipped core_ `hasLegalMove` (`src/core/deadlock.ts`). It decided "board is live" by same-colour **component size ≥ minChain**. That is unsound at `minChain 4`: a 4-cell "star" (K₁,₃ — a centre with 3 mutually non-adjacent arms) is a size-4 component whose longest simple chain is only 3. The size check called it playable; the board was actually soft-locked.

## Decision

- **Fix in shipped core, user-approved scope widening.** Rewrote `hasLegalMove` as a bounded same-colour **simple-path DFS** (`chainFrom`) searching for a real ≥minChain chain. It is **byte-identical to the old size check at minChain 3** (any ≥3 component on an 8-way grid contains a 3-path), so Endless/Journey (minChain 3) are provably unaffected. Regression test added on the star board: `check('GRB/BRG/RBR', 4) === false` and `=== true` at minChain 3.
- **`enumerate-moves.ts` carries a matching `findChain` completeness net** so the solver's move set agrees with the corrected predicate. Structural reasoning (8-way components are trees or contain a 2×2 clique) showed `findChain` is a per-start _structural_ net, not load-bearing for non-emptiness — which is why a "prove findChain necessary" synthetic test is unconstructable, and that Low code-review finding was skipped with rationale.
- **Docs-impact:** the fix invalidated the old "minChain capped at 4 because hasLegalMove is only sound for 3–4" rationale in 3 places (`docs/level-script-schema.md`, `voyage-config.ts` MAX_MIN_CHAIN, `level-script.ts` minChain comment) — all corrected to "design/scope ceiling; hasLegalMove is a path search, sound at every minChain."

## Outcome

Post-fix sweep `1..200` + Caged Core boss green, zero drops. Full gate green: lint 0 errors (2 pre-existing warnings in untouched effects/input files), typecheck clean, 343/343 tests (37 files), coverage 95.22% stmts ≥ baseline, `src/core` RN-free. Mandatory code-review done (1 Medium + 2 Low fixed, 1 Low skipped-with-rationale).

## Next steps

Handoff boundary: **Phases 6–8 (Skia render — diorama backdrop, navigation ribbon, boss visuals/HUD/juice) are NOT Vitest-testable and are verified on-device by the owner.** Plan synced (Phases 1–5 Done; 6–8 Pending). On-device success criterion left unchecked pending that verification.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
