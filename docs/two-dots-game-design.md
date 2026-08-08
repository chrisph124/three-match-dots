# Brainstorm Summary — Two Dots-style Mobile Game (React Native)

**Date:** 2026-06-17
**Status:** Design approved (Approach A). Ready for `/ck:plan`.

**Superseded in part by** `docs/superpowers/specs/2026-08-03-playable-game-design.md` (2026-08-03):
adjacency is 8-way, the board is 6×6 with 3 colors, chains clear at ≥3, a straight run of ≥5 also
sweeps the color, a deadlocked board reshuffles, and endless mode has no fail state or game-over
screen.
**Working title:** TBD (slug: `two-dots-rn-game`)

---

## Problem Statement

Build a mobile puzzle game in the **Two Dots** mold — _not_ a Candy Crush match-3 clone.
Core loop: drag through adjacent same-color dots to link chains; chains of 2+ clear;
closing a 2×2 loop clears ALL dots of that color; board refills via gravity from top.
(As built: 8-way adjacency, chains of ≥3, a straight run of ≥5 also sweeps the color, and a
deadlocked board reshuffles — see the supersession note above.)
**iOS-first.** Central question answered: **can React Native do this?** → **Yes.**

## Requirements (locked)

**Functional (v1):**

- Grid board, 6×6, of 3-color dots (green / red / blue) — both config values.
- Continuous drag gesture; link ADJACENT same-color dots, 8-way (orthogonal AND diagonal).
- Chain of ≥3 clears on release.
- Closing a 2×2 square loop → clears every dot of that color on the board.
- A straight chain of ≥5 (any of the 8 directions) → clears every dot of that color on the board.
- No legal chain anywhere → the board reshuffles the same dots into a playable arrangement.
- Gravity refill: survivors fall, new dots spawn at top.
- Endless score-attack mode. Local high score.
- Juicy game feel: dot pop, fall+bounce, particle bursts, combo flair, screen shake.

**Non-functional:**

- 60fps on mid-tier iPhone during drag + cascade.
- iOS App Store shippable.

**Out of scope (v1):** levels/campaign, monetization/ads/IAP, online/leaderboards,
accounts/cloud-save, Android. (All deferred — architecture should not block them.)

**Constraints:** React Native (user preference); iOS first; greenfield (no existing code).

## Evaluated Approaches

|       | Approach                                            | Pros                                                                                                                                | Cons                                                                                     | Verdict                    |
| ----- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------- |
| **A** | **Expo + RN Skia + Reanimated 3 + Gesture Handler** | GPU canvas; full game loop on UI thread (no bridge jank); full control of juice; EAS cloud iOS builds; logic reusable for web later | Hand-build effects; Skia learning curve; version pinning; needs dev client (not Expo Go) | ✅ **CHOSEN**              |
| B     | Plain RN `<View>` + Reanimated (no Skia)            | Simplest mental model                                                                                                               | Dynamic link-lines + particles awkward/janky; can't deliver "juicy"                      | ❌ caps the juice          |
| C     | Unity                                               | Mature game tooling; drag-drop juice; ad/IAP SDKs; user already knows it                                                            | Heavier binary; weaker meta-UI; off the RN goal                                          | ➖ legit rival, not chosen |
| —     | Phaser/Pixi in WebView                              | Mature 2D engine                                                                                                                    | Gesture latency; non-native feel; RN↔WebView friction                                    | ❌ rejected                |

## Final Recommendation — Approach A

**Stack:**

- **Render:** `@shopify/react-native-skia` — board as one GPU canvas (circles=dots, paths=links, particles).
- **Animation:** `react-native-reanimated` v3 — falling/spring/clear tweens in UI-thread worklets.
- **Gesture:** `react-native-gesture-handler` — pan gesture; finger→grid hit-test + chain logic in worklet.
- **App shell/build:** **Expo** (dev client) + **EAS Build/Submit** for iOS. No local Xcode required for cloud builds.
- **State:** lightweight store (Zustand) for meta/UI; board sim state in shared values for the hot loop.
- **Persistence:** `react-native-mmkv` (or AsyncStorage) for high score/settings. No backend in v1.
- **Audio:** `expo-av` for SFX.

**Why A fits:** entity count is tiny (~36–64 dots); no physics sim beyond falling tweens;
no 3D; no networking. This is the easy end of Skia's range. Keeping gesture+hit-test+animation
on the UI thread eliminates the classic RN game-jank cause.

**Rationale vs Unity:** game is simple 2D and user wants to live in React/TS; RN gives nicer
meta-UI and smoother Expo iOS pipeline. Accepted trade: hand-build juice in Skia vs asset-store drag-drop.

## Architecture Sketch (for planning)

- **Game core (pure TS, engine-agnostic):** grid model, adjacency + chain validation, loop
  detection, clear+gravity+refill resolution, scoring. Unit-testable, no RN deps. ← _web-reusable_
- **Render layer (Skia):** subscribes to core state; draws dots, active link path, particles.
- **Input layer (Gesture Handler worklet):** maps touch xy → cell; appends valid cells to chain;
  commits/cancels on release; calls into core.
- **Effects layer:** pop, fall-bounce, burst, shake, combo — Reanimated + Skia values.
- **Meta UI (RN components):** title, HUD (score/high), ~~game-over~~, settings. (No game-over
  screen was built — endless mode has no fail state.)

## Risks & Mitigations

| Risk                                                  | Mitigation                                                                       |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| Skia↔Reanimated↔Expo version mismatch (#1 setup pain) | Pin to one Expo SDK; use its locked compatible versions                          |
| Juice underdelivers / eats time                       | Build core loop first (Approach A spike), layer effects after; timebox particles |
| Drag hit-test feels off                               | Tune touch radius/snap in worklet; validate on device early                      |
| Perf on cascades                                      | Cap simultaneous particles; reuse Skia objects; profile on real iPhone           |
| App size bloat                                        | Acceptable for casual; monitor, strip unused native modules                      |

## Success Metrics / Validation

- Drag-link → clear → gravity-refill loop runs at 60fps on a mid-tier iPhone (device test, not sim).
- Loop-closure correctly clears all dots of color.
- "Juicy" bar met: pop + fall-bounce + burst + combo visible and smooth.
- Endless score + persistent high score working.
- `eas build --platform ios` produces an installable build; TestFlight submit succeeds.

## Next Steps / Dependencies

1. (Recommended) Throwaway **spike**: RN-Skia drag-link-and-clear loop to confirm feel.
2. Run `/ck:plan` to phase the build (core engine → render → gesture → effects → meta UI → iOS release).
3. Apple Developer account ($99/yr) before TestFlight/submit.
4. Decide colors count, grid size, scoring curve during planning.

## Unresolved Questions

- Game name / branding? (slug placeholder for now)
- ~~Grid size + color count~~ → resolved: 6×6, 3 colors (config values).
- ~~Endless difficulty ramp~~ → resolved: pure relax, no fail state. Blockers and a shrinking
  board are the recorded levers if a fail state is wanted later.
- Sound/art: source SFX + dot art (asset pipeline) — who/where?
- Do you want the spike first, or go straight to full plan?
