# Three Dots — Monetization & Expansion Roadmap (DEFERRED)

**Date:** 2026-08-06 (concept); retargeted to React Native 2026-08-16.
**Status:** **DESIGNED, NOT IN THE v1 BUILD.** v1 ships with **no ads and no IAP** (user decision) — this keeps
v1's compliance posture minimal (no ATT, no UMP, no §3 Payments review). This doc records the intended economy
and the sequence to add it, so v1 architecture doesn't block it.
**Related:** `docs/three-dots-game-design.md`, `docs/apple-compliance-checklist.md` §8 (compliance-when-added).

---

## Why deferred (and why that's cheap)

Shipping v1 with zero monetization removes the entire ads/IAP compliance surface at first launch. The economy
below is designed now only so the pure-TS core, the level-script schema (time/objectives), and the UI leave
room for it — no economy code ships in v1.

## Intended economy (post-v1)

| Item                                                 | Type                             | Where it lives                                                                     | Note                                                 |
| ---------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Remove ads forever**                               | Non-consumable IAP               | An IAP wrapper over StoreKit 2 (e.g. `react-native-iap` / `expo-in-app-purchases`) | Must offer **Restore Purchases** (App Review §3.1.1) |
| **Extra time** ("more times")                        | Consumable IAP + rewarded ad     | Journey (timed) — the natural home                                                 | Buys/awards seconds on a timed city                  |
| **Power-ups / "weapons"** (e.g. destroy a caged dot) | Consumable IAP + rewarded ad     | Journey                                                                            | **Deterministic** — you buy the exact effect         |
| **Ads**                                              | Rewarded (opt-in) + interstitial | Between Journey levels                                                             | Non-personalized by default (see compliance)         |

### Hard design rules (13+ and App Review safe)

- **No randomized loot boxes / no paid gacha.** Power-ups are deterministic (buy-the-exact-effect). Randomized
  paid rewards trigger odds-disclosure requirements and can bump the age rating in some regions — avoided by design.
- **No pay-to-not-lose framing that feels coercive** on a 13+ title; losses come from the clock/skill, and
  extra-time is an _optional_ convenience, not the only path to progress.
- **Rewarded ads are opt-in**; core progression is completable without spending (fair free experience — App
  Review §2/§3 and store-featuring friendliness).

## Compliance when monetization is added

Full detail in `docs/apple-compliance-checklist.md` §8. Summary of what _activates_ on adding ads/IAP:

- **In-app purchases via a React Native wrapper over StoreKit 2** (e.g. `react-native-iap`), with on-device
  receipt verification (no backend needed); **Restore Purchases** required.
- **Ads:** non-personalized by default → typically avoids the **ATT** prompt; **UMP consent** is still
  mandatory in **EEA / UK / Switzerland** regardless. Prefer a single ad network (e.g. AdMob) over mediation
  initially to keep the privacy surface small.
- **Privacy:** the ad SDK adds a `PrivacyInfo.xcprivacy` manifest + new Nutrition-Label data types; re-answer
  the age-rating questionnaire's monetization/ads questions.
- **EU:** DSA trader-status registration becomes relevant for EU-storefront distribution.

## Expansion roadmap (sequenced)

1. **v1 vertical slice** — Endless (**shipped**) + one country (**Japan**; starting with one city → filled to
   10–15), caged-dot obstacle, timed Journey loop, isometric growing city, mascot. **No monetization.** →
   TestFlight → App Store.
2. **Content expansion** — fill the first country to 10–15 cities; add the next 1–2 countries (chapters) +
   more obstacles from the catalog. Still no monetization (or add remove-ads only).
3. **Monetization** — introduce the economy above (remove-ads first, then extra-time/power-ups, then ads),
   with the §8 compliance work. This is the first release that reopens the ads/IAP compliance surface.
4. **Game Center** — leaderboards/achievements via a React Native wrapper over GameKit, once there's an audience.
5. **Android** — the one-TS-codebase RN architecture already ships both stores from a single build (see
   `CLAUDE.md`); no separate native track is needed. Ship via EAS Build once the iOS release, the design
   system, and the level-script content are stable — the level scripts (JSON) and the pure-TS core are
   already platform-neutral.

## Open items

- **v1 music ship strategy** vs the Suno indemnification caveat (see tool catalog) — decide before submission.
- **EU distribution in scope?** Affects UMP + DSA when monetization lands (not v1). Confirm before step 3.
- Pricing/token economy tuning — deferred to the monetization milestone.
