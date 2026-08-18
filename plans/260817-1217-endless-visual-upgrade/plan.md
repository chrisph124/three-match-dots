---
title: 'Endless Visual Upgrade'
description: 'Make Endless mode look and feel premium: a first-to-last chain merge relay with per-hop fade and a soft drop bounce, dead-flat solid-colour dots (bright frozen hues, colour-only) on an inset dark board panel over a dark, receded flat-vector city skyline that evolves at score milestones, and a fuller paper-craft UI across the title, game, and settings screens.'
status: in-progress
priority: P1
effort: "~6-9 dev-days across 6 shippable PRs (+1 deferred art-gated slice); Phases 1 & 3 reworked 2026-08-17; Phase 3 refined (full-bleed + cat's-eye marble) 2026-08-17, re-pivoted (matte candy + dark receded inset board) 2026-08-18, then simplified (flat colour-only dots + dark city skyline, marble subsystem deleted) 2026-08-18"
tags: [endless, visual, skia, reanimated, reduce-motion, paper-craft]
created: 2026-08-17
blockedBy: []
blocks: []
---

# Endless Visual Upgrade

## Overview

Reskin and enrich the **shipped, playable Endless mode** without touching its game
logic. Three visible payoffs, delivered as an ordered PR series:

1. **Chain merge relay + drop bounce** — on commit, the linked dots collapse as a
   _first→last traveling relay_, each dot fading as it lands on the next (the pop is
   folded into each hop); refilled dots settle with a soft bounce.
2. **Flat colour dots + inset dark board over a dark, receded city skyline** — dots are
   _dead-flat solid-colour discs_ on the **bright frozen hues** (identity is **colour-only** —
   no shape/pattern channel, no shading, no light, no gloss, no ring); the board sits **inset
   with a margin** (Journey-like framing, not full-bleed) on an _opaque dark framed panel_ over
   a **dark, receded, crisp flat-vector** city **skyline** (no gradient, no blur) that
   **cross-fades at score milestones** (pure function of the already-persisted score — no timer,
   no fail state, one continuous board). The dark, receded scene **complies** with the bible's
   "backgrounds recede" — no exception needed, and the bright dots clear WCAG contrast on the
   dark ground where they could not on a light panel. (The LOCKED §2.2 colour+shape rule stays
   **unmet** — the user chose colour-only and accepted the gap; same as the shipped app.)
3. **Fuller paper-craft UI** — title, HUD, and settings become an intentional
   paper-craft interface instead of bare centered text.

Design authority for this work: the accepted brainstorm brief
(`plans/reports/brainstorm-260817-1139-endless-visual-upgrade.md`) and the approved
annotated mockup (`scratchpad/endless-visual-mockup.html`), refined by the Phase 3
look-change brief (`plans/reports/brainstorm-260817-1920-endless-fullbleed-catseye-marble.md`),
re-pivoted by the matte-candy / dark-receded brief
(`plans/reports/brainstorm-260818-0054-endless-matte-candy-dark-receded.md`), then
**simplified** by the flat-colour / city-skyline brief
(`plans/reports/brainstorm-260818-0138-endless-flat-color-city-skyline.md`) — the current
Phase 3 direction: **dead-flat colour-only dots** (the marble subsystem deleted) on a **dark,
receded city skyline** with an **inset** board (pending its own HTML-preview sign-off before
code). Look/feel is bound by `docs/creative-bible.md` (LOCKED). This plan does **not**
implement Journey.

## Goals

| #   | Goal                                                                                                                                                     | Priority |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Chain commit reads as a first→last relay, each dot fading as it lands; dropped dots bounce                                                               | P1       |
| 2   | Dead-flat colour-only dots (bright frozen hues) on an inset dark framed board panel over a dark, receded crisp flat-vector city skyline, one Skia canvas | P1       |
| 3   | Backdrop theme (dark city-skyline family) is a pure function of the persisted score, cross-fading at milestones (zen preserved)                          | P1       |
| 4   | Title / HUD / settings become an intentional paper-craft UI                                                                                              | P1       |
| 5   | Every animation honors Reduce Motion (bible §4)                                                                                                          | P1       |
| 6   | City theme catalog is shared (DRY) so Journey can reuse it later                                                                                         | P2       |
| 7   | Animated title via `rive-react-native` (meta-UI motion layer per bible §4)                                                                               | P2       |
| 8   | Mascot moment (deferred — gated on mascot art)                                                                                                           | P3       |

## Non-goals

- Journey / world-map / timed levels / obstacles; `src/app/journey.tsx` untouched.
- Any timer or fail state in Endless. Endless stays un-timed, zen, one board.
- Audio / SFX.
- Dependency sprawl — **exactly one** new dependency (`rive-react-native`).
- Changing shipped Endless **logic**: `src/core/**`, scoring, gesture rules, the
  score-persistence contract (`key 'score'`). This is a reskin + additive motion.

## Constraints (LOCKED — carried from the brief)

- **One Skia canvas** for the whole scene (bible §2.5). No second canvas.
- **Frozen dot palette** — `DOT_COLORS[0..2]` in `src/render/palette.ts` are FROZEN
  and outside the Vitest boundary; never reorder or re-hex. New UI chrome tokens are
  APPEND-only.
- **Worklet-safe hot path** — `src/core/hot/**` and `src/render/geometry.ts` stay
  allocation-free, pure, one-directional (`resolve/` may use `hot/`, never reverse).
- **No new MMKV key** — backdrop theme derives from the persisted score; it
  auto-corrects when Settings resets the score.
- Files stay focused (~<200 lines); split by responsibility.
- No fake data/mocks to pass a gate. No `any`. Lint (incl. sonarjs) + strict types
  are CI-blocking.
- No AI attribution in commits/PRs/comments (project rule).
- The new scene uses Skia only (flat `Path`/`RoundedRect`/`Circle` fills; the deleted marble
  bake is gone) — **not** `expo-blur`, **not** `expo-image` (wrong layer / tool-mixing
  violation). **No blur** anywhere in the reworked look (no `BackdropBlur`, no gradient sky);
  the panel is opaque, the scene is flat, and dots are flat solid discs.

## Phases

| #   | Phase                                                                                                        | Status      | Priority | Depends on |
| --- | ------------------------------------------------------------------------------------------------------------ | ----------- | -------- | ---------- |
| 1   | [Phase 1: Chain merge motion + `useReduceMotion`](./phase-01-merge-and-reduce-motion.md)                     | Completed   | P1       | —          |
| 2   | [Phase 2: Canvas-coordinate plumbing (zero visual diff)](./phase-02-canvas-coordinates.md)                   | Completed   | P1       | —          |
| 3   | [Phase 3: Dark receded city skyline + inset board panel + flat color dots](./phase-03-backdrop-and-panel.md) | Superseded¹ | P1       | 2          |
| 4   | [Phase 4: Score-milestone theme index + cross-fade](./phase-04-score-milestone-themes.md)                    | Dropped¹    | P1       | 1, 3       |
| 5   | [Phase 5: HUD / title / settings reskin (static)](./phase-05-ui-reskin.md)                                   | Pending     | P1       | —          |
| 6   | [Phase 6: Animated title via `rive-react-native`](./phase-06-rive-title.md)                                  | Pending     | P2       | 5          |
| 7   | [Phase 7: Mascot moment (deferred — gated on art)](./phase-07-mascot-deferred.md)                            | Deferred    | P3       | 5          |

**Sequencing notes.** Phases 1, 2, and 5 are independent and may run in parallel
(disjoint file ownership). Phase 3 depends on 2 (needs the board-origin offset).
Phase 4 depends on 3 (needs the theme catalog) and 1 (reuses `useReduceMotion`).

> **¹ Direction change (2026-08-18) — the backdrop is gone.** The user chose to
> render Endless like Journey: flat dots on the plain dark `SCREEN_BACKGROUND`, with
> **no framed board panel and no city-skyline backdrop**. Delivered by
> [`260818-1656-endless-plain-board`](../260818-1656-endless-plain-board/plan.md).
>
> - **Phase 3 — Superseded (partly):** the _flat colour-only dots_ it introduced
>   **ship and stay**; the _inset board panel + dark city skyline_ are **reverted**
>   and the `backdrop.tsx` / `board-panel.tsx` / `themes/city-themes.ts` subsystem is
>   **deleted**. The Phase-2 board-origin geometry primitive is kept (tested, no-op).
> - **Phase 4 — Dropped:** a score→milestone _theme_ index has nothing to theme once
>   the backdrop is gone. If a milestone-evolving scene is ever wanted again, it is a
>   fresh design, not a resumption of this phase.
> - Goals #2 (city skyline), #3 (milestone cross-fade), and #6 (shared city catalog)
>   are **retired** by this change. Goal #2's _flat colour-only dots_ clause is met.
>   Phase 6 depends on 5 (reskinned title is the mount point). Phase 7 is gated on
>   mascot art and blocks nothing — it ships whenever the art lands.

## Cross-plan relationships

- `plans/260816-1418-rn-three-dots-retarget` — **status `done`**. It shipped the
  Endless core/render/input/effects/meta this plan reskins. Prerequisite satisfied;
  no blocking relationship (this plan is additive and does not change its contracts).

## Success Criteria

- [ ] On commit, the drawn chain collapses as a first→last relay — each dot travels into
      the next and fades as it lands (pop folded into the hop), terminal dot fades last;
      on a sweep (≥5 line / 2×2 loop) the swept extras rush into the collapse point on the
      finale beat. Dropped dots settle with a soft, distance-independent bounce.
- [ ] Board sits **inset with a clear margin** (Journey-like, not full-bleed) on an opaque
      **dark** framed panel over a **dark, receded** crisp flat-vector city **skyline**; dots are
      **dead-flat solid-colour discs** on the **bright frozen hues** (no shading, no light, no
      gloss, no ring — identity is **colour-only**, the §2.2 shape channel stays unmet by user
      decision) and stay clearly legible — the whole flat disc is the base hue, and its contrast
      vs the fixed dark panel base is measured once and holds **WCAG SC 1.4.11 ≥ 3:1** (the
      graphical-object bar; the bright dots clear it with large margin on the dark ground, with
      **red/blue** the tight cases, not green). The scene recedes and the dots stay the loudest
      element; score + Back text hold ≥ 4.5:1 over the scene.
- [ ] Backdrop cross-fades at score milestones; theme is reproducible from score alone
      and resets with the score. No timer, no fail state, one continuous board.
- [ ] Title / HUD / settings read as intentional paper-craft.
- [ ] Reduce Motion swaps every animation for a static/reduced variant.
- [ ] Exactly one new dependency added (`rive-react-native`).
- [ ] `npm run lint` + `npm run typecheck` + `npm test` green; new pure logic
      (geometry origin, `themeIndexForScore`) covered by Vitest; RN/Skia/gesture
      layers verified on-device.
- [ ] Docs reconciled: `docs/three-dots-game-design.md` Endless "Progression" row; and
      `docs/creative-bible.md` §2.5 + §7 amended to record the procedural, score-gated
      Endless backdrop as a scoped exception to the LOCKED isometric-sprite /
      unlock-on-city-clear approach (per the bible's own §6.4), plus the Endless-vs-
      Journey city disambiguation. The §2.2 colour+shape shipped-status note **stays UNMET
      (colour-only by decision)** with an explicit "not to be cited as satisfied" line added, and
      the stale `src/render/palette.ts` "rule met via marble" comment reverted to colour-only.
      **No "backgrounds recede" exception** — the dark, receded Endless scene **complies** with
      §2.2, so the prior full-bleed exception is dropped, not amended.

## Verification boundary (repo rule)

Vitest tests **only** pure `src/core/**` and `src/render/geometry.ts` (+ one new pure
`theme-for-score.ts` added to the include in Phase 4). Skia / Reanimated / gesture /
Rive layers are **not** Vitest-testable → verified **on a real iPhone** (touch feel,
merge timing, contrast, Reduce Motion, cross-fade). On-device sign-off is a hard gate
on Phases 1, 3, 4, 5, 6.

## Validation decisions (2026-08-17, `ak plan validate`)

Critical-questions interview; four forks resolved by the user:

1. **Bible §2.5** — _amend §2.5 (procedural now)_. The Endless backdrop is procedural
   and score-gated; Phase 4 amends §2.5 + §7 to record it as a scoped variant per §6.4.
   Confirms the plan as written.
2. **Rive title** — _keep Rive in this effort_. Phase 6 stays in v1 (not deferred); its
   dependency-verification procedure (legacy `rive-react-native` vs Nitro successor vs
   mmkv-v4 nitro pin) still applies at implementation time.
3. **City count** — _start with 1 washi theme_. Ship exactly **one washi city identity
   (Japan)** in v1 — no tropical / urban / galaxy / fantasy cities (that distinct-city
   catalog is deferred). **Reconciliation with locked decision #3** (score-milestone
   backdrops): a single static backdrop would make Phase 4's cross-fade dead code and
   silently drop the milestone-evolution the brainstorm locked. So `CITY_THEMES` v1
   holds a **small ramp of milestone _states_ of that one washi city** (e.g. time-of-day
   or increasing skyline density — cheap recolor/shape variants, one visual family), not
   multiple cities. Evolution stays; only the _distinct-city_ catalog is deferred.
   **⚠ Confirm at handoff:** if the intent was truly one static backdrop with milestone
   evolution deferred, dialing `CITY_THEMES` to a single entry is a one-line change.
4. **Merge scope** — _drawn chain + all swept dots animate_. Phase 1 reworked: on a
   sweep, the swept extras also converge toward the terminal collapse point (not an
   instant pop). See `phase-01-merge-and-reduce-motion.md`.

### Phase 3 look refinement (2026-08-17, approved via HTML preview)

On the crisp-marble Phase 3 build (uncommitted, not yet on-device-signed-off) the user
asked for two look changes, folded into Phase 3 (a refinement, not a new phase, since the
code has not passed the on-device gate). Approved after previewing an HTML render of the
three cat's-eye marbles + full-bleed mock.

1. **Marble motif → cat's-eye swirl.** Replace the busy noise-vein swirl with a simpler
   _illustrated_ cat's-eye marble (light blades from a dark core, matte — _"not too
   transparent or crystal"_, "we do in our way"). **Blade count carries identity:** red 4 /
   green 3 / blue 5 — a countable colour + shape cue (distinguishable even in greyscale),
   keeping the LOCKED §2.2/§2.5 rule. Baked-SkSL architecture unchanged; only `MARBLE_SKSL`
   - `COLOR_CONFIG` rewritten. **No rim band** — the boundary samples the mid tone (≈ 5.7:1);
     a dark rim would re-introduce the ring the user rejected.
2. **Full-bleed "a bit richer" city.** The single Skia canvas fills the whole screen
   (`useWindowDimensions`, safe-area-aware via the already-present
   `react-native-safe-area-context` — no new dependency); the board floats on the opaque
   panel over the full-bleed scene. The scene is pitched a notch **richer** (more contrast +
   skyline detail) — a **documented exception** to the bible's "backgrounds recede"
   (§2.2 rule, mirrored in the §7 summary; Phase 4 docs), guard-railed by _dots stay the
   loudest element_ (on-device gate checks it). Still one canvas, flat, static, no gradient,
   no blur.

No new dependency; DOT_COLORS unchanged; Journey untouched. On-device sign-off re-gates
the refined Phase 3.

**Red-team + validate on the refinement (2026-08-17).** Red-team verdict: _ship-with-fixes_.
One would-be on-device crash (safe-area insets used with no `SafeAreaProvider` in the app)
and five gaps. Fixes folded into Phase 3 / 4: add `<SafeAreaProvider>` in `_layout.tsx`
(root-shell, no new dependency); measure contrast against the solid pre-AA rim fill; the
score/Back 4.5:1 is scene-dependent → author against every theme's sky, Phase 4 owns the
cross-theme on-device re-check; add a full-bleed **per-frame draw-cost** risk (distinct from
the one-time marble bake); fix the "backgrounds recede" citation to **§2.2** (mirrored in §7),
not §7 alone. Three material forks answered at validate:

1. **Touch routing → z-order first.** Score/Back are RN overlays above the Canvas with their
   own touch targets; the Pan gesture is bounded to the board rect **only if** the on-device
   gate shows the full-screen pan eats the Back tap. Least-invasive — does not preemptively
   touch the protected input layer.
2. **Marble variant decorrelation → per-variant spin.** The analytic cat's-eye drops the fbm
   `uSeed` decorrelation, so add `spin + v*(TAU/blades/VARIANTS)` (v = 0..4) to keep the 5
   baked variants visibly distinct (else a stamped board). Same variant count, same bake cost.
3. **Perf gate device → iPhone 12 (A14).** The enlarged full-bleed scene + baked marble is
   profiled against A14 at the on-device gate; A13 (iPhone 11 / SE 2nd-gen) is not guaranteed;
   scene budget is tuned to hold frame-rate on A14 during a full sweep/merge.

### Phase 3 look re-pivot (2026-08-18, `--advice` / kongming; HTML-preview sign-off pending)

Before the cat's-eye build reached the on-device gate, the user rejected the look and asked
for a different direction (verbatim: make the marble like the reference candy image, _"I don't
like cat's-eye"_; pull the board back from the phone edge _"like the journey"_; Journey's
bright colours beat the darkened marble tones). Resolved under `--advice` supervision plus two
user forks (`plans/reports/brainstorm-260818-0054-endless-matte-candy-dark-receded.md`); folded
into Phase 3 as a **third pass** (still a refinement, not a new phase — the code never passed
the on-device gate). Retargets Phase 4 to the dark theme family.

1. **Marble motif → matte candy (in-bible).** Replace cat's-eye with **matte candy marble** on
   the **bright frozen `DOT_COLORS`** (no darkening): a **distinct pattern archetype per colour**
   carries identity — **red = wavy swirl bands, green = soft circular spots, blue = diagonal
   stripes** (greyscale-distinguishable, satisfying the LOCKED §2.2 colour+shape rule a new way,
   _replacing_ the blade-count cue). Soft **painted** top-left light, **no hard specular / glass / simulated
   3-D** → stays inside the bible, **no amendment**. The literal glossy-plastic option was
   declined (it would have needed a §1/§2.1/§2.2 amendment). Baked-SkSL architecture unchanged;
   only `MARBLE_SKSL` (add a `uPattern` 0/1/2 selector) + `COLOR_CONFIG` rewritten.
2. **Dark, receded city + inset board.** Reauthor `city-themes.ts` to a **dark washi family**
   (fresh dark tones, **not** a blind darken of the light values — kongming). The board sits
   **inset with a clear margin** (Journey-like, not full-bleed / edge-to-edge). The bright frozen
   dots only clear WCAG SC 1.4.11 on a **dark** ground (green caps ~1.8:1 on any light washi
   panel — kongming contrast math), so _"use Journey's bright colours"_ **requires** the dark
   ground — the two are one decision. A dark, receded scene **complies** with §2.2, so the prior
   full-bleed "backgrounds recede" exception is **dropped** (better bible alignment, not worse).

No new dependency; DOT_COLORS unchanged; Journey untouched; Phase 4's cross-fade survives
(retargeted to the dark theme family). An **HTML preview** of the matte candy marbles on the
dark inset scene (with a greyscale toggle) precedes any `marble-texture.tsx` edit, and the
on-device HARD GATE re-runs against the new build (the cat's-eye gate is void).

### Phase 3 look simplification (fourth pass, 2026-08-18; HTML-preview sign-off pending)

Before the matte-candy build reached the on-device gate, the user removed the pattern entirely
(verbatim: _"remove the marble pattern, just a plain matte color set, and the scene is city
skyline"_). Resolved via two in-session forks
(`plans/reports/brainstorm-260818-0138-endless-flat-color-city-skyline.md`); folded into Phase 3
as a **fourth pass** (still a refinement, not a new phase — the code never passed the on-device
gate). This is a **net deletion** — the whole baked-marble subsystem goes away.

1. **Dots → dead-flat colour-only discs.** Remove the marble entirely: **delete
   `src/render/marble-texture.tsx`** (SkSL, `uPattern`, `COLOR_CONFIG`, the variant cache) and
   render Endless dots via the **existing flat `colorFor` `Circle`** path (`patterned = false`) —
   byte-for-byte the Journey dot. **Dead-flat finish** (user fork): no roundness shading, no soft
   top-left light, no specular, no gloss, no ring. The "matte fill + soft top-left light" option
   was declined.
2. **Dot identity → colour-only; §2.2 gap accepted (user fork).** Removing the pattern re-opens the
   LOCKED §2.2 colour+shape rule. The user chose **colour-only and to accept the gap** (declining a
   per-colour silhouette). This is **not a regression** (the shipped app is already colour-only) and
   takes **no bible amendment** — but §2.2 stays **unmet** and must never be cited as satisfied. The
   stale `palette.ts` comment claiming the rule is met via marble is reverted; Phase 4's doc-update
   keeps the shipped-status note `not yet met` and adds an explicit-gap line.
3. **Scene → dark city skyline.** Resolves the earlier A(quiet) / B(city) busy-ness fork to **B ·
   city skyline**: `city-themes.ts` reauthored to a **dark, low-chroma city family** (near + far
   building-silhouette rows, accent disc; the torii landmark dropped/genericised), still flat +
   static + receding (§2.2-compliant). The **inset** board, the **opaque dark panel**, and the
   dark-ground contrast analysis (red/blue tight cases, `PANEL_BASE` L ≤ ~0.058, `PANEL_FRAME` ≥ 3:1
   vs the darkest scene swatch) all **survive unchanged** — they never depended on the pattern.

No new dependency (this pass **spends none and removes** the marble machinery); DOT_COLORS
unchanged; Journey untouched; Phase 4's cross-fade survives (dark city family). A simplified **HTML
preview** (dark skyline + inset board + flat discs; pattern/greyscale sections dropped) precedes any
Skia edit, and the on-device HARD GATE re-runs against the new build (the matte-candy gate is void).

## Open questions

- **Milestone thresholds** — the score breakpoints between city themes are a tuning
  dial set in Phase 4 (mockup values were illustrative). Start with an evenly spaced
  ramp, confirm on-device; not a blocker.
- **Theme count for v1** — RESOLVED (validation #3): exactly **1 washi city** ships in
  the first cut. Phases 3–4 stay parametrized so additional cities are pure catalog
  data (no arch change), but none are authored in this effort.

<!-- slug: endless-visual-upgrade -->
