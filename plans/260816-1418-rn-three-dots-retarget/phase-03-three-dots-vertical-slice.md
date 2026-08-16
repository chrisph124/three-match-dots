---
phase: 3
title: 'Three Dots Journey Vertical Slice'
status: done # todo | in-progress | done (code complete + core-tested; on-device QA is the remaining human gate)
priority: P1
effort: '2-3d'
dependencies: [2]
---

# Phase 3: Three Dots Journey Vertical Slice

## Overview

Prove the Three Dots concept end-to-end on the existing RN engine: a level-script
loader, a pure-TS Journey layer (countdown timer, mistake-time penalty,
objectives), one `cagedDot` obstacle, and one hand-authored Japan city wired
through a new Journey route. Endless mode stays exactly as it ships. All new game
logic is pure and Vitest-tested **before** any render/gesture wiring.

## Requirements

- Functional:
  - A level-script JSON parses + validates into a typed `LevelScript` and maps to
    a `GameConfig` (board) plus Journey config (time, objectives, obstacles).
  - Journey adds: a countdown timer; a mistake penalty (an attempted chain that
    resolves to nothing subtracts time); objective tracking for `clearColor`
    (clear N dots of a color) and `freeCaged` (free all caged dots); win when all
    objectives met, lose when the timer hits zero.
  - A `cagedDot` obstacle: a caged cell is freed when it is cleared by **any**
    clear of its color — a normal ≥3 chain, a 2×2-loop sweep, or a ≥5-line sweep.
    Loop/line sweeps clear that color **board-wide** (one sweep can free every
    cage of a color at once — a tuning consideration, not a bug). Freeing all
    caged cells satisfies a `freeCaged` objective.
  - **Deadlock:** when the board has no legal move, Journey reshuffles by reusing
    the shipped core path (`shuffleBoard`), exactly like Endless — and remaps the
    caged overlay through the shuffle's `moves` so cages never desync from their
    dots (Decision A; the same `remapMoves` helper handles gravity _and_ shuffle).
  - One playable Japan city level, reachable from the title screen via a new
    Journey route, showing timer + objectives HUD + win/lose result.
  - Endless (`src/app/game.tsx`) is unchanged.
- Non-functional:
  - All Journey/level/obstacle logic lives in pure `src/core/**` (no RN/Skia/
    Reanimated imports) and is Vitest-tested. Timer/HUD/route are verified
    on-device (not Vitest-testable).
  - The tested color-board core (`resolve*`, `hot/*`, `gravity`, `scoring`) is
    **not** modified — the Journey layer folds over the existing `Resolution`
    output. Cage state is a Journey-layer overlay keyed by cell index, never a
    new color in the `Board`.
  - **Journey persistence: none this slice (Decision B).** Journey reads and
    writes **no** MMKV; `src/meta/score-storage.ts` and the shared `'score'` key
    are untouched. Timer/score are in-session only. (Best-time/stars are deferred;
    when a real second level lands, give Journey its own key namespace, e.g.
    `journey.<id>.*` — never the Endless `'score'` key.)

## Architecture

Journey is a **parallel layer** wrapping the existing core, not a rewrite. The
seams (verified in code):

- `GameState = { config, board, score, rngState }`; `newGame(config, seed)`;
  `applyResolution(state, resolution)`.
- `resolveChain(state, chain) → Resolution | null` — **null is the mistake
  signal** (chain too short / non-committable).
- `Resolution.cleared: ClearedCell[]` (each has `index`, `color`, `reason`) — the
  fold source for objectives and cage-freeing.
- `useGameState` (meta hook) drives commit → animate → settle; `game.tsx` reads
  `DEFAULT_CONFIG` directly.

New pure core modules:

- `src/core/level/level-script.ts` — `LevelScript` type (incl. an **optional
  `seed`**), `parseLevelScript(json): LevelScript` (zod, with the fail-fast bounds
  from Phase 2: `colors ≤ palette length`, the board-legality invariant
  `colors × minChain ≤ rows × cols`, `obstacle.cell` in board bounds,
  `objective.color < colors`, non-empty objectives, sane ranges; `spawnWeights`
  optional/no length rule), and `levelToConfig(level): GameConfig`. Shape follows
  `docs/level-script-schema.md` (Phase 2).
- `src/core/journey/journey-state.ts` — `JourneyState = { game: GameState, level,
timeRemainingMs, objectives: ObjectiveProgress[], caged: ReadonlySet<CellIndex>,
status: 'playing'|'won'|'lost' }`; `newJourney(level, seed)` (uses `level.seed`
  when authored, else a session seed); `tick(jstate, dtMs)` (decrements time,
  flips to `'lost'` at 0); `applyJourneyResolution(jstate, resolution)` (folds
  score via `applyResolution`, advances objectives, frees cleared caged cells,
  **then remaps every surviving caged index via `remapMoves(caged,
resolution.falls)` — identity for cells that didn't move**, re-evaluates win);
  `settleJourney(jstate)` (on deadlock, reshuffle via the core path and
  `remapMoves(caged, shuffle.moves)` — Decision A); `registerMistake(jstate)`
  (subtracts the level's penalty on a null commit, never below 0).
- `src/core/journey/objectives.ts` — objective kinds `clearColor` / `freeCaged`,
  `ObjectiveProgress`, and a pure `foldObjectives(progress, resolution, caged)`.
- `src/core/obstacles/caged-dot.ts` — cage overlay helpers: build the initial
  caged set from the level; `freeCleared(caged, resolution)` returns the set
  narrowed to cells not in `resolution.cleared`; and a single generic
  `remapMoves(caged, moves: readonly CellMove[])` that translates every surviving
  caged index through a `from→to` map. `Resolution['falls']` and `shuffleBoard`'s
  `moves` are **both `CellMove[]`** (`types.ts`), so the _same_ helper covers
  gravity **and** the deadlock reshuffle — do not write two.
  **Contract — default to identity:** iterate over the `caged` set and map each
  index via `map.get(idx) ?? idx`. `applyGravity` only emits a move when `from !==
to` (`gravity.ts`), so a stationary caged cell is **absent** from the move list
  and must stay put, _not_ be dropped. `freeCleared` + `remapMoves` run per
  resolution; `remapMoves` also runs after a Journey deadlock reshuffle
  (Decision A). Core resolve/shuffle is untouched.

Cage gravity semantics (assumption, v1): a caged dot is an ordinary dot that
happens to wear a cage — it links, clears, and **falls under gravity like any
other cell**; the cage is a Journey-layer overlay only. An "immovable blocker"
cage (gravity-exempt, splits columns) is a different obstacle that would require
changing `resolve/**` and is therefore **deferred**, not built in this slice. If
the intended feel is the blocker variant, stop and confirm scope with the user
before implementing `caged-dot.ts`.

New meta/UI (on-device verified):

- `src/meta/use-journey-state.ts` — an **independent** hook (it does **not**
  import or wrap `useGameState`, which hardcodes `newGame(DEFAULT_CONFIG, …)` and
  has no `config` param). It calls `newGame(levelToConfig(level), seed)` directly
  so the board is the level's, not the Endless 6×6/3-color default; owns the timer
  (computing `dtMs` from timestamp deltas, with an `AppState` pause listener —
  see Risk Assessment), exposes `timeRemaining`, `objectives`, `status`, and a
  `commit` that calls `registerMistake` when `resolveChain` returns null. Mirrors
  only `use-game-state.ts`'s _mutation-safety pattern_ (plain module-level
  writers), not its config.
- `src/app/journey.tsx` — new expo-router route: load `japan-01.json` →
  `parseLevelScript` → `newJourney`; render board (reusing `BoardCanvas`) + timer
  - objectives HUD + win/lose overlay.
- `src/app/index.tsx` — add a "Journey" entry point (Link → `/journey`).

Assets:

- `assets/levels/japan-01.json` — one hand-authored level (board + time budget +
  `clearColor` and `freeCaged` objectives + a few caged cells).

## Related Code Files

- Create: `src/core/level/level-script.ts` (+ `level-script.test.ts`)
- Create: `src/core/journey/journey-state.ts` (+ `journey-state.test.ts`)
- Create: `src/core/journey/objectives.ts` (+ `objectives.test.ts`)
- Create: `src/core/obstacles/caged-dot.ts` (+ `caged-dot.test.ts`)
- Create: `assets/levels/japan-01.json`
- Create: `src/meta/use-journey-state.ts`
- Create: `src/app/journey.tsx`
- Modify: `src/app/index.tsx` (add Journey entry point)
- Modify: `src/app/_layout.tsx` (register the `journey` `Stack.Screen` + title)
- Modify: `src/render/palette.ts` (extend `DOT_COLORS` to ≥5 distinguishable,
  colorblind-considerate hues so levels can use >3 colors — Decision C; the zod
  validator caps `colors` at the palette length)
- Add dep: `zod` (runtime validation for level scripts)
- Do NOT modify: `src/core/resolve/**`, `src/core/hot/**`, `src/core/game.ts`,
  `src/core/config.ts` types, `src/app/game.tsx`

## Implementation Steps

1. **Add `zod`** via `npx expo install zod` (let Expo pick the compatible
   version; do not hand-pin).
2. **Level script (TDD).** Write `level-script.test.ts` first (valid parse,
   rejects malformed/missing fields, `levelToConfig` maps board fields to
   `GameConfig`), then implement `level-script.ts`.
3. **Objectives (TDD).** Test `foldObjectives` for `clearColor` progress and
   `freeCaged` completion off sample `Resolution`s, then implement.
4. **Caged obstacle (TDD).** Write `remapMoves`/`freeCleared` tests before
   implementing, covering all three cases: (a) `freeCleared` narrows the caged set
   only when a cleared cell was caged; (b) a caged index that **moves** (a cell
   below it clears via an unrelated chain) follows its dot through
   `resolution.falls` and is _not_ freed; (c) **identity** — a caged index that
   neither clears nor appears in the move list (the common case, since
   `gravity.ts` emits a move only when `from !== to`) is left **unchanged**, not
   dropped. Also test `remapMoves` reused on a `shuffleBoard` `moves` array remaps
   every caged index with none dropped/duplicated (Decision A). Then implement
   `caged-dot.ts`.
5. **Journey state (TDD).** Test `newJourney` (uses `level.seed` when set), `tick`
   (time decrements; hits `'lost'` at 0), `registerMistake` (subtracts penalty;
   never below 0), `applyJourneyResolution` (score folds, objectives advance,
   cages free + remap, win flips to `'won'` when all objectives met), and
   `settleJourney` (deadlock → reshuffle → caged overlay stays consistent). Then
   implement `journey-state.ts`.
6. **Author `japan-01.json`** matching the Phase 2 schema **with a fixed `seed`**
   (deterministic board). Add a fixture test asserting it parses/validates, that
   its caged cells' dealt colors match intent under that seed, and that it is
   winnable under that seed (objectives reachable). (A single fixed seed proves
   _this_ board solvable — a statistical N-seed checker is deferred; note the
   limit.)
7. **Extend the palette (Decision C).** **Append** new distinguishable hues to
   `src/render/palette.ts#DOT_COLORS` **after** the existing three — do **not**
   reorder or change the hex of indices 0-2. Endless renders those indices, and
   `palette.ts` sits outside the Vitest boundary, so a reshuffle would silently
   change Endless's on-screen colors with **zero diff** under the protected core
   files — the "Endless unaffected" criterion could not catch it. Use a named
   colorblind-safe ramp (e.g. Okabe–Ito) and sanity-check against
   `docs/creative-bible.md`. The zod validator rejects `colors` beyond the palette
   length. **Explicit deferral:** the creative-bible's LOCKED "identity = color +
   shape/pattern, never color alone" rule is **not** satisfied by hue choice alone
   — the shipped `dot-layer.tsx` draws plain circles with no shape channel.
   Shape/pattern differentiation is **deferred** in this slice and recorded as a
   known accessibility gap (see Phase 2), not something this step closes.
8. **Meta hook.** Implement `use-journey-state.ts` as an **independent** hook
   calling `newGame(levelToConfig(level), seed)` directly (do **not** import
   `useGameState`); timer clock computing `dtMs` from timestamp deltas + an
   `AppState` pause listener; `commit` that calls `registerMistake` on a null
   resolution. Reuse only the mutation-safety pattern (plain module-level writers).
9. **Route + HUD.** Implement `src/app/journey.tsx` (board via `BoardCanvas` +
   timer + objectives + win/lose overlay); register a `journey` `Stack.Screen`
   (with title) in `src/app/_layout.tsx`; add the Journey entry point to
   `src/app/index.tsx` (without disturbing the existing Play/Settings links or the
   score re-read).
10. **Verify.** `npm run lint && npm run typecheck && npm test` green for all new
    core tests. Then the **on-device QA checklist** (the composition bugs Vitest
    can't see): play `japan-01` on the level's board dimensions (not 6×6);
    countdown runs and a no-op drag subtracts time; background→foreground
    **pauses** (no snap-to-lose); clearing frees caged dots (incl. a board-wide
    sweep freeing cages); a Journey deadlock reshuffles with cages intact;
    objectives complete → win, timeout → lose; then **return to Endless and
    confirm its persisted score and board are untouched**; and confirm authoring a
    level with `colors > palette length` is rejected at parse time.

## Success Criteria

- [x] New core modules (`level-script`, `objectives`, `caged-dot`,
      `journey-state`) each have passing Vitest tests written before their code —
      including the caged-overlay **identity** case and the deadlock-reshuffle
      remap. _(209 tests green across 22 files.)_
- [x] `assets/levels/japan-01.json` parses/validates, has a fixed `seed`, and is
      winnable under that seed; `colors > palette length` is rejected at parse.
      _(`japan-01.test.ts`: legal, non-deadlocked start under seed 20260816 = the
      winnability **proxy**; a statistical N-seed solvability checker stays
      deferred per step 6.)_
- [ ] **On-device QA — human gate, PENDING.** Journey route plays on-device:
      countdown runs, mistake subtracts time, background **pauses** the timer (no
      snap-to-lose), caged dots free on clear (incl. board-wide sweep), a deadlock
      reshuffles with cages intact, objectives complete → win, timeout → lose, and
      the board uses the level's dimensions (not `DEFAULT_CONFIG`). _(Not
      Vitest-testable — route/timer/HUD are RN/worklet. Checklist embedded in
      `use-journey-state.ts` and carried in the PR banner.)_
- [x] Endless is unaffected — **static half proven**: no diffs under
      `src/core/resolve/**`, `hot/**`, `game.ts`, `game.tsx`,
      `score-storage.ts`, `config.ts` (git status clean on all). _(The on-device
      replay — play Endless after a Journey session, persisted `'score'`/board
      intact — remains part of the on-device QA gate above; Journey writes no
      MMKV.)_
- [x] `src/core/**` new modules import no RN/Skia/Reanimated symbols. _(grep of
      `journey/`, `level/`, `obstacles/` for RN/Skia/Reanimated/expo `from`
      imports → none.)_
- [x] Lint + typecheck + tests all green (no-any, sonarjs clean). _(typecheck
      clean; ESLint 0 errors / 2 pre-existing exhaustive-deps warnings; 209/209.)_

## Risk Assessment

- **Timer jitter / drift / background-catchup.** Signal: on-device countdown
  stutters, fights the gesture worklet, or — worst — snaps straight to `'lost'`
  the instant the app returns from background (queued JS timers firing in a
  burst). Response: (1) compute authoritative time from **timestamp deltas**, not
  tick counts, so a burst can never over-subtract — feed the pure reducer a
  clamped `dtMs`; (2) drive display time from a Reanimated clock/`useFrameCallback`
  on the UI thread (coarse 100 ms `setInterval` is an acceptable slice fallback);
  (3) **pause on background** via an explicit `AppState.addEventListener('change',
…)` listener — there is no existing `AppState` usage in the repo, so wire it
  deliberately. This is an on-device Success Criterion, not a footnote.
- **Palette extension breaks Endless visual parity or overstates accessibility.**
  Signal: an Endless dot changes color on device after the palette edit, or the
  ported creative-bible color+shape rule reads as satisfied when the renderer
  still draws plain circles. Response: append-only palette edits (indices 0-2 hex
  frozen); keep shape/pattern differentiation an **explicit deferred gap**, not a
  silent claim (Phase 2 annotates the doc's shipped-status).
- **Cage semantics leak into the color core.** Signal: a change to
  `resolve/**` or a new `Board` color is needed. Response: stop — cages are a
  Journey-layer overlay folded over `Resolution.cleared`; re-derive without
  touching the tested core. If the concept genuinely can't be expressed as an
  overlay, replan the obstacle scope with the user.
- **`japan-01` unwinnable / unfun.** Signal: objectives unreachable in the time
  budget on-device. Response: tune the JSON only (time, objectives, cage count) —
  data, not code; that is the whole point of the level-script contract.
- **Journey scope creep (stars, city map, more countries).** Signal: the slice
  starts absorbing roadmap items. Response: those are explicitly deferred (see
  plan Deferred Scope); the slice ships one city, two objective kinds, one
  obstacle.
