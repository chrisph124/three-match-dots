# Game Core Engine — Design

**Date:** 2026-08-01
**Status:** Approved via brainstorm. Ready for `superpowers:writing-plans`.
**Scope:** `src/core/` only — the pure-TS, RN-free game engine.

## Problem

The stack and scaffold are designed but the game itself has no logic. This round designs the
engine that owns the rules: chain validation, special-clear detection, clear→gravity→refill
resolution, and scoring. It is the only layer Vitest can test, so its boundaries decide how much
of the game is testable at all.

This design changes two rules previously recorded in `docs/two-dots-game-design.md`
(see [Rule changes](#rule-changes-from-the-original-game-design)).

## Rules (locked)

- **Linking is 8-way.** A chain may step to any of the 8 surrounding cells, diagonals included.
- **A chain of ≥2 same-color dots clears on release.**
- **Closing a 2×2 square clears every dot of that color board-wide.**
- **A straight chain of ≥5 clears every dot of that color board-wide.** "Straight" means all
  cells collinear along one of the 8 directions. Threshold is 5-or-more, not exactly-5 — an
  exactly-5 rule would perversely score a 6-long straight chain lower than a 5-long one.
- **Retrace undoes.** Dragging back onto the second-to-last dot pops the last dot. Any other
  revisit of an already-linked cell is rejected unless it completes the 2×2.
- **Loop closure seals the chain.** After the square closes, further appends are rejected until
  release. This is a deliberate simplification of Two Dots and costs nothing: the sweep already
  removes every dot of that color, so extending cannot add a point. It also gives the render
  layer one unambiguous moment to fire the color-glow effect.
- **No fail state.** Endless zen. The run ends when the player quits; score climbs indefinitely.
- **Board defaults to 6×6 with 5 colors**, both config values.

### Rule changes from the original game design

|               | `docs/two-dots-game-design.md` | This design                 | Why                                                                  |
| ------------- | ------------------------------ | --------------------------- | -------------------------------------------------------------------- |
| Adjacency     | 4-way (up/down/left/right)     | **8-way**                   | Required for diagonal 5-in-a-line, which the 5-line rule depends on. |
| Special clear | 2×2 loop only                  | 2×2 loop **or** straight ≥5 | New mechanic requested this round.                                   |

`docs/two-dots-game-design.md` and `CLAUDE.md` both describe 4-way adjacency and must be updated
when this is implemented.

### Why the loop rule stayed 2×2-only

Under 8-way adjacency, "any closed cycle" is a trap. Three dots in an L — `(0,0) → (1,0) → (1,1)`
— already close a cycle, because `(1,1)` is diagonally adjacent to `(0,0)`. If any cycle fired
the board-wide sweep, the game's most powerful effect would trigger on almost every drag. The
2×2-only rule keeps it rare and deliberate, and keeps detection O(1) per step.

### Why there is no fail state

The chosen mode ends only on deadlock, and deadlock is effectively unreachable here. A 6×6 board
has ~120 adjacent pairs under 8-way adjacency; a run ends only if every pair differs in color.
Even at 10 colors that is roughly a 1-in-300,000 board, and it must occur on a freshly refilled
board. So the honest design is a zen game with no fail state: the player stops when they choose,
and the persisted high score is the best score ever reached. `deadlock.ts` is still implemented
as a correctness safety net — it just almost never fires.

If a real fail state is wanted later, the viable levers are clogging blockers or a shrinking
board. Both are out of scope for v1.

## Architecture

The driving constraint: per `CLAUDE.md`, chain logic runs **inside a Reanimated worklet** on the
UI thread. Worklets can only call plain workletizable functions — no classes, no closures over
mutable module state. But clear→gravity→refill→scoring runs once per commit and has no such
constraint. The core therefore splits in two.

```
src/core/
  types.ts            Color, CellIndex, Board, Chain, ChainKind, Resolution, GameConfig
  config.ts           DEFAULT_CONFIG: 6×6, 5 colors, scoring constants
  rng.ts              seeded PRNG (mulberry32), explicit state threading
  hot/                ── worklet-safe: plain fns, primitives + flat arrays only
    adjacency.ts        areAdjacent(a, b, cols)                8-way
    can-append.ts       canAppend(chain, cell, board, cols) → AppendVerdict
    closes-square.ts    closesSquare(chain, cell, cols)
    is-line.ts          isCollinearRun(chain, cols)
  resolve/            ── JS thread, runs once per commit
    classify-chain.ts   chain → ChainKind
    collect-cleared.ts  which cells clear, and why
    gravity.ts          survivors fall → FallMove[]
    refill.ts           spawn new dots → Spawn[]
    scoring.ts          scoreFor(kind, chainLength, clearedCount)
    resolve-chain.ts    orchestrator → Resolution | null
  deadlock.ts         hasLegalMove(board, cols) — safety net
  game.ts             newGame(config, seed), applyResolution(state, res)
```

Fifteen files, none near the 200-line ceiling, each with one responsibility.

### Representation

- **A cell is a single `number`** — `row * cols + col`, not a `{row, col}` object. The hot path
  runs at touch frequency; per-move object allocation on the UI thread is exactly what the
  performance principle forbids. `rowOf`/`colOf` helpers recover the pair.
- **The board is a flat `number[]`** of color ids, `-1` for empty. This is what a Reanimated
  shared value holds cleanly.
- **A chain is a `number[]`** of cell indices.

### The boundary rule

**Nothing in `hot/` may allocate objects, capture module state, use classes, or import from
`resolve/`.** Dependencies point one way: `resolve/` may use `hot/`, never the reverse. This
belongs in `CLAUDE.md` at implementation time, or it will erode.

## Chain rules (hot path)

`canAppend(chain, cell, board, cols)` returns one of four verdicts. **Order matters** — the
retrace check must precede the revisit check, or backing up reads as an illegal revisit.

| #   | Condition                                    | Verdict                                       |
| --- | -------------------------------------------- | --------------------------------------------- |
| 1   | chain empty                                  | `append` — starts the chain, fixes its color  |
| 2   | `cell` is the last dot                       | `reject` — finger jitter inside the same cell |
| 3   | `cell` is the second-to-last dot             | `undo` — retrace, pop the last dot            |
| 4   | not 8-way adjacent to last                   | `reject`                                      |
| 5   | `board[cell]` ≠ chain color                  | `reject`                                      |
| 6   | `cell` already in chain **and** closes a 2×2 | `close-square`                                |
| 7   | `cell` already in chain otherwise            | `reject`                                      |
| 8   | —                                            | `append`                                      |

Once a chain is sealed by `close-square`, all further appends return `reject` until release.

**The closing cell is appended.** On `close-square` the input layer pushes `cell` onto the chain
even though it duplicates an earlier entry. This makes the committed chain **self-describing**: a
sealed chain is exactly one whose last entry repeats its fifth-from-last, so `resolveChain` needs
no extra "sealed" parameter and the chain stays a plain `number[]` the worklet can own. Without
this, a chain that merely _ends_ on four cells shaped like a square — `(0,0) → (0,1) → (1,1) →
(1,0)`, never revisiting the start — would be indistinguishable from a real loop closure, and
would wrongly sweep the board.

**`closesSquare(chain, cell, cols)`** is evaluated _before_ the append: it finds index `i` where
`chain[i] === cell`, requires `chain.length - i === 4`, and requires those four cells to form a
true 2×2 block. Stated generally, a long winding chain that _ends_ by looping a square still
counts — the square need not be the whole chain.

**`isCollinearRun(chain, cols)`** returns true when the chain is ≥5 long and every consecutive
step has an identical `(Δrow, Δcol)`. Since each step is already an adjacency step, identical
deltas is exactly equivalent to "straight in one of the 8 directions" — one O(n) pass, no
geometry.

This is called during the drag, not only at commit, so the render layer can light the chain up
the moment it reaches 5. The consequence is legible and accepted: bend at dot 6 and the run
breaks, the glow drops, and it scores as a plain chain.

`classify-chain` therefore detects `square-loop` by the self-describing form above —
`chain[len-1] === chain[len-5]` and those four cells forming a 2×2 — and `line` via
`isCollinearRun`. Precedence is `square-loop` > `line` > `plain`. A sealed square chain cannot
also be straight, so the two are mutually exclusive in practice; the precedence is defensive.

## Resolution pipeline

`resolveChain(state, chain)` runs five pure steps — classify → collect → gravity → refill →
score — and returns one immutable object, or `null` when the chain cannot be committed.

```ts
type Resolution = {
  kind: ChainKind; // 'plain' | 'square-loop' | 'line'
  color: Color;
  cleared: ClearedCell[]; // { index, color, reason: 'chain' | 'color-sweep' }
  falls: FallMove[]; // { from, to }
  spawns: Spawn[]; // { to, color, heightAbove }
  scoreDelta: number;
  board: Board; // resulting flat number[]
  rngState: number; // threaded forward, never hidden
};
```

**Cleared set.** For `plain`, exactly the chain cells. For `square-loop` the chain's duplicated
closing entry is counted once — `cleared` is always duplicate-free. For `square-loop` or `line`, every cell
matching the chain color — chain cells tagged `'chain'`, the rest `'color-sweep'`, so the render
layer can stagger the chain pops along drag order and then burst the sweep. That tagging is why
`cleared` is a list of records rather than a bare index array.

**Ordering is part of the contract**, because animation staggering depends on it: chain-tagged
cells in drag order, sweep cells row-major, falls per column bottom-up.

**`heightAbove` is what makes spawns animatable.** A column with `k` empty top cells spawns `k`
dots; the one landing at row `r` gets `heightAbove = k - r`, so the render layer starts it that
many cell-heights above the board instead of materializing it in place.

**Determinism is threaded, not hidden.** `GameState` carries `rngState: number`; `rng.ts` exposes
`next(state) → { value, state }` (mulberry32) and resolution returns the advanced state. No
stateful closure, no `Math.random()`. Refill consumes randomness in a fixed order — **columns
left→right, rows top→bottom** — and that order is part of the spec: change it and every seeded
test breaks.

**Scoring** (constants in `config.ts`):

| Kind                   | Formula                                                       | Example                   |
| ---------------------- | ------------------------------------------------------------- | ------------------------- |
| `plain`                | `BASE * n(n+1)/2` for distinct chain length `n`               | 2 dots → 30; 5 dots → 150 |
| `square-loop` / `line` | `BASE * m * SWEEP_MULTIPLIER` for `m` dots removed board-wide | 8 dots → 240              |

`BASE = 10`, `SWEEP_MULTIPLIER = 3`.

`game.ts` stays thin: `newGame(config, seed)` builds the opening board from the seed, and
`applyResolution(state, res)` folds board, score, and `rngState` forward. High-score persistence
belongs to the meta layer (MMKV), not the core.

## Error handling and invariants

**Nothing on the gesture path throws.** `hot/` never throws — every outcome is a verdict.
`resolveChain` returns `null` for anything it cannot commit: chain shorter than 2, or a malformed
chain (non-adjacent steps, mixed colors) indicating the worklet handed over a corrupted array.
The input layer treats `null` as a cancel. Only `newGame` throws, on invalid config
(rows/cols < 2, colors < 2) — a startup-time programmer error, not a mid-drag possibility.

**Invariants**, asserted in tests rather than guarded at runtime:

- after resolution the board contains no empty cells
- `falls` never contains an entry where `from === to`
- `cleared` is duplicate-free
- `spawns.length === cleared.length`

## Testing

Vitest, node environment, scoped to `src/core/**`. No RN imports anywhere in the tree.

**Board fixtures as string art** — `parseBoard("RGBRG/BBRGR/...")` plus `formatBoard` for readable
failure diffs. Gravity and sweep assertions are unreadable as raw number arrays and obvious as
text grids; this helper pays for itself immediately.

Coverage by module:

- `areAdjacent` — every edge and corner cell explicitly
- `canAppend` — the verdict table, row by row
- `closesSquare` — square at the tail of a long winding chain; non-square revisit rejected
- `classify-chain` — a chain ending on four square-shaped cells _without_ a revisit classifies as
  `plain`, not `square-loop`
- `isCollinearRun` — all 8 directions; length 4 vs 5; bend-at-6
- `collect-cleared` — tagging and ordering
- `gravity` — `from→to` correctness
- `refill` — `heightAbove`, and same-seed reproducibility
- `scoring` — the arithmetic
- `deadlock` — detection on a hand-built deadlocked board
- `resolveChain` — seeded end-to-end goldens

**Name the row-wrap bug in the tests.** The flat-array representation invites it: `cell + 1` at
the right edge is not a right-neighbor, it is the first cell of the next row, and the diagonal
offsets wrap identically. `areAdjacent` must compare decoded columns, not raw index deltas.

Worklet-safety is not Vitest-testable — to Vitest these are ordinary functions. Per the
`CLAUDE.md` test boundary, it gets verified on-device.

## Out of scope

Render (Skia), input (gesture worklet), effects, meta UI, persistence, difficulty ramp,
blockers, shrinking board, levels, monetization, Android.

## Dependencies

The Expo scaffold (`plans/2026-06-18-expo-scaffold.md`) must land first — it creates
`src/core/` and the Vitest configuration this design targets. The core itself has no runtime
dependencies beyond TypeScript.

## Success criteria

- Every rule above is covered by a passing Vitest test.
- `src/core/` imports nothing from React Native, Skia, or Reanimated.
- No file exceeds ~200 lines; no `any`; lint and typecheck green.
- A seeded `newGame` → `resolveChain` sequence reproduces identically across runs.
- The `Resolution` object carries enough information for the render layer to animate a full
  clear→fall→spawn cycle without diffing boards.
