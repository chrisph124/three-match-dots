# Code Review — Phase 3: Three Dots Journey Vertical Slice

Branch: `feat/rn-three-dots-retarget` (uncommitted working tree)
Scope: `src/core/level/**`, `src/core/journey/**`, `src/core/obstacles/**`,
`assets/levels/japan-01.json`, `src/meta/use-journey-state.ts`, `src/app/journey.tsx`,
`src/app/index.tsx`, `src/app/_layout.tsx`, `src/render/palette.ts`.

Verified independently: `npm run typecheck` (clean), `npm run lint` (0 errors, 2
pre-existing warnings in untouched `use-board-animation.ts`/`use-board-gesture.ts`),
`npm test` (208/208 pass). New core modules: 840 LOC impl / 770 LOC test.

## Overall Assessment

The pure-core layer (`level-script.ts`, `journey-state.ts`, `objectives.ts`,
`caged-dot.ts`) is solid: correctly RN-free, well-tested including the two
identity/remap cases the acceptance criteria specifically called out, and the
"Do NOT modify" core files are byte-identical (`git diff` empty for
`resolve/**`, `hot/**`, `game.ts`, `game.tsx`, `score-storage.ts`, `config.ts`
types). `palette.ts` is append-only with indices 0-2 frozen.

The one substantive defect is in the RN hook (`use-journey-state.ts`), which is
outside the Vitest boundary and therefore wasn't caught by the otherwise-strong
test suite. It reuses Endless's `applyAndDrop`/`settle` async pipeline verbatim,
but that pipeline relies on an implicit invariant Endless always held — nothing
else mutates game state between a commit's animation start and its completion —
and Journey's independent countdown timer breaks that invariant. The result is
a confirmed state-desync bug, in one branch severe enough to resurrect an
already-ended run.

## Findings

### HIGH — CONFIRMED: `useJourneyState`'s settle/unlock pipeline uses a stale snapshot, racing the countdown timer

`src/meta/use-journey-state.ts:108-135`

```ts
const settle = useCallback(
  (next: JourneyState) => {
    const { jstate: settled, moves } = settleJourney(next);
    if (moves.length === 0) {
      unlock(chainState);
      return;
    }
    ...
    publish(settled);
    playMove(anim, offsetX, offsetY, SHUFFLE_MS, () => unlock(chainState));
  },
  [anim, cellCount, chainState, layout, publish],
);

const applyAndDrop = useCallback(
  (resolution: Resolution) => {
    const next = applyJourneyResolution(latest.current, resolution);
    ...
    publish(next);
    playMove(anim, offsetX, offsetY, FALL_MS, () => settle(next));
  },
  [anim, cellCount, layout, publish, settle],
);
```

`next` is computed once, synchronously, when a chain clear finishes, then
closed over for the `FALL_MS` (220ms) tween before `settle(next)` actually
runs. The countdown timer (`src/meta/use-journey-state.ts:150-179`) is an
independent `setInterval` that mutates `latest.current` (and React state) on
its own 100ms cadence, entirely outside this callback chain. If the timer
flips `status` to `'lost'` while a commit's clear/fall animation is still
in flight, `settle` still receives the **stale, pre-timeout** `next` — not
`latest.current` — with `status: 'playing'`. Two concrete consequences, both
confirmed by tracing (not observed on-device):

1. **Every accepted resolution that doesn't itself trigger a reshuffle**
   (i.e. `moves.length === 0` — the common case, including the normal win
   path) calls `unlock(chainState)` unconditionally. This directly
   contradicts the hook's own stated invariant at `use-journey-state.ts:181-186`
   ("Freeze input the moment the run ends, so no chain can commit
   post-result"). On a win, the sequence is: `applyJourneyResolution` sets
   `status: 'won'` → the status-watching `useEffect` locks `isResolving` →
   ~220ms later `settle`'s `moves.length === 0` branch unlocks it again. There
   is no other gate on the `Gesture.Pan()` in `journey.tsx` (no `.enabled()`
   guard) — the _only_ thing stopping further chain commits after the run
   ends is `isResolving`, and this path un-freezes it on every single win.
   Currently masked by the full-screen win/lose overlay intercepting touch by
   default (a plain `View`, no `pointerEvents` override), so not directly
   exploitable today, but it is a real invariant violation with no
   defense-in-depth behind it.

2. **Severe variant — state resurrection.** If the timer's loss transition
   lands during the animation window _and_ that resolution's board is a
   deadlock, `settleJourney(next)` takes the reshuffle branch and returns
   `settled = { ...next (stale, status: 'playing'), game: shuffledBoard, caged: remapped }`.
   `publish(settled)` then **overwrites** `latest.current`/React state,
   replacing the real `'lost'` status (and the real, drained
   `timeRemainingMs`) with the stale pre-timeout snapshot. The win/lose
   overlay would disappear, the timer would resume counting down from its
   earlier value, and the `setInterval` (never stopped — it only gates on
   `latest.current.status !== 'playing'` each tick) picks the countdown back
   up. A run the player already saw end as "Time's Up" would silently
   un-end.

3. A related instance of the same root cause: `commit`'s null-resolution
   branch (`use-journey-state.ts:140-144`) calls `unlock(chainState)`
   unconditionally after `registerMistake`, even though `registerMistake`
   can itself drain the last of the time and flip `status` to `'lost'` —
   the mistake that ends the run still unlocks input for it.

**Root cause:** `settle`/`applyAndDrop` operate on a value captured before an
async boundary instead of re-reading `latest.current` at the point they
actually execute, and neither checks the _current_ status before publishing
or unlocking. This is a real gap Endless's original pattern never needed to
guard against — Endless has no independent async mutator of `GameState`
(no timer, no fail state), so `next` and `latest.current` never diverge there.
Journey's timer is the first concurrent state mutator in this codebase, and
the reused pipeline wasn't adapted for it.

**Supporting evidence of the gap:** `tick` and `registerMistake` each have an
explicit "is a no-op once the run has ended" Vitest case
(`journey-state.test.ts:157`, `:185`); `applyJourneyResolution` and
`settleJourney` have no equivalent test for that transition, which matches
where the RN-layer bug lives (the pure functions correctly no-op when given
a non-`'playing'` state — the bug is that the _hook_ doesn't always give them
the current one).

**Fix:** have `settle` (and the null-commit branch) re-derive from
`latest.current` and bail when it isn't `'playing'`, rather than trusting a
closure-captured snapshot:

```ts
const settle = useCallback(() => {
  if (latest.current.status !== 'playing') {
    return; // authoritative state says the run already ended
  }
  const { jstate: settled, moves } = settleJourney(latest.current);
  if (moves.length === 0) {
    unlock(chainState);
    return;
  }
  const { offsetX, offsetY } = buildMoveOffsets({ moves }, layout, cellCount);
  publish(settled);
  playMove(anim, offsetX, offsetY, SHUFFLE_MS, () => unlock(chainState));
}, [anim, cellCount, chainState, layout, publish]);

// applyAndDrop: playMove(..., () => settle());  // no argument — settle reads latest.current itself
```

and in `commit`'s null branch, only unlock when the post-penalty state is
still playing:

```ts
if (resolution === null) {
  const nextState = registerMistake(latest.current);
  advance(nextState);
  if (nextState.status === 'playing') {
    unlock(chainState);
  }
  return;
}
```

As defense-in-depth (optional, not required to fix the bug above), consider
gating the `Gesture.Pan()` itself on `journey.status === 'playing'` so
`isResolving` isn't the sole line of defense against post-result input.

### MEDIUM — CONFIRMED: `objectives.ts` doc comment claims a validation the parser doesn't perform

`src/core/journey/objectives.ts:19-23` states: "a level with no cages
completes it immediately (a degenerate case **the level parser rejects**, but
kept honest here)." `src/core/level/level-script.ts`'s `superRefine` (lines
110-177) has no rule tying a `freeCaged` objective to `obstacles.length > 0` —
grepped for `freeCaged`/`obstacles` and confirmed no such check exists. A
level authored with `objectives: [{ type: 'freeCaged' }]` and no `cagedDot`
obstacles parses successfully today and, at runtime, starts with that
objective already `done: true` (target `0`, current `0`) — a degenerate but
silent authoring footgun the comment incorrectly claims is caught at parse
time.

Not exploitable by the shipped `japan-01.json` (which does have 3 obstacles),
so this doesn't block the vertical slice, but the comment should either be
corrected (drop the "the level parser rejects" claim) or the parser should
gain the guard it currently claims to have — e.g. in `superRefine`:

```ts
if (level.objectives.some((o) => o.type === 'freeCaged') && level.obstacles.length === 0) {
  ctx.addIssue({
    code: 'custom',
    path: ['objectives'],
    message: 'freeCaged requires at least one cagedDot obstacle',
  });
}
```

### LOW — informational: `japan-01.json` "winnable" claim is a start-state proxy, not a full solve

Acceptance criterion 2 says japan-01 "is winnable under that seed." The
fixture test (`src/core/level/japan-01.test.ts:46-52`) only proves the dealt
board has a legal move and contains at least one dot of the objective color at
open — it does not simulate play to prove the 60s timer / 10-count
`clearColor` + 3-cage `freeCaged` combination is actually completable. This is
explicitly and correctly disclosed both in the test's own comment and in the
plan document ("a statistical N-seed checker is deferred; note the limit"), so
it's not a hidden gap — just flagging that the acceptance-criteria wording
("is winnable") is stronger than what's actually proven. Recommend an
on-device playtest pass before shipping this level (already called out in the
plan's own on-device QA checklist).

### LOW — style/DRY: `levelToConfig(level)` computed twice per Journey mount

`src/app/journey.tsx:47` (`JourneyRun`'s `config` memo) and
`src/meta/use-journey-state.ts:74` (`cellCount` memo) each independently call
`levelToConfig(level)`. Cheap and pure, so no real cost, but the hook could
accept `cellCount`/`config` from the caller (which already computed it) rather
than recomputing internally — minor duplication, not worth blocking on.

### LOW — informational: `newJourney` doesn't use `LevelScript.mode` to narrow input

`src/core/journey/journey-state.ts:33-45`: `newJourney` accepts any
`LevelScript` regardless of `mode`. `timeRemainingMs: level.timer?.startMs ?? 0`
means an `endless`-mode `LevelScript` (which the schema permits, with no
`timer`) would open with `status: 'playing'` and 0ms remaining, and the very
first `tick()` would immediately flip it to `'lost'`. Not reachable in this
slice (only the journey-mode `japan-01.json` is ever routed through
`newJourney`), so this is a type-safety nit rather than a live bug — noting it
so a future caller doesn't get bitten if endless-mode `LevelScript`s are ever
threaded through this path.

## Acceptance Criteria Checklist

1. New core modules TDD'd, including caged-overlay identity case and
   deadlock-reshuffle remap — **met**. `caged-dot.test.ts` covers all three
   cases from the plan (frees-on-clear, follows-a-fall, identity-when-absent)
   plus a dedicated shuffle-permutation remap test and a free-then-remap
   ordering test.
2. `japan-01.json` parses/validates, fixed seed, colors > palette rejected —
   **met**, with the caveat above that "winnable" is a start-state proxy, not
   a full solve (disclosed, not hidden).
3. Journey drives the level's board dims, timer via timestamp deltas,
   AppState pause, `registerMistake` on null commit — **met** structurally;
   see the HIGH finding above for a race in the settle/unlock plumbing that
   undermines the "freeze input on end" part of this criterion.
4. Endless unaffected — **met**. `git diff` confirms byte-identical
   `src/core/resolve/**`, `src/core/hot/**`, `src/core/game.ts`,
   `src/app/game.tsx`, `src/meta/score-storage.ts`. No MMKV import anywhere
   under `src/core/journey/**`, `src/meta/use-journey-state.ts`, or
   `src/app/journey.tsx` (grepped).
5. New `src/core/**` modules import no RN/Skia/Reanimated — **met**, grep
   confirms zero matches.
6. Lint + typecheck + tests green — **met**, independently reproduced (208/208
   tests, 0 lint errors, clean typecheck).

## kongming-ruled invariants

- clearBonusMs added once per accepted commit, not per cleared dot —
  **confirmed**, `journey-state.ts:85` reads `jstate.level.timer?.clearBonusMs`
  once per `applyJourneyResolution` call regardless of `resolution.cleared.length`;
  directly tested (`journey-state.test.ts:248-262`).
- Cage remap uses identity-default for absent indices — **confirmed**,
  `caged-dot.ts:49` (`map.get(idx) ?? idx`), directly tested
  (`caged-dot.test.ts:57-62`).
- minChain parse-guarded to [2,4] — **confirmed**, `level-script.ts:62`
  (`.min(2).max(4)`). Note the deadlock.ts docstring says `hasLegalMove` is
  "sound... provided minChain is 3 or 4", which reads as if 2 were excluded;
  it isn't a bug — a component of size ≥2 in the same-color adjacency graph is
  connected by construction, so the 2-case is trivially sound (no combinatorial
  argument needed, unlike 3-4). `docs/level-script-schema.md` independently
  confirms the lower bound of 2 was chosen to match `newGame`'s own runtime
  guard, not `hasLegalMove`'s soundness bound — so the code and docs are
  consistent with each other; only the deadlock.ts docstring's phrasing is
  slightly imprecise about why 2 works. Not blocking.

## Unresolved Questions

- Should the HIGH finding's fix land before merge, or is the vertical slice
  intentionally shipping with "verify on-device" as the gate for RN-layer
  bugs? Given the bug requires a specific timing window (a commit's animation
  in flight exactly when the timer reaches zero, compounded with a deadlock
  for the severe variant), it may not surface in a short on-device QA pass —
  recommend fixing before merge rather than relying on manual QA to catch it.
- Is the `objectives.ts` doc-comment mismatch (Medium finding) worth an actual
  parser guard, or just a comment fix? Depends on whether Journey levels
  beyond `japan-01` are expected to author `freeCaged` without cages (unlikely
  by design, but the schema currently allows it).
