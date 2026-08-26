# On-device render sign-off checklist — Voyage + layered cages

**Date:** 2026-08-26
**Owner action:** this is the human, on-device "feel + look" pass. Every item below is a render/
worklet/native surface that Vitest cannot cover (see CLAUDE.md test boundary). The pure-TS core for
all of it is already green (typecheck, lint, tests, coverage). Build + launch is verified crash-free
after the worklets pin-back; what remains is visual/behavioral confirmation on a real device.

Maps 1:1 to the two open plan criteria:

- `plans/260824-1106-voyage-infinite-mode/plan.md` — Success Criteria line 95 (Phases 6-8 handoff).
- `plans/260824-2301-layered-cages-and-first-cage-teaching/plan.md` — Global acceptance "On-device"
  block + Success Criteria line 141 (Phases 5-6 verify pending).

Check each box on the device; note any miss with a one-line "actual vs expected".

---

## 0. Launch + regression smoke (guards the crash fix)

- [ ] App launches to the title screen, no SIGABRT, no redbox (worklets 0.10.1 init survives — this
      is the exact failure that PR #16 introduced and the pin-back fixed).
- [ ] Endless still plays: drag a same-colour chain (≥3) clears; 2x2 loop and ≥5 straight run sweep
      the whole colour; deadlock reshuffles.
- [ ] Score persists across a full app kill + relaunch (MMKV `score` key — never regressed by the
      pin-back, but confirm since worklets/native moved).

## 1. Voyage — diorama backdrop (Phase 6)

- [ ] The near-black canvas is gone: the shadow-box paper diorama renders behind the board.
- [ ] Dots stay clearly legible on the diorama (the WCAG 3:1 contrast floor on `PANEL_BASE` holds —
      no hue washes out against the backdrop; check all active colours incl. any extended hue).
- [ ] Biome 1 and biome 2 both render (advance far enough or use the ladder to reach the 2nd biome).

## 2. Voyage — navigation ribbon (Phase 7)

- [ ] The ribbon lists Episode 1 (levels 1-10) and scrolls/virtualizes smoothly (no jank on the
      list; this is the H1 push->replace nav that was fixed in review).
- [ ] Tapping a level opens it; back returns to the ribbon at the same position.
- [ ] Per-level progress persists across an app restart (completed levels stay completed —
      MMKV `voyage.progress.epN`).

## 3. Voyage — boss + HUD + juice (Phase 8)

- [ ] Level 10 "The Caged Core" reads as a boss (distinct framing/HUD vs a normal level), with zero
      bespoke art.
- [ ] The boss HP bar reflects total remaining cage layers (per-colour tally summed), decrements as
      cages are chipped/broken.
- [ ] Out-of-moves fail-state fires: exhausting the move budget triggers the soft-fold (no hard
      game-over; graceful).
- [ ] Juice stays papery/restrained per the creative bible — no confetti-spam.

## 4. Layered cages — overlay render, BOTH modes (Phase 5)

Voyage (seeded 2-layer teaching cage, default level ~L5) AND Journey (japan-01, authored 2-layer):

- [ ] Caged dots are visibly caged (folded-paper cage, shape carries distinctness — not colour
      alone), with a remaining-layer indicator (pips/number).
- [ ] A caged dot is still linkable (can be included in a chain).
- [ ] Clearing the caged dot's colour **chips one layer** — the dot does NOT pop; the pip/number
      decrements and the cage rattles (the chip-feedback that prevents "feels unsolvable").
- [ ] The dot **pops only on the final layer**.
- [ ] Three feedback cases are distinct: (a) a mixed chain (caged + free), (b) a chip-only chain,
      (c) a sweep (2x2 loop or ≥5 line) that hits mixed cages — sweep chips a multi-layer cage once,
      pops a 1-layer cage.
- [ ] Chip-only commit returns input cleanly — **no input lock** after a commit that cleared nothing
      (only chipped). Board stays responsive.
- [ ] `freeCaged` objective completes only when every cage is fully broken (not on first chip).
- [ ] A `clearColor` objective does NOT advance on a chip — only on an actual pop.

## 5. Layered cages — first-encounter teaching popup (Phase 6)

- [ ] The one-time popup fires on the **first multi-layer cage** encounter (Voyage seeded ~L5, or
      japan-01 in Journey) — NOT on a 1-layer teach cage (L4 / early generated teach band must NOT
      fire it).
- [ ] The popup explains the chip mechanic; a first-time player can then chip a 2-layer cage and
      narrate why it didn't pop (Success Criteria line 141).
- [ ] "Don't show again" dismissal survives a full app kill + relaunch (per-install MMKV flag); the
      popup never returns after dismissal.

## 6. Winnability sanity (spot-check, engine already proves this headless)

- [ ] The seeded 2-layer Voyage teaching level is beatable within its move budget.
- [ ] japan-01 is beatable (authored Journey level — NOT solver-swept, so this is the only proof).
- [ ] The L10 boss is beatable within its calibrated budget.

---

## Sign-off

When every box above is checked (or misses are logged), flip these plan lines to `[x]`:

- Voyage plan Success Criteria (line ~95): the diorama/ribbon/boss/moves-fail on-device criterion.
- Layered-cages plan Success Criteria (line ~141) + the "On-device" acceptance block; then set
  Phases 5 & 6 status from "Done (on-device verify pending)" to "Done".

Then the Voyage plan can move from `in-progress` to `done`.
