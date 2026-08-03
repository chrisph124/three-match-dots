# Playable Game — Design

**Date:** 2026-08-03
**Status:** Approved via brainstorm. Ready for `superpowers:writing-plans`.
**Scope:** the whole vertical slice — core engine, Skia render, gesture input, animation, score
persistence, and screens. Ends with a playable game on a real iPhone.

## Problem

The app does not work. Nothing is broken: the game was never built. `src/app/game.tsx` renders a
static blue circle labelled "proof of render", and `src/core/` holds a single sample function.
This round builds the game.

It supersedes parts of the core-engine spec at
`docs/superpowers/specs/2026-08-01-game-core-engine-design.md`, which was approved but never
implemented. That document's architecture stands; four of its rules change (see
[Changes to the core spec](#changes-to-the-core-spec)).

## Rules (locked)

- **6×6 board, 3 colors:** green, red, blue.
- **Linking is 8-way.** A chain steps to any of the 8 surrounding cells, same color only.
- **A chain of ≥3 clears on release.** A 2-dot chain does nothing.
- **Closing a 2×2 square clears every dot of that color board-wide.**
- **A straight chain of ≥5 clears every dot of that color board-wide.** "Straight" means every
  consecutive step shares an identical `(Δrow, Δcol)`.
- **Survivors fall; new dots spawn from the top.**
- **No legal 3-chain anywhere → the board auto-shuffles**, rearranging the same 36 dots until a
  legal chain exists.
- **Endless.** No fail state, no timer, no move limit. The run never ends.
- **Score persists across app restarts.** The board does not — every launch deals a fresh board
  and the score continues where it left off.

Rules carried over unchanged from the core spec: retrace-undoes, loop-closure-seals-the-chain,
the self-describing sealed chain, and explicit RNG state threading.

### Changes to the core spec

|                  | `2026-08-01-game-core-engine-design.md` | This design                   | Why                                  |
| ---------------- | --------------------------------------- | ----------------------------- | ------------------------------------ |
| Colors           | 5                                       | **3**                         | Requested.                           |
| Minimum chain    | 2                                       | **3**                         | Requested.                           |
| Deadlock         | safety net that "almost never fires"    | **a real mechanic** — shuffle | See below.                           |
| Game-over screen | assumed present                         | **deleted**                   | No fail state means nothing to show. |

The old spec argued deadlock was a ~1-in-300,000 event and therefore not worth designing around.
That argument assumed 5+ colors and a 2-dot minimum. At 3 colors with a 3-dot minimum, deadlock
becomes rare but genuinely reachable, so it is promoted from safety net to feature.

### Why there is still no fail state

Shuffling on deadlock removes the only condition that could have ended a run. The honest
consequence is a zen game: the player stops when they choose, and the score is a single number
that climbs across sessions. Inventing a timer or move limit to manufacture an ending was
considered and rejected — it is a mechanic nobody asked for.

## Architecture

State ownership splits along the thread boundary.

**React owns the board** and mirrors it into a Reanimated shared value once per commit. **The
gesture worklet owns the in-progress chain** and reads that mirror to validate every touch move on
the UI thread. On release, a single `runOnJS` hop hands the chain to the resolution pipeline.

The bridge is crossed a few times a second — never at touch frequency. This mirrors the core's own
`hot/` (worklet-safe, per-touch) versus `resolve/` (ordinary JS, per-commit) split.

Two rejected alternatives: putting the board _and_ resolution in worklets is pure but harder to
debug and buys no frames, since the board changes only once per commit; running everything through
`runOnJS` on each touch move is the textbook cause of React Native game jank.

```
src/
  core/                       pure TS, RN-free                        ← Vitest
    types.ts config.ts rng.ts
    hot/                      worklet-safe: adjacency, can-append,
                              closes-square, is-line
    resolve/                  classify-chain, collect-cleared,
                              gravity, refill, scoring, resolve-chain
    deadlock.ts               hasLegalMove
    shuffle.ts                shuffleBoard                            ← new
    game.ts                   newGame, applyResolution
  render/
    geometry.ts               cell↔pixel math, worklet-safe           ← Vitest
    palette.ts                color id → hex
    board-canvas.tsx          the Skia <Canvas>
    dot-layer.tsx             36 dots driven by shared values
    link-path.tsx             Skia Path along the live chain
  input/
    use-board-gesture.ts      Pan gesture worklet
  effects/
    use-board-animation.ts    shared values + tween sequencing
  meta/
    use-game-state.ts         board + score, commit orchestration
    score-storage.ts          MMKV read/write
  app/
    index.tsx game.tsx settings.tsx
```

The core keeps the file layout the existing core plan already specifies. Only the constants, the
minimum-length check, and the new `shuffle.ts` differ.

`geometry.ts` is worth calling out: cell↔pixel math is pure arithmetic, so it is both worklet-safe
and Vitest-testable. That pulls hit-testing inside the test boundary instead of leaving it to
on-device guesswork.

### The boundary rule (carried forward)

Nothing in `src/core/hot/` may allocate objects, capture module state, use classes, or import from
`resolve/`. Dependencies point one way: `resolve/` may use `hot/`, never the reverse. `geometry.ts`
follows the same discipline — it takes a read-only layout object of plain numbers and returns
primitives, never allocating per call.

## Shuffle

```ts
shuffleBoard(board, cols, rngState) → { board, moves: CellMove[], rngState }
```

`CellMove` is `{ from, to }` — the same shape as `FallMove`, which becomes an alias for it, since a
fall and a shuffle slide are the same thing to the render layer.

Fisher–Yates over the existing color array, re-rolled until `hasLegalMove` passes, capped at 100
attempts. A 3-color 6×6 essentially always passes on the first try; the cap exists so a
pathological board cannot hang the UI thread. On exhaustion it deals a fresh random board, which is
itself re-rolled under the same cap until `hasLegalMove` passes — the function never returns a
deadlocked board.

It returns `moves` so the render layer can slide dots to their new cells rather than teleport them
— a shuffle must read as a rearrangement, not a wipe. Because it is a permutation, the color
balance the player worked into the board is preserved.

Seeded and deterministic like the rest of the core: `rngState` is threaded in and out, never
hidden in a closure.

## Input

One `Gesture.Pan`. Each `onUpdate` converts the touch point to a cell index and calls
`hot/canAppend`, applying the returned verdict to the chain shared value: append, undo on retrace,
seal on square-close, or ignore.

**A dot registers only when the finger is within 40% of a cell width of its center.** Without a
dead zone between dots, dragging diagonally past a corner silently links a dot the player never
aimed at. This threshold is a constant and is expected to need tuning on device.

Release with fewer than 3 dots clears the chain with no effect. Release with 3 or more calls
`runOnJS` once, handing the chain to `resolveChain`.

The gesture reads an `isResolving` shared value and bails immediately while a resolution is
animating, so input cannot interleave with a cascade.

## Render and animation

Cell positions are fixed — there are always 36 cells. Each cell carries four shared values:
`color`, `dx`, `dy`, `scale`. A dot draws at `center + (dx, dy)`, scaled by `scale`.

**The board is never animated through intermediate states; it is replaced in one step, and
animation is purely an offset from where a dot already belongs.** A falling dot is never moved: it
is placed at its destination with `dy` preset to where it came from, then `dy` tweens to zero. Spawns use the same trick, seeded from the `Resolution`'s
`heightAbove`. Nothing diffs boards; nothing tracks in-flight entities.

Commit sequence, with input locked by `isResolving` throughout:

1. Cleared dots tween `scale → 0`, staggered ~25ms apart along the order the `Resolution`
   guarantees — chain cells in drag order, then sweep cells row-major.
2. The new board is applied; colors update.
3. Falls and spawns tween `dy → 0` together on an ease-in curve.
4. `hasLegalMove` runs. If false, `shuffleBoard` runs and dots slide to their new cells via
   `dx`/`dy`.
5. Unlock.

The whole sequence is budgeted under ~450ms. Longer than that and the lock reads as sluggish
rather than as feedback.

**The live chain** draws as a round-capped Skia `Path` through the linked cell centers and on to
the current finger position, rebuilt in a `useDerivedValue` from the chain shared value.

**One readability cue, not full juice.** The moment a chain closes a 2×2 or reaches a straight 5,
the link path brightens and every dot of that color scales to 1.1. Without it the board-wide sweep
fires with no warning and reads as a bug. This is the only effect in scope beyond the clear, fall,
and spawn tweens.

## Persistence

`react-native-mmkv`, per `CLAUDE.md`. `score-storage.ts` exposes `readScore()` and `writeScore(n)`
and is the only file that touches MMKV, keeping the core clean and the storage choice swappable.

The score is written on each commit. MMKV is synchronous and fast enough that debouncing would be
premature optimization.

**Zustand is deliberately skipped this round.** The state is one board and one number, owned by
`use-game-state.ts`. A store would be ceremony. This is a knowing deviation from the stack table in
`CLAUDE.md`, to be revisited when settings and meta UI grow.

## Screens

| Route           | Change                                                                          |
| --------------- | ------------------------------------------------------------------------------- |
| `index.tsx`     | title, current score, Play, Settings                                            |
| `game.tsx`      | score HUD, back button, the board canvas — replaces the blue-circle placeholder |
| `settings.tsx`  | one action: reset score, behind a confirm                                       |
| `game-over.tsx` | **deleted**                                                                     |

## Error handling and invariants

Nothing on the gesture path throws. `hot/` returns verdicts, never exceptions. `resolveChain`
returns `null` for anything it cannot commit — a chain shorter than 3, or a malformed chain
(non-adjacent steps, mixed colors) indicating a corrupted array crossed the bridge. The input layer
treats `null` as a cancel. Only `newGame` throws, on invalid config, which is a startup-time
programmer error.

Invariants, asserted in tests rather than guarded at runtime:

- after resolution the board contains no empty cells
- `falls` never contains an entry where `from === to`
- `cleared` is duplicate-free
- `spawns.length === cleared.length`
- `shuffleBoard` output is a permutation of its input (identical color counts)
- `hasLegalMove` is true on every board the player can touch

## Testing

Vitest, node environment, scoped to RN-free code. Coverage follows the core spec, plus:

- **`shuffle`** — output is a permutation of the input, always yields a legal move, reproducible
  from a seed, and falls back correctly when the attempt cap is hit
- **`hasLegalMove`** — hand-built deadlocked 3-color boards, and near-miss boards with exactly one
  legal chain
- **`geometry`** — `cellAtPoint` at cell centers, at board edges, inside the dead zone between
  dots, and off-board
- **`canAppend`** — the verdict table row by row, including the 3-dot minimum
- **`isCollinearRun`** — all 8 directions, length 4 versus 5, bend-at-6
- **`resolveChain`** — seeded end-to-end goldens

Board fixtures use string art (`parseBoard("RGB/BRG/...")`, `formatBoard`) so gravity and sweep
failures are readable as text grids rather than raw number arrays.

**The row-wrap bug is named in the tests.** The flat-array representation invites it: `cell + 1` at
the right edge is the first cell of the next row, not a right-neighbor, and the diagonal offsets
wrap identically. `areAdjacent` must compare decoded columns, not raw index deltas.

Render, gesture, and animation are not Vitest-testable per the `CLAUDE.md` test boundary. They are
verified on a real iPhone: drag feel, 60fps through a cascade, the sweep cue firing before the
sweep, and shuffle legibility.

## Docs to update at implementation

`CLAUDE.md` and `docs/two-dots-game-design.md` both still describe 4-way adjacency and a 2-dot
minimum. Both need: 8-way linking, 3 colors, the 3-dot minimum, the straight-5 rule, the shuffle
mechanic, and the Zustand deferral.

## Risks

| Risk                                                                                              | Mitigation                                                                                                                   |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| MMKV is a native module → the dev client must be rebuilt                                          | One `npx expo run:ios`; a dev client is already required for Skia                                                            |
| 3 colors makes a straight 5 easy — sweeps may fire constantly, clearing ~⅓ of the board each time | `MIN_LINE_LENGTH` and `SWEEP_MULTIPLIER` live in `config.ts`; one-line tuning after playtest                                 |
| Resolve animation locks input; too slow feels sluggish                                            | Budget the full clear→fall→settle under ~450ms; timings are constants                                                        |
| Skia ↔ Reanimated shared-value interop                                                            | Versions are Expo-SDK-locked (Skia 2.6.2, Reanimated 4.5.1); prove the binding on a single dot before building the layer out |
| Touch dead zone mistuned → drags feel sticky or jumpy                                             | Threshold is a constant; tune on device, not in the simulator                                                                |

## Out of scope

Particle bursts, combo flair, screen shake, fall-bounce, SFX, levels, difficulty ramp, blockers,
monetization, leaderboards, accounts, Android. Architecture must not block them.

## Success criteria

- Dragging through 3+ same-color dots on a real iPhone clears them; survivors fall, new dots drop
  in, and the score rises.
- Closing a 2×2 or a straight 5 clears every dot of that color, and the cue fires before it does.
- A forced deadlocked board triggers a visible shuffle that leaves a playable board.
- The score survives an app restart.
- 60fps through a full cascade on device.
- Lint, typecheck, and Vitest green. `src/core/` imports nothing from React Native, Skia, or
  Reanimated. No file exceeds ~200 lines. No `any`.
