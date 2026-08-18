## Code Review Summary — Phase 3 rework (Endless marble dots + flat-vector city + opaque panel)

### Scope

- Files reviewed (as directed): `src/render/themes/city-themes.ts`, `src/render/marble-texture.tsx`,
  `src/render/backdrop.tsx`, `src/render/board-panel.tsx` (new; `frosted-panel.tsx` confirmed deleted),
  `src/render/dot-layer.tsx`, `src/render/board-canvas.tsx`, `src/app/game.tsx` (comment/prop-wiring),
  `src/render/palette.ts` (comment-only + append-only additions).
- LOC: ~650 across the 6 render files (git diff HEAD).
- Verification method: read every file in full, diffed against `HEAD` (not `main` — `main` is far
  behind this branch), independently re-ran `tsc --noEmit`, `eslint`, `vitest run`, wrote a script to
  recompute WCAG relative-luminance contrast for all 9 marble tones, and read the actual
  `@shopify/react-native-skia` `Transform`/`Matrix4` source to verify the `Group transform` composition
  order rather than assuming it.
- Also inspected (not in the stated file list, but structurally load-bearing for `dot-layer.tsx` and
  therefore in-scope for invariant (h)): `src/effects/use-board-animation.ts`, `src/meta/use-game-state.ts`.

### Overall Assessment

Functionally solid. Every acceptance criterion (a)–(j) in the task holds against the actual code, not
just against code comments. I found no critical or high-severity defect. One real but narrow
concurrency smell in `marble-texture.tsx` (medium), plus a few process/scope notes below.

### Critical Issues

None found.

### High Priority

None found.

### Medium Priority

**1. `src/render/marble-texture.tsx:167-249` — check-then-act race on the module-level bake cache.**
`useMarbleTextures` checks `if (cache)` synchronously (no `await` before the check) and, if null,
starts an async bake. If a second `BoardCanvas` mount starts its own effect while the first bake is
still in flight (e.g. user leaves Endless and returns to it before the ~15 `drawAsImage` calls
resolve), both effect instances see `cache === null` and both bake independently. `cache = baked;`
(line 226) is NOT gated by the `alive` flag, so a torn-down instance can still overwrite the module
cache after unmount. Net effect: duplicate GPU work (~2× the bake cost, ~2MB transient) and
last-write-wins on `cache`, self-healing once both promises settle — no data corruption, no partial
texture set ever gets published (the `throw`/`catch` path correctly aborts to `null` on any failure
before touching `cache`). Not blocking, but worth a generation-token or in-flight-promise dedupe if a
future revision makes the bake heavier or more frequent.
_Fix sketch:_ store the in-flight `Promise<Map<...>>` in the module scope (not just the resolved
`cache`), and have every mount `await` that same promise instead of starting a new bake when one is
already pending.

### Low Priority

**2. Diff scope wider than the task's file list.** `src/effects/use-board-animation.ts` and
`src/meta/use-game-state.ts` are modified in the working tree (uncommitted) and are NOT in the task's
"What changed" list, yet `dot-layer.tsx`'s `mergeStep`/`mergeTravel`/`bounce` shared values only exist
because of that rework (merge relay retimed from a proportional `mergeSpan` stagger to fixed-ms
`MERGE_STEP_MS`/`MERGE_TRAVEL_MS`/`MERGE_MS_MAX`, plus a new drop-bounce term threaded through
`playMove`). I traced the math by hand: for both the chain-terminal cell and sweep-extra cells (which
share `mergeRank = len - 1`), `local` reaches exactly `1` at `mergeT = 1` by construction
(`onset_ms + travel_ms == total` in every branch, clamped or not), so every dot's radius worklet
reaches exactly `0` before `onDone` (`applyAndDrop`) swaps the board — no visible pop/flash artifact,
and the "exactly one tween in flight, `onDone` fires unconditionally" invariant is preserved through
the rework (same reachability argument as `playClear`, restated correctly in the new comment at
`use-board-animation.ts:195-201`). This is a **confirmed-correct** finding, not a bug — flagging only
because it wasn't in the reviewed file list and a reviewer trusting that list alone would have missed
reviewing it at all.

**3. `plans/260817-1217-endless-visual-upgrade/phase-03-backdrop-and-panel.md:4`** still has
`status: pending` in its frontmatter and all Success Criteria checkboxes unchecked, despite the
implementation appearing functionally complete per the checks in this report. Plan mutation is not
mine to do — flagging for the lead/planner to reconcile status and record the measured contrast ratio
in the PR per the plan's own step 2 ("record the ratio in the PR").

**4. `src/render/themes/city-themes.ts` has no dedicated test file**, despite its own top comment
insisting it "must stay Vitest-testable." It's pure data today (no logic), so there's nothing to unit
test yet, but the same comment block warns that a reorder of `DOT_COLORS` would silently break Endless
with zero test failure — the identical risk applies here: nothing currently guards `CITY_THEMES`
being ordered ascending by `scoreMin` (Phase 4's selection logic will depend on that), or that
`sceneFields` stays a well-formed 3-tuple and `skyline` stays within `[0, 1]`. I verified these
invariants hold today by hand (all 4 themes: `scoreMin` 0/6000/15000/30000 ascending; all
`sceneFields` exactly 3 hex strings; all `skyline` values in `[0, 1]`), but a future append that
violates them would pass CI silently.

**5. Unrelated infra changes bundled into the same working tree**: `app.json` (adds `extra.eas.projectId`

- `owner`), `package.json`/`package-lock.json` (expo/expo-router/expo-dev-client patch bumps), and a new
  `eas.json` are all present but out of scope for this visual rework and not mentioned in the task. No
  secrets found (`projectId` is not sensitive; `eas.json` build profiles contain no tokens). Recommend
  splitting into a separate commit for review hygiene, not because of any defect found.

**6. Cosmetic-only**: `src/render/dot-layer.tsx:201-202` picks a dot's marble variant via
`cell % variants.length` (cell = fixed board index), independent of `colorId`. Since `VARIANTS = 5`
and the board is 6 columns wide, this produces a static positional variant lattice across the grid
(every cell always shows the same variant index regardless of which color cycles through it over the
game's lifetime) rather than per-dot-instance variety. Matches the plan's "deterministic from cell
index" requirement, so not a bug — just note this is positional determinism, not per-spawn variety, in
case that reads as repetitive on-device.

### Edge Cases Found by Scout

- Degenerate `scale(0)` on the marble `Group` transform (fully faded/cleared dot): confirmed safe — a
  zero-area transformed circle simply paints nothing, same as the flat path's `r=0`. No NaN/Infinity
  risk since `radius.value` is always clamped non-negative upstream.
- `ImageShader fit="cover"` over `rect={x:-1,y:-1,w:2,h:2}`: source texture is square (`TEX_SIZE`×
  `TEX_SIZE`) and destination is square (2×2 unit-space), so `cover` cannot introduce aspect distortion
  regardless of fit mode — verified, not just assumed.
- `Group transform={[translateX, translateY, scale]}` order: read `Matrix4.ts`'s `processTransform3d`
  (row-major, column-vector convention) to confirm `scale` (last-listed) applies to the point first,
  then the two translates — i.e. the unit circle is scaled by `radius` _before_ being offset by
  `(cx, cy)`, producing pixel parity with the flat `<Circle cx cy r>` path. Verified from source, not
  assumed from array order intuition (getting this backwards would have collapsed every dot toward the
  panel origin as it faded).
- Journey isolation: grep-confirmed only `game.tsx` passes a `backdrop` prop to `BoardCanvas`;
  `journey.tsx:85` passes none. `useMarbleTextures`'s `enabled ? textures : null` return means Journey
  gets `null` unconditionally even when Endless already warmed the shared module cache in the same
  session — verified by reading the return statement, not inferred from the comment.
- Rules of hooks: `useMarbleTextures(backdrop != null)` at `board-canvas.tsx:59` is unconditional, no
  early return above it.

### Positive Observations

- WCAG contrast claim independently re-verified by script (not trusted from the comment): the three
  marble "light" tones vs opaque `PANEL_BASE = '#f8f2e6'` compute to 3.30:1 (red), 3.32:1 (green),
  3.30:1 (blue) — all clear the WCAG SC 1.4.11 non-text 3:1 floor the code claims. This is a genuine
  fix over an earlier (uncommitted, per this branch's own plan doc) first cut that targeted 4.5:1
  against raw `DOT_COLORS` and failed (2.91/1.60/2.89) — see updated agent memory.
- `PANEL_BASE` fill has no alpha channel and no `opacity` prop anywhere in `board-panel.tsx` — opacity
  claim (d) is real, not just asserted, so the single fixed-color contrast measurement is valid
  regardless of which `CITY_THEMES` entry sits behind it.
- `city-themes.ts` and `dot-layer.tsx`/`board-canvas.tsx`/`backdrop.tsx` contain no `any`, no new
  `eslint-disable` beyond one documented, justified `react-hooks/exhaustive-deps` suppression in
  `marble-texture.tsx` with an inline reason. `tsc --noEmit`, `eslint`, and `vitest run` (216/216) all
  independently re-run clean, matching the task's claim.
- `DOT_COLORS[0..2]` unchanged (`#ff4d5e`/`#3ddc84`/`#4f8cff`); `src/core/**` and
  `src/meta/score-storage.ts` untouched by this diff (`git diff HEAD --stat` empty for both).

### Recommended Actions

1. (Optional, medium) Dedupe concurrent bakes in `marble-texture.tsx` via an in-flight promise instead
   of only a resolved-value cache, if this hook is expected to survive rapid Endless remount cycles.
2. (Process) Reconcile `phase-03-backdrop-and-panel.md` status/checkboxes and record the measured
   contrast ratio in the PR per the plan's own step 2 — lead/planner action, not mine to edit.
3. (Optional, low) Add a small Vitest smoke test for `CITY_THEMES` invariants (ascending `scoreMin`,
   3-tuple `sceneFields`, `skyline` in `[0,1]`) before Phase 4 starts depending on the ordering.
4. (Hygiene) Split the `app.json`/`package.json`/`eas.json` infra changes into a separate commit from
   the visual rework.

### Metrics

- Type Coverage: `tsc --noEmit` clean (0 errors), no `any` in touched files.
- Test Coverage: 216/216 Vitest tests passing (unchanged count — no new tests added for
  `city-themes.ts`, see Low #4).
- Linting Issues: 0 in the reviewed files (repo-wide "2 pre-existing warnings" claim not
  re-verified — out of scope, unrelated to this diff).

### Unresolved Questions

- Is the double-bake race in `marble-texture.tsx` (Medium #1) acceptable as-is given how rarely a user
  would round-trip Endless fast enough to hit it, or should it be fixed before merge? Deferring to the
  lead's risk tolerance since it's not a correctness bug.
- Should `use-board-animation.ts`/`use-game-state.ts` (Low #2, out-of-band but load-bearing) get their
  own formal review pass, given they weren't in this task's file list?

Status: DONE_WITH_CONCERNS
Summary: Phase 3 rework meets all 10 stated acceptance criteria against actual source (contrast math,
opacity, hook rules, Journey isolation, transform correctness, animation invariant all independently
verified) with no critical/high defects; one narrow medium-severity concurrency smell in the marble
bake cache, plus scope/process notes (untracked but load-bearing animation-file changes, stale plan
status, missing theme-catalog test, unrelated infra bundled in).
Concerns:

1. (Medium) `marble-texture.tsx` bake-cache check-then-act race on rapid Endless remount — self-healing, no corruption, but unsynchronized shared module state.
2. (Low) Task's file list omitted `use-board-animation.ts`/`use-game-state.ts`, which `dot-layer.tsx` structurally depends on — verified correct by hand, but should be reviewed on its own record.
3. (Low) Plan `phase-03-backdrop-and-panel.md` still marked `pending`; contrast ratio not recorded in a PR anywhere.
4. (Low) No test coverage for `CITY_THEMES` catalog invariants Phase 4 will depend on.
5. (Low) Unrelated `app.json`/`package.json`/`eas.json` infra changes bundled into the same working tree.
