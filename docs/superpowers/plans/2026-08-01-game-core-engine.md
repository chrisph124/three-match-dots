# Game Core Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure-TypeScript game core in `src/core/` — chain validation, special-clear detection, clear→gravity→refill resolution, and scoring — fully unit-tested with Vitest and free of any React Native dependency.

**Architecture:** The core splits in two. `src/core/hot/` holds worklet-safe functions the gesture layer calls at touch frequency: plain functions over primitives and flat arrays, no allocation, no classes, no module state. `src/core/resolve/` holds the once-per-commit pipeline that returns an immutable `Resolution` describing everything the render layer must animate. Dependencies point one way — `resolve/` may import `hot/`, never the reverse.

**Tech Stack:** TypeScript (strict, no `any`), Vitest (node env, `src/core/**/*.test.ts`), ESLint + `eslint-plugin-sonarjs`, Prettier.

**Spec:** `docs/superpowers/specs/2026-08-01-game-core-engine-design.md`

**Depends on:** `plans/2026-06-18-expo-scaffold.md` must land first — it creates `package.json`, `vitest.config.ts`, `src/core/`, and the lint/typecheck scripts this plan assumes.

## Global Constraints

- **Never `any`.** Enforced by `@typescript-eslint/no-explicit-any` (error) + strict tsconfig. Escape only via inline `// eslint-disable-next-line` with a written justification.
- **`src/core/` imports nothing from React Native, Skia, Reanimated, or Expo.** Vitest can only test RN-free code.
- **Nothing in `src/core/hot/` may allocate objects, capture module state, use classes, or import from `resolve/`.**
- Every file in `src/core/hot/` opens each exported function with the `'worklet';` directive.
- Files stay under ~200 lines; kebab-case filenames; one responsibility per file.
- Principles: YAGNI, KISS, DRY. No fake data or stubs to make builds pass.
- Conventional commits (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`).
- **No AI attribution in commits — ever.** No `Co-Authored-By`, no "Generated with", no tool references.
- Gates after every task: `npm run lint && npm run typecheck && npm test` all green.
- Board constants: `EMPTY = -1`. Defaults: 6 rows, 6 cols, 5 colors, `baseScore = 10`, `sweepMultiplier = 3`.
- Randomness order is contractual: refill consumes RNG **columns left→right, rows top→bottom**.
- `Resolution` ordering is contractual: chain-tagged cleared cells in drag order, sweep cells row-major, falls per column bottom-up.

---

## File Structure

| File                                     | Responsibility                           |
| ---------------------------------------- | ---------------------------------------- |
| `src/core/types.ts`                      | All shared types + `EMPTY` constant      |
| `src/core/config.ts`                     | `DEFAULT_CONFIG`                         |
| `src/core/rng.ts`                        | mulberry32 with explicit state threading |
| `src/core/hot/adjacency.ts`              | `rowOf`, `colOf`, `areAdjacent` (8-way)  |
| `src/core/hot/closes-square.ts`          | `closesSquare`, `formsSquareLoop`        |
| `src/core/hot/is-line.ts`                | `isCollinearRun`                         |
| `src/core/hot/can-append.ts`             | `canAppend` → `AppendVerdict`            |
| `src/core/resolve/classify-chain.ts`     | `classifyChain` → `ChainKind`            |
| `src/core/resolve/collect-cleared.ts`    | `collectCleared` → `ClearedCell[]`       |
| `src/core/resolve/gravity.ts`            | `applyGravity` → board + `FallMove[]`    |
| `src/core/resolve/refill.ts`             | `refill` → board + `Spawn[]` + rngState  |
| `src/core/resolve/scoring.ts`            | `scoreFor`                               |
| `src/core/resolve/resolve-chain.ts`      | `resolveChain` orchestrator              |
| `src/core/deadlock.ts`                   | `hasLegalMove`                           |
| `src/core/game.ts`                       | `newGame`, `applyResolution`             |
| `src/core/test-support/board-fixture.ts` | `parseBoard`, `formatBoard`              |

**Deleted:** `src/core/are-adjacent.ts` and `src/core/are-adjacent.test.ts` (scaffold sample — 4-way, `{row, col}`-based, superseded by `hot/adjacency.ts`).

---

### Task 1: Types, config, and seeded RNG

**Files:**

- Create: `src/core/types.ts`, `src/core/config.ts`, `src/core/rng.ts`
- Test: `src/core/rng.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `Color`, `CellIndex`, `Board`, `Chain`, `ChainKind`, `AppendVerdict`, `ClearReason`, `ClearedCell`, `FallMove`, `Spawn`, `GameConfig`, `Resolution`, `GameState`, `EMPTY`; `DEFAULT_CONFIG`; `next(state: number): RngStep` and `nextInt(state: number, bound: number): RngStep`.

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

export type FallMove = {
  readonly from: CellIndex;
  readonly to: CellIndex;
};

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

export const DEFAULT_CONFIG: GameConfig = {
  rows: 6,
  cols: 6,
  colors: 5,
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
    const step = next(999);
    expect(step.state).not.toBe(999);
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
      const step = nextInt(state, 5);
      state = step.state;
      expect(step.value).toBeGreaterThanOrEqual(0);
      expect(step.value).toBeLessThan(5);
      expect(Number.isInteger(step.value)).toBe(true);
    }
  });

  it('eventually produces every value in range', () => {
    let state = 42;
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const step = nextInt(state, 5);
      state = step.state;
      seen.add(step.value);
    }
    expect(seen.size).toBe(5);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./rng` (module does not exist yet).

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

Replaces the scaffold's 4-way `are-adjacent` sample. The flat-index representation invites a specific bug: `cell + 1` at the right edge is the _first cell of the next row_, not a right-neighbour, and the diagonal offsets wrap the same way. `areAdjacent` must therefore compare decoded columns, never raw index deltas.

**Files:**

- Create: `src/core/hot/adjacency.ts`, `src/core/hot/adjacency.test.ts`
- Delete: `src/core/are-adjacent.ts`, `src/core/are-adjacent.test.ts`

**Interfaces:**

- Consumes: `CellIndex` from `src/core/types.ts`.
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
    expect(areAdjacent(5, 12, COLS)).toBe(false); // would be "down-left" by raw offset
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

Expected: no errors. If ESLint flags the `'worklet';` directive as an unused expression, add `"no-unused-expressions": ["error", { "allowTaggedTemplates": false }]` is _not_ the fix — instead confirm the directive sits as the first statement of the function body, where it is parsed as a directive prologue. Only if the rule still fires, disable it for `src/core/hot/**` in `eslint.config.*` with a comment explaining that these are Reanimated worklet markers.

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
- Produces: `closesSquare(chain: Chain, cell: CellIndex, cols: number): boolean` — evaluated _before_ the closing cell is appended. `formsSquareLoop(chain: Chain, cols: number): boolean` — evaluated on an already-sealed chain (one whose last entry repeats its 5th-from-last).

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
    const chain = [14, 8, 2, ...SQUARE];
    expect(closesSquare(chain, 0, COLS)).toBe(true);
  });

  it('is false when the closing cell is not the 4th from the end', () => {
    expect(closesSquare([0, 1, 7, 6, 12], 0, COLS)).toBe(false);
    expect(closesSquare([0, 1, 7], 0, COLS)).toBe(false);
  });

  it('is false when the last four cells are not a 2x2 block', () => {
    // A straight run of four.
    expect(closesSquare([0, 1, 2, 3], 0, COLS)).toBe(false);
    // An L of four.
    expect(closesSquare([0, 1, 2, 8], 0, COLS)).toBe(false);
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
    expect(formsSquareLoop([0, 1, 7, 6], COLS)).toBe(false);
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
 * is what lets a real loop closure be told apart from a chain that merely
 * ends on four square-shaped cells.
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

Every chain step is already an adjacency step, so "all steps share one delta" is exactly equivalent to "straight in one of the 8 directions" — one O(n) pass, no geometry.

**Files:**

- Create: `src/core/hot/is-line.ts`, `src/core/hot/is-line.test.ts`

**Interfaces:**

- Consumes: `rowOf`, `colOf` from `./adjacency`; `Chain` from `../types`.
- Produces: `isCollinearRun(chain: Chain, cols: number): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/core/hot/is-line.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isCollinearRun } from './is-line';

const COLS = 6;

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
    expect(isCollinearRun(run(2, 0, 0, 1, 5), COLS)).toBe(true);
  });

  it('is true for a vertical run of five', () => {
    expect(isCollinearRun(run(0, 3, 1, 0, 5), COLS)).toBe(true);
  });

  it('is true for both diagonal runs of five', () => {
    expect(isCollinearRun(run(0, 0, 1, 1, 5), COLS)).toBe(true);
    expect(isCollinearRun(run(0, 5, 1, -1, 5), COLS)).toBe(true);
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
      expect(isCollinearRun(run(startRow, startCol, dRow, dCol, 5), COLS)).toBe(true);
    }
  });

  it('is true for a run longer than five', () => {
    expect(isCollinearRun(run(0, 0, 0, 1, 6), COLS)).toBe(true);
  });

  it('is false for a straight run of only four', () => {
    expect(isCollinearRun(run(2, 0, 0, 1, 4), COLS)).toBe(false);
  });

  it('is false when the run bends at the sixth dot', () => {
    const bent = [...run(0, 0, 0, 1, 5), 11];
    expect(isCollinearRun(bent, COLS)).toBe(false);
  });

  it('is false for a chain shorter than five', () => {
    expect(isCollinearRun([], COLS)).toBe(false);
    expect(isCollinearRun([0], COLS)).toBe(false);
    expect(isCollinearRun([0, 1], COLS)).toBe(false);
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

/** Minimum chain length that triggers the straight-line sweep. */
export const LINE_LENGTH = 5;

/**
 * True when the chain is at least LINE_LENGTH long and every step shares one
 * (dRow, dCol). Because each step is already an adjacency step, that is
 * exactly "straight along one of the 8 directions".
 */
export function isCollinearRun(chain: Chain, cols: number): boolean {
  'worklet';
  if (chain.length < LINE_LENGTH) {
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
    // cell 3 is row 0 col 3; cell 4 is row 1 col 0. Both are R but not adjacent.
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
    // 0,1,5 then back to 0: adjacent and same colour, but only three cells.
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
- Produces: `classifyChain(chain: Chain, cols: number): ChainKind`.

- [ ] **Step 1: Write the failing test**

Create `src/core/resolve/classify-chain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyChain } from './classify-chain';

const COLS = 6;

describe('classifyChain', () => {
  it('classifies a short chain as plain', () => {
    expect(classifyChain([0, 1], COLS)).toBe('plain');
    expect(classifyChain([0, 1, 7], COLS)).toBe('plain');
  });

  it('classifies a sealed chain as square-loop', () => {
    expect(classifyChain([0, 1, 7, 6, 0], COLS)).toBe('square-loop');
  });

  it('classifies a straight run of five as line', () => {
    expect(classifyChain([12, 13, 14, 15, 16], COLS)).toBe('line');
  });

  it('classifies a diagonal run of five as line', () => {
    expect(classifyChain([0, 7, 14, 21, 28], COLS)).toBe('line');
  });

  // Guards the reason the closing cell is appended.
  it('classifies four square-shaped cells without a revisit as plain', () => {
    expect(classifyChain([0, 1, 7, 6], COLS)).toBe('plain');
  });

  it('classifies a bent five-chain as plain', () => {
    expect(classifyChain([12, 13, 14, 15, 21], COLS)).toBe('plain');
  });

  it('prefers square-loop over line', () => {
    // A sealed chain can never be collinear, but precedence is defensive.
    expect(classifyChain([0, 1, 7, 6, 0], COLS)).toBe('square-loop');
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
export function classifyChain(chain: Chain, cols: number): ChainKind {
  if (formsSquareLoop(chain, cols)) {
    return 'square-loop';
  }
  if (isCollinearRun(chain, cols)) {
    return 'line';
  }
  return 'plain';
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
git add src/core/resolve/classify-chain.ts src/core/resolve/classify-chain.test.ts
git commit -m "feat(core): add chain classification"
```

---

### Task 7: Board fixtures and cleared-cell collection

Gravity and sweep assertions are unreadable as raw number arrays and obvious as text grids, so the fixture helper lands here, with the first test that needs it.

**Files:**

- Create: `src/core/test-support/board-fixture.ts`, `src/core/test-support/board-fixture.test.ts`
- Create: `src/core/resolve/collect-cleared.ts`, `src/core/resolve/collect-cleared.test.ts`

**Interfaces:**

- Consumes: `Board`, `Chain`, `ChainKind`, `ClearedCell`, `Color`, `EMPTY` from `../types`.
- Produces: `parseBoard(art: string): { board: Color[]; rows: number; cols: number }`, `formatBoard(board: Board, cols: number): string`, `COLOR_CHARS`; `collectCleared(board: Board, chain: Chain, kind: ChainKind): ClearedCell[]`.

- [ ] **Step 1: Create `src/core/test-support/board-fixture.ts`**

```ts
import type { Board, Color } from '../types';
import { EMPTY } from '../types';

/** Colour index 0..4 maps to these characters in board art. */
export const COLOR_CHARS = 'RGBYP';

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
    const art = 'RGBY/PRGB/BYPR';
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
    const cleared = collectCleared(board, [0, 1], 'plain');
    expect(cleared).toEqual([
      { index: 0, color: 0, reason: 'chain' },
      { index: 1, color: 0, reason: 'chain' },
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
    const cleared = collectCleared(board, [0, 1, 5, 4, 0], 'square-loop');
    const indices = cleared.map((c) => c.index);
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('tags chain cells first in drag order, then sweep cells row-major', () => {
    const cleared = collectCleared(board, [0, 1, 5, 4, 0], 'square-loop');
    const chainPart = cleared.filter((c) => c.reason === 'chain').map((c) => c.index);
    const sweepPart = cleared.filter((c) => c.reason === 'color-sweep').map((c) => c.index);
    expect(chainPart).toEqual([0, 1, 5, 4]);
    expect(sweepPart).toEqual([3, 7, 10, 11, 12, 14]);
    // Chain cells precede all sweep cells in the emitted order.
    expect(cleared.slice(0, 4).every((c) => c.reason === 'chain')).toBe(true);
  });

  it('sweeps for a line the same way it does for a loop', () => {
    const line = collectCleared(board, [3, 7, 11, 15], 'line');
    expect(line.some((c) => c.reason === 'color-sweep')).toBe(true);
  });
});
```

Note: cell 15 is G, so the `line` chain above is only illustrative of sweep behaviour — `collectCleared` trusts the caller's `kind` and takes the colour from `chain[0]`. Colour validity is `resolveChain`'s job (Task 11).

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
    // Clear the bottom-left cell (index 4).
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
    // Left column top-to-bottom is R, B, R, Y. Clearing rows 1 and 3 leaves
    // R and R, which settle into the bottom two rows.
    const { board, rows, cols } = parseBoard('RG/BG/RB/YB');
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
    // Clear the bottom row entirely: indices 6, 7, 8.
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
 * render layer can stagger them directly from the array order.
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
import { formatBoard, parseBoard } from '../test-support/board-fixture';
import { EMPTY } from '../types';
import { refill } from './refill';

describe('refill', () => {
  it('fills every empty cell', () => {
    const { board, rows, cols } = parseBoard('../.G/RB');
    const result = refill(board, rows, cols, 5, 2026);
    expect(result.board.includes(EMPTY)).toBe(false);
  });

  it('leaves settled cells untouched', () => {
    const { board, rows, cols } = parseBoard('../.G/RB');
    const result = refill(board, rows, cols, 5, 2026);
    expect(formatBoard(result.board, cols).slice(-5)).toBe('.G/RB'.slice(-5));
  });

  it('emits one spawn per empty cell', () => {
    const { board, rows, cols } = parseBoard('../.G/RB');
    const result = refill(board, rows, cols, 5, 2026);
    expect(result.spawns).toHaveLength(3);
  });

  it('assigns heightAbove counting up from the lowest new dot', () => {
    // Left column has two empties (rows 0 and 1), right column has one (row 0).
    const { board, rows, cols } = parseBoard('../.G/RB');
    const result = refill(board, rows, cols, 5, 2026);
    const byCell = new Map(result.spawns.map((s) => [s.to, s.heightAbove]));
    expect(byCell.get(2)).toBe(1); // left column, row 1 -> lands first
    expect(byCell.get(0)).toBe(2); // left column, row 0 -> starts higher
    expect(byCell.get(1)).toBe(1); // right column, single empty
  });

  it('consumes randomness columns left to right, rows top to bottom', () => {
    const { board, rows, cols } = parseBoard('../.G/RB');
    const result = refill(board, rows, cols, 5, 2026);
    expect(result.spawns.map((s) => s.to)).toEqual([0, 2, 1]);
  });

  it('records the spawned colour on the board', () => {
    const { board, rows, cols } = parseBoard('../.G/RB');
    const result = refill(board, rows, cols, 5, 2026);
    for (const spawn of result.spawns) {
      expect(result.board[spawn.to]).toBe(spawn.color);
    }
  });

  it('is reproducible for the same seed', () => {
    const { board, rows, cols } = parseBoard('../.G/RB');
    const a = refill(board, rows, cols, 5, 777);
    const b = refill(board, rows, cols, 5, 777);
    expect(a.board).toEqual(b.board);
    expect(a.spawns).toEqual(b.spawns);
    expect(a.rngState).toBe(b.rngState);
  });

  it('differs for a different seed', () => {
    const { board, rows, cols } = parseBoard('..../..../..../....');
    const a = refill(board, rows, cols, 5, 1);
    const b = refill(board, rows, cols, 5, 2);
    expect(a.board).not.toEqual(b.board);
  });

  it('advances the rng state', () => {
    const { board, rows, cols } = parseBoard('../.G/RB');
    const result = refill(board, rows, cols, 5, 777);
    expect(result.rngState).not.toBe(777);
  });

  it('is a no-op on a full board', () => {
    const { board, rows, cols } = parseBoard('RG/BG/RB');
    const result = refill(board, rows, cols, 5, 777);
    expect(result.spawns).toEqual([]);
    expect(result.board).toEqual([...board]);
    expect(result.rngState).toBe(777);
  });

  it('does not mutate the input board', () => {
    const { board, rows, cols } = parseBoard('../.G/RB');
    const before = [...board];
    refill(board, rows, cols, 5, 777);
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
    expect(scoreFor('plain', 2, DEFAULT_CONFIG)).toBe(30);
    expect(scoreFor('plain', 3, DEFAULT_CONFIG)).toBe(60);
    expect(scoreFor('plain', 5, DEFAULT_CONFIG)).toBe(150);
  });

  it('makes each extra dot worth more than the last', () => {
    const gaps: number[] = [];
    for (let n = 2; n < 10; n++) {
      gaps.push(scoreFor('plain', n + 1, DEFAULT_CONFIG) - scoreFor('plain', n, DEFAULT_CONFIG));
    }
    const ascending = gaps.every((gap, i) => i === 0 || gap > gaps[i - 1]);
    expect(ascending).toBe(true);
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
    for (let n = 2; n < 40; n++) {
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
  return {
    config: { ...DEFAULT_CONFIG, rows, cols, colors: 5 },
    board,
    score: 0,
    rngState: seed,
  };
};

describe('resolveChain', () => {
  it('returns null for a chain shorter than two', () => {
    expect(resolveChain(stateFrom(ART), [])).toBeNull();
    expect(resolveChain(stateFrom(ART), [0])).toBeNull();
  });

  it('returns null for a chain with a non-adjacent step', () => {
    expect(resolveChain(stateFrom(ART), [0, 12])).toBeNull();
  });

  it('returns null for a chain that wraps a row edge', () => {
    expect(resolveChain(stateFrom(ART), [3, 4])).toBeNull();
  });

  it('returns null for a chain of mixed colours', () => {
    expect(resolveChain(stateFrom(ART), [1, 2])).toBeNull();
  });

  it('resolves a plain chain', () => {
    const result = resolveChain(stateFrom(ART), [0, 1]);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('plain');
    expect(result?.color).toBe(0);
    expect(result?.cleared).toHaveLength(2);
    expect(result?.scoreDelta).toBe(30);
  });

  it('resolves a square-loop into a board-wide sweep', () => {
    const result = resolveChain(stateFrom(ART), [0, 1, 5, 4, 0]);
    expect(result?.kind).toBe('square-loop');
    // Ten R cells on the board.
    expect(result?.cleared).toHaveLength(10);
    expect(result?.scoreDelta).toBe(300);
  });

  it('resolves a straight run of five into a sweep', () => {
    // A vertical run of five G on a 5-row board.
    const result = resolveChain(stateFrom('G/G/G/G/G'), [0, 1, 2, 3, 4]);
    expect(result?.kind).toBe('line');
    expect(result?.cleared).toHaveLength(5);
  });

  it('returns a board with no empty cells', () => {
    const result = resolveChain(stateFrom(ART), [0, 1, 5, 4, 0]);
    expect(result?.board.includes(EMPTY)).toBe(false);
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
    const result = resolveChain(stateFrom(ART), [0, 1, 5, 4, 0]);
    const indices = result?.cleared.map((c) => c.index) ?? [];
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('advances the rng state', () => {
    const result = resolveChain(stateFrom(ART, 555), [0, 1]);
    expect(result?.rngState).not.toBe(555);
  });

  it('is reproducible for the same seed', () => {
    const a = resolveChain(stateFrom(ART, 99), [0, 1]);
    const b = resolveChain(stateFrom(ART, 99), [0, 1]);
    expect(a).toEqual(b);
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
import type { Board, Chain, Resolution, GameState } from '../types';
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
function isCommittable(board: Board, chain: Chain, cols: number): boolean {
  if (chain.length < 2) {
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

  if (!isCommittable(board, chain, cols)) {
    return null;
  }

  const kind = classifyChain(chain, cols);
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

### Task 12: Deadlock detection and game state

`hasLegalMove` is a correctness safety net, not a fail-state driver — under 8-way adjacency a deadlocked board is effectively unreachable in play, so it is tested against hand-built boards.

**Files:**

- Create: `src/core/deadlock.ts`, `src/core/deadlock.test.ts`, `src/core/game.ts`, `src/core/game.test.ts`

**Interfaces:**

- Consumes: `nextInt` from `./rng`; `resolveChain` from `./resolve/resolve-chain`; `Board`, `Color`, `GameConfig`, `GameState`, `Resolution` from `./types`.
- Produces: `hasLegalMove(board: Board, rows: number, cols: number): boolean`; `newGame(config: GameConfig, seed: number): GameState`; `applyResolution(state: GameState, resolution: Resolution): GameState`.

- [ ] **Step 1: Write the failing deadlock test**

Create `src/core/deadlock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseBoard } from './test-support/board-fixture';
import { hasLegalMove } from './deadlock';

const check = (art: string): boolean => {
  const { board, rows, cols } = parseBoard(art);
  return hasLegalMove(board, rows, cols);
};

describe('hasLegalMove', () => {
  it('finds a horizontal pair', () => {
    expect(check('RRG/BYB/GBY')).toBe(true);
  });

  it('finds a vertical pair', () => {
    expect(check('RGB/RYP/GBY')).toBe(true);
  });

  it('finds a diagonal pair', () => {
    expect(check('RGB/YRP/GBY')).toBe(true);
  });

  it('finds an anti-diagonal pair', () => {
    expect(check('BGR/YRP/GBY')).toBe(true);
  });

  it('is false on a board with no touching same-colour pair', () => {
    expect(check('RG/BY')).toBe(false);
  });

  it('is false on a larger deadlocked board', () => {
    // Every 2x2 window holds four distinct colours.
    expect(check('RGRG/BYBY/RGRG/BYBY')).toBe(false);
  });

  it('does not treat a row wrap as a pair', () => {
    // Cell 1 (row 0, col 1) and cell 2 (row 1, col 0) are both R but not adjacent.
    expect(check('GR/RG')).toBe(true); // diagonal G-G and R-R do touch
    expect(check('GR/YB')).toBe(false);
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
 * True when any two 8-way-adjacent cells share a colour. Only the forward
 * neighbours (right, down-left, down, down-right) are checked, since every
 * pair is reachable that way exactly once.
 *
 * Under 8-way adjacency a false result is effectively unreachable in play;
 * this exists as a correctness net, not as a fail-state driver.
 */
export function hasLegalMove(board: Board, rows: number, cols: number): boolean {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const color = board[index];
      if (col + 1 < cols && board[index + 1] === color) {
        return true;
      }
      if (row + 1 < rows) {
        if (board[index + cols] === color) {
          return true;
        }
        if (col > 0 && board[index + cols - 1] === color) {
          return true;
        }
        if (col + 1 < cols && board[index + cols + 1] === color) {
          return true;
        }
      }
    }
  }
  return false;
}
```

- [ ] **Step 4: Run the deadlock test to verify it passes**

```bash
npm test
```

Expected: PASS — 7 tests green.

- [ ] **Step 5: Write the failing game test**

Create `src/core/game.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './config';
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
    const state = newGame(DEFAULT_CONFIG, 2026);
    for (const color of state.board) {
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThan(DEFAULT_CONFIG.colors);
    }
  });

  it('starts at zero score', () => {
    expect(newGame(DEFAULT_CONFIG, 2026).score).toBe(0);
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
});

describe('applyResolution', () => {
  it('folds board, score, and rng state forward', () => {
    const state = newGame(DEFAULT_CONFIG, 2026);
    // Find any legal adjacent same-colour pair to commit.
    const cols = DEFAULT_CONFIG.cols;
    let chain: number[] | null = null;
    for (let i = 0; i < state.board.length && chain === null; i++) {
      const right = i + 1;
      if ((i % cols) + 1 < cols && state.board[right] === state.board[i]) {
        chain = [i, right];
      }
    }
    expect(chain).not.toBeNull();

    const resolution = resolveChain(state, chain as number[]);
    expect(resolution).not.toBeNull();

    const nextState = applyResolution(state, resolution!);
    expect(nextState.board).toEqual(resolution!.board);
    expect(nextState.score).toBe(resolution!.scoreDelta);
    expect(nextState.rngState).toBe(resolution!.rngState);
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
    const once = applyResolution(state, fake);
    const twice = applyResolution(once, fake);
    expect(twice.score).toBe(240);
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

- [ ] **Step 6: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — cannot resolve `./game`.

- [ ] **Step 7: Create `src/core/game.ts`**

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

- [ ] **Step 8: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS — 10 game tests green.

- [ ] **Step 9: Verify lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors. If sonarjs flags the non-null assertions (`resolution!`) in the test, replace them with an explicit guard:

```ts
if (resolution === null) {
  throw new Error('expected a resolution');
}
```

- [ ] **Step 10: Commit**

```bash
git add src/core/deadlock.ts src/core/deadlock.test.ts src/core/game.ts src/core/game.test.ts
git commit -m "feat(core): add deadlock detection and game state transitions"
```

---

### Task 13: Documentation sync

`CLAUDE.md` and `docs/two-dots-game-design.md` still describe 4-way adjacency and a 2×2-loop-only special clear. Both are now wrong. This task also records the `hot/` boundary rule so it does not erode.

**Files:**

- Modify: `CLAUDE.md`
- Modify: `docs/two-dots-game-design.md`

- [ ] **Step 1: Update the core loop description in `CLAUDE.md`**

Find the "Project Overview" paragraph and replace this line:

```
**Core loop:** drag through ADJACENT same-color dots (up/down/left/right) to link a chain;
chains of ≥2 clear on release; closing a 2×2 loop clears EVERY dot of that color on the board;
survivors fall via gravity and new dots spawn from the top.
```

with:

```
**Core loop:** drag through ADJACENT same-color dots (8-way — orthogonal AND diagonal) to link a
chain; chains of ≥2 clear on release; closing a 2×2 loop OR drawing a straight run of ≥5 clears
EVERY dot of that color on the board; survivors fall via gravity and new dots spawn from the top.
Endless zen — no fail state.
```

- [ ] **Step 2: Update the Scope section in `CLAUDE.md`**

Replace `Two Dots-exact mechanic` in the v1 scope line with `Two Dots-derived mechanic (8-way linking, 2×2-loop and ≥5-line sweeps)`.

- [ ] **Step 3: Add the hot-path boundary rule to `CLAUDE.md`**

Append to the "Development Rules" list:

```
- **`src/core/hot/` is worklet-safe:** no object allocation, no module state, no classes, and no
  imports from `src/core/resolve/`. Dependencies point one way — `resolve/` may use `hot/`, never
  the reverse. Every exported function opens with the `'worklet';` directive.
```

- [ ] **Step 4: Update the requirements in `docs/two-dots-game-design.md`**

Replace these lines in the "Requirements (locked)" list:

```
- Continuous drag gesture; link only ADJACENT same-color dots (up/down/left/right).
- Chain of ≥2 clears on release.
- Closing a square loop → clears every dot of that color on the board.
```

with:

```
- Continuous drag gesture; link ADJACENT same-color dots, 8-way (orthogonal AND diagonal).
- Chain of ≥2 clears on release.
- Closing a 2×2 square loop → clears every dot of that color on the board.
- A straight chain of ≥5 (any of the 8 directions) → clears every dot of that color on the board.
```

- [ ] **Step 5: Add a supersession note to `docs/two-dots-game-design.md`**

Directly under the `**Status:**` line at the top, add:

```
**Superseded in part by** `docs/superpowers/specs/2026-08-01-game-core-engine-design.md`
(2026-08-01): adjacency is now 8-way, a straight run of ≥5 also sweeps the color, grid/color
counts are pinned at 6×6 / 5, and endless mode has no fail state.
```

- [ ] **Step 6: Resolve the answered open questions in `docs/two-dots-game-design.md`**

In "Unresolved Questions", replace these two bullets:

```
- Grid size + color count for v1 (affects difficulty) — pin during planning.
- Endless difficulty ramp: time pressure, move limit, or pure relax mode?
```

with:

```
- ~~Grid size + color count~~ → resolved: 6×6, 5 colors (config values).
- ~~Endless difficulty ramp~~ → resolved: pure relax, no fail state. Blockers and a shrinking
  board are the recorded levers if a fail state is wanted later.
```

- [ ] **Step 7: Verify the full gate**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md docs/two-dots-game-design.md
git commit -m "docs: sync game rules to 8-way linking and line sweeps"
```

---

## Verification

After Task 13, confirm the whole spec is satisfied:

- [ ] `npm run lint && npm run typecheck && npm test` all green
- [ ] `grep -rE "react-native|@shopify|expo|reanimated" src/core/` returns nothing
- [ ] `grep -rn "resolve/" src/core/hot/` returns nothing (one-way dependency holds)
- [ ] `grep -rn "any" src/core/ --include=*.ts` shows no `: any` or `as any`
- [ ] No file in `src/core/` exceeds 200 lines: `find src/core -name '*.ts' | xargs wc -l | sort -rn | head`
- [ ] Every exported function in `src/core/hot/` opens with `'worklet';`
- [ ] Run `superpowers:requesting-code-review` before opening the PR (Definition of Done, step 2)

## Self-Review

**Spec coverage.** Every spec section maps to a task: rules and 8-way adjacency (T2), 2×2 loop with the self-describing sealed chain (T3, T5, T6), straight ≥5 (T4, T6), retrace/reject verdict table (T5), the `Resolution` contract with tagging and ordering (T7, T8, T9, T11), `heightAbove` (T9), threaded RNG determinism (T1, T9, T11), scoring formulas (T10), null-not-throw error handling and the four invariants (T11), deadlock net (T12), `newGame`/`applyResolution` and config throwing (T12), board fixtures and the row-wrap test (T2, T7), doc supersession (T13).

**Placeholders.** None: every code step carries real code, every test step real assertions, and every expected board literal is written out in full.

**Type consistency.** `applyGravity` returns `{ board, falls }` and is consumed as `settled.board` / `settled.falls` in T11. `refill` returns `{ board, spawns, rngState }`, consumed as `filled.*`. `scoreFor(kind, clearedCount, config)` is called with `cleared.length` in T11, matching its T10 signature. `collectCleared(board, chain, kind)` takes three arguments in both T7 and T11. `formsSquareLoop` is defined in T3 and used in T5 and T6 under the same name. `nextInt` returns `RngStep` (`{ value, state }`) in T1 and is destructured as `step.value` / `step.state` in T9 and T12.
