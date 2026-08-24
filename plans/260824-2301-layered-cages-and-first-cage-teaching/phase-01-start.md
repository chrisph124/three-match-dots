---
title: 'Phase 1: Core resolve seam'
phase: 1
status: done
priority: P1
effort: '0.5-1d'
dependencies: []
---

# Phase 1: Core resolve seam

## Overview

Add a generic, default-off `protectedCells` parameter to `resolveChain` so a cell can be linked and
counted in a chain yet resist removal, and echo the shielded cells back as `Resolution.protectedHits`.
This is the single, mechanic-agnostic seam the layered-cage overlay (Phase 3) and the solver (Phase 4)
build on. The core learns nothing about cages or layers.

## Requirements

- Functional:
  - `resolveChain(state, chain, protectedCells: ReadonlySet<CellIndex> = EMPTY_PROTECTED)` — a
    **defaulted** third param (not a bare optional — see F7 in Architecture), so every existing 2-arg
    caller keeps compiling and running unchanged. When omitted or empty, output is **byte-identical** to today.
  - Validation (`isCommittable`), `classifyChain`, and colour derivation run on the **full chain** —
    unchanged. A protected cell still counts toward `chain.length ≥ minChain` and toward
    loop/line classification.
  - After `collectCleared`, partition the collected set:
    - `cleared = collected ∖ protectedCells` → feeds `applyGravity`, `scoreFor`, `refill` exactly as
      today (protected cells therefore do not score and are not removed; dots above stack onto them,
      and if cells BELOW cleared, a protected cell falls and appears in `falls`).
    - `protectedHits = collected ∩ protectedCells` → returned as an optional `Resolution` field, in
      the same `ClearedCell` shape and the same row-major / drag order as `cleared`, so the render
      layer can stagger a chip animation identically to pops.
  - Omitted param ⇒ `protectedHits` absent (like `heat`), not an empty array — keep the object shape
    byte-identical.
- Non-functional:
  - `src/core/resolve/**` edit limited to this one param + partition; `hot/**` untouched.
  - No `any`; strict types; file stays ~<200 lines.

## Architecture

`resolveChain` today: `isCommittable` → `classifyChain` → `collectCleared` → `applyGravity` →
heat/score → `refill` → build `Resolution`. Insert the partition immediately after `collectCleared`
and before `applyGravity`. Everything downstream (gravity, heat, scoring, sweep-exclusion refill,
falls/spawns ordering) consumes the reduced `cleared` set unchanged.

`Resolution` (in `src/core/types.ts`) gains an optional `protectedHits?: readonly ClearedCell[]`,
added the same way `heat` is optional (spread-in only when present):

```ts
// resolve-chain.ts — DEFAULT the param so every existing 2-arg caller is safe (red-team F7):
// a bare `protectedCells.size` on an omitted optional throws TypeError on the byte-identity path.
const EMPTY_PROTECTED: ReadonlySet<CellIndex> = new Set(); // module-level, shared, never mutated
export function resolveChain(
  state: GameState,
  chain: Chain,
  protectedCells: ReadonlySet<CellIndex> = EMPTY_PROTECTED,
): Resolution {
  // ...after: const collected = collectCleared(board, chain, kind);
  const cleared =
    protectedCells.size === 0 ? collected : collected.filter((c) => !protectedCells.has(c.index));
  const protectedHits =
    protectedCells.size === 0 ? undefined : collected.filter((c) => protectedCells.has(c.index));
  // ...gravity/score/refill use `cleared` exactly as before...
  return { ...existing, ...(protectedHits && protectedHits.length ? { protectedHits } : {}) };
}
```

Default the param (not a bare optional `?`) — `protectedCells?: ReadonlySet<CellIndex>` alone leaves
`protectedCells.size` a null-deref for every current 2-arg caller (`solver.ts:148`,
`use-voyage-state.ts:182`, the tests). Default-to-`EMPTY_PROTECTED` keeps the omitted path byte-identical
AND crash-free. (Exact `collected` type/shape to be confirmed against `collect-cleared.ts` — it returns
`ClearedCell[]`; `.index` is the field used elsewhere in `caged-dot.ts`.)

**Contract note (red-team F8, adjudicated as intended):** widening `Resolution` with an optional
`protectedHits?` is the deliberate, R1-settled seam — it is always echoed when the param is non-empty,
never conditionally on a "cage" concept. The core stays mechanic-agnostic; this is the boundary, not a
leak. Do not re-litigate it as scope creep during implementation.

## Related Code Files

- Modify: `src/core/resolve/resolve-chain.ts` (add param, partition, echo)
- Modify: `src/core/types.ts` (optional `protectedHits` on `Resolution`)
- Modify: `src/core/resolve/resolve-chain.test.ts` (ADD cases only — do not edit existing assertions)

## Implementation Steps (test-first)

1. **Red:** add a byte-identity property test — over randomized boards + valid chains (incl. loops
   and ≥5 lines), assert `resolveChain(s, c)` deep-equals `resolveChain(s, c, new Set())`. Must pass
   immediately once the signature is added (it is the regression proof).
2. **Red:** add protected-path tests (all NEW, none editing existing assertions):
   - protected cell in a plain chain → excluded from `cleared`, present in `protectedHits`, board
     keeps that cell's colour, `scoreDelta` reflects only the popped cells.
   - protected cell with cells cleared BELOW it → the protected cell appears in `falls` (rides
     gravity down); with cells cleared only ABOVE → dots stack, protected cell stays put.
   - two protected cells in one column.
   - a sweep (2×2 loop / ≥5 line) whose colour includes both a protected and unprotected cage-cell →
     unprotected pops (in `cleared`), protected chips (in `protectedHits`), classification still the
     sweep kind.
   - an all-protected chain (e.g. a 4-loop of protected cells) → legal commit, `cleared` empty (or
     sweep-extras only), `scoreDelta ≈ 0`, no throw. Assert `protectedHits` carries them.
   - `protectedHits` ordering matches `cleared`'s ordering contract.
3. **Green:** implement the signature + partition + optional echo per Architecture.
4. Run `npm test -- resolve-chain` then the full `npm test`; the pre-existing suite must pass with
   **zero edits to existing assertions**.

## Success Criteria

- [ ] Byte-identity property test green
- [ ] All new protected-path tests green
- [ ] Pre-existing `resolve-chain.test.ts` assertions unchanged and green
- [ ] `Resolution.protectedHits` absent when the param is omitted/empty (object shape byte-identical)
- [ ] `npm run typecheck` + `npm run lint` green; no `any`; `resolve/**` change scoped to this param

## Risk Assessment

- **Any needed edit to an EXISTING assertion is a design smell** (kongming) → stop, re-examine the
  partition; do not weaken a test to make it pass. Signal: a resolve-chain test that previously
  asserted a field now differs when the param is omitted. Response: revert, the omitted path must be
  identical.
- Falls/spawns ordering contract (documented in `collect-cleared.ts` / `gravity.ts`) must be
  preserved — the reduced `cleared` set flows through the same gravity call, so ordering is inherited;
  the new test on `falls` for a protected cell with clears below guards it.
