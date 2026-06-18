# Two Dots Gameplay Script (Beat-by-Beat)

**Date:** 2026-06-18
**Status:** Build-spec reference. Mirrors `docs/two-dots-storyboard.html`.
**Source design:** `docs/two-dots-game-design.md`, `CLAUDE.md` (Architecture).
**Mode:** endless score-attack. **Game-over trigger:** soft countdown timer (clears add time; timer 0 = run ends).

## Legend — engine layers (where each beat is implemented)

| Tag | Layer | Responsibility |
|-----|-------|----------------|
| **core** | `src/core/` (pure TS, RN-free) | grid model, adjacency, chain/loop validation, clear→gravity→refill, scoring, timer |
| **render** | Skia | draw dots, active link path, particles |
| **input** | Gesture Handler worklet | touch xy → cell, build/commit/cancel chain |
| **effects** | Reanimated + Skia | pop, fall-bounce, burst, combo flair, screen shake/flash |
| **meta** | RN components | title, HUD (score/best/timer), game-over, settings |
| **persist** | MMKV (deferred dep) | high score + settings |

Illustrative board = **6×6**, **5 colors** (both tunable per design doc).

---

## Section A — Screen Flow

| # | Screen | Player action | System response | Juice / FX | SFX | Maps to |
|---|--------|---------------|-----------------|------------|-----|---------|
| SF1 | Title | (app launch) | Title shows logo, **Play**, **Settings**, current best score | logo settle, buttons fade-in | ambient loop | meta, persist |
| SF2 | Title → Game | tap **Play** | navigate to Game; board fills, HUD shows score 0 + full timer | board dots drop-in staggered | whoosh | meta, render, core (init) |
| SF3 | Game | (play — see Section B) | — | — | — | all |
| SF4 | Game → Game Over | timer reaches 0 | run ends; Game Over shows final score, best, **Replay**, **Title** | board freezes, dim overlay slides up | run-end sting | core (timer), meta |
| SF5 | Game Over → Game | tap **Replay** | new board, timer + score reset, return to Game | board re-fills | whoosh | core, meta |
| SF6 | Game Over → Title | tap **Title** | return to Title | crossfade | tap | meta |
| SF7 | Title ↔ Settings | tap **Settings** / **Back** | Settings shows sound toggle, haptics toggle, reset-best; Back returns | slide | tap | meta, persist |

---

## Section B — Gameplay Beats (inside the Game screen)

| # | Phase | Player action | System response | Juice / FX | SFX | Maps to |
|---|-------|---------------|-----------------|------------|-----|---------|
| GP1 | Board fill | — | 6×6 grid spawns random-color dots | dots drop + settle bounce | soft taps | core (init), render, effects |
| GP2 | Idle | — | HUD: score, best, **timer counting down** | timer bar drains smoothly | ambient | meta (HUD), core (timer) |
| GP3 | Chain start | press a dot | that dot highlights + scales; chain = [cell] | dot ring + scale-up | tap-blip | input, effects |
| GP4 | Extend chain | drag to **adjacent same-color** dot (U/D/L/R) | cell appended; **link path** drawn between centers; dots pulse | link line animates in; rising pitch | blip (pitch ↑ per length) | input, core (adjacency), render (link) |
| GP5 | Grow | keep dragging valid cells | chain grows; HUD previews potential points | path extends; dots pulse in sequence | blip ladder | input, core, render |
| GP6 | Invalid | drag to diagonal / different color / non-adjacent | cell **rejected**; no link added | brief shake on cursor dot; muted tint | dull thud | input, core (validation), effects |
| GP7 | Backtrack | drag back onto previous dot | chain pops last cell (un-links) | link segment retracts | reverse blip | input, core |
| GP8 | Clear (chain ≥2) | release | chained dots **pop/clear**; score += f(chain length) | scale-out + particle burst per dot | pop + chime | core (scoring), effects (pop/burst), render |
| GP9 | Cancel (chain <2) | release with only 1 dot | no clear; chain resets | dots ease back to rest | soft tick | input, effects |
| GP10 | **Loop clear** | close a loop (chain revisits to enclose a square of that color) | **every dot of that color on the board clears** | screen flash + shake; mass burst | boom + sparkle | core (loop detection), effects (flash/shake), render |
| GP11 | Gravity | (auto, after any clear) | survivors fall to fill gaps | fall + bounce ease | falling thuds | core (gravity), effects (fall-bounce), render |
| GP12 | Refill | (auto, after gravity) | new dots drop from top into empty cells | staggered drop-in | soft taps | core (refill), render, effects |
| GP13 | Combo | clears chain again immediately from refill | combo multiplier rises; bonus points | combo counter pop + color flair | combo chime (rising) | core (scoring/combo), effects, meta (HUD) |
| GP14 | Timer bonus | (auto, on each clear) | clear **adds time** to the countdown | timer bar pulses green, ticks up | up-chime | core (timer), meta, effects |
| GP15 | Low time | timer near 0 | HUD timer turns **red + pulses** | red pulse, vignette | tense beep loop | meta, effects |
| GP16 | Run end | timer = 0 | → Game Over (SF4) | board freeze, overlay | run-end sting | core (timer), meta |
| GP17 | New best | final score > stored best | "**New Best!**" celebration; persist new best | confetti / glow on score | fanfare | core (scoring), persist, effects, meta |

---

## Scoring & timer rules (for the core engine)

- **Chain score:** grows super-linearly with chain length (e.g. base × length, or sum 1..n) — exact curve tuned later.
- **Loop clear:** bonus scaled by number of dots wiped (big payoff — the signature move).
- **Combo:** consecutive clears without a new touch-down raise a multiplier; resets on idle.
- **Timer:** starts at T seconds; each clear adds `+t` (chain-size scaled); reaching 0 ends the run. Values TBD during tuning.

## Out of scope (this artifact)

Real art/audio (placeholder shapes + labels only), real game logic (visual mock only), exact tuning values, menu polish.

## Open questions

- Scoring curve + timer constants (start T, per-clear bonus) — tune on-device.
- Color count (5 illustrative) and grid size (6×6 illustrative) — both still tunable.
- Loop-clear exact rule wording (enclose 2×2 vs revisit-to-close) — confirm against Two Dots reference during core build.
