# Playable Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the scaffold into a playable game — a 6×6 board of three-colour dots that the player drags through to link and clear, with sweeps, gravity, refill, auto-shuffle, and a score that survives an app restart.

**Architecture:** React owns the board and mirrors it into a Reanimated shared value once per commit. The gesture worklet owns the in-progress chain and validates every touch move on the UI thread against that mirror, so the bridge is crossed a few times a second rather than at touch frequency. On release one `runOnJS` hop hands the chain to the pure-TS resolution pipeline, which returns an immutable `Resolution` describing everything the render layer must animate. Animation is expressed as an offset from a dot's settled position, driven by two shared progress values rather than per-dot tweens.

**Tech Stack:** TypeScript (strict, no `any`), Vitest (node env), `@shopify/react-native-skia` 2.6.2, `react-native-reanimated` 4.5.1, `react-native-gesture-handler` 2.32, `react-native-mmkv`, expo-router, ESLint + `eslint-plugin-sonarjs`, Prettier.

**Spec:** `docs/superpowers/specs/2026-08-03-playable-game-design.md`

**Supersedes:** `docs/superpowers/plans/2026-08-01-game-core-engine.md`. That plan was never executed. Tasks 1–14 below replace it in full — do not run both. It is deleted in Task 22.

## Global Constraints

- **Never `any`.** Enforced by `@typescript-eslint/no-explicit-any` (error) plus strict tsconfig. Escape only via an inline `// eslint-disable-next-line` carrying a written justification.
- **`src/core/` imports nothing from React Native, Skia, Reanimated, or Expo.** Vitest can only test RN-free code.
- **Nothing in `src/core/hot/` may allocate objects, capture module state, use classes, or import from `src/core/resolve/`.** Dependencies point one way: `resolve/` may use `hot/`, never the reverse.
- Every exported function in `src/core/hot/` and in `src/render/geometry.ts` opens with the `'worklet';` directive as the first statement of its body.
- Files stay under ~200 lines. Kebab-case filenames. One responsibility per file.
- Principles: YAGNI, KISS, DRY. No fake data or stubs to make builds pass.
- Conventional commits (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`).
- **No AI attribution in commits — ever.** No `Co-Authored-By`, no "Generated with", no tool references.
- Gate after every task: `npm run lint && npm run typecheck && npm test` all green.
- Board constants: `EMPTY = -1`. Defaults: 6 rows, 6 cols, **3 colours**, **minChain 3**, **lineLength 5**, `baseScore` 10, `sweepMultiplier` 3.
- Colour ids are contractual and shared by the test fixtures and the palette: **0 = R (red), 1 = G (green), 2 = B (blue)**.
- Randomness order is contractual: refill consumes RNG **columns left→right, rows top→bottom**.
- `Resolution` ordering is contractual: chain-tagged cleared cells in drag order, sweep cells row-major, falls per column bottom-up.
- Total resolve animation budget: **under 450ms** from release to unlocked input.

---

## Two findings that shaped this plan

Both were verified by brute force before writing, not assumed.

**1. `hasLegalMove` must count connected components, not adjacent pairs.** Under 8-way adjacency the four cells of any 2×2 block are pairwise adjacent. With only 3 colours, pigeonhole guarantees two of them share a colour, so _an adjacent same-colour pair always exists on any board with at least 2 rows and 2 columns_. A pair-based deadlock check would be a constant `true`, making the shuffle dead code. Because the minimum chain is 3, the correct question is: **does a same-colour 8-connected component of size ≥ `minChain` exist?** (Any connected component with ≥ 3 vertices contains a 3-vertex path, so component size is exactly the right measure.) This is why Task 12 is a flood fill.

**2. Deadlock is real but astronomically rare.** A deadlocked 6×6 three-colour board exists — `BBRBRR/GRGGBG/GBBRRG/RRGGBB/GBBRRG/GRGGBG` is one, found by annealing search — but **zero** of 2,000,000 uniformly random 6×6 boards were deadlocked. The shuffle is therefore a correctness net, not a mechanic the player will routinely see. It ships, it is correct, and it is verified in Vitest against known-deadlocked boards. **It cannot be verified by playing the game**, so the on-device checklist in Task 22 does not ask anyone to try.

---

## File Structure

| File                                     | Responsibility                               |
| ---------------------------------------- | -------------------------------------------- |
| `src/core/types.ts`                      | All shared types + `EMPTY`                   |
| `src/core/config.ts`                     | `DEFAULT_CONFIG`                             |
| `src/core/rng.ts`                        | mulberry32 with explicit state threading     |
| `src/core/hot/adjacency.ts`              | `rowOf`, `colOf`, `areAdjacent` (8-way)      |
| `src/core/hot/closes-square.ts`          | `closesSquare`, `formsSquareLoop`            |
| `src/core/hot/is-line.ts`                | `isCollinearRun`                             |
| `src/core/hot/can-append.ts`             | `canAppend` → `AppendVerdict`                |
| `src/core/resolve/classify-chain.ts`     | `classifyChain` → `ChainKind`                |
| `src/core/resolve/collect-cleared.ts`    | `collectCleared` → `ClearedCell[]`           |
| `src/core/resolve/gravity.ts`            | `applyGravity` → board + `CellMove[]`        |
| `src/core/resolve/refill.ts`             | `refill` → board + `Spawn[]` + rngState      |
| `src/core/resolve/scoring.ts`            | `scoreFor`                                   |
| `src/core/resolve/resolve-chain.ts`      | `resolveChain` orchestrator                  |
| `src/core/deadlock.ts`                   | `hasLegalMove` (flood fill)                  |
| `src/core/shuffle.ts`                    | `shuffleBoard`                               |
| `src/core/game.ts`                       | `newGame`, `applyResolution`                 |
| `src/core/test-support/board-fixture.ts` | `parseBoard`, `formatBoard`                  |
| `src/render/geometry.ts`                 | cell↔pixel math, hit-test, animation offsets |
| `src/render/palette.ts`                  | colour id → hex, board chrome colours        |
| `src/render/dot-layer.tsx`               | the 36 dots                                  |
| `src/render/link-path.tsx`               | the live chain stroke                        |
| `src/render/board-canvas.tsx`            | the Skia `<Canvas>` composing both           |
| `src/effects/use-board-animation.ts`     | shared values + tween sequencing             |
| `src/input/use-board-gesture.ts`         | Pan gesture worklet                          |
| `src/meta/score-storage.ts`              | MMKV read/write                              |
| `src/meta/use-game-state.ts`             | board + score, commit orchestration          |
| `src/app/game.tsx`                       | HUD + canvas + gesture wiring                |
| `src/app/index.tsx`                      | title, score, navigation                     |
| `src/app/settings.tsx`                   | reset score                                  |

**Deleted:** `src/core/are-adjacent.ts`, `src/core/are-adjacent.test.ts` (4-way, `{row,col}`-based scaffold sample), `src/app/game-over.tsx` (no fail state), `docs/superpowers/plans/2026-08-01-game-core-engine.md` (superseded).

---

## Phase 1 — Game core (Tasks 1–14)

### Task 1: Types, config, and seeded RNG

**Files:**

- Create: `src/core/types.ts`, `src/core/config.ts`, `src/core/rng.ts`
- Test: `src/core/rng.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `Color`, `CellIndex`, `Board`, `Chain`, `ChainKind`, `AppendVerdict`, `ClearReason`, `ClearedCell`, `CellMove`, `FallMove`, `Spawn`, `GameConfig`, `Resolution`, `GameState`, `EMPTY`; `DEFAULT_CONFIG`; `next(state: number): RngStep`, `nextInt(state: number, bound: number): RngStep`.

- [ ] **Step 1: Create `src/core/types.ts`**

```ts
/** A dot colour, expressed as an index into the palette: 0..colors-1. */
export type Color = number;

/** A board position flattened to a single number: row * cols + col. */
export type CellIndex = number;

/** Flat, row-major board of colours. EMPTY marks a hole. */
export type Board = readonly Color[];

/** An ordered run of linked cells. A sealed chain repeats its 5th-from-last entry. */
export type Chain = readonly CellIndex[];

export const EMPTY: Color = -1;

export type ChainKind = 'plain' | 'square-loop' | 'line';

export type AppendVerdict = 'append' | 'undo' | 'reject' | 'close-square';

export type ClearReason = 'chain' | 'color-sweep';

export type ClearedCell = {
  readonly index: CellIndex;
  readonly color: Color;
  readonly reason: ClearReason;
};

/**
 * A dot moving from one cell to another. A gravity fall and a shuffle slide
 * are the same thing to the render layer, so they share one type.
 */
export type CellMove = {
  readonly from: CellIndex;
  readonly to: CellIndex;
};

export type FallMove = CellMove;

export type Spawn = {
  readonly to: CellIndex;
  readonly color: Color;
  /** Cell-heights above the board the dot starts at, so it can fall in. */
  readonly heightAbove: number;
};

export type GameConfig = {
  readonly rows: number;
  readonly cols: number;
  readonly colors: number;
  /** Shortest chain that clears on release. */
  readonly minChain: number;
  /** Shortest straight run that sweeps the colour board-wide. */
  readonly lineLength: number;
  readonly baseScore: number;
  readonly sweepMultiplier: number;
};

export type Resolution = {
  readonly kind: ChainKind;
  readonly color: Color;
  readonly cleared: readonly ClearedCell[];
  readonly falls: readonly FallMove[];
  readonly spawns: readonly Spawn[];
  readonly scoreDelta: number;
  readonly board: Board;
  readonly rngState: number;
};

export type GameState = {
  readonly config: GameConfig;
  readonly board: Board;
  readonly score: number;
  readonly rngState: number;
};
```

- [ ] **Step 2: Create `src/core/config.ts`**

```ts
import type { GameConfig } from './types';

/**
 * Three colours plus a 3-dot minimum is what makes the board feel dense.
 * lineLength and sweepMultiplier are the tuning dials: with only three
 * colours a straight five is easy to draw, so expect to raise lineLength
 * or lower sweepMultiplier after playing on device.
 */
export const DEFAULT_CONFIG: GameConfig = {
  rows: 6,
  cols: 6,
  colors: 3,
  minChain: 3,
  lineLength: 5,
  baseScore: 10,
  sweepMultiplier: 3,
};
```

- [ ] **Step 3: Write the failing test**

Create `src/core/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { next, nextInt } from './rng';

describe('next', () => {
  it('returns a value in [0, 1)', () => {
    const step = next(12345);
    expect(step.value).toBeGreaterThanOrEqual(0);
    expect(step.value).toBeLessThan(1);
  });

  it('is deterministic for the same state', () => {
    expect(next(999)).toEqual(next(999));
  });

  it('advances the state', () => {
    expect(next(999).state).not.toBe(999);
  });

  it('produces a different value from the advanced state', () => {
    const first = next(999);
    const second = next(first.state);
    expect(second.value).not.toBe(first.value);
  });

  it('reproduces an identical sequence from the same seed', () => {
    const run = (seed: number): number[] => {
      let state = seed;
      const values: number[] = [];
      for (let i = 0; i < 20; i++) {
        const step = next(state);
        state = step.state;
        values.push(step.value);
      }
      return values;
    };
    expect(run(2026)).toEqual(run(2026));
  });
});

describe('nextInt', () => {
  it('stays within the bound', () => {
    let state = 7;
    for (let i = 0; i < 500; i++) {
      const step = nextInt(state, 3);
      state = step.state;
      expect(step.value).toBeGreaterThanOrEqual(0);
      expect(step.value).toBeLessThan(3);
      expect(Number.isInteger(step.value)).toBe(true);
    }
  });

  it('eventually produces every value in range', () => {
    let state = 42;
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const step = nextInt(state, 3);
      state = step.state;
      seen.add(step.value);
    }
    expect(seen.size).toBe(3);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./rng`.

- [ ] **Step 5: Create `src/core/rng.ts`**

```ts
export type RngStep = {
  readonly value: number;
  readonly state: number;
};

/**
 * mulberry32, with the generator state threaded explicitly rather than
 * captured in a closure. Purity is what makes refill reproducible in tests.
 */
export function next(state: number): RngStep {
  const advanced = (state + 0x6d2b79f5) | 0;
  let t = advanced;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: advanced };
}

/** Uniform integer in [0, bound). */
export function nextInt(state: number, bound: number): RngStep {
  const step = next(state);
  return { value: Math.floor(step.value * bound), state: step.state };
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 7 tests green.

- [ ] **Step 7: Verify lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/core/types.ts src/core/config.ts src/core/rng.ts src/core/rng.test.ts
git commit -m "feat(core): add core types, config, and seeded rng"
```

---

### Task 2: 8-way adjacency

Replaces the scaffold's 4-way `are-adjacent` sample. The flat-index representation invites one specific bug: `cell + 1` at the right edge is the _first cell of the next row_, not a right-neighbour, and the diagonal offsets wrap the same way. `areAdjacent` must compare decoded columns, never raw index deltas.

**Files:**

- Create: `src/core/hot/adjacency.ts`, `src/core/hot/adjacency.test.ts`
- Delete: `src/core/are-adjacent.ts`, `src/core/are-adjacent.test.ts`

**Interfaces:**

- Consumes: `CellIndex` from `../types`.
- Produces: `rowOf(cell: CellIndex, cols: number): number`, `colOf(cell: CellIndex, cols: number): number`, `areAdjacent(a: CellIndex, b: CellIndex, cols: number): boolean`.

- [ ] **Step 1: Delete the superseded scaffold sample**

```bash
git rm src/core/are-adjacent.ts src/core/are-adjacent.test.ts
```

- [ ] **Step 2: Write the failing test**

Create `src/core/hot/adjacency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { areAdjacent, colOf, rowOf } from './adjacency';

const COLS = 6;

describe('rowOf / colOf', () => {
  it('decodes a flat index', () => {
    expect(rowOf(0, COLS)).toBe(0);
    expect(colOf(0, COLS)).toBe(0);
    expect(rowOf(7, COLS)).toBe(1);
    expect(colOf(7, COLS)).toBe(1);
    expect(rowOf(35, COLS)).toBe(5);
    expect(colOf(35, COLS)).toBe(5);
  });
});

describe('areAdjacent', () => {
  it('is true for orthogonal neighbours', () => {
    expect(areAdjacent(7, 6, COLS)).toBe(true);
    expect(areAdjacent(7, 8, COLS)).toBe(true);
    expect(areAdjacent(7, 1, COLS)).toBe(true);
    expect(areAdjacent(7, 13, COLS)).toBe(true);
  });

  it('is true for diagonal neighbours', () => {
    expect(areAdjacent(7, 0, COLS)).toBe(true);
    expect(areAdjacent(7, 2, COLS)).toBe(true);
    expect(areAdjacent(7, 12, COLS)).toBe(true);
    expect(areAdjacent(7, 14, COLS)).toBe(true);
  });

  it('is false for the same cell', () => {
    expect(areAdjacent(7, 7, COLS)).toBe(false);
  });

  it('is false for distant cells', () => {
    expect(areAdjacent(0, 35, COLS)).toBe(false);
    expect(areAdjacent(0, 2, COLS)).toBe(false);
    expect(areAdjacent(0, 12, COLS)).toBe(false);
  });

  // The bug this representation invites.
  it('does not wrap around a row edge', () => {
    expect(areAdjacent(5, 6, COLS)).toBe(false); // row 0 col 5 -> row 1 col 0
    expect(areAdjacent(11, 12, COLS)).toBe(false);
    expect(areAdjacent(5, 12, COLS)).toBe(false); // "down-left" by raw offset
    expect(areAdjacent(6, 5, COLS)).toBe(false);
  });

  it('handles corner cells', () => {
    expect(areAdjacent(0, 1, COLS)).toBe(true);
    expect(areAdjacent(0, 6, COLS)).toBe(true);
    expect(areAdjacent(0, 7, COLS)).toBe(true);
    expect(areAdjacent(35, 34, COLS)).toBe(true);
    expect(areAdjacent(35, 29, COLS)).toBe(true);
    expect(areAdjacent(35, 28, COLS)).toBe(true);
  });

  it('handles left- and right-edge cells', () => {
    expect(areAdjacent(12, 6, COLS)).toBe(true);
    expect(areAdjacent(12, 7, COLS)).toBe(true);
    expect(areAdjacent(12, 11, COLS)).toBe(false); // row 2 col 0 vs row 1 col 5
    expect(areAdjacent(17, 18, COLS)).toBe(false); // row 2 col 5 vs row 3 col 0
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./adjacency`.

- [ ] **Step 4: Create `src/core/hot/adjacency.ts`**

```ts
import type { CellIndex } from '../types';

export function rowOf(cell: CellIndex, cols: number): number {
  'worklet';
  return Math.floor(cell / cols);
}

export function colOf(cell: CellIndex, cols: number): number {
  'worklet';
  return cell % cols;
}

/**
 * 8-way adjacency. Columns are decoded rather than compared as raw index
 * deltas, because cell+1 at the right edge is the next row's first cell.
 */
export function areAdjacent(a: CellIndex, b: CellIndex, cols: number): boolean {
  'worklet';
  if (a === b) {
    return false;
  }
  const rowDelta = Math.abs(rowOf(a, cols) - rowOf(b, cols));
  const colDelta = Math.abs(colOf(a, cols) - colOf(b, cols));
  return rowDelta <= 1 && colDelta <= 1;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 7 tests green. The deleted `are-adjacent` tests no longer run.

- [ ] **Step 6: Verify lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors. If ESLint flags the `'worklet';` directive as an unused expression, first confirm the directive is the **first statement** of the function body, where it parses as a directive prologue. Only if the rule still fires, add this block to `eslint.config.js` before the `prettier` entry:

```js
{
  files: ['src/core/hot/**/*.ts', 'src/render/geometry.ts'],
  rules: {
    // 'worklet' directives are Reanimated markers, not dead expressions.
    '@typescript-eslint/no-unused-expressions': 'off',
  },
},
```

- [ ] **Step 7: Commit**

```bash
git add src/core/hot/adjacency.ts src/core/hot/adjacency.test.ts
git commit -m "feat(core): add 8-way adjacency on flat cell indices"
```

---

### Task 3: Square-loop detection

**Files:**

- Create: `src/core/hot/closes-square.ts`, `src/core/hot/closes-square.test.ts`

**Interfaces:**

- Consumes: `rowOf`, `colOf` from `./adjacency`; `Chain`, `CellIndex` from `../types`.
- Produces: `closesSquare(chain: Chain, cell: CellIndex, cols: number): boolean` — evaluated _before_ the closing cell is appended. `formsSquareLoop(chain: Chain, cols: number): boolean` — evaluated on an already-sealed chain.

- [ ] **Step 1: Write the failing test**

Create `src/core/hot/closes-square.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { closesSquare, formsSquareLoop } from './closes-square';

const COLS = 6;
// The 2x2 block at rows 0-1, cols 0-1 is cells 0, 1, 7, 6.
const SQUARE = [0, 1, 7, 6];

describe('closesSquare', () => {
  it('is true when the last four cells form a 2x2 and the cell closes it', () => {
    expect(closesSquare(SQUARE, 0, COLS)).toBe(true);
  });

  it('is true when the square is at the tail of a long winding chain', () => {
    expect(closesSquare([14, 8, 2, ...SQUARE], 0, COLS)).toBe(true);
  });

  it('is false when the closing cell is not the 4th from the end', () => {
    expect(closesSquare([0, 1, 7, 6, 12], 0, COLS)).toBe(false);
    expect(closesSquare([0, 1, 7], 0, COLS)).toBe(false);
  });

  it('is false when the last four cells are not a 2x2 block', () => {
    expect(closesSquare([0, 1, 2, 3], 0, COLS)).toBe(false); // straight four
    expect(closesSquare([0, 1, 2, 8], 0, COLS)).toBe(false); // an L
  });

  it('is false when the four cells span more than one row or column', () => {
    expect(closesSquare([0, 1, 7, 13], 0, COLS)).toBe(false);
  });

  it('is false for a chain shorter than four', () => {
    expect(closesSquare([0, 1], 0, COLS)).toBe(false);
    expect(closesSquare([], 0, COLS)).toBe(false);
  });
});

describe('formsSquareLoop', () => {
  it('is true for a sealed chain', () => {
    expect(formsSquareLoop([...SQUARE, 0], COLS)).toBe(true);
  });

  it('is true for a sealed chain with a winding lead-in', () => {
    expect(formsSquareLoop([14, 8, 2, ...SQUARE, 0], COLS)).toBe(true);
  });

  // The reason the closing cell is appended at all.
  it('is false for a chain that merely ends on four square-shaped cells', () => {
    expect(formsSquareLoop(SQUARE, COLS)).toBe(false);
  });

  it('is false when the repeated cell does not bound a 2x2', () => {
    expect(formsSquareLoop([0, 1, 2, 3, 0], COLS)).toBe(false);
  });

  it('is false for a chain shorter than five', () => {
    expect(formsSquareLoop(SQUARE, COLS)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./closes-square`.

- [ ] **Step 3: Create `src/core/hot/closes-square.ts`**

```ts
import type { CellIndex, Chain } from '../types';
import { colOf, rowOf } from './adjacency';

/** Four distinct cells whose bounding box is exactly 2x2 are exactly a 2x2 block. */
function isSquareBlock(
  a: CellIndex,
  b: CellIndex,
  c: CellIndex,
  d: CellIndex,
  cols: number,
): boolean {
  'worklet';
  if (a === b || a === c || a === d || b === c || b === d || c === d) {
    return false;
  }
  const r0 = rowOf(a, cols);
  const r1 = rowOf(b, cols);
  const r2 = rowOf(c, cols);
  const r3 = rowOf(d, cols);
  if (Math.max(r0, r1, r2, r3) - Math.min(r0, r1, r2, r3) !== 1) {
    return false;
  }
  const c0 = colOf(a, cols);
  const c1 = colOf(b, cols);
  const c2 = colOf(c, cols);
  const c3 = colOf(d, cols);
  return Math.max(c0, c1, c2, c3) - Math.min(c0, c1, c2, c3) === 1;
}

/**
 * True when appending `cell` would close a 2x2 loop. Checked before the
 * append, so the square is the chain's last four entries.
 */
export function closesSquare(chain: Chain, cell: CellIndex, cols: number): boolean {
  'worklet';
  const start = chain.length - 4;
  if (start < 0 || chain[start] !== cell) {
    return false;
  }
  return isSquareBlock(chain[start], chain[start + 1], chain[start + 2], chain[start + 3], cols);
}

/**
 * True when a committed chain is sealed: its last entry repeats its
 * 5th-from-last, and those four cells form a 2x2. This self-describing form
 * is what tells a real loop closure apart from a chain that merely ends on
 * four square-shaped cells.
 */
export function formsSquareLoop(chain: Chain, cols: number): boolean {
  'worklet';
  const len = chain.length;
  if (len < 5 || chain[len - 1] !== chain[len - 5]) {
    return false;
  }
  return isSquareBlock(chain[len - 5], chain[len - 4], chain[len - 3], chain[len - 2], cols);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 11 tests green.

- [ ] **Step 5: Verify lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/hot/closes-square.ts src/core/hot/closes-square.test.ts
git commit -m "feat(core): add 2x2 square loop detection"
```

---

### Task 4: Straight-line detection

Every chain step is already an adjacency step, so "all steps share one delta" is exactly equivalent to "straight in one of the 8 directions" — one O(n) pass, no geometry. The minimum length is a parameter rather than a constant, because it is the dial most likely to move after playtest.

**Files:**

- Create: `src/core/hot/is-line.ts`, `src/core/hot/is-line.test.ts`

**Interfaces:**

- Consumes: `rowOf`, `colOf` from `./adjacency`; `Chain` from `../types`.
- Produces: `isCollinearRun(chain: Chain, cols: number, minLength: number): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/core/hot/is-line.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isCollinearRun } from './is-line';

const COLS = 6;
const MIN = 5;

/** Build a straight run of `length` cells from (row, col) stepping by (dRow, dCol). */
const run = (row: number, col: number, dRow: number, dCol: number, length: number): number[] => {
  const cells: number[] = [];
  for (let i = 0; i < length; i++) {
    cells.push((row + dRow * i) * COLS + (col + dCol * i));
  }
  return cells;
};

describe('isCollinearRun', () => {
  it('is true for a horizontal run of five', () => {
    expect(isCollinearRun(run(2, 0, 0, 1, 5), COLS, MIN)).toBe(true);
  });

  it('is true for a vertical run of five', () => {
    expect(isCollinearRun(run(0, 3, 1, 0, 5), COLS, MIN)).toBe(true);
  });

  it('is true for all eight directions', () => {
    const deltas = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    for (const [dRow, dCol] of deltas) {
      const startRow = dRow >= 0 ? 0 : 5;
      const startCol = dCol >= 0 ? 0 : 5;
      expect(isCollinearRun(run(startRow, startCol, dRow, dCol, 5), COLS, MIN)).toBe(true);
    }
  });

  it('is true for a run longer than the minimum', () => {
    expect(isCollinearRun(run(0, 0, 0, 1, 6), COLS, MIN)).toBe(true);
  });

  it('is false for a straight run of only four', () => {
    expect(isCollinearRun(run(2, 0, 0, 1, 4), COLS, MIN)).toBe(false);
  });

  it('is false when the run bends at the sixth dot', () => {
    expect(isCollinearRun([...run(0, 0, 0, 1, 5), 11], COLS, MIN)).toBe(false);
  });

  it('is false for a chain shorter than the minimum', () => {
    expect(isCollinearRun([], COLS, MIN)).toBe(false);
    expect(isCollinearRun([0], COLS, MIN)).toBe(false);
    expect(isCollinearRun([0, 1], COLS, MIN)).toBe(false);
  });

  it('honours a different minimum length', () => {
    expect(isCollinearRun(run(2, 0, 0, 1, 4), COLS, 4)).toBe(true);
    expect(isCollinearRun(run(2, 0, 0, 1, 5), COLS, 6)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./is-line`.

- [ ] **Step 3: Create `src/core/hot/is-line.ts`**

```ts
import type { Chain } from '../types';
import { colOf, rowOf } from './adjacency';

/**
 * True when the chain is at least `minLength` long and every step shares one
 * (dRow, dCol). Because each step is already an adjacency step, that is
 * exactly "straight along one of the 8 directions".
 */
export function isCollinearRun(chain: Chain, cols: number, minLength: number): boolean {
  'worklet';
  if (chain.length < minLength || chain.length < 2) {
    return false;
  }
  const dRow = rowOf(chain[1], cols) - rowOf(chain[0], cols);
  const dCol = colOf(chain[1], cols) - colOf(chain[0], cols);
  for (let i = 2; i < chain.length; i++) {
    if (rowOf(chain[i], cols) - rowOf(chain[i - 1], cols) !== dRow) {
      return false;
    }
    if (colOf(chain[i], cols) - colOf(chain[i - 1], cols) !== dCol) {
      return false;
    }
  }
  return true;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 8 tests green.

- [ ] **Step 5: Verify lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/hot/is-line.ts src/core/hot/is-line.test.ts
git commit -m "feat(core): add straight-line run detection"
```

---

### Task 5: Chain append verdicts

The order of checks is load-bearing: the retrace check must precede the revisit check, or backing up would read as an illegal revisit.

**Files:**

- Create: `src/core/hot/can-append.ts`, `src/core/hot/can-append.test.ts`

**Interfaces:**

- Consumes: `areAdjacent` from `./adjacency`; `closesSquare`, `formsSquareLoop` from `./closes-square`; `AppendVerdict`, `Board`, `CellIndex`, `Chain` from `../types`.
- Produces: `canAppend(chain: Chain, cell: CellIndex, board: Board, cols: number): AppendVerdict`.

- [ ] **Step 1: Write the failing test**

Create `src/core/hot/can-append.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canAppend } from './can-append';

const COLS = 4;
const R = 0;
const G = 1;

// 4x4, row-major:
//  R R G R
//  R R G R
//  G G R R
//  R G R G
const BOARD = [R, R, G, R, R, R, G, R, G, G, R, R, R, G, R, G];

describe('canAppend', () => {
  it('appends into an empty chain', () => {
    expect(canAppend([], 0, BOARD, COLS)).toBe('append');
  });

  it('rejects the cell the chain already ends on', () => {
    expect(canAppend([0, 1], 1, BOARD, COLS)).toBe('reject');
  });

  it('undoes when retracing onto the second-to-last dot', () => {
    expect(canAppend([0, 1], 0, BOARD, COLS)).toBe('undo');
  });

  it('rejects a non-adjacent cell', () => {
    expect(canAppend([0], 12, BOARD, COLS)).toBe('reject');
  });

  it('rejects a cell that wraps a row edge', () => {
    // cell 3 is row 0 col 3; cell 4 is row 1 col 0. Both R, but not adjacent.
    expect(canAppend([3], 4, BOARD, COLS)).toBe('reject');
  });

  it('rejects a colour mismatch', () => {
    expect(canAppend([0], 2, BOARD, COLS)).toBe('reject');
  });

  it('appends an adjacent same-colour cell', () => {
    expect(canAppend([0], 1, BOARD, COLS)).toBe('append');
  });

  it('appends diagonally', () => {
    expect(canAppend([0], 5, BOARD, COLS)).toBe('append');
  });

  it('closes the square on a revisit that completes a 2x2', () => {
    // Cells 0,1,5,4 are the R block at rows 0-1, cols 0-1.
    expect(canAppend([0, 1, 5, 4], 0, BOARD, COLS)).toBe('close-square');
  });

  it('rejects a revisit that does not complete a 2x2', () => {
    expect(canAppend([0, 1, 5], 0, BOARD, COLS)).toBe('reject');
  });

  it('rejects every append once the chain is sealed', () => {
    const sealed = [0, 1, 5, 4, 0];
    expect(canAppend(sealed, 8, BOARD, COLS)).toBe('reject');
    expect(canAppend(sealed, 1, BOARD, COLS)).toBe('reject');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./can-append`.

- [ ] **Step 3: Create `src/core/hot/can-append.ts`**

```ts
import type { AppendVerdict, Board, CellIndex, Chain } from '../types';
import { areAdjacent } from './adjacency';
import { closesSquare, formsSquareLoop } from './closes-square';

/**
 * Decides what a drag onto `cell` means. Check order matters: the retrace
 * case must be settled before the revisit case, or backing up would read as
 * an illegal revisit.
 */
export function canAppend(
  chain: Chain,
  cell: CellIndex,
  board: Board,
  cols: number,
): AppendVerdict {
  'worklet';
  const len = chain.length;
  if (len === 0) {
    return 'append';
  }
  // A sealed chain accepts nothing further until release.
  if (formsSquareLoop(chain, cols)) {
    return 'reject';
  }
  if (cell === chain[len - 1]) {
    return 'reject';
  }
  if (len >= 2 && cell === chain[len - 2]) {
    return 'undo';
  }
  if (!areAdjacent(cell, chain[len - 1], cols)) {
    return 'reject';
  }
  if (board[cell] !== board[chain[0]]) {
    return 'reject';
  }
  for (let i = 0; i < len; i++) {
    if (chain[i] === cell) {
      return closesSquare(chain, cell, cols) ? 'close-square' : 'reject';
    }
  }
  return 'append';
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 11 tests green.

- [ ] **Step 5: Verify lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/hot/can-append.ts src/core/hot/can-append.test.ts
git commit -m "feat(core): add chain append verdicts"
```

---

### Task 6: Chain classification

**Files:**

- Create: `src/core/resolve/classify-chain.ts`, `src/core/resolve/classify-chain.test.ts`

**Interfaces:**

- Consumes: `formsSquareLoop` from `../hot/closes-square`; `isCollinearRun` from `../hot/is-line`; `Chain`, `ChainKind` from `../types`.
- Produces: `classifyChain(chain: Chain, cols: number, lineLength: number): ChainKind`.

- [ ] **Step 1: Write the failing test**

Create `src/core/resolve/classify-chain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyChain } from './classify-chain';

const COLS = 6;
const LINE = 5;

describe('classifyChain', () => {
  it('classifies a short chain as plain', () => {
    expect(classifyChain([0, 1, 7], COLS, LINE)).toBe('plain');
  });

  it('classifies a sealed chain as square-loop', () => {
    expect(classifyChain([0, 1, 7, 6, 0], COLS, LINE)).toBe('square-loop');
  });

  it('classifies a straight run of five as line', () => {
    expect(classifyChain([12, 13, 14, 15, 16], COLS, LINE)).toBe('line');
  });

  it('classifies a diagonal run of five as line', () => {
    expect(classifyChain([0, 7, 14, 21, 28], COLS, LINE)).toBe('line');
  });

  // Guards the reason the closing cell is appended.
  it('classifies four square-shaped cells without a revisit as plain', () => {
    expect(classifyChain([0, 1, 7, 6], COLS, LINE)).toBe('plain');
  });

  it('classifies a bent five-chain as plain', () => {
    expect(classifyChain([12, 13, 14, 15, 21], COLS, LINE)).toBe('plain');
  });

  it('prefers square-loop over line', () => {
    // A sealed chain can never be collinear, but precedence is defensive.
    expect(classifyChain([0, 1, 7, 6, 0], COLS, LINE)).toBe('square-loop');
  });

  it('honours a raised line length', () => {
    expect(classifyChain([12, 13, 14, 15, 16], COLS, 6)).toBe('plain');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./classify-chain`.

- [ ] **Step 3: Create `src/core/resolve/classify-chain.ts`**

```ts
import { formsSquareLoop } from '../hot/closes-square';
import { isCollinearRun } from '../hot/is-line';
import type { Chain, ChainKind } from '../types';

/** Precedence is square-loop > line > plain. */
export function classifyChain(chain: Chain, cols: number, lineLength: number): ChainKind {
  if (formsSquareLoop(chain, cols)) {
    return 'square-loop';
  }
  if (isCollinearRun(chain, cols, lineLength)) {
    return 'line';
  }
  return 'plain';
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 8 tests green.

- [ ] **Step 5: Verify lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/resolve/classify-chain.ts src/core/resolve/classify-chain.test.ts
git commit -m "feat(core): add chain classification"
```

---

### Task 7: Board fixtures and cleared-cell collection

Gravity and sweep assertions are unreadable as raw number arrays and obvious as text grids, so the fixture helper lands here with the first test that needs it. `COLOR_CHARS` is `'RGB'`, matching the three configured colours and the palette added in Task 15.

**Files:**

- Create: `src/core/test-support/board-fixture.ts`, `src/core/test-support/board-fixture.test.ts`
- Create: `src/core/resolve/collect-cleared.ts`, `src/core/resolve/collect-cleared.test.ts`

**Interfaces:**

- Consumes: `Board`, `Chain`, `ChainKind`, `ClearedCell`, `Color`, `EMPTY` from `../types`.
- Produces: `COLOR_CHARS`, `parseBoard(art: string): { board: Color[]; rows: number; cols: number }`, `formatBoard(board: Board, cols: number): string`; `collectCleared(board: Board, chain: Chain, kind: ChainKind): ClearedCell[]`.

- [ ] **Step 1: Create `src/core/test-support/board-fixture.ts`**

```ts
import type { Board, Color } from '../types';
import { EMPTY } from '../types';

/** Colour index 0..2 maps to these characters in board art. Matches the palette. */
export const COLOR_CHARS = 'RGB';

/** Parse board art like "RGB/BRG/GBR" into a flat board. "." is an empty cell. */
export function parseBoard(art: string): { board: Color[]; rows: number; cols: number } {
  const lines = art.trim().split('/');
  const cols = lines[0].length;
  const board: Color[] = [];
  for (const line of lines) {
    if (line.length !== cols) {
      throw new Error(`ragged board row: "${line}" (expected ${cols} cells)`);
    }
    for (const char of line) {
      if (char === '.') {
        board.push(EMPTY);
        continue;
      }
      const color = COLOR_CHARS.indexOf(char);
      if (color < 0) {
        throw new Error(`unknown colour character: "${char}"`);
      }
      board.push(color);
    }
  }
  return { board, rows: lines.length, cols };
}

/** Inverse of parseBoard, for readable assertion diffs. */
export function formatBoard(board: Board, cols: number): string {
  const lines: string[] = [];
  for (let row = 0; row * cols < board.length; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
      const color = board[row * cols + col];
      line += color === EMPTY ? '.' : COLOR_CHARS[color];
    }
    lines.push(line);
  }
  return lines.join('/');
}
```

- [ ] **Step 2: Write the fixture test**

Create `src/core/test-support/board-fixture.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatBoard, parseBoard } from './board-fixture';

describe('parseBoard', () => {
  it('parses dimensions and colours', () => {
    const { board, rows, cols } = parseBoard('RGB/BRG');
    expect(rows).toBe(2);
    expect(cols).toBe(3);
    expect(board).toEqual([0, 1, 2, 2, 0, 1]);
  });

  it('parses "." as empty', () => {
    expect(parseBoard('R./.G').board).toEqual([0, -1, -1, 1]);
  });

  it('throws on a ragged board', () => {
    expect(() => parseBoard('RGB/RG')).toThrow(/ragged/);
  });

  it('throws on an unknown colour character', () => {
    expect(() => parseBoard('RGX')).toThrow(/unknown colour/);
  });
});

describe('formatBoard', () => {
  it('round-trips with parseBoard', () => {
    const art = 'RGBR/BRGB/GBRG';
    const { board, cols } = parseBoard(art);
    expect(formatBoard(board, cols)).toBe(art);
  });

  it('renders empty cells as "."', () => {
    expect(formatBoard([0, -1, -1, 1], 2)).toBe('R./.G');
  });
});
```

- [ ] **Step 3: Run the fixture test to verify it passes**

```bash
npm test
```

Expected: PASS — 6 new tests green.

- [ ] **Step 4: Write the failing collect-cleared test**

Create `src/core/resolve/collect-cleared.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseBoard } from '../test-support/board-fixture';
import { collectCleared } from './collect-cleared';

// 4x4:
//  R R G R
//  R R G R
//  G G R R
//  R G R G
const { board } = parseBoard('RRGR/RRGR/GGRR/RGRG');

describe('collectCleared', () => {
  it('clears exactly the chain for a plain chain', () => {
    expect(collectCleared(board, [0, 1, 5], 'plain')).toEqual([
      { index: 0, color: 0, reason: 'chain' },
      { index: 1, color: 0, reason: 'chain' },
      { index: 5, color: 0, reason: 'chain' },
    ]);
  });

  it('keeps chain cells in drag order', () => {
    const cleared = collectCleared(board, [5, 4, 0, 1], 'plain');
    expect(cleared.map((c) => c.index)).toEqual([5, 4, 0, 1]);
  });

  it('sweeps every cell of the colour for a square-loop', () => {
    const cleared = collectCleared(board, [0, 1, 5, 4, 0], 'square-loop');
    // Every R on the board: 0,1,3,4,5,7,10,11,12,14
    expect(cleared.map((c) => c.index).sort((a, b) => a - b)).toEqual([
      0, 1, 3, 4, 5, 7, 10, 11, 12, 14,
    ]);
  });

  it("counts a sealed chain's repeated closing cell only once", () => {
    const indices = collectCleared(board, [0, 1, 5, 4, 0], 'square-loop').map((c) => c.index);
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('tags chain cells first in drag order, then sweep cells row-major', () => {
    const cleared = collectCleared(board, [0, 1, 5, 4, 0], 'square-loop');
    expect(cleared.filter((c) => c.reason === 'chain').map((c) => c.index)).toEqual([0, 1, 5, 4]);
    expect(cleared.filter((c) => c.reason === 'color-sweep').map((c) => c.index)).toEqual([
      3, 7, 10, 11, 12, 14,
    ]);
    expect(cleared.slice(0, 4).every((c) => c.reason === 'chain')).toBe(true);
  });

  it('sweeps for a line the same way it does for a loop', () => {
    const cleared = collectCleared(board, [2, 6], 'line');
    // Every G: 2,6,8,9,13,15
    expect(cleared.map((c) => c.index).sort((a, b) => a - b)).toEqual([2, 6, 8, 9, 13, 15]);
    expect(cleared.some((c) => c.reason === 'color-sweep')).toBe(true);
  });
});
```

Note: `collectCleared` trusts the caller's `kind` and takes the colour from `chain[0]`. Validating that the chain is legal is `resolveChain`'s job (Task 11), which is why the `line` case above can use a two-cell chain.

- [ ] **Step 5: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./collect-cleared`.

- [ ] **Step 6: Create `src/core/resolve/collect-cleared.ts`**

```ts
import type { Board, Chain, ChainKind, ClearedCell } from '../types';

/**
 * Chain cells first, in drag order; then, for a sweep, every remaining cell
 * of that colour row-major. The ordering is contractual — the render layer
 * staggers its pop animations along it.
 */
export function collectCleared(board: Board, chain: Chain, kind: ChainKind): ClearedCell[] {
  const color = board[chain[0]];
  const seen = new Set<number>();
  const cleared: ClearedCell[] = [];

  for (const index of chain) {
    if (seen.has(index)) {
      continue;
    }
    seen.add(index);
    cleared.push({ index, color, reason: 'chain' });
  }

  if (kind === 'plain') {
    return cleared;
  }

  for (let index = 0; index < board.length; index++) {
    if (board[index] !== color || seen.has(index)) {
      continue;
    }
    seen.add(index);
    cleared.push({ index, color, reason: 'color-sweep' });
  }
  return cleared;
}
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 6 collect-cleared tests green.

- [ ] **Step 8: Verify lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/core/test-support src/core/resolve/collect-cleared.ts src/core/resolve/collect-cleared.test.ts
git commit -m "feat(core): add board fixtures and cleared-cell collection"
```

---

### Task 8: Gravity

**Files:**

- Create: `src/core/resolve/gravity.ts`, `src/core/resolve/gravity.test.ts`

**Interfaces:**

- Consumes: `Board`, `ClearedCell`, `Color`, `FallMove`, `EMPTY` from `../types`.
- Produces: `applyGravity(board: Board, cleared: readonly ClearedCell[], rows: number, cols: number): { board: Color[]; falls: FallMove[] }`.

- [ ] **Step 1: Write the failing test**

Create `src/core/resolve/gravity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatBoard, parseBoard } from '../test-support/board-fixture';
import type { ClearedCell } from '../types';
import { applyGravity } from './gravity';

const clear = (indices: number[]): ClearedCell[] =>
  indices.map((index) => ({ index, color: 0, reason: 'chain' as const }));

describe('applyGravity', () => {
  it('drops survivors into the holes below them', () => {
    const { board, rows, cols } = parseBoard('RG/BG/RB');
    const result = applyGravity(board, clear([4]), rows, cols);
    expect(formatBoard(result.board, cols)).toBe('.G/RG/BB');
  });

  it('reports each fall as an explicit from -> to', () => {
    const { board, rows, cols } = parseBoard('RG/BG/RB');
    const result = applyGravity(board, clear([4]), rows, cols);
    expect(result.falls).toEqual([
      { from: 2, to: 4 },
      { from: 0, to: 2 },
    ]);
  });

  it('never reports a fall where from equals to', () => {
    const { board, rows, cols } = parseBoard('RG/BG/RB');
    const result = applyGravity(board, clear([0]), rows, cols);
    expect(result.falls).toEqual([]);
    expect(formatBoard(result.board, cols)).toBe('.G/BG/RB');
  });

  it('handles several holes in one column', () => {
    // Left column top-to-bottom is R, B, R, G. Clearing rows 1 and 3 leaves
    // R and R, which settle into the bottom two rows.
    const { board, rows, cols } = parseBoard('RG/BG/RB/GB');
    const result = applyGravity(board, clear([2, 6]), rows, cols);
    expect(formatBoard(result.board, cols)).toBe('.G/.G/RB/RB');
  });

  it('leaves a fully cleared column empty', () => {
    const { board, rows, cols } = parseBoard('RG/RG/RB');
    const result = applyGravity(board, clear([0, 2, 4]), rows, cols);
    expect(formatBoard(result.board, cols)).toBe('.G/.G/.B');
  });

  it('orders falls per column bottom-up, columns left to right', () => {
    const { board, rows, cols } = parseBoard('RGB/RGB/RGB');
    const result = applyGravity(board, clear([6, 7, 8]), rows, cols);
    expect(result.falls).toEqual([
      { from: 3, to: 6 },
      { from: 0, to: 3 },
      { from: 4, to: 7 },
      { from: 1, to: 4 },
      { from: 5, to: 8 },
      { from: 2, to: 5 },
    ]);
  });

  it('does not mutate the input board', () => {
    const { board, rows, cols } = parseBoard('RG/BG/RB');
    const before = [...board];
    applyGravity(board, clear([4]), rows, cols);
    expect(board).toEqual(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./gravity`.

- [ ] **Step 3: Create `src/core/resolve/gravity.ts`**

```ts
import type { Board, ClearedCell, Color, FallMove } from '../types';
import { EMPTY } from '../types';

/**
 * Punches out the cleared cells, then settles each column downward.
 * Falls are emitted per column bottom-up, columns left to right, so the
 * render layer can stagger them straight from the array order.
 */
export function applyGravity(
  board: Board,
  cleared: readonly ClearedCell[],
  rows: number,
  cols: number,
): { board: Color[]; falls: FallMove[] } {
  const next: Color[] = [...board];
  for (const cell of cleared) {
    next[cell.index] = EMPTY;
  }

  const falls: FallMove[] = [];
  for (let col = 0; col < cols; col++) {
    let writeRow = rows - 1;
    for (let row = rows - 1; row >= 0; row--) {
      const from = row * cols + col;
      if (next[from] === EMPTY) {
        continue;
      }
      const to = writeRow * cols + col;
      if (from !== to) {
        falls.push({ from, to });
        next[to] = next[from];
        next[from] = EMPTY;
      }
      writeRow--;
    }
  }
  return { board: next, falls };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 7 tests green.

- [ ] **Step 5: Verify lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/resolve/gravity.ts src/core/resolve/gravity.test.ts
git commit -m "feat(core): add gravity with explicit fall moves"
```

---

### Task 9: Refill

**Files:**

- Create: `src/core/resolve/refill.ts`, `src/core/resolve/refill.test.ts`

**Interfaces:**

- Consumes: `nextInt` from `../rng`; `Board`, `Color`, `Spawn`, `EMPTY` from `../types`.
- Produces: `refill(board: Board, rows: number, cols: number, colors: number, rngState: number): { board: Color[]; spawns: Spawn[]; rngState: number }`.

- [ ] **Step 1: Write the failing test**

Create `src/core/resolve/refill.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseBoard } from '../test-support/board-fixture';
import { EMPTY } from '../types';
import { refill } from './refill';

// Left column has two holes (rows 0 and 1); right column has one (row 0).
const ART = '../.G/RB';

describe('refill', () => {
  it('fills every empty cell', () => {
    const { board, rows, cols } = parseBoard(ART);
    expect(refill(board, rows, cols, 3, 2026).board.includes(EMPTY)).toBe(false);
  });

  it('leaves settled cells untouched', () => {
    const { board, rows, cols } = parseBoard(ART);
    const result = refill(board, rows, cols, 3, 2026);
    expect(result.board[3]).toBe(1); // the G at row 1, col 1
    expect(result.board[4]).toBe(0); // the R at row 2, col 0
    expect(result.board[5]).toBe(2); // the B at row 2, col 1
  });

  it('emits one spawn per empty cell', () => {
    const { board, rows, cols } = parseBoard(ART);
    expect(refill(board, rows, cols, 3, 2026).spawns).toHaveLength(3);
  });

  it('assigns heightAbove counting up from the lowest new dot', () => {
    const { board, rows, cols } = parseBoard(ART);
    const byCell = new Map(
      refill(board, rows, cols, 3, 2026).spawns.map((s) => [s.to, s.heightAbove]),
    );
    expect(byCell.get(2)).toBe(1); // left column, row 1 -> lands first
    expect(byCell.get(0)).toBe(2); // left column, row 0 -> starts higher
    expect(byCell.get(1)).toBe(1); // right column, single hole
  });

  it('consumes randomness columns left to right, rows top to bottom', () => {
    const { board, rows, cols } = parseBoard(ART);
    expect(refill(board, rows, cols, 3, 2026).spawns.map((s) => s.to)).toEqual([0, 2, 1]);
  });

  it('records the spawned colour on the board', () => {
    const { board, rows, cols } = parseBoard(ART);
    const result = refill(board, rows, cols, 3, 2026);
    for (const spawn of result.spawns) {
      expect(result.board[spawn.to]).toBe(spawn.color);
    }
  });

  it('only spawns colours within range', () => {
    const { board, rows, cols } = parseBoard(ART);
    for (const spawn of refill(board, rows, cols, 3, 2026).spawns) {
      expect(spawn.color).toBeGreaterThanOrEqual(0);
      expect(spawn.color).toBeLessThan(3);
    }
  });

  it('is reproducible for the same seed', () => {
    const { board, rows, cols } = parseBoard(ART);
    expect(refill(board, rows, cols, 3, 777)).toEqual(refill(board, rows, cols, 3, 777));
  });

  it('differs for a different seed', () => {
    const { board, rows, cols } = parseBoard('..../..../..../....');
    expect(refill(board, rows, cols, 3, 1).board).not.toEqual(
      refill(board, rows, cols, 3, 2).board,
    );
  });

  it('is a no-op on a full board', () => {
    const { board, rows, cols } = parseBoard('RG/BG/RB');
    const result = refill(board, rows, cols, 3, 777);
    expect(result.spawns).toEqual([]);
    expect(result.board).toEqual([...board]);
    expect(result.rngState).toBe(777);
  });

  it('does not mutate the input board', () => {
    const { board, rows, cols } = parseBoard(ART);
    const before = [...board];
    refill(board, rows, cols, 3, 777);
    expect(board).toEqual(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./refill`.

- [ ] **Step 3: Create `src/core/resolve/refill.ts`**

```ts
import { nextInt } from '../rng';
import type { Board, Color, Spawn } from '../types';
import { EMPTY } from '../types';

/**
 * Fills the holes gravity left at the top of each column.
 *
 * Randomness is consumed columns left to right, rows top to bottom. That
 * order is contractual: change it and every seeded test changes with it.
 */
export function refill(
  board: Board,
  rows: number,
  cols: number,
  colors: number,
  rngState: number,
): { board: Color[]; spawns: Spawn[]; rngState: number } {
  const next: Color[] = [...board];
  const spawns: Spawn[] = [];
  let state = rngState;

  for (let col = 0; col < cols; col++) {
    let holes = 0;
    for (let row = 0; row < rows; row++) {
      if (next[row * cols + col] === EMPTY) {
        holes++;
      }
    }
    for (let row = 0; row < holes; row++) {
      const step = nextInt(state, colors);
      state = step.state;
      const to = row * cols + col;
      next[to] = step.value;
      spawns.push({ to, color: step.value, heightAbove: holes - row });
    }
  }

  return { board: next, spawns, rngState: state };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 11 tests green.

- [ ] **Step 5: Verify lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/resolve/refill.ts src/core/resolve/refill.test.ts
git commit -m "feat(core): add seeded refill with spawn heights"
```

---

### Task 10: Scoring

**Files:**

- Create: `src/core/resolve/scoring.ts`, `src/core/resolve/scoring.test.ts`

**Interfaces:**

- Consumes: `ChainKind`, `GameConfig` from `../types`; `DEFAULT_CONFIG` from `../config`.
- Produces: `scoreFor(kind: ChainKind, clearedCount: number, config: GameConfig): number`.

- [ ] **Step 1: Write the failing test**

Create `src/core/resolve/scoring.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { scoreFor } from './scoring';

describe('scoreFor', () => {
  it('scores a plain chain on the triangular curve', () => {
    expect(scoreFor('plain', 3, DEFAULT_CONFIG)).toBe(60);
    expect(scoreFor('plain', 4, DEFAULT_CONFIG)).toBe(100);
    expect(scoreFor('plain', 5, DEFAULT_CONFIG)).toBe(150);
  });

  it('makes each extra dot worth more than the last', () => {
    const gaps: number[] = [];
    for (let n = 3; n < 12; n++) {
      gaps.push(scoreFor('plain', n + 1, DEFAULT_CONFIG) - scoreFor('plain', n, DEFAULT_CONFIG));
    }
    expect(gaps.every((gap, i) => i === 0 || gap > gaps[i - 1])).toBe(true);
  });

  it('scores a square-loop per dot swept, with the multiplier', () => {
    expect(scoreFor('square-loop', 8, DEFAULT_CONFIG)).toBe(240);
  });

  it('scores a line the same way as a square-loop', () => {
    expect(scoreFor('line', 8, DEFAULT_CONFIG)).toBe(scoreFor('square-loop', 8, DEFAULT_CONFIG));
  });

  it('makes a sweep beat a plain chain of the same size', () => {
    expect(scoreFor('square-loop', 5, DEFAULT_CONFIG)).toBeGreaterThan(
      scoreFor('plain', 5, DEFAULT_CONFIG),
    );
  });

  it('honours config overrides', () => {
    const config = { ...DEFAULT_CONFIG, baseScore: 1, sweepMultiplier: 10 };
    expect(scoreFor('plain', 4, config)).toBe(10);
    expect(scoreFor('line', 4, config)).toBe(40);
  });

  it('returns an integer', () => {
    for (let n = 3; n < 40; n++) {
      expect(Number.isInteger(scoreFor('plain', n, DEFAULT_CONFIG))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./scoring`.

- [ ] **Step 3: Create `src/core/resolve/scoring.ts`**

```ts
import type { ChainKind, GameConfig } from '../types';

/**
 * A plain chain of n dots scores on the triangular curve, so each extra dot
 * is worth more than the last. A sweep scores per dot removed board-wide,
 * multiplied. `clearedCount` is always the deduplicated cleared-cell count,
 * which for a plain chain is exactly its distinct length.
 */
export function scoreFor(kind: ChainKind, clearedCount: number, config: GameConfig): number {
  if (kind === 'plain') {
    return (config.baseScore * (clearedCount * (clearedCount + 1))) / 2;
  }
  return config.baseScore * clearedCount * config.sweepMultiplier;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 7 tests green.

- [ ] **Step 5: Verify lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/resolve/scoring.ts src/core/resolve/scoring.test.ts
git commit -m "feat(core): add triangular chain scoring and sweep bonuses"
```

---

### Task 11: The resolveChain orchestrator

**Files:**

- Create: `src/core/resolve/resolve-chain.ts`, `src/core/resolve/resolve-chain.test.ts`

**Interfaces:**

- Consumes: `areAdjacent` from `../hot/adjacency`; `classifyChain`, `collectCleared`, `applyGravity`, `refill`, `scoreFor` from siblings; `Board`, `Chain`, `GameState`, `Resolution`, `EMPTY` from `../types`.
- Produces: `resolveChain(state: GameState, chain: Chain): Resolution | null`.

- [ ] **Step 1: Write the failing test**

Create `src/core/resolve/resolve-chain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { parseBoard } from '../test-support/board-fixture';
import type { GameState } from '../types';
import { EMPTY } from '../types';
import { resolveChain } from './resolve-chain';

// 4x4:
//  R R G R
//  R R G R
//  G G R R
//  R G R G
const ART = 'RRGR/RRGR/GGRR/RGRG';

const stateFrom = (art: string, seed = 2026): GameState => {
  const { board, rows, cols } = parseBoard(art);
  return { config: { ...DEFAULT_CONFIG, rows, cols }, board, score: 0, rngState: seed };
};

describe('resolveChain', () => {
  it('returns null for a chain shorter than minChain', () => {
    expect(resolveChain(stateFrom(ART), [])).toBeNull();
    expect(resolveChain(stateFrom(ART), [0])).toBeNull();
    expect(resolveChain(stateFrom(ART), [0, 1])).toBeNull();
  });

  it('returns null for a chain with a non-adjacent step', () => {
    expect(resolveChain(stateFrom(ART), [0, 12, 13])).toBeNull();
  });

  it('returns null for a chain that wraps a row edge', () => {
    expect(resolveChain(stateFrom(ART), [3, 4, 5])).toBeNull();
  });

  it('returns null for a chain of mixed colours', () => {
    expect(resolveChain(stateFrom(ART), [1, 2, 6])).toBeNull();
  });

  it('resolves a plain chain', () => {
    const result = resolveChain(stateFrom(ART), [0, 1, 5]);
    expect(result?.kind).toBe('plain');
    expect(result?.color).toBe(0);
    expect(result?.cleared).toHaveLength(3);
    expect(result?.scoreDelta).toBe(60);
  });

  it('resolves a square-loop into a board-wide sweep', () => {
    const result = resolveChain(stateFrom(ART), [0, 1, 5, 4, 0]);
    expect(result?.kind).toBe('square-loop');
    expect(result?.cleared).toHaveLength(10); // ten R cells
    expect(result?.scoreDelta).toBe(300);
  });

  it('resolves a straight run of five into a sweep', () => {
    const result = resolveChain(stateFrom('RRRRR'), [0, 1, 2, 3, 4]);
    expect(result?.kind).toBe('line');
    expect(result?.cleared).toHaveLength(5);
    expect(result?.scoreDelta).toBe(150);
  });

  it('returns a board with no empty cells', () => {
    expect(resolveChain(stateFrom(ART), [0, 1, 5, 4, 0])?.board.includes(EMPTY)).toBe(false);
  });

  it('spawns exactly as many dots as it cleared', () => {
    const result = resolveChain(stateFrom(ART), [0, 1, 5, 4, 0]);
    expect(result?.spawns).toHaveLength(result?.cleared.length ?? -1);
  });

  it('never emits a fall where from equals to', () => {
    const result = resolveChain(stateFrom(ART), [0, 1, 5, 4, 0]);
    expect(result?.falls.every((f) => f.from !== f.to)).toBe(true);
  });

  it('emits duplicate-free cleared cells', () => {
    const indices =
      resolveChain(stateFrom(ART), [0, 1, 5, 4, 0])?.cleared.map((c) => c.index) ?? [];
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('advances the rng state', () => {
    expect(resolveChain(stateFrom(ART, 555), [0, 1, 5])?.rngState).not.toBe(555);
  });

  it('is reproducible for the same seed', () => {
    expect(resolveChain(stateFrom(ART, 99), [0, 1, 5])).toEqual(
      resolveChain(stateFrom(ART, 99), [0, 1, 5]),
    );
  });

  it('does not mutate the input state', () => {
    const state = stateFrom(ART);
    const before = [...state.board];
    resolveChain(state, [0, 1, 5, 4, 0]);
    expect(state.board).toEqual(before);
    expect(state.score).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./resolve-chain`.

- [ ] **Step 3: Create `src/core/resolve/resolve-chain.ts`**

```ts
import { areAdjacent } from '../hot/adjacency';
import type { Board, Chain, GameState, Resolution } from '../types';
import { EMPTY } from '../types';
import { classifyChain } from './classify-chain';
import { collectCleared } from './collect-cleared';
import { applyGravity } from './gravity';
import { refill } from './refill';
import { scoreFor } from './scoring';

/**
 * Defensive validation. The gesture layer should never hand over a chain
 * that fails this, but the chain arrives from a worklet-owned array and a
 * corrupted one must not be able to corrupt the board.
 */
function isCommittable(board: Board, chain: Chain, cols: number, minChain: number): boolean {
  if (chain.length < minChain) {
    return false;
  }
  const color = board[chain[0]];
  if (color === EMPTY || color === undefined) {
    return false;
  }
  for (let i = 0; i < chain.length; i++) {
    if (board[chain[i]] !== color) {
      return false;
    }
    if (i > 0 && !areAdjacent(chain[i - 1], chain[i], cols)) {
      return false;
    }
  }
  return true;
}

/**
 * classify -> collect -> gravity -> refill -> score.
 * Returns null when the chain cannot be committed; the input layer treats
 * null as a cancel. Nothing here throws.
 */
export function resolveChain(state: GameState, chain: Chain): Resolution | null {
  const { board, config } = state;
  const { rows, cols } = config;

  if (!isCommittable(board, chain, cols, config.minChain)) {
    return null;
  }

  const kind = classifyChain(chain, cols, config.lineLength);
  const color = board[chain[0]];
  const cleared = collectCleared(board, chain, kind);
  const settled = applyGravity(board, cleared, rows, cols);
  const filled = refill(settled.board, rows, cols, config.colors, state.rngState);

  return {
    kind,
    color,
    cleared,
    falls: settled.falls,
    spawns: filled.spawns,
    scoreDelta: scoreFor(kind, cleared.length, config),
    board: filled.board,
    rngState: filled.rngState,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 14 tests green.

Note on the sealed-chain case: `[0, 1, 5, 4, 0]` has length 5 but only 4 distinct cells. `isCommittable` checks raw length against `minChain` (3), which the sealed chain clears comfortably. A sealed chain always has at least 5 entries, so no sealed chain can ever be rejected for length.

- [ ] **Step 5: Verify lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/resolve/resolve-chain.ts src/core/resolve/resolve-chain.test.ts
git commit -m "feat(core): add resolveChain orchestrator"
```

---

### Task 12: Deadlock detection

Read "Two findings that shaped this plan" above before writing this. A pair-based check would be a constant `true` under 3 colours and 8-way adjacency, so this is a flood fill over same-colour 8-connected components, comparing component size against `minChain`. Any connected component with ≥ 3 vertices contains a 3-vertex path, so component size is exactly the right measure for "a legal chain exists".

The deadlocked fixtures below were found by exhaustive search (4×4) and annealing (6×6) and verified against this exact algorithm. Do not substitute hand-invented boards — deadlocked three-colour boards are extremely hard to construct by eye.

**Files:**

- Create: `src/core/deadlock.ts`, `src/core/deadlock.test.ts`

**Interfaces:**

- Consumes: `Board` from `./types`.
- Produces: `hasLegalMove(board: Board, rows: number, cols: number, minChain: number): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/core/deadlock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hasLegalMove } from './deadlock';
import { parseBoard } from './test-support/board-fixture';

const check = (art: string, minChain = 3): boolean => {
  const { board, rows, cols } = parseBoard(art);
  return hasLegalMove(board, rows, cols, minChain);
};

describe('hasLegalMove', () => {
  it('finds a horizontal triple', () => {
    expect(check('RRR/GBG/BGB')).toBe(true);
  });

  it('finds a diagonal triple', () => {
    expect(check('RGB/GRG/BGR')).toBe(true);
  });

  it('is false when the best run is a pair', () => {
    expect(check('RR/GB')).toBe(false);
  });

  it('counts the same board as legal when minChain is 2', () => {
    expect(check('RR/GB', 2)).toBe(true);
  });

  // Found by exhaustive search over all 3^16 four-by-four three-colour boards.
  it('is false on a known deadlocked 4x4', () => {
    expect(check('BGGR/RRBR/BGBG/RGRR')).toBe(false);
  });

  // Found by annealing search. Deadlock on 6x6 is real but astronomically
  // rare: zero of 2,000,000 uniformly random boards were deadlocked.
  it('is false on a known deadlocked 6x6', () => {
    expect(check('BBRBRR/GRGGBG/GBBRRG/RRGGBB/GBBRRG/GRGGBG')).toBe(false);
  });

  it('is true on the shared 4x4 fixture', () => {
    expect(check('RRGR/RRGR/GGRR/RGRG')).toBe(true);
  });

  it('does not treat a row wrap as adjacency', () => {
    // Cells 1 and 2 are both R but sit at (0,1) and (1,0) — not adjacent.
    expect(check('GR/RG', 2)).toBe(true); // the diagonal G-G and R-R do touch
    expect(check('GR/BG', 3)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./deadlock`.

- [ ] **Step 3: Create `src/core/deadlock.ts`**

```ts
import type { Board } from './types';

/**
 * True when some same-colour, 8-connected component is at least `minChain`
 * cells large — which is exactly the condition for a legal chain to exist,
 * because any connected component with n vertices contains a path of n
 * vertices when n is small, and always contains one of length minChain when
 * its size reaches minChain.
 *
 * This must NOT be written as a scan for adjacent same-colour pairs. Under
 * 8-way adjacency the four cells of any 2x2 block are pairwise adjacent, so
 * with three colours the pigeonhole principle guarantees a same-colour pair
 * on every board — a pair-based check would always return true.
 */
export function hasLegalMove(board: Board, rows: number, cols: number, minChain: number): boolean {
  const seen = new Array<boolean>(rows * cols).fill(false);

  for (let start = 0; start < board.length; start++) {
    if (seen[start]) {
      continue;
    }
    const color = board[start];
    const stack = [start];
    seen[start] = true;
    let size = 0;

    while (stack.length > 0) {
      const cell = stack.pop() as number;
      size++;
      if (size >= minChain) {
        return true;
      }
      const row = Math.floor(cell / cols);
      const col = cell % cols;
      for (let dRow = -1; dRow <= 1; dRow++) {
        for (let dCol = -1; dCol <= 1; dCol++) {
          if (dRow === 0 && dCol === 0) {
            continue;
          }
          const nRow = row + dRow;
          const nCol = col + dCol;
          if (nRow < 0 || nCol < 0 || nRow >= rows || nCol >= cols) {
            continue;
          }
          const neighbour = nRow * cols + nCol;
          if (!seen[neighbour] && board[neighbour] === color) {
            seen[neighbour] = true;
            stack.push(neighbour);
          }
        }
      }
    }
  }
  return false;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 8 tests green.

- [ ] **Step 5: Verify lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors. If sonarjs flags the nested loops for cognitive complexity, extract the neighbour walk into a module-private `pushNeighbours(stack, seen, board, cell, rows, cols, color)` helper rather than disabling the rule.

- [ ] **Step 6: Commit**

```bash
git add src/core/deadlock.ts src/core/deadlock.test.ts
git commit -m "feat(core): add component-based deadlock detection"
```

---

### Task 13: Shuffle

**Files:**

- Create: `src/core/shuffle.ts`, `src/core/shuffle.test.ts`

**Interfaces:**

- Consumes: `nextInt` from `./rng`; `hasLegalMove` from `./deadlock`; `Board`, `CellMove`, `Color`, `GameConfig` from `./types`.
- Produces: `shuffleBoard(board: Board, config: GameConfig, rngState: number): { board: Color[]; moves: CellMove[]; rngState: number }`.

- [ ] **Step 1: Write the failing test**

Create `src/core/shuffle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './config';
import { hasLegalMove } from './deadlock';
import { shuffleBoard } from './shuffle';
import { parseBoard } from './test-support/board-fixture';

const DEADLOCKED_6X6 = 'BBRBRR/GRGGBG/GBBRRG/RRGGBB/GBBRRG/GRGGBG';

const configFor = (rows: number, cols: number) => ({ ...DEFAULT_CONFIG, rows, cols });

const tally = (board: readonly number[]): number[] => {
  const counts = [0, 0, 0];
  for (const color of board) {
    counts[color]++;
  }
  return counts;
};

describe('shuffleBoard', () => {
  it('preserves the colour counts exactly', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    const result = shuffleBoard(board, configFor(rows, cols), 2026);
    expect(tally(result.board)).toEqual(tally(board));
  });

  it('produces a board with a legal move', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    const result = shuffleBoard(board, configFor(rows, cols), 2026);
    expect(hasLegalMove(result.board, rows, cols, DEFAULT_CONFIG.minChain)).toBe(true);
  });

  it('actually rearranges the deadlocked board', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    const result = shuffleBoard(board, configFor(rows, cols), 2026);
    expect(result.board).not.toEqual([...board]);
  });

  it('emits a move for every dot that changed cell', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    const result = shuffleBoard(board, configFor(rows, cols), 2026);
    for (const move of result.moves) {
      expect(move.from).not.toBe(move.to);
      expect(result.board[move.to]).toBe(board[move.from]);
    }
  });

  it('emits no move for a dot that stayed put', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    const result = shuffleBoard(board, configFor(rows, cols), 2026);
    const movedTo = new Set(result.moves.map((m) => m.to));
    for (let cell = 0; cell < board.length; cell++) {
      if (!movedTo.has(cell)) {
        expect(result.board[cell]).toBe(board[cell]);
      }
    }
  });

  it('is reproducible for the same seed', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    expect(shuffleBoard(board, configFor(rows, cols), 42)).toEqual(
      shuffleBoard(board, configFor(rows, cols), 42),
    );
  });

  it('advances the rng state', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    expect(shuffleBoard(board, configFor(rows, cols), 42).rngState).not.toBe(42);
  });

  it('does not mutate the input board', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    const before = [...board];
    shuffleBoard(board, configFor(rows, cols), 42);
    expect(board).toEqual(before);
  });

  it('falls back to a fresh deal when a permutation cannot be made legal', () => {
    // A single colour can never be deadlocked, so this exercises the happy
    // path of the fallback contract: the result is always legal and full.
    const { board, rows, cols } = parseBoard('RRR/RRR/RRR');
    const result = shuffleBoard(board, configFor(rows, cols), 7);
    expect(hasLegalMove(result.board, rows, cols, DEFAULT_CONFIG.minChain)).toBe(true);
    expect(result.board).toHaveLength(9);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./shuffle`.

- [ ] **Step 3: Create `src/core/shuffle.ts`**

```ts
import { hasLegalMove } from './deadlock';
import { nextInt } from './rng';
import type { Board, CellMove, Color, GameConfig } from './types';

/** Enough attempts that exhausting them is a bug, few enough to never hang. */
const MAX_ATTEMPTS = 100;

function shuffled(
  colors: readonly Color[],
  rngState: number,
): { colors: Color[]; rngState: number } {
  const next = [...colors];
  let state = rngState;
  for (let i = next.length - 1; i > 0; i--) {
    const step = nextInt(state, i + 1);
    state = step.state;
    const j = step.value;
    const swap = next[i];
    next[i] = next[j];
    next[j] = swap;
  }
  return { colors: next, rngState: state };
}

function dealt(
  count: number,
  colors: number,
  rngState: number,
): { colors: Color[]; rngState: number } {
  const next: Color[] = [];
  let state = rngState;
  for (let i = 0; i < count; i++) {
    const step = nextInt(state, colors);
    state = step.state;
    next.push(step.value);
  }
  return { colors: next, rngState: state };
}

/**
 * Rearranges the dots already on the board until a legal chain exists,
 * preserving the colour balance the player worked into it.
 *
 * `moves` lets the render layer slide dots to their new cells instead of
 * teleporting them, so a shuffle reads as a rearrangement rather than a wipe.
 * Each move pairs a source cell with a destination that now holds the colour
 * that used to sit there; since a permutation has many valid pairings, the
 * pairing chosen is the greedy one that keeps as many dots in place as
 * possible.
 */
export function shuffleBoard(
  board: Board,
  config: GameConfig,
  rngState: number,
): { board: Color[]; moves: CellMove[]; rngState: number } {
  const { rows, cols, minChain } = config;
  let state = rngState;
  let next: Color[] = [...board];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = shuffled(board, state);
    state = result.rngState;
    next = result.colors;
    if (hasLegalMove(next, rows, cols, minChain)) {
      return { board: next, moves: pairMoves(board, next), rngState: state };
    }
  }

  // Unreachable in practice. A permutation of a real board essentially always
  // has a legal move; if the caller somehow hands over a board that cannot be
  // permuted into one, deal fresh rather than return a dead board.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = dealt(board.length, config.colors, state);
    state = result.rngState;
    next = result.colors;
    if (hasLegalMove(next, rows, cols, minChain)) {
      break;
    }
  }
  return { board: next, moves: pairMoves(board, next), rngState: state };
}

/**
 * Pairs each destination cell whose colour changed with a source cell that
 * held that colour and is not staying put. Cells whose colour is unchanged
 * emit no move, so untouched dots do not animate.
 */
function pairMoves(before: Board, after: readonly Color[]): CellMove[] {
  const available = new Map<Color, number[]>();
  for (let cell = 0; cell < before.length; cell++) {
    if (before[cell] === after[cell]) {
      continue;
    }
    const bucket = available.get(before[cell]);
    if (bucket === undefined) {
      available.set(before[cell], [cell]);
    } else {
      bucket.push(cell);
    }
  }

  const moves: CellMove[] = [];
  for (let cell = 0; cell < after.length; cell++) {
    if (before[cell] === after[cell]) {
      continue;
    }
    const bucket = available.get(after[cell]);
    const from = bucket?.pop();
    if (from !== undefined) {
      moves.push({ from, to: cell });
    }
  }
  return moves;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 9 tests green.

- [ ] **Step 5: Verify lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/shuffle.ts src/core/shuffle.test.ts
git commit -m "feat(core): add board shuffle for deadlocked boards"
```

---

### Task 14: Game state transitions

**Files:**

- Create: `src/core/game.ts`, `src/core/game.test.ts`

**Interfaces:**

- Consumes: `nextInt` from `./rng`; `Color`, `GameConfig`, `GameState`, `Resolution` from `./types`.
- Produces: `newGame(config: GameConfig, seed: number): GameState`, `applyResolution(state: GameState, resolution: Resolution): GameState`.

- [ ] **Step 1: Write the failing test**

Create `src/core/game.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './config';
import { hasLegalMove } from './deadlock';
import { applyResolution, newGame } from './game';
import { resolveChain } from './resolve/resolve-chain';
import { EMPTY } from './types';

describe('newGame', () => {
  it('builds a full board of the configured size', () => {
    const state = newGame(DEFAULT_CONFIG, 2026);
    expect(state.board).toHaveLength(36);
    expect(state.board.includes(EMPTY)).toBe(false);
  });

  it('only uses colours within range', () => {
    for (const color of newGame(DEFAULT_CONFIG, 2026).board) {
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThan(DEFAULT_CONFIG.colors);
    }
  });

  it('starts at zero score', () => {
    expect(newGame(DEFAULT_CONFIG, 2026).score).toBe(0);
  });

  it('deals an opening board that has a legal move', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = newGame(DEFAULT_CONFIG, seed);
      expect(hasLegalMove(state.board, 6, 6, DEFAULT_CONFIG.minChain)).toBe(true);
    }
  });

  it('is reproducible for the same seed', () => {
    expect(newGame(DEFAULT_CONFIG, 42)).toEqual(newGame(DEFAULT_CONFIG, 42));
  });

  it('differs for a different seed', () => {
    expect(newGame(DEFAULT_CONFIG, 1).board).not.toEqual(newGame(DEFAULT_CONFIG, 2).board);
  });

  it('throws on a board smaller than 2x2', () => {
    expect(() => newGame({ ...DEFAULT_CONFIG, rows: 1 }, 1)).toThrow(/rows/);
    expect(() => newGame({ ...DEFAULT_CONFIG, cols: 1 }, 1)).toThrow(/cols/);
  });

  it('throws on fewer than two colours', () => {
    expect(() => newGame({ ...DEFAULT_CONFIG, colors: 1 }, 1)).toThrow(/colors/);
  });

  it('throws on a minimum chain below two', () => {
    expect(() => newGame({ ...DEFAULT_CONFIG, minChain: 1 }, 1)).toThrow(/minChain/);
  });
});

describe('applyResolution', () => {
  it('folds board, score, and rng state forward', () => {
    const state = newGame(DEFAULT_CONFIG, 2026);
    const cols = DEFAULT_CONFIG.cols;

    // Find any legal three-in-a-row to commit.
    let chain: number[] | null = null;
    for (let i = 0; i < state.board.length && chain === null; i++) {
      if (
        (i % cols) + 2 < cols &&
        state.board[i + 1] === state.board[i] &&
        state.board[i + 2] === state.board[i]
      ) {
        chain = [i, i + 1, i + 2];
      }
    }
    if (chain === null) {
      throw new Error('seed 2026 was expected to deal a horizontal triple');
    }

    const resolution = resolveChain(state, chain);
    if (resolution === null) {
      throw new Error('expected a resolution');
    }

    const nextState = applyResolution(state, resolution);
    expect(nextState.board).toEqual(resolution.board);
    expect(nextState.score).toBe(resolution.scoreDelta);
    expect(nextState.rngState).toBe(resolution.rngState);
    expect(nextState.config).toBe(state.config);
  });

  it('accumulates score across moves', () => {
    const state = newGame(DEFAULT_CONFIG, 2026);
    const fake = {
      kind: 'plain' as const,
      color: 0,
      cleared: [],
      falls: [],
      spawns: [],
      scoreDelta: 120,
      board: state.board,
      rngState: 5,
    };
    expect(applyResolution(applyResolution(state, fake), fake).score).toBe(240);
  });

  it('does not mutate the previous state', () => {
    const state = newGame(DEFAULT_CONFIG, 2026);
    const before = [...state.board];
    applyResolution(state, {
      kind: 'plain',
      color: 0,
      cleared: [],
      falls: [],
      spawns: [],
      scoreDelta: 10,
      board: [],
      rngState: 1,
    });
    expect(state.board).toEqual(before);
    expect(state.score).toBe(0);
  });
});
```

If the "horizontal triple" search throws for seed 2026, pick another seed rather than weakening the assertion — a 6×6 three-colour board almost always contains one.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./game`.

- [ ] **Step 3: Create `src/core/game.ts`**

```ts
import { nextInt } from './rng';
import type { Color, GameConfig, GameState, Resolution } from './types';

/**
 * Builds an opening board from a seed. Throws on invalid config: that is a
 * startup-time programmer error, not something reachable mid-drag.
 */
export function newGame(config: GameConfig, seed: number): GameState {
  if (config.rows < 2) {
    throw new Error(`config.rows must be at least 2, got ${config.rows}`);
  }
  if (config.cols < 2) {
    throw new Error(`config.cols must be at least 2, got ${config.cols}`);
  }
  if (config.colors < 2) {
    throw new Error(`config.colors must be at least 2, got ${config.colors}`);
  }
  if (config.minChain < 2) {
    throw new Error(`config.minChain must be at least 2, got ${config.minChain}`);
  }

  const board: Color[] = [];
  let state = seed;
  for (let i = 0; i < config.rows * config.cols; i++) {
    const step = nextInt(state, config.colors);
    state = step.state;
    board.push(step.value);
  }

  return { config, board, score: 0, rngState: state };
}

/** Folds a resolution into the next immutable game state. */
export function applyResolution(state: GameState, resolution: Resolution): GameState {
  return {
    config: state.config,
    board: resolution.board,
    score: state.score + resolution.scoreDelta,
    rngState: resolution.rngState,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 12 tests green.

- [ ] **Step 5: Verify the whole core gate**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all green.

- [ ] **Step 6: Verify the core is RN-free**

```bash
grep -rnE "(from|require\()\s*['\"](react-native|@shopify|expo|@expo)" src/core/ || echo "core is clean"
```

Expected: `core is clean`.

The pattern is anchored to `from`/`require(` deliberately. A bare `grep -rE "expo"` matches the substring inside every `export` line and reports the whole core as dirty.

- [ ] **Step 7: Commit**

```bash
git add src/core/game.ts src/core/game.test.ts
git commit -m "feat(core): add game state transitions"
```

---

## Phase 2 — Render foundation (Tasks 15–16)

### Task 15: Board geometry

Cell↔pixel math is pure arithmetic, so it is both worklet-safe and Vitest-testable. Putting it here rather than inline in the gesture handler is what pulls hit-testing inside the test boundary.

The board canvas is square and its own coordinate space: the origin is the canvas's top-left, so no offset terms are needed.

**Files:**

- Create: `src/render/geometry.ts`, `src/render/geometry.test.ts`
- Modify: `vitest.config.ts`

**Interfaces:**

- Consumes: `CellIndex`, `Spawn` from `../core/types`.
- Produces: `BoardLayout`; `makeLayout(rows: number, cols: number, boardSize: number, touchFraction?: number): BoardLayout`; `centerX(cell, layout): number`, `centerY(cell, layout): number`, `cellAtPoint(x, y, layout): CellIndex` (−1 for a miss), `moveOffsetX(from, to, layout): number`, `moveOffsetY(from, to, layout): number`, `spawnOffsetY(to, heightAbove, layout): number`.

- [ ] **Step 1: Widen the Vitest include**

Replace `vitest.config.ts` with:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // src/core is RN-free by rule. src/render/geometry.ts is pure arithmetic
    // and is listed explicitly so the rest of src/render stays out of Vitest.
    include: ['src/core/**/*.test.ts', 'src/render/geometry.test.ts'],
  },
});
```

- [ ] **Step 2: Write the failing test**

Create `src/render/geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  cellAtPoint,
  centerX,
  centerY,
  makeLayout,
  moveOffsetX,
  moveOffsetY,
  spawnOffsetY,
} from './geometry';

// 4x4 board, 40px wide -> 10px cells, touch radius 4px.
const layout = makeLayout(4, 4, 40);

describe('makeLayout', () => {
  it('derives cell size and touch radius from the board size', () => {
    expect(layout.cellSize).toBe(10);
    expect(layout.touchRadius).toBeCloseTo(4);
  });
});

describe('centerX / centerY', () => {
  it('centres a cell in its square', () => {
    expect(centerX(0, layout)).toBe(5);
    expect(centerY(0, layout)).toBe(5);
    expect(centerX(5, layout)).toBe(15); // row 1, col 1
    expect(centerY(5, layout)).toBe(15);
    expect(centerX(15, layout)).toBe(35); // row 3, col 3
    expect(centerY(15, layout)).toBe(35);
  });
});

describe('cellAtPoint', () => {
  it('hits a cell at its exact centre', () => {
    expect(cellAtPoint(5, 5, layout)).toBe(0);
    expect(cellAtPoint(35, 5, layout)).toBe(3);
    expect(cellAtPoint(15, 25, layout)).toBe(9); // row 2, col 1
  });

  it('hits at the edge of the touch radius', () => {
    expect(cellAtPoint(5, 1, layout)).toBe(0); // exactly 4px above centre
  });

  it('misses in the dead zone between dots', () => {
    expect(cellAtPoint(1, 1, layout)).toBe(-1); // corner of cell 0, ~5.66px away
    expect(cellAtPoint(10, 10, layout)).toBe(-1); // the four-corner junction
  });

  it('misses off the board', () => {
    expect(cellAtPoint(-1, 5, layout)).toBe(-1);
    expect(cellAtPoint(5, -1, layout)).toBe(-1);
    expect(cellAtPoint(45, 5, layout)).toBe(-1);
    expect(cellAtPoint(5, 45, layout)).toBe(-1);
  });

  it('widens with the touch fraction', () => {
    // Point (2,2) is 4.24px from cell 0's centre at (5,5).
    expect(cellAtPoint(2, 2, layout)).toBe(-1); // default radius 4 -> miss
    const generous = makeLayout(4, 4, 40, 0.5);
    expect(cellAtPoint(2, 2, generous)).toBe(0); // radius 5 -> hit
    expect(cellAtPoint(1, 1, generous)).toBe(-1); // 5.66px away -> still a miss
  });
});

describe('moveOffsetX / moveOffsetY', () => {
  it('reports where a dot came from, in pixels', () => {
    expect(moveOffsetY(2, 10, layout)).toBe(-20); // fell two rows
    expect(moveOffsetX(2, 10, layout)).toBe(0); // same column
    expect(moveOffsetX(0, 3, layout)).toBe(-30); // slid three columns right
  });

  it('is zero for a dot that did not move', () => {
    expect(moveOffsetX(7, 7, layout)).toBe(0);
    expect(moveOffsetY(7, 7, layout)).toBe(0);
  });
});

describe('spawnOffsetY', () => {
  it('starts every dot in a column the same distance above the board', () => {
    // A column with two holes: both new dots fall exactly two cells.
    expect(spawnOffsetY(0, 2, layout)).toBe(-20); // lands row 0, heightAbove 2
    expect(spawnOffsetY(4, 1, layout)).toBe(-20); // lands row 1, heightAbove 1
  });

  it('scales with the number of holes', () => {
    expect(spawnOffsetY(0, 1, layout)).toBe(-10);
    expect(spawnOffsetY(0, 4, layout)).toBe(-40);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./geometry`.

- [ ] **Step 4: Create `src/render/geometry.ts`**

```ts
import type { CellIndex } from '../core/types';

export type BoardLayout = {
  readonly rows: number;
  readonly cols: number;
  readonly cellSize: number;
  /** A touch registers on a dot only within this distance of its centre. */
  readonly touchRadius: number;
};

/**
 * The dead zone the touch radius creates is deliberate. Without it, dragging
 * diagonally past a corner silently links a dot the player never aimed at.
 * Expect to tune `touchFraction` on device.
 */
export function makeLayout(
  rows: number,
  cols: number,
  boardSize: number,
  touchFraction = 0.4,
): BoardLayout {
  const cellSize = boardSize / cols;
  return { rows, cols, cellSize, touchRadius: cellSize * touchFraction };
}

export function centerX(cell: CellIndex, layout: BoardLayout): number {
  'worklet';
  return ((cell % layout.cols) + 0.5) * layout.cellSize;
}

export function centerY(cell: CellIndex, layout: BoardLayout): number {
  'worklet';
  return (Math.floor(cell / layout.cols) + 0.5) * layout.cellSize;
}

/** The cell under a point, or -1 when the point is off-board or between dots. */
export function cellAtPoint(x: number, y: number, layout: BoardLayout): CellIndex {
  'worklet';
  const col = Math.floor(x / layout.cellSize);
  const row = Math.floor(y / layout.cellSize);
  if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) {
    return -1;
  }
  const cell = row * layout.cols + col;
  const dx = x - centerX(cell, layout);
  const dy = y - centerY(cell, layout);
  return dx * dx + dy * dy <= layout.touchRadius * layout.touchRadius ? cell : -1;
}

/** Horizontal distance from a dot's old cell to its new one, in pixels. */
export function moveOffsetX(from: CellIndex, to: CellIndex, layout: BoardLayout): number {
  'worklet';
  return ((from % layout.cols) - (to % layout.cols)) * layout.cellSize;
}

/** Vertical distance from a dot's old cell to its new one, in pixels. */
export function moveOffsetY(from: CellIndex, to: CellIndex, layout: BoardLayout): number {
  'worklet';
  return (Math.floor(from / layout.cols) - Math.floor(to / layout.cols)) * layout.cellSize;
}

/**
 * Where a spawned dot starts, relative to the cell it lands in.
 *
 * Every dot refilling one column falls the same distance: the number of holes
 * in that column, which `refill` encodes as heightAbove + the landing row.
 * That makes the incoming dots a stack that slides down as one, rather than a
 * set of dots each appearing at a different height.
 */
export function spawnOffsetY(to: CellIndex, heightAbove: number, layout: BoardLayout): number {
  'worklet';
  return -(heightAbove + Math.floor(to / layout.cols)) * layout.cellSize;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 12 tests green.

The hit-test cases are exact, not approximate: with a 10px cell, cell 0's centre is `(5, 5)`, the default radius is `4`, and the generous radius is `5`. Point `(2, 2)` is `sqrt(3² + 3²) ≈ 4.24px` away — outside 4, inside 5. Point `(1, 1)` is `sqrt(4² + 4²) ≈ 5.66px` away — outside both.

- [ ] **Step 6: Verify lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/render/geometry.ts src/render/geometry.test.ts vitest.config.ts
git commit -m "feat(render): add board geometry and touch hit-testing"
```

---

### Task 16: Palette and a static board

By the end of this task the game screen shows a real, correctly coloured 6×6 board. Nothing moves yet.

**Files:**

- Create: `src/render/palette.ts`, `src/render/dot-layer.tsx`, `src/render/board-canvas.tsx`
- Modify: `src/app/game.tsx`

**Interfaces:**

- Consumes: `BoardLayout`, `centerX`, `centerY` from `./geometry`; `Board` from `../core/types`; `DEFAULT_CONFIG`, `newGame` from `../core`.
- Produces: `DOT_COLORS`, `BOARD_BACKGROUND`, `SCREEN_BACKGROUND`, `TEXT_COLOR`; `DotLayer` (props `{ board, layout, anim? }` — `anim` arrives in Task 17); `BoardCanvas` (props `{ board, layout }`).

- [ ] **Step 1: Create `src/render/palette.ts`**

```ts
/** Index-aligned with the colour ids the core deals: 0 = R, 1 = G, 2 = B. */
export const DOT_COLORS = ['#ff4d5e', '#3ddc84', '#4f8cff'] as const;

export const SCREEN_BACKGROUND = '#0f1117';
export const BOARD_BACKGROUND = '#171a23';
export const TEXT_COLOR = '#e8eaf0';
export const LINK_COLOR = '#e8eaf0';

/** Dot radius as a fraction of the cell, leaving a visible gap between dots. */
export const DOT_RADIUS_RATIO = 0.34;

export function colorFor(colorId: number): string {
  'worklet';
  return DOT_COLORS[colorId] ?? DOT_COLORS[0];
}
```

- [ ] **Step 2: Create `src/render/dot-layer.tsx`**

```tsx
import { Circle } from '@shopify/react-native-skia';
import type { Board } from '../core/types';
import { centerX, centerY, type BoardLayout } from './geometry';
import { colorFor, DOT_RADIUS_RATIO } from './palette';

type DotLayerProps = {
  readonly board: Board;
  readonly layout: BoardLayout;
};

/**
 * Colours come from React props rather than a shared value: the board only
 * changes once per commit, so a re-render is cheaper and far simpler than
 * animating colour on the UI thread.
 */
export function DotLayer({ board, layout }: DotLayerProps) {
  return (
    <>
      {board.map((colorId, cell) => (
        <Circle
          key={cell}
          cx={centerX(cell, layout)}
          cy={centerY(cell, layout)}
          r={DOT_RADIUS_RATIO * layout.cellSize}
          color={colorFor(colorId)}
        />
      ))}
    </>
  );
}
```

- [ ] **Step 3: Create `src/render/board-canvas.tsx`**

```tsx
import { Canvas } from '@shopify/react-native-skia';
import type { Board } from '../core/types';
import { DotLayer } from './dot-layer';
import type { BoardLayout } from './geometry';

type BoardCanvasProps = {
  readonly board: Board;
  readonly layout: BoardLayout;
};

/**
 * The canvas is exactly the board, so canvas coordinates and the geometry
 * module's coordinates are the same space — the gesture handler needs no
 * offset correction.
 */
export function BoardCanvas({ board, layout }: BoardCanvasProps) {
  const size = layout.cellSize * layout.cols;
  return (
    <Canvas style={{ width: size, height: layout.cellSize * layout.rows }}>
      <DotLayer board={board} layout={layout} />
    </Canvas>
  );
}
```

- [ ] **Step 4: Replace `src/app/game.tsx`**

```tsx
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { DEFAULT_CONFIG } from '../core/config';
import { newGame } from '../core/game';
import { BoardCanvas } from '../render/board-canvas';
import { makeLayout } from '../render/geometry';
import { SCREEN_BACKGROUND, TEXT_COLOR } from '../render/palette';

export default function GameScreen() {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 32, 400);
  const layout = useMemo(
    () => makeLayout(DEFAULT_CONFIG.rows, DEFAULT_CONFIG.cols, boardSize),
    [boardSize],
  );
  const state = useMemo(() => newGame(DEFAULT_CONFIG, 2026), []);

  return (
    <View style={styles.container}>
      <BoardCanvas board={state.board} layout={layout} />
      <Link href="/" style={styles.link}>
        Back
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: SCREEN_BACKGROUND,
  },
  link: { fontSize: 18, color: TEXT_COLOR },
});
```

- [ ] **Step 5: Verify lint + typecheck + tests**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all green.

- [ ] **Step 6: Verify on device**

```bash
npm run ios
```

Expected: the game screen shows a 6×6 grid of evenly spaced red, green, and blue dots on a dark background. Confirm the board is square and does not overflow the screen edge on the narrowest device you have.

- [ ] **Step 7: Commit**

```bash
git add src/render/palette.ts src/render/dot-layer.tsx src/render/board-canvas.tsx src/app/game.tsx
git commit -m "feat(render): draw the board as a skia canvas"
```

---

## Phase 3 — Interaction (Tasks 17–19)

### Task 17: Board animation

Two shared progress values drive everything. Per-dot tweens would mean 144 shared values and hooks inside a loop; instead each dot reads a shared array of start offsets and interpolates against one clock.

`moveT` runs 0 → 1 and every dot sits at `offset × (1 − moveT)`, so a dot is never _moved_ — it is placed where it belongs and drawn at where it came from. `clearT` runs 0 → 1 with the stagger folded into the first half of its timeline, so the pop duration is fixed no matter how many dots clear. That keeps the total resolve inside the 450ms budget: 200ms clear + 220ms settle.

**Files:**

- Create: `src/effects/use-board-animation.ts`
- Modify: `src/render/dot-layer.tsx`, `src/render/board-canvas.tsx`

**Interfaces:**

- Consumes: `ClearedCell` from `../core/types`; `BoardLayout` from `../render/geometry`.
- Produces: `BoardAnimation`; `useBoardAnimation(cellCount: number): BoardAnimation`; `playClear(anim, cleared, onDone)`, `playMove(anim, offsetX, offsetY, duration, onDone)`, `resetClear(anim)`; `CLEAR_MS`, `FALL_MS`, `SHUFFLE_MS`.

- [ ] **Step 1: Create `src/effects/use-board-animation.ts`**

```ts
import { runOnJS, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import type { ClearedCell } from '../core/types';

export const CLEAR_MS = 200;
export const FALL_MS = 220;
export const SHUFFLE_MS = 260;

/** Fraction of the clear timeline spent staggering starts, not shrinking. */
export const STAGGER_SPAN = 0.5;

export type BoardAnimation = {
  /** Per-cell pixel offset a dot is drawn at when moveT is 0. */
  readonly offsetX: SharedValue<number[]>;
  readonly offsetY: SharedValue<number[]>;
  /** 0 = dots at their start offsets, 1 = settled. */
  readonly moveT: SharedValue<number>;
  /** Per-cell stagger rank while clearing; -1 means the dot is not clearing. */
  readonly clearRank: SharedValue<number[]>;
  /** How many ranks the current clear spans; never 0. */
  readonly clearSpan: SharedValue<number>;
  /** 0 -> 1 across the whole clear, stagger included. */
  readonly clearT: SharedValue<number>;
  /** Colour id to emphasise while a sweep is armed; -1 means none. */
  readonly highlight: SharedValue<number>;
};

export function useBoardAnimation(cellCount: number): BoardAnimation {
  return {
    offsetX: useSharedValue<number[]>(new Array(cellCount).fill(0)),
    offsetY: useSharedValue<number[]>(new Array(cellCount).fill(0)),
    moveT: useSharedValue(1),
    clearRank: useSharedValue<number[]>(new Array(cellCount).fill(-1)),
    clearSpan: useSharedValue(1),
    clearT: useSharedValue(0),
    highlight: useSharedValue(-1),
  };
}

/**
 * Shrinks the cleared dots away, staggered along the order `Resolution`
 * guarantees: chain cells in drag order, then sweep cells row-major.
 */
export function playClear(
  anim: BoardAnimation,
  cleared: readonly ClearedCell[],
  onDone: () => void,
): void {
  const ranks = new Array<number>(anim.clearRank.value.length).fill(-1);
  cleared.forEach((cell, rank) => {
    ranks[cell.index] = rank;
  });
  anim.clearRank.value = ranks;
  anim.clearSpan.value = Math.max(cleared.length, 1);
  anim.clearT.value = 0;
  anim.clearT.value = withTiming(1, { duration: CLEAR_MS }, (finished) => {
    'worklet';
    if (finished === true) {
      runOnJS(onDone)();
    }
  });
}

/** Clears the pop state so every dot draws at full size again. */
export function resetClear(anim: BoardAnimation): void {
  anim.clearRank.value = new Array<number>(anim.clearRank.value.length).fill(-1);
  anim.clearSpan.value = 1;
  anim.clearT.value = 0;
}

/**
 * Places every dot at its start offset, then slides them all home together.
 * Offsets are set before moveT so a dot never renders at its destination for
 * a frame first.
 */
export function playMove(
  anim: BoardAnimation,
  offsetX: number[],
  offsetY: number[],
  duration: number,
  onDone: () => void,
): void {
  anim.offsetX.value = offsetX;
  anim.offsetY.value = offsetY;
  anim.moveT.value = 0;
  anim.moveT.value = withTiming(1, { duration }, (finished) => {
    'worklet';
    if (finished === true) {
      runOnJS(onDone)();
    }
  });
}
```

- [ ] **Step 2: Replace `src/render/dot-layer.tsx`**

```tsx
import { Circle } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { BoardAnimation } from '../effects/use-board-animation';
import { STAGGER_SPAN } from '../effects/use-board-animation';
import type { Board } from '../core/types';
import { centerX, centerY, type BoardLayout } from './geometry';
import { colorFor, DOT_RADIUS_RATIO } from './palette';

/** How much a dot swells while its colour is armed for a sweep. */
const HIGHLIGHT_SCALE = 1.12;

type DotProps = {
  readonly cell: number;
  readonly colorId: number;
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
};

function Dot({ cell, colorId, layout, anim }: DotProps) {
  const cx = useDerivedValue(
    () => centerX(cell, layout) + anim.offsetX.value[cell] * (1 - anim.moveT.value),
  );
  const cy = useDerivedValue(
    () => centerY(cell, layout) + anim.offsetY.value[cell] * (1 - anim.moveT.value),
  );
  const radius = useDerivedValue(() => {
    const base =
      DOT_RADIUS_RATIO * layout.cellSize * (anim.highlight.value === colorId ? HIGHLIGHT_SCALE : 1);
    const rank = anim.clearRank.value[cell];
    if (rank < 0) {
      return base;
    }
    const start = (rank / anim.clearSpan.value) * STAGGER_SPAN;
    const local = (anim.clearT.value - start) / (1 - STAGGER_SPAN);
    return base * (1 - Math.min(Math.max(local, 0), 1));
  });

  return <Circle cx={cx} cy={cy} r={radius} color={colorFor(colorId)} />;
}

type DotLayerProps = {
  readonly board: Board;
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
};

/**
 * Colours come from React props rather than a shared value: the board only
 * changes once per commit, so a re-render is cheaper and far simpler than
 * animating colour on the UI thread. Positions and size come from shared
 * values, because those change every frame.
 */
export function DotLayer({ board, layout, anim }: DotLayerProps) {
  return (
    <>
      {board.map((colorId, cell) => (
        <Dot key={cell} cell={cell} colorId={colorId} layout={layout} anim={anim} />
      ))}
    </>
  );
}
```

- [ ] **Step 3: Update `src/render/board-canvas.tsx` to pass `anim` through**

Replace the file with:

```tsx
import { Canvas } from '@shopify/react-native-skia';
import type { Board } from '../core/types';
import type { BoardAnimation } from '../effects/use-board-animation';
import { DotLayer } from './dot-layer';
import type { BoardLayout } from './geometry';

type BoardCanvasProps = {
  readonly board: Board;
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
};

/**
 * The canvas is exactly the board, so canvas coordinates and the geometry
 * module's coordinates are the same space — the gesture handler needs no
 * offset correction.
 */
export function BoardCanvas({ board, layout, anim }: BoardCanvasProps) {
  return (
    <Canvas style={{ width: layout.cellSize * layout.cols, height: layout.cellSize * layout.rows }}>
      <DotLayer board={board} layout={layout} anim={anim} />
    </Canvas>
  );
}
```

- [ ] **Step 4: Update `src/app/game.tsx` to construct the animation**

Add these two imports:

```tsx
import { useBoardAnimation } from '../effects/use-board-animation';
```

Inside `GameScreen`, after `layout` and before the return:

```tsx
const anim = useBoardAnimation(DEFAULT_CONFIG.rows * DEFAULT_CONFIG.cols);
```

And pass it to the canvas:

```tsx
<BoardCanvas board={state.board} layout={layout} anim={anim} />
```

- [ ] **Step 5: Verify lint + typecheck + tests**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all green.

- [ ] **Step 6: Verify on device**

```bash
npm run ios
```

Expected: the board looks exactly as it did at the end of Task 16 — `moveT` starts at 1 and `clearRank` is all −1, so every dot draws settled and full-size. A visible change here means the interpolation is wrong; fix it before moving on.

- [ ] **Step 7: Commit**

```bash
git add src/effects/use-board-animation.ts src/render/dot-layer.tsx src/render/board-canvas.tsx src/app/game.tsx
git commit -m "feat(effects): add shared-value board animation"
```

---

### Task 18: Gesture and the live chain

By the end of this task the chain draws under the player's finger and follows the rules — but releasing does nothing yet.

**Files:**

- Create: `src/input/use-board-gesture.ts`, `src/render/link-path.tsx`
- Modify: `src/render/board-canvas.tsx`, `src/app/game.tsx`

**Interfaces:**

- Consumes: `canAppend` from `../core/hot/can-append`; `formsSquareLoop` from `../core/hot/closes-square`; `isCollinearRun` from `../core/hot/is-line`; `cellAtPoint`, `centerX`, `centerY` from `../render/geometry`.
- Produces: `ChainState` (`{ chain, finger, board, isResolving }` shared values); `useChainState(cellCount)`; `useBoardGesture(options)`; `LinkPath` (props `{ chain, finger, linkColor, layout }`).

- [ ] **Step 1: Create `src/input/use-board-gesture.ts`**

```ts
import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { canAppend } from '../core/hot/can-append';
import { formsSquareLoop } from '../core/hot/closes-square';
import { isCollinearRun } from '../core/hot/is-line';
import type { BoardAnimation } from '../effects/use-board-animation';
import { cellAtPoint, type BoardLayout } from '../render/geometry';

export type ChainState = {
  /** The live chain of cell indices. Owned by the gesture worklet. */
  readonly chain: SharedValue<number[]>;
  /** Current finger position, or {x: -1, y: -1} when not touching. */
  readonly finger: SharedValue<{ x: number; y: number }>;
  /** Mirror of the committed board, so the worklet can validate appends. */
  readonly board: SharedValue<number[]>;
  /** 1 while a commit is animating; the gesture ignores touches then. */
  readonly isResolving: SharedValue<number>;
  /** Colour id of the live chain, or -1 when there is no chain. */
  readonly linkColor: SharedValue<number>;
};

export function useChainState(initialBoard: readonly number[]): ChainState {
  return {
    chain: useSharedValue<number[]>([]),
    finger: useSharedValue({ x: -1, y: -1 }),
    board: useSharedValue<number[]>([...initialBoard]),
    isResolving: useSharedValue(0),
    linkColor: useSharedValue(-1),
  };
}

type GestureOptions = {
  readonly state: ChainState;
  readonly anim: BoardAnimation;
  readonly layout: BoardLayout;
  readonly minChain: number;
  readonly lineLength: number;
  readonly onCommit: (chain: number[]) => void;
};

/**
 * Everything here runs on the UI thread. The only bridge crossing is the
 * single runOnJS on release, so touch-frequency work never leaves the worklet.
 *
 * Reassigning `chain.value` allocates a new array per accepted step. That is
 * unavoidable — Reanimated only observes assignment, not mutation — but it
 * happens once per linked dot, not once per frame.
 */
export function useBoardGesture({
  state,
  anim,
  layout,
  minChain,
  lineLength,
  onCommit,
}: GestureOptions) {
  const { chain, finger, board, isResolving, linkColor } = state;

  return useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .maxPointers(1)
        .onStart((event) => {
          'worklet';
          if (isResolving.value === 1) {
            return;
          }
          finger.value = { x: event.x, y: event.y };
          const cell = cellAtPoint(event.x, event.y, layout);
          chain.value = cell >= 0 ? [cell] : [];
          linkColor.value = cell >= 0 ? board.value[cell] : -1;
        })
        .onUpdate((event) => {
          'worklet';
          if (isResolving.value === 1) {
            return;
          }
          finger.value = { x: event.x, y: event.y };
          const cell = cellAtPoint(event.x, event.y, layout);
          if (cell < 0) {
            return;
          }
          const verdict = canAppend(chain.value, cell, board.value, layout.cols);
          if (verdict === 'append' || verdict === 'close-square') {
            chain.value = [...chain.value, cell];
          } else if (verdict === 'undo') {
            chain.value = chain.value.slice(0, -1);
          } else {
            return;
          }

          const live = chain.value;
          linkColor.value = live.length > 0 ? board.value[live[0]] : -1;
          const armed =
            formsSquareLoop(live, layout.cols) || isCollinearRun(live, layout.cols, lineLength);
          anim.highlight.value = armed ? linkColor.value : -1;
        })
        .onEnd(() => {
          'worklet';
          const committed = chain.value;
          if (isResolving.value === 0 && committed.length >= minChain) {
            isResolving.value = 1;
            runOnJS(onCommit)(committed);
          }
        })
        .onFinalize(() => {
          'worklet';
          chain.value = [];
          finger.value = { x: -1, y: -1 };
          linkColor.value = -1;
          anim.highlight.value = -1;
        }),
    [
      state,
      anim,
      layout,
      minChain,
      lineLength,
      onCommit,
      chain,
      finger,
      board,
      isResolving,
      linkColor,
    ],
  );
}
```

- [ ] **Step 2: Create `src/render/link-path.tsx`**

```tsx
import { Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { centerX, centerY, type BoardLayout } from './geometry';
import { colorFor, LINK_COLOR } from './palette';

type LinkPathProps = {
  readonly chain: SharedValue<number[]>;
  readonly finger: SharedValue<{ x: number; y: number }>;
  readonly linkColor: SharedValue<number>;
  readonly layout: BoardLayout;
};

/** Stroke width as a fraction of the cell. */
const STROKE_RATIO = 0.13;

export function LinkPath({ chain, finger, linkColor, layout }: LinkPathProps) {
  const path = useDerivedValue(() => {
    const built = Skia.Path.Make();
    const cells = chain.value;
    if (cells.length === 0) {
      return built;
    }
    built.moveTo(centerX(cells[0], layout), centerY(cells[0], layout));
    for (let i = 1; i < cells.length; i++) {
      built.lineTo(centerX(cells[i], layout), centerY(cells[i], layout));
    }
    if (finger.value.x >= 0) {
      built.lineTo(finger.value.x, finger.value.y);
    }
    return built;
  });

  const stroke = useDerivedValue(() =>
    linkColor.value >= 0 ? colorFor(linkColor.value) : LINK_COLOR,
  );

  return (
    <Path
      path={path}
      color={stroke}
      style="stroke"
      strokeWidth={STROKE_RATIO * layout.cellSize}
      strokeCap="round"
      strokeJoin="round"
    />
  );
}
```

If the animated `color` prop misbehaves (the stroke renders black or not at all), swap the derived value to return a Skia colour object instead of a string:

```tsx
const stroke = useDerivedValue(() =>
  Skia.Color(linkColor.value >= 0 ? colorFor(linkColor.value) : LINK_COLOR),
);
```

- [ ] **Step 3: Add the link path to `src/render/board-canvas.tsx`**

Add the imports:

```tsx
import type { ChainState } from '../input/use-board-gesture';
import { LinkPath } from './link-path';
```

Add `chainState: ChainState` to `BoardCanvasProps`, accept it in the signature, and render it **under** the dots so dots sit on top of the stroke:

```tsx
<Canvas style={{ width: layout.cellSize * layout.cols, height: layout.cellSize * layout.rows }}>
  <LinkPath
    chain={chainState.chain}
    finger={chainState.finger}
    linkColor={chainState.linkColor}
    layout={layout}
  />
  <DotLayer board={board} layout={layout} anim={anim} />
</Canvas>
```

- [ ] **Step 4: Wire the gesture in `src/app/game.tsx`**

Replace the file with:

```tsx
import { Link } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { DEFAULT_CONFIG } from '../core/config';
import { newGame } from '../core/game';
import { useBoardAnimation } from '../effects/use-board-animation';
import { useBoardGesture, useChainState } from '../input/use-board-gesture';
import { BoardCanvas } from '../render/board-canvas';
import { makeLayout } from '../render/geometry';
import { SCREEN_BACKGROUND, TEXT_COLOR } from '../render/palette';

export default function GameScreen() {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 32, 400);
  const layout = useMemo(
    () => makeLayout(DEFAULT_CONFIG.rows, DEFAULT_CONFIG.cols, boardSize),
    [boardSize],
  );
  const state = useMemo(() => newGame(DEFAULT_CONFIG, 2026), []);
  const anim = useBoardAnimation(DEFAULT_CONFIG.rows * DEFAULT_CONFIG.cols);
  const chainState = useChainState(state.board);

  // Task 19 replaces this with the real commit pipeline.
  const onCommit = useCallback(
    (chain: number[]) => {
      console.log('committed', chain.length, 'dots');
      chainState.isResolving.value = 0;
    },
    [chainState],
  );

  const gesture = useBoardGesture({
    state: chainState,
    anim,
    layout,
    minChain: DEFAULT_CONFIG.minChain,
    lineLength: DEFAULT_CONFIG.lineLength,
    onCommit,
  });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={gesture}>
        <View>
          <BoardCanvas board={state.board} layout={layout} anim={anim} chainState={chainState} />
        </View>
      </GestureDetector>
      <Link href="/" style={styles.link}>
        Back
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: SCREEN_BACKGROUND,
  },
  link: { fontSize: 18, color: TEXT_COLOR },
});
```

- [ ] **Step 5: Verify lint + typecheck + tests**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all green.

- [ ] **Step 6: Verify on device — this is the feel check**

```bash
npm run ios
```

Walk through each of these on a real iPhone, not the simulator:

- Dragging from a dot draws a stroke that follows your finger.
- The stroke only extends onto same-colour 8-way neighbours; wrong-colour and distant dots are refused.
- Dragging back onto the previous dot shortens the chain.
- Dragging diagonally past a corner does **not** link a dot you did not aim at. If it does, lower `touchFraction` in `makeLayout`; if dots feel hard to hit, raise it.
- Closing a 2×2 makes every dot of that colour swell.
- A straight run of five does the same.
- Releasing logs the chain length to the Metro console and does nothing else.

- [ ] **Step 7: Commit**

```bash
git add src/input/use-board-gesture.ts src/render/link-path.tsx src/render/board-canvas.tsx src/app/game.tsx
git commit -m "feat(input): add pan gesture chain building with live link path"
```

---

### Task 19: The commit pipeline

This is the task that makes the game playable: release commits the chain, dots pop, survivors fall, new dots drop in, the score rises, and a deadlocked board reshuffles.

**Files:**

- Create: `src/meta/use-game-state.ts`
- Modify: `src/app/game.tsx`

**Interfaces:**

- Consumes: `resolveChain`, `applyResolution`, `newGame`, `hasLegalMove`, `shuffleBoard`, `DEFAULT_CONFIG`; `moveOffsetX`, `moveOffsetY`, `spawnOffsetY` from `../render/geometry`; `playClear`, `playMove`, `resetClear`, `FALL_MS`, `SHUFFLE_MS` from `../effects/use-board-animation`; `ChainState` from `../input/use-board-gesture`.
- Produces: `useGameState({ layout, anim, chainState })` → `{ board, score, commit }`.

- [ ] **Step 1: Create `src/meta/use-game-state.ts`**

```ts
import { useCallback, useMemo, useRef, useState } from 'react';
import { DEFAULT_CONFIG } from '../core/config';
import { hasLegalMove } from '../core/deadlock';
import { applyResolution, newGame } from '../core/game';
import { resolveChain } from '../core/resolve/resolve-chain';
import { shuffleBoard } from '../core/shuffle';
import type { GameState, Resolution } from '../core/types';
import {
  FALL_MS,
  playClear,
  playMove,
  resetClear,
  SHUFFLE_MS,
  type BoardAnimation,
} from '../effects/use-board-animation';
import type { ChainState } from '../input/use-board-gesture';
import { moveOffsetX, moveOffsetY, spawnOffsetY, type BoardLayout } from '../render/geometry';

type Options = {
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
  readonly chainState: ChainState;
  /** Score to resume from. Task 20 supplies this from storage. */
  readonly initialScore?: number;
  /** Called whenever the score changes. Task 20 supplies the persister. */
  readonly onScoreChange?: (score: number) => void;
};

const CELL_COUNT = DEFAULT_CONFIG.rows * DEFAULT_CONFIG.cols;

export function useGameState({
  layout,
  anim,
  chainState,
  initialScore = 0,
  onScoreChange,
}: Options) {
  const [state, setState] = useState<GameState>(() => ({
    ...newGame(DEFAULT_CONFIG, Date.now() >>> 0),
    score: initialScore,
  }));

  // The gesture callback closes over this once; React state would be stale.
  const latest = useRef(state);
  latest.current = state;

  const publish = useCallback(
    (next: GameState) => {
      latest.current = next;
      setState(next);
      chainState.board.value = [...next.board];
      onScoreChange?.(next.score);
    },
    [chainState, onScoreChange],
  );

  const settle = useCallback(
    (next: GameState) => {
      const { rows, cols, minChain } = next.config;
      if (hasLegalMove(next.board, rows, cols, minChain)) {
        chainState.isResolving.value = 0;
        return;
      }
      const shuffled = shuffleBoard(next.board, next.config, next.rngState);
      const offsetX = new Array<number>(CELL_COUNT).fill(0);
      const offsetY = new Array<number>(CELL_COUNT).fill(0);
      for (const move of shuffled.moves) {
        offsetX[move.to] = moveOffsetX(move.from, move.to, layout);
        offsetY[move.to] = moveOffsetY(move.from, move.to, layout);
      }
      publish({ ...next, board: shuffled.board, rngState: shuffled.rngState });
      playMove(anim, offsetX, offsetY, SHUFFLE_MS, () => {
        chainState.isResolving.value = 0;
      });
    },
    [anim, chainState, layout, publish],
  );

  const applyAndDrop = useCallback(
    (resolution: Resolution) => {
      const next = applyResolution(latest.current, resolution);
      const offsetX = new Array<number>(CELL_COUNT).fill(0);
      const offsetY = new Array<number>(CELL_COUNT).fill(0);
      for (const fall of resolution.falls) {
        offsetY[fall.to] = moveOffsetY(fall.from, fall.to, layout);
      }
      for (const spawn of resolution.spawns) {
        offsetY[spawn.to] = spawnOffsetY(spawn.to, spawn.heightAbove, layout);
      }
      resetClear(anim);
      publish(next);
      playMove(anim, offsetX, offsetY, FALL_MS, () => settle(next));
    },
    [anim, layout, publish, settle],
  );

  const commit = useCallback(
    (chain: number[]) => {
      const resolution = resolveChain(latest.current, chain);
      if (resolution === null) {
        chainState.isResolving.value = 0;
        return;
      }
      playClear(anim, resolution.cleared, () => applyAndDrop(resolution));
    },
    [anim, applyAndDrop, chainState],
  );

  return useMemo(
    () => ({ board: state.board, score: state.score, commit }),
    [state.board, state.score, commit],
  );
}
```

- [ ] **Step 2: Wire it into `src/app/game.tsx`**

Replace the file with:

```tsx
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { DEFAULT_CONFIG } from '../core/config';
import { useBoardAnimation } from '../effects/use-board-animation';
import { useBoardGesture, useChainState } from '../input/use-board-gesture';
import { useGameState } from '../meta/use-game-state';
import { BoardCanvas } from '../render/board-canvas';
import { makeLayout } from '../render/geometry';
import { SCREEN_BACKGROUND, TEXT_COLOR } from '../render/palette';

const CELL_COUNT = DEFAULT_CONFIG.rows * DEFAULT_CONFIG.cols;

export default function GameScreen() {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 32, 400);
  const layout = useMemo(
    () => makeLayout(DEFAULT_CONFIG.rows, DEFAULT_CONFIG.cols, boardSize),
    [boardSize],
  );
  const anim = useBoardAnimation(CELL_COUNT);
  const chainState = useChainState(new Array<number>(CELL_COUNT).fill(0));
  const game = useGameState({ layout, anim, chainState });

  const gesture = useBoardGesture({
    state: chainState,
    anim,
    layout,
    minChain: DEFAULT_CONFIG.minChain,
    lineLength: DEFAULT_CONFIG.lineLength,
    onCommit: game.commit,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.score}>{game.score}</Text>
      <GestureDetector gesture={gesture}>
        <View>
          <BoardCanvas board={game.board} layout={layout} anim={anim} chainState={chainState} />
        </View>
      </GestureDetector>
      <Link href="/" style={styles.link}>
        Back
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: SCREEN_BACKGROUND,
  },
  score: { fontSize: 40, fontWeight: '700', color: TEXT_COLOR, fontVariant: ['tabular-nums'] },
  link: { fontSize: 18, color: TEXT_COLOR },
});
```

Note the mirror seeding: `useChainState` is constructed with a placeholder board because `useGameState` deals the real one, and `publish` pushes it into `chainState.board` on the first commit. To make the mirror correct **before** the first commit, `useGameState` must also publish once on mount — add this to `use-game-state.ts` right after the `publish` definition:

```ts
const seeded = useRef(false);
if (!seeded.current) {
  seeded.current = true;
  chainState.board.value = [...state.board];
}
```

- [ ] **Step 3: Verify lint + typecheck + tests**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all green.

- [ ] **Step 4: Verify on device**

```bash
npm run ios
```

Confirm each:

- Linking 3+ dots and releasing pops them, drops the survivors, and fills the gaps from the top.
- Linking only 2 dots and releasing does nothing.
- The score rises by 60 for a 3-chain, 100 for a 4-chain, 150 for a 5-chain.
- Closing a 2×2 clears every dot of that colour board-wide.
- A straight run of 5 does the same.
- Touching the board during the pop/fall does nothing — input is locked.
- The whole clear→fall→settle reads as one motion, not a sequence of jolts, and finishes fast enough that the lock is never noticeable. If it drags, lower `CLEAR_MS` and `FALL_MS`.
- Watch for a one-frame flash where a dot appears at its destination before sliding in. If you see it, the offsets are being written after the React re-render; move the `playMove` call before `publish`.

The shuffle is **not** verifiable here — see "Two findings" at the top. Its correctness rests on the Task 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/meta/use-game-state.ts src/app/game.tsx
git commit -m "feat(meta): wire the commit, cascade, and shuffle pipeline"
```

---

## Phase 4 — Meta (Tasks 20–22)

### Task 20: Score persistence

**Files:**

- Create: `src/meta/score-storage.ts`
- Modify: `src/app/game.tsx`, `package.json` (via `expo install`)

**Interfaces:**

- Consumes: `react-native-mmkv`.
- Produces: `readScore(): number`, `writeScore(score: number): void`, `resetScore(): void`.

- [ ] **Step 1: Install MMKV**

```bash
npx expo install react-native-mmkv
```

MMKV is a native module, so the dev client must be rebuilt after this. `npm run ios` in Step 5 does that.

- [ ] **Step 2: Create `src/meta/score-storage.ts`**

```ts
import { MMKV } from 'react-native-mmkv';

const SCORE_KEY = 'score';

/**
 * The only module that touches MMKV. Keeping the storage choice behind three
 * functions means the core never learns about it and the backend stays
 * swappable.
 */
const storage = new MMKV();

export function readScore(): number {
  return storage.getNumber(SCORE_KEY) ?? 0;
}

export function writeScore(score: number): void {
  storage.set(SCORE_KEY, score);
}

export function resetScore(): void {
  storage.set(SCORE_KEY, 0);
}
```

- [ ] **Step 3: Read and write the score in `src/app/game.tsx`**

Add the import:

```tsx
import { readScore, writeScore } from '../meta/score-storage';
```

Replace the `useGameState` call with:

```tsx
const initialScore = useMemo(() => readScore(), []);
const game = useGameState({
  layout,
  anim,
  chainState,
  initialScore,
  onScoreChange: writeScore,
});
```

MMKV writes are synchronous and fast enough that writing on every commit needs no debouncing.

- [ ] **Step 4: Verify lint + typecheck + tests**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all green. Vitest is unaffected — `score-storage.ts` lives outside the Vitest include, which is exactly why the MMKV import is isolated there.

- [ ] **Step 5: Rebuild the dev client and verify on device**

```bash
npm run ios
```

Confirm: play until the score is non-zero, force-quit the app, reopen it, open the game screen — the score continues from where it was, and the board is freshly dealt.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/meta/score-storage.ts src/app/game.tsx
git commit -m "feat(meta): persist the score with mmkv"
```

---

### Task 21: Screens

**Files:**

- Modify: `src/app/index.tsx`, `src/app/settings.tsx`, `src/app/_layout.tsx`
- Delete: `src/app/game-over.tsx`

**Interfaces:**

- Consumes: `readScore`, `resetScore` from `../meta/score-storage`; palette colours.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Delete the game-over screen**

There is no fail state, so nothing can navigate here.

```bash
git rm src/app/game-over.tsx
```

- [ ] **Step 2: Remove its route from `src/app/_layout.tsx`**

Delete this line:

```tsx
<Stack.Screen name="game-over" options={{ title: 'Game Over' }} />
```

- [ ] **Step 3: Replace `src/app/index.tsx`**

```tsx
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { readScore } from '../meta/score-storage';
import { SCREEN_BACKGROUND, TEXT_COLOR } from '../render/palette';

export default function TitleScreen() {
  const [score, setScore] = useState(0);

  // Re-read on focus so the score is current after returning from a session.
  useFocusEffect(
    useCallback(() => {
      setScore(readScore());
    }, []),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>three-match-dots</Text>
      <Text style={styles.score}>{score}</Text>
      <Link href="/game" style={styles.link}>
        Play
      </Link>
      <Link href="/settings" style={styles.link}>
        Settings
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: SCREEN_BACKGROUND,
  },
  title: { fontSize: 28, fontWeight: '600', color: TEXT_COLOR },
  score: { fontSize: 48, fontWeight: '700', color: TEXT_COLOR, fontVariant: ['tabular-nums'] },
  link: { fontSize: 18, color: '#4f8cff' },
});
```

- [ ] **Step 4: Replace `src/app/settings.tsx`**

```tsx
import { Link } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { resetScore } from '../meta/score-storage';
import { SCREEN_BACKGROUND, TEXT_COLOR } from '../render/palette';

export default function SettingsScreen() {
  const confirmReset = () => {
    Alert.alert('Reset score?', 'Your score goes back to zero. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetScore },
    ]);
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={confirmReset} accessibilityRole="button">
        <Text style={styles.destructive}>Reset score</Text>
      </Pressable>
      <Link href="/" style={styles.link}>
        Back
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: SCREEN_BACKGROUND,
  },
  destructive: { fontSize: 18, color: '#ff4d5e' },
  link: { fontSize: 18, color: TEXT_COLOR },
});
```

- [ ] **Step 5: Verify lint + typecheck + tests**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all green.

- [ ] **Step 6: Verify on device**

```bash
npm run ios
```

Confirm: the title screen shows the persisted score; Play opens the game; returning to the title shows the updated score; Settings → Reset score asks for confirmation and zeroes the title score; no route leads to a game-over screen.

- [ ] **Step 7: Commit**

```bash
git add src/app
git commit -m "feat(meta): add title score, settings reset, and drop game-over"
```

---

### Task 22: Documentation sync and close-out

`CLAUDE.md` and `docs/two-dots-game-design.md` still describe 4-way adjacency, five colours, and a 2-dot minimum. All three are now wrong.

**Files:**

- Modify: `CLAUDE.md`, `docs/two-dots-game-design.md`
- Delete: `docs/superpowers/plans/2026-08-01-game-core-engine.md`

- [ ] **Step 1: Update the core loop description in `CLAUDE.md`**

Replace this paragraph under "Project Overview":

```
**Core loop:** drag through ADJACENT same-color dots (up/down/left/right) to link a chain;
chains of ≥2 clear on release; closing a 2×2 loop clears EVERY dot of that color on the board;
survivors fall via gravity and new dots spawn from the top.
```

with:

```
**Core loop:** drag through ADJACENT same-color dots (8-way — orthogonal AND diagonal) to link a
chain; chains of ≥3 clear on release; closing a 2×2 loop OR drawing a straight run of ≥5 clears
EVERY dot of that color on the board; survivors fall via gravity and new dots spawn from the top.
A board with no legal chain reshuffles. Endless zen — no fail state.
```

- [ ] **Step 2: Update the status line in `CLAUDE.md`**

Replace the "**Current status:**" paragraph with:

```
**Current status:** playable. The game core (`src/core/`), Skia render layer (`src/render/`),
gesture input (`src/input/`), animation (`src/effects/`), and score persistence (`src/meta/`)
are all built and wired. 6×6 board, 3 colors, endless play with a persisted score.
Game design doc: `docs/two-dots-game-design.md`. Team workflow design: `docs/team-workflow-design.md`.
```

- [ ] **Step 3: Update the Scope section in `CLAUDE.md`**

Replace `Two Dots-exact mechanic` in the v1 scope line with `Two Dots-derived mechanic (8-way linking, 2×2-loop and ≥5-line sweeps, shuffle on deadlock)`.

- [ ] **Step 4: Add the layer rules to "Development Rules" in `CLAUDE.md`**

Append these bullets:

```
- **`src/core/hot/` is worklet-safe:** no object allocation, no module state, no classes, and no
  imports from `src/core/resolve/`. Dependencies point one way — `resolve/` may use `hot/`, never
  the reverse. Every exported function opens with the `'worklet';` directive.
- **`src/render/geometry.ts` follows the same rule** and is the only file outside `src/core/`
  that Vitest runs. Keep it pure arithmetic over plain numbers.
- **Zustand is not used yet.** State is one board and one number, owned by
  `src/meta/use-game-state.ts`. Introduce a store when settings and meta UI actually grow.
```

- [ ] **Step 5: Update the requirements in `docs/two-dots-game-design.md`**

Replace these lines under "Requirements (locked)":

```
- Grid board (start 6×6, tunable) of N-color dots.
- Continuous drag gesture; link only ADJACENT same-color dots (up/down/left/right).
- Chain of ≥2 clears on release.
- Closing a square loop → clears every dot of that color on the board.
```

with:

```
- Grid board, 6×6, of 3-color dots (green / red / blue) — both config values.
- Continuous drag gesture; link ADJACENT same-color dots, 8-way (orthogonal AND diagonal).
- Chain of ≥3 clears on release.
- Closing a 2×2 square loop → clears every dot of that color on the board.
- A straight chain of ≥5 (any of the 8 directions) → clears every dot of that color on the board.
- No legal chain anywhere → the board reshuffles the same dots into a playable arrangement.
```

- [ ] **Step 6: Add a supersession note to `docs/two-dots-game-design.md`**

Directly under the `**Status:**` line at the top:

```
**Superseded in part by** `docs/superpowers/specs/2026-08-03-playable-game-design.md` (2026-08-03):
adjacency is 8-way, the board is 6×6 with 3 colors, chains clear at ≥3, a straight run of ≥5 also
sweeps the color, a deadlocked board reshuffles, and endless mode has no fail state or game-over
screen.
```

- [ ] **Step 7: Resolve the answered open questions in `docs/two-dots-game-design.md`**

In "Unresolved Questions", replace:

```
- Grid size + color count for v1 (affects difficulty) — pin during planning.
- Endless difficulty ramp: time pressure, move limit, or pure relax mode?
```

with:

```
- ~~Grid size + color count~~ → resolved: 6×6, 3 colors (config values).
- ~~Endless difficulty ramp~~ → resolved: pure relax, no fail state. Blockers and a shrinking
  board are the recorded levers if a fail state is wanted later.
```

- [ ] **Step 8: Delete the superseded plan**

```bash
git rm docs/superpowers/plans/2026-08-01-game-core-engine.md
```

- [ ] **Step 9: Verify the full gate**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add CLAUDE.md docs/two-dots-game-design.md
git commit -m "docs: sync game rules to the playable implementation"
```

---

## Verification

After Task 22, confirm the spec is satisfied end to end.

**Automated:**

- [ ] `npm run lint && npm run typecheck && npm test` all green
- [ ] `grep -rnE "(from|require\()\s*['\"](react-native|@shopify|expo|@expo)" src/core/` returns nothing — anchor to `from`/`require(`, since a bare `expo` matches every `export` line
- [ ] `grep -rn "from '../resolve\|from './resolve" src/core/hot/` returns nothing
- [ ] No file in `src/` exceeds 200 lines: `find src -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -rn | head -5`

**On a real iPhone** (not the simulator — touch is not a mouse). MMKV is a native module added after the scaffold, so this needs a fresh `npx expo run:ios`, not just Metro.

Core mechanics:

- [ ] Dragging through 3+ same-colour dots clears them; survivors fall, new dots drop in, the score rises
- [ ] A 2-dot chain does nothing
- [ ] Closing a 2×2 clears every dot of that colour, and the cue fires before the sweep — **both halves**: the link path brightens AND the dots of that colour swell
- [ ] A straight run of 5 does the same
- [ ] Score rises by 60 for a 3-chain, 100 for a 4-chain, 150 for a 5-chain
- [ ] Dragging past a corner never links a dot you did not aim at (tune `touchFraction` in `makeLayout` if it does)
- [ ] 60fps through a full cascade
- [ ] The score survives a force-quit and reopen; the board is freshly dealt
- [ ] Settings → Reset score confirms, then zeroes it; the title reflects it on return
- [ ] No route reaches a game-over screen

Hazards identified by the final whole-branch review — check these deliberately:

- [ ] **One-frame tear at the board swap.** Dot colours come from React props while positions and radii come from shared values, so the two land on different schedules. Watch for either variant: the new board rendering fully settled for one frame before it jumps up and slides in, **or** cleared dots snapping back to full radius in their _old_ colour before the colours update. If visible, move the `resetClear` + `playMove` writes in `use-game-state.ts` into a `useLayoutEffect` keyed on the newly published board.
- [ ] **Background the app mid-cascade** (notification shade or app switcher), then return — confirm input is not permanently locked. The unlock no longer depends on a tween completing normally; this check confirms that fix.
- [ ] **iOS interactive-pop conflict on the left edge.** The board's left edge sits near x≈16 on a 390pt iPhone, inside the native edge-swipe zone, so a drag starting in the left column may pop the screen instead of linking. If it bites, set `gestureEnabled: false` on the game screen.
- [ ] **Spawn clipping.** Refill dots start up to 6 cells above row 0 — confirm the Canvas clips them and they do not draw over the score HUD.
- [ ] **Drag-spam under lock.** Repeatedly drag and release during a cascade: the lock must never leak, the score must never double-count, and no chain may survive from before the lock into after it.
- [ ] **Link-path stroke colour.** If it renders black or not at all, swap the derived value in `link-path.tsx` to return `Skia.Color(...)` instead of a string.

**Not verifiable by playing:** the shuffle. Deadlock is real but occurred zero times in 2,000,000 random boards, so it cannot be reached in play. Its correctness rests on the Task 13 tests against machine-found fixtures — and its animation path (the only user of `moveOffsetX`) will ship having never rendered. A temporary debug hook forcing a deadlocked board is the only way to see it.

**Expected tuning after playtest** — all one-line changes in `src/core/config.ts` and `src/render/geometry.ts`:

- `lineLength` if straight-5 sweeps fire too often at 3 colours
- `sweepMultiplier` if sweeps dominate the score
- `touchFraction` in `makeLayout` if the drag feels sticky or jumpy
- `CLEAR_MS` / `FALL_MS` if the input lock feels slow

## Self-Review

Checked after writing:

- **Spec coverage** — every section of `2026-08-03-playable-game-design.md` maps to a task: rules → 1–14; shuffle → 12–13; architecture and the `hot/` boundary → 1–14 plus Task 22's doc rules; input → 18; render and animation → 15–19; persistence → 20; screens → 21; error handling and invariants → 11, 13, 14; testing → every task; docs → 22; risks → the Verification tuning list.
- **Placeholders** — none. Every step carries the code or the exact edit.
- **Type consistency** — `CellMove` is defined in Task 1 and used by Tasks 8 and 13; `FallMove` is an alias, so `applyGravity` and `shuffleBoard` agree. `isCollinearRun` takes `minLength` in Task 4 and is called with `config.lineLength` in Tasks 6 and 18. `hasLegalMove` takes `minChain` in Task 12 and is called with it in Tasks 13, 14, and 19. `moveOffsetX/Y` and `spawnOffsetY` are defined in Task 15 and used in Task 19. `BoardAnimation` is defined in Task 17 and consumed in Tasks 18 and 19.
- **Two corrections to the spec are recorded inline** rather than silently applied: `hasLegalMove` counts connected components (the spec implied a pair scan), and shuffle is a safety net rather than a routine mechanic (the spec called it "a real mechanic — a feature").
