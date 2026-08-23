# Brainstorm — Endless Mode Enrichment (external ideas → our own)

**Date:** 2026-08-19 · **Skill:** `ak-brainstorm --advice` (kongming-supervised) · **Status:** exploration, feeds planning
**Scope:** Endless mode FIRST (as asked). Journey / new modes / obstacles noted at the end, not designed here.

---

## Core framing (the one decision everything hangs on)

Borrow the **motivation architecture** of Candy Crush / Two Dots / score-attack games — streak reward,
soft goals, cosmetic collection, daily check-in — but **NOT their failure architecture** (move limits,
lose states, countdown bombs, blocking obstacles). Pressure is Journey's job; Endless must stay
**no-fail / flow-state** — the beloved Two Dots relaxed niche the design doc explicitly protects.

**Corollary on obstacles:** in a no-fail mode an obstacle is just friction, not threat. So Endless gets
**benign "spice"** (bonus behaviours, board events) — real blockers stay in Journey.

### Two engine facts that killed 3 of the first-draft ideas (verified in code)

1. **No cascades.** `src/core/resolve/resolve-chain.ts` runs ONE `classify→collect→gravity→refill` and
   returns a single `Resolution`. Nothing auto-clears on landing (correct for the Two Dots mold — matches
   are player-drawn only). → any "cascade combo" idea is fiction today.
2. **No runs — score is a lifetime odometer.** `src/meta/score-storage.ts` = one `'score'` MMKV key, no
   run boundary, no game-over. → "escalate as score climbs" would ratchet **forever** (punish loyalty);
   "daily seed + personal-best ladder" needs a _bounded attempt_ = smuggled pressure. Both belong to a
   future bounded mode, not Endless.
3. **A time-decaying combo multiplier is a smuggled timer** — with no cascades, "consecutive clears in a
   window" = consecutive _player moves_ on a clock, punishing the zen player who pauses to think.
   Fix: make heat **move-indexed, never wall-clock**.

---

## External idea harvest (what we take vs. leave)

| Source                      | Idea                                                                                                                                                             | Take / Leave for Endless                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Two Dots**                | 5 modes; weekly Treasure Hunts (7 lvls / 4-day window); Daily Quests; minimalist depth                                                                           | Daily _flourish_ = take (no runs). Events/extra modes = defer (live-ops scope).                                           |
| **Candy Crush**             | Icing (multi-layer, clear-adjacent), chocolate (spreads), liquorice lock (=our caged dot), jelly, candy bombs; special candy **born from big matches**; boosters | "special born from a big play" = **take, reshaped**. Blockers/bombs/spreaders/boosters = **leave** (fail/pay vocabulary). |
| **Zen / endless retention** | infinite-collection = permanent progression engine; "players leave when goals run out"; Zen Match decoration meta; adaptive difficulty; daily check-in           | cosmetic collection + noticing-based goals = take. Adaptive difficulty = take only as **opt-in variety**, never imposed.  |
| **Score-attack**            | combo/streak multiplier; multiplier **decays over time**; skill-rank milestones; slow-burn exponential scoring                                                   | streak reward = take (**move-indexed, not time**); rank milestones = take as local read-outs; time-decay = **leave**.     |

---

## Our cooked ideas for Endless (mechanic-native, no-fail)

The organising insight: **our signature move is the color-sweep** (loop-close OR ≥5 line clears every dot
of a color board-wide). Two Dots / Candy Crush don't have this. Endless enrichment should orbit it.

1. **Post-sweep refill exclusion** _(sharpest / most "ours, not copycat")_ — after sweeping color X, the
   next refill wave contains **no X** ("the sky rains the other colors for one wave"). A just-swept board is
   already statistically ripe for a follow-up sweep; this makes **sweep→sweep chaining a deliberate
   strategy, not luck**. Tiny pure-TS change (optional excluded color in `refill.ts`), fully Vitest-able,
   one config dial. The signature move _generates the next tactical state_.
2. **Move-indexed sweep "heat"** — heat builds on sweep-quality moves, decays **one step per plain move**
   (never per second). Rewards "sweeps back-to-back," not "play fast." Zen-safe skill expression, no timer.
3. **Double-Sweep recognition** — detect `kind !== 'plain'` on consecutive resolutions in the meta layer;
   celebrate + spike heat. Zero engine change — names structure the game already produces.
4. **Lifetime per-color sweep counters** — 3 additive MMKV keys ("swept red 214×"). One tiny stats layer
   that **collapses goals + collection + daily into one substrate**: soft goals become _milestone read-outs_
   of counters you already keep (goals as _noticing_, not assignments) and they feed cosmetic unlocks that
   specifically reward the signature move.
5. **Zen cosmetic meta — extend, don't rebuild.** Score-milestone cosmetics are **already in flight**
   (`plans/260817-1217-endless-visual-upgrade` Phase 4 cross-fades the city backdrop at score milestones).
   Dot skins / board papers ride that same `theme-for-score` pattern. The evolving city _is_ the "growing
   diorama" — do NOT build a parallel decoration meta or a new art balloon.
6. **Daily flourish, not a ladder** — "first sweep of the day glows gold" (+ heat bonus). One MMKV date key,
   cosmetic, zero run semantics. A real daily _challenge_ (bounded score attempt) is a **future third mode**,
   not part of Endless.

**Explicitly rejected (identity traps):** wall-clock decay anywhere; **bomb dots** (blast-radius = match-3
vocabulary); **prism/wild dots** (break the single-color-chain invariant in `isCommittable` + the
allocation-free `src/core/hot/` worklet path — most expensive engine change, worst fit); **imposed** color
escalation; run boundaries in Endless; a second cosmetic system parallel to the in-flight themes.

---

## Approaches (HOW to enrich) + recommendation

|                          | Contents                                                                                                                   | Cost                                                      | Fails first when                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| **A-prime** _(rec. now)_ | move-indexed sweep heat + Double-Sweep celebration + post-sweep refill exclusion                                           | low; pure-TS core, all Vitest-able, no persistence change | depth alone doesn't create a between-session return reason                |
| **B-lite** _(next)_      | A-prime + lifetime sweep counters + milestone read-outs + dot/board skins riding the existing score-milestone theme system | medium; additive MMKV keys, cosmetic art                  | cosmetic art scope balloons (mitigated by reusing the in-flight city art) |
| **C** _(defer)_          | B-lite + weekly treasure-hunt event + bounded daily-challenge mode                                                         | high; live-ops + a 3rd mode + results screen              | pulls in scope v1 explicitly defers (monetization/online/events)          |

**Recommendation:** **A-prime now → B-lite next → defer C.** Respects "no monetization / online in v1" +
KISS/YAGNI, gives Endless a real skill curve immediately, and B-lite's persistence is just additive keys in
the single MMKV owner — so A-prime doesn't block it. A bounded **Daily** mode is the natural future bridge
between Endless and Journey ("N moves, _ends_ but never _fails_") — that is where idea 6's ladder + a daily
seed legitimately live.

---

## Brainstorm contract

- **Outcome:** Endless gains a genuine, no-fail **skill curve + return reason** built around the signature
  color-sweep — without adding a timer, a lose state, or monetization.
- **Constraints:** RN + Expo + Skia + Reanimated; keep `src/core/` RN-free & Vitest-tested; `src/core/hot/`
  stays allocation-free/worklet-safe; no monetization/online/accounts in v1; 13+; MMKV local only; extend the
  in-flight score-milestone cosmetic system, don't fork it.
- **Non-goals:** move limits / lose states / countdown pressure in Endless; blocking obstacles in Endless
  (those are Journey); wild/prism/bomb dots; new modes or live-ops events in v1.
- **Acceptance evidence:** sweep-heat + refill-exclusion + double-sweep land as pure-TS core changes with
  Vitest coverage; 60fps drag preserved on device; sweeps-per-move visibly trends up over a player's
  lifetime; no "felt rushed" reports in on-device zen play.

## Coordination note (avoid file collisions)

Two Endless plans are **in-progress right now** — `260817-1217-endless-visual-upgrade` and
`260818-1656-endless-plain-board` — and own `game.tsx` / HUD / render surfaces. Let those land (esp.
visual-upgrade Phase 4–5, which delivers the cosmetic-milestone spine B-lite reuses) before wiring any
heat-meter / goal HUD. Note the `game.tsx` unstyled-View gesture-root invariant when adding HUD later.

## Handoff

Next: `superpowers:writing-plans` (or `/ak:plan`) for **A-prime** as the first slice — carry `--advice`
forward per the flag. Core changes are `src/core/resolve/refill.ts` (exclusion), a new meta-layer
heat/double-sweep tracker, and `scoring`/config dials; TDD the core (regression-test-first per the DoD).

## Unresolved questions

1. **Heat curve shape** — linear vs. exponential per consecutive sweep; decay = 1 plain move or N? (on-device tune)
2. **Refill-exclusion strength** — exclude X for 1 wave or until first non-X clear? Risk it makes sweeps _too_ easy given the already-flagged ≥5-line-too-cheap-at-3-colors tuning note in `config.ts`.
3. **Where heat is shown** — subtle (dot glow) vs. explicit HUD meter — must not break the calm; blocked on the in-flight HUD/visual work landing.
4. **Opt-in variety** — do we ever offer a 4-color board as a milestone _unlock_ (variety), or leave color count fixed at 3 for Endless? (deferred until heat economy is proven at 3)

---

## ACCEPTED DECISIONS & SCOPE LOCK (2026-08-19, --advice / kongming)

**Stale-premise correction (verified):** `260818-1656-endless-plain-board` is **completed** and the user
**reverted** the backdrop/panel/city-theme subsystem — `src/render/themes/` deleted, visual-upgrade
**Phase 3 Superseded / Phase 4 Dropped** ("nothing to theme once the backdrop is gone"), **Phase 5
(HUD/settings reskin) Pending**. So brainstorm **idea 5's "extend the milestone cosmetic system" premise is
dead** — there is no such system. The user's settled look = **dead-flat, colour-only dots on a plain
ground; no glow / gradient / blur** (four passes). `applyResolution` lives in `src/core/game.ts:34`.

**User decisions (AskUserQuestion):** ① skins = **plain now, skins later** (separate future plan);
② heat display = **transient + in the numbers** (no persistent glow — respects plain look);
③ 4-color = **separate future plan**.

**This plan = "prove the heat economy at 3 colors" — locked scope:**

- **Phase 1 — core economy (start now; collision-free, pure-TS/core):**
  - Refill exclusion in `refill.ts` + `resolve-chain.ts` = the **sweep's own resolution refill**
    (`resolve-chain.ts:51`), zero cross-commit state; config dial off by default; **config-off path
    byte-identical** (refill RNG-consumption contract → every existing seeded test passes untouched).
  - Heat + `lastKind` as **`GameState` fields**, updated in `applyResolution`; multiplier applied in
    `scoring.ts`/`resolveChain`. **Linear, cap ~3 tiers, +1/consecutive sweep, −1/plain move, floor 0.**
    All `GameConfig` dials, **off by default → Journey (shares `resolveChain`) provably inert.**
  - Double-sweep recognition (consecutive non-plain `kind`).
  - **TDD + a seeded Monte-Carlo Vitest harness** (P(follow-up sweep available) exclusion on/off; greedy-bot
    heat steady-state; score-rate vs baseline) with numeric bounds as a **merge gate before** on-device.
- **Phase 2 — persistence (collision-free):** per-color lifetime sweep counters = **3 additive MMKV keys**
  in `score-storage.ts` (single owner; update its "only module" doc comment). **Survive `resetScore()`**
  (lifetime stats).
- **Phase 3 — read-outs + transient heat (GATED behind visual-upgrade Phase 5 + plain-board on-device
  gate):** milestone read-outs of counters; heat shown via existing clear/sweep celebration + numbers only;
  **HTML preview first**; re-check the `game.tsx` unstyled-View gesture-root invariant if HUD read-outs
  touch it.

**Non-goals (this plan):** 4-color board (separate plan seed); persistent heat visual + dot/board skins
(separate fork — partially reverses plain-board); C-bundle (weekly events / bounded daily mode — reverses
locked v1 "no online/events"); any timer / fail state in Endless.

**Red-team MUST-check (brief for the post-plan review):** ① config-off **byte-identity + Journey
isolation** (all dials default → existing seeded tests untouched-green; Journey path inert; no new writes
reorder the `publish→unlock` settle chain in `use-game-state.ts`); ② **economy degeneracy proven by the
seeded sim** with numeric bounds _before_ the on-device feel gate; ③ **visual-scope containment** — no
persistent glow / skins smuggled against the plain-board + dead-flat rulings; `game.tsx` gesture-root
invariant intact.
