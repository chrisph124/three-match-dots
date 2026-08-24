---
title: 'Layered cages + first-cage teaching popup'
type: brainstorm
status: accepted
created: 2026-08-24
tags: [voyage, journey, obstacle, cage, tutorial, render, solver, calibration]
handoff: the installed plan skill, then /ak:cook
---

# Layered cages + first-cage teaching popup

## Trigger

User: "what is cage in voyage? I don't know how to solve it — can we have a demo/challenge with a
popup and a 'don't show again' checkbox... I don't like the mechanism of the cage challenge either."

## Evidence (scouted from code, not intent)

1. **Cages are INVISIBLE on the board — in BOTH modes.** `BoardCanvas` props are only
   `board, layout, anim, chainState`; it has zero cage-render code (`src/render/board-canvas.tsx`).
   The `caged` set surfaces only in HUD readouts — Voyage boss HP bar, Journey "Cages" text
   (`src/app/journey.tsx:31`). A caged dot looks identical to a normal dot on the board. **This is
   the primary reason it feels unsolvable — you can't see which dots to clear.** A popup alone does
   not fix it; the cage must be drawn.
2. **The current freeing rule is trivial.** `src/core/obstacles/caged-dot.ts`: a caged dot is an
   ordinary dot wearing a cage overlay (a `Set<CellIndex>`); it links/clears/falls normally; freed
   the instant the caged cell itself is cleared (linked directly, or swept board-wide by a 2×2 loop
   / ≥5 line of its color). `freeCaged` objective completes when the set empties. "The Caged Core"
   (lvl 10) = 8 cages over ≥2 colors.
3. **Doc contradicts code.** `docs/three-dots-game-design.md:132` says a caged dot "can't be linked
   while caged" (freed by adjacent same-color clears) — the classic Two-Dots anchor. The shipped
   code makes it fully linkable. Owner-facing discrepancy; the rework below supersedes it — update
   the doc in the same change.
4. **No tutorial / popup / onboarding infra exists** anywhere in `src/` (grep: none).
5. **MMKV persistence pattern is established** — `createMMKV()` + `storage.set/getString/getNumber`
   in `src/meta/score-storage.ts`, `voyage-progress-storage.ts`. A "don't show again" boolean is a
   one-key add on the same pattern.

## Decisions locked (this session)

| #   | Decision                | Choice                                                                                                                                                |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cage mechanic direction | **Tweak the freeing rule** (not keep-as-is, not replace obstacle)                                                                                     |
| 2   | Teaching format         | **Static popup + "don't show again" checkbox** (not guided demo)                                                                                      |
| 3   | Exact freeing rule      | **Layered cage (N hits / "HP")** — caged dot STAYS LINKABLE; each same-color clear that includes it strips one layer; it only pops on the final layer |

Rule 3 was chosen over the "anchor / free-by-adjacency" option specifically because the caged dot
should remain **linkable** — the player chips it by clearing it, not by clearing around it.

## Delivery contract

- **Outcome:** A player meeting their first cage (a) SEES it on the board with its remaining layers,
  and (b) gets a one-time popup explaining how to break it, dismissible with a persisted
  "don't show again". Cages take N hits to break instead of one.
- **Constraints:**
  - Keep `board-canvas.tsx` at origin-(0,0) — draw the cage overlay in a **sibling layer** (the
    `VoyageEffectsLayer` pattern), not by mutating the board canvas.
  - **Protect the tested colour core** (`src/core/resolve/**`, `src/core/hot/**`) — the original
    cage was deliberately a Journey/Voyage overlay to avoid touching it. The layered rewrite must
    keep that discipline (see Risk R1).
  - Core stays RN-free (Vitest-pure); render math stays geometry-pure.
  - Solver must model the layered rule so every generated level stays **provably winnable**; budgets
    re-calibrated after the rule change (more clears per cage ⇒ more moves/time).
  - Tuning constants (N per difficulty band) live in `src/core/voyage/voyage-config.ts` only.
  - "Don't show again" via existing MMKV `createMMKV()` pattern.
  - Cage art stays paper-craft per the LOCKED `docs/creative-bible.md`.
  - Files ~<200 lines; kebab-case; no `any`; no AI attribution in commits.
- **Non-goals:** a general multi-mechanic tutorial framework (one popup, cage only); replacing the
  cage obstacle; new obstacle types; Android.
- **Acceptance (on-device — worklet/native, not Vitest-testable):**
  - First cage level shows visible cages with a remaining-layer indicator (pips/number).
  - Clearing a caged dot's color chips one layer; the dot pops only on the final layer.
  - `freeCaged` completes only when every cage is fully broken.
  - Popup appears on the first cage encounter; "don't show again" survives an app restart; popup
    never returns after.
  - Generated levels still win within their (re-calibrated) budgets.
- **Automatable gate (pre-handoff to owner):** new/updated Vitest suites for the layered overlay +
  free logic + objective fold + solver winnability; `npm run lint`/`typecheck`/`test`/`coverage:diff`
  green; `src/core/**` RN-free.

## Chosen direction — layered cage (recommended shape)

- **Overlay type:** `Set<CellIndex>` → `Map<CellIndex, number>` (layers remaining). `buildCaged`
  seeds each caged cell with its initial layer count; `freeCleared` → a `chipLayers(caged, resolution)`
  that decrements matched cages and removes (frees) those hitting 0; `remapMoves` remaps map keys
  through gravity/shuffle. `foldObjectives`' `freeCaged` branch already keys off the caged set size —
  keep "done when map is empty".
- **Layer count N (recommended default, tunable):** derived from the difficulty curve, not authored —
  teach band = 1 (behaves like today, so early levels stay gentle), mid = 2, boss cages = 3. All in
  `voyage-config.ts`; refined by the Phase-5-style solver sweep + on-device playtest, not pre-committed.
- **Render:** a new sibling cage-overlay layer over the board (both `journey.tsx` and `voyage-game.tsx`)
  drawing a paper cage per caged cell + a remaining-layer readout (small pips or count). Board canvas
  untouched.
- **Popup:** a lightweight modal (`react-native` `Modal` or absolute overlay) shown on first cage
  encounter — paper-cage icon + one line ("Break a caged dot by clearing its color — link it or sweep
  its color. Layered cages take a few clears.") + a "Don't show again" checkbox persisted to MMKV.
- **Docs:** correct `three-dots-game-design.md:132` and `docs/level-script-schema.md` "Freeing
  semantics" to the layered rule in the same change.

## Blast radius (files, for the planner)

- Core: `src/core/obstacles/caged-dot.ts` (+ test), `src/core/journey/objectives.ts` (freeCaged
  target/fold vs layers), `src/core/voyage/voyage-state.ts`, `src/core/journey/journey-state.ts`,
  `src/core/voyage/solver.ts` (model layers for winnability), `src/core/voyage/voyage-config.ts`
  (N per band), generator/calibration touchpoints (`generate-level.ts`, `episode-1.ts`,
  `difficulty-budget.ts`, `boss.ts`, `cage-layout.ts`).
- Schema: `src/core/level/level-script.ts` — decide if per-obstacle `layers` becomes an optional
  authored field (schemaVersion bump) or stays fully derived (see Q2).
- Render: new cage-overlay component under `src/render/`; wired into `journey.tsx` + `voyage-game.tsx`;
  `voyage-boss-hpbar.tsx` may need to count layers, not cages.
- Meta: new MMKV flag helper (e.g. `src/meta/tutorial-flags.ts`).
- Popup: new component (e.g. `src/render/cage-intro-popup.tsx`).
- Docs: `three-dots-game-design.md`, `level-script-schema.md`, plus the `src/` architecture map if a
  new module boundary lands.

## Risks

- **R1 (highest) — "linkable + resist removal" vs the untouched-colour-core rule.** For a caged dot
  to stay linkable yet survive a non-final clear, something must stop `resolve/**` from removing it.
  Options for the planner to weigh: (a) strip not-yet-final caged cells from the committed chain at
  the `onCommit` boundary so `resolve` never clears them (keeps `resolve/hot` untouched; watch the
  min-chain edge case when stripping shortens the chain); (b) intercept the cleared set in the
  Voyage/Journey fold and re-seat survivors (fights gravity — likely worse). Prefer (a). This is THE
  architecture decision to settle in planning before coding.
- **R2 — solver winnability + budget recalibration.** Layered cages need more clears; the
  winnability sweep and move/time budgets must be re-run/re-tuned or levels become unwinnable (recall
  the level-83 false-halt lesson — the solver is load-bearing).
- **R3 — first-encounter trigger.** "First cage level" needs a definition — first level whose script
  has a `cagedDot` obstacle. Persisted flag must be per-install, not per-level.
- **R4 — tone.** Popup + cage art must stay within the LOCKED creative bible (paper, restrained).

## Unresolved questions (resolve in planning)

1. **R1 implementation** — confirm approach (a) chain-strip-at-commit vs (b) fold-reseat. Needs a read
   of `resolve/**` + the `onCommit` path.
2. **Layer authoring** — is `layers` an optional per-obstacle schema field (schemaVersion bump) or
   purely difficulty-derived? Recommendation: derived for the generated ladder; allow an optional
   authored override only if a curated level needs it.
3. **Exact N per difficulty band** — 1/2/3 is a starting recommendation; final values come from the
   solver sweep + on-device playtest.
4. **Does a board-wide sweep chip every same-color cage by one layer, or fully break them?**
   Recommendation: chip by one (consistent with "each clear = one layer"), so sweeps stay strong but
   not an instant multi-cage win. Confirm the feel on device.
5. **Adjacency vs inclusion for "a clear that hits the cage"** — since the dot stays linkable, the
   natural trigger is _inclusion_ (the caged cell is in the cleared set). Confirm no adjacency
   component is wanted.
