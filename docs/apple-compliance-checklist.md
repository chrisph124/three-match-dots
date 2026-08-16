# Apple App Store Compliance Checklist — three-match-dots

**Scope:** v1 = React Native (Expo) iOS build via EAS Build/Submit, **no IAP / ads / accounts / online /
leaderboards**.
**Verified live against Apple's own pages, 2026-08-06.** This is a _living_ checklist — re-verify before every
submission (Apple revises without notice). Every item: what / why / URL / status / scope / cadence.

**Port note (2026-08-16):** this checklist was originally written against a Swift/SpriteKit build that was
evaluated and reversed back to React Native (history: branch `archive/swift-pivot-260816`). Only the
engine-specific references below (build tooling, SDK package names) were retargeted in that port — the
underlying Apple-policy content (guideline text, URLs, dates) was **not** re-verified against live Apple
pages in this pass. Re-verify per the cadence notes below at the next actual submission.

## Prerequisite

**Apple Developer Program membership — $99/yr.** Required before any TestFlight/App Store submission.
Source: https://developer.apple.com/programs/whats-included/ (fee waiver for nonprofits/edu/gov — N/A here).
Cadence: renew yearly; a lapse blocks all submissions/updates.

---

## 1. App Store Review Guidelines

**What:** Comply with §2 (Performance), §4 (Design), §5 (Legal/Privacy). No on-page "last updated" date — Apple's
changelog lives in dated News posts. Most recent verified revision: **June 8, 2026**.
**Why it gates shipping:** App Review rejects on any guideline violation; this is the pass/fail bar.
**URL:** https://developer.apple.com/app-store/review/guidelines/
**Status:** Verified 2026-08-06. **Applies:** v1 — mandatory.
**Cadence:** re-skim before every submission (explicitly a "living document").

Key sub-items for this game:

- **2.1 App Completeness** — final build, no placeholders, on-device tested, no crashes. (No accounts in v1.)
- **2.3 Accurate Metadata** — 2.3.1 no hidden/dormant features; describe new features in "Notes for Review";
  2.3.6 answer age-rating honestly; 2.3.7 app name ≤30 chars; 2.3.8 store metadata/screenshots stay 4+-appropriate.
- **4.2 Minimum Functionality** — app must have "lasting entertainment value," not a trivial/repackaged experience.
  **A genuine gate for simple casual games** — mitigated by the juice/visuals/scoring the "AAA-polish" direction targets.
- **4.3(b) Spam / clone risk — flag prominently.** _"Don't submit apps indistinguishable from what's already widely
  available… unless they offer a meaningfully different or improved experience."_ Real risk for a familiar casual
  mechanic: ensure store listing/screenshots emphasize the game's **own** visual identity/juice, not a "clone" framing.
  A review-risk factor (not a hard blocker), mitigated by differentiated art/branding.
- **4.7** — only relevant if embedding HTML5/JS mini-games/emulators in a WebView. **Not applicable** — this app
  compiles React Native/TypeScript to a native binary (Hermes engine) via Expo/EAS; it is not a WebView wrapper
  around JS content, which is what 4.7 targets.
- **5.1.1 / 5.1.2** — privacy policy required (App Store Connect link + in-app) once _any_ data (incl. anonymous
  analytics/crash data) is collected; disclose 3rd-party SDK (PostHog/Sentry) use; consent revocable; don't require
  tracking/location/push for core functionality. **Applies if PostHog/Sentry are wired (see §4).**
- **5.1.4 Kids** — applies only in the Kids Category. Plan: **do NOT enroll in the Kids Category** so PostHog/Sentry
  stay permissible (the Kids Category bars 3rd-party analytics/ads). Confirm when the age rating is set (§3).

---

## 2. Human Interface Guidelines — Games ("Designing for games")

**What:** Apple's design mandates/recommendations for games. Not review-blocking alone, but reviewers use HIG as the
quality bar behind 4.2 / 4.3(b), and it affects App Store featuring eligibility.
**URL:** https://developer.apple.com/design/human-interface-guidelines/designing-for-games
**Status:** Verified 2026-08-06; page revision marker `2025-06-09` ("Updated guidance for touch-based controls and
Game Center"). **Applies:** v1 — recommended practice, not a hard gate.
**Cadence:** review once at initial UX pass; re-check if a redesign touches onboarding/controls.

Key mandates relevant to this game:

- **Jump into gameplay** — playable immediately after install; teach through play, not a mandatory written tutorial;
  defer permission prompts until needed.
- **Look stunning on every display** — legible text/contrast; touch targets **≥44×44pt** (directly relevant to the
  grid hit-boxes); resolution-independent assets; respect safe areas; support the orientations you allow.
- **Intuitive interactions** — default iPhone input is touch; physical controllers are optional (must have a touch
  alternative if supported) — matches the drag-gesture design (`react-native-gesture-handler`).
- **Haptics** — a _recommended_ enhancement for game feel via `expo-haptics` or similar; fits the "juicy" v1 scope.
- **Accessibility** — don't rely on color alone for state (**colorblind-safe palette + shape differentiation** — see
  `docs/creative-bible.md` §2.2 for the current shipped-status gap); support type-size / reduced-motion where feasible.
- **Game Center** — recommended, not mandatory. Out of v1 scope (see Deferred).

---

## 3. App Store Connect Age-Rating Questionnaire

**What:** Complete the age-rating questionnaire in App Store Connect → App Information → Age Ratings.
**Why it gates shipping:** Verbatim from Apple: _"An age rating is a required app information property… An Unrated app
can't be published on the App Store."_ **Currently a hard submission blocker.**
**URL:** https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating
**Status:** Verified 2026-08-06. Tier structure current: **4+, 9+, 13+, 16+, 18+** (12+/17+ retired). Updated
questionnaire mandatory since **Jan 31, 2026** (past). A further update adds **mandatory social-media-capability
questions** for submissions from **September 2026** — answer "no" (no social feed/UGC in v1); does not reclassify this app.
**Applies:** v1 — mandatory, every submission.
**Cadence:** set once at first submission; re-verify if gameplay content changes, and before the first post-Sept-2026
submission to confirm the social-media question renders correctly.

---

## 4. App Privacy Details ("Nutrition Label") + Privacy Manifest

**What:** Declare, per data type, in App Store Connect: category, purpose, linked-to-identity, used-for-tracking.
Separately: any 3rd-party SDK on Apple's "commonly used" list must ship a `PrivacyInfo.xcprivacy` manifest (Required-Reason
API usage + collected data types) and be code-signed — **mandatory since May 1, 2024** for any newly-added SDK.
**Why it gates shipping:** Missing/inaccurate label or missing SDK manifest → App Store Connect blocks submission
(`ITMS-91053`/`91056`-class errors) or later rejection/removal for mismatch.
**URLs:** https://developer.apple.com/app-store/app-privacy-details/ ; https://developer.apple.com/news/?id=pvszzano
**Status:** Verified 2026-08-06. **Applies:** v1 — mandatory the moment PostHog and/or Sentry are integrated.

**Mapping for this project's SDKs** (React Native packages, per `CLAUDE.md`'s Infrastructure table):

| SDK                                                                                                      | Data collected                                                                                                                                                                                                                      | Nutrition-label mapping                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sentry** (`@sentry/react-native`, wraps `sentry-cocoa` on iOS — ships its own `PrivacyInfo.xcprivacy`) | Crash Data, Performance Data, Other Diagnostics. Declared `Linked=false`, `Tracking=false`.                                                                                                                                         | **Diagnostics** (Crash + Performance), purpose = App Functionality. Not linked, not tracking.                                                                                                                                                 |
| **PostHog** (`posthog-react-native`, wraps `posthog-ios`)                                                | Locally-stored anonymous UUID (`anonymous_id`, distinct from IDFA), autocaptured product-interaction events, optional session replay if enabled, IP (unless anonymized server-side). PII auto-excluded from autocapture by default. | **Identifiers → Device ID** (not linked unless you call `identify()` with PII — don't) + **Usage Data → Product Interaction**, purpose = Analytics. `Linked=false`/`Tracking=false` as long as no PII `identify()` and no ad-network sharing. |

Used as described (no PII `identify()`, no ad attribution), **neither SDK requires "Tracking = Yes" or an ATT prompt** (§5).
Verify both ship a current `PrivacyInfo.xcprivacy` against the version actually pinned in `package.json` (and the
generated `ios/Podfile.lock` after `expo prebuild` / an EAS Build) at integration time — versions drift.
**Cadence:** re-verify label + each SDK's manifest on every SDK bump and before every submission.

---

## 5. App Tracking Transparency (ATT)

**What:** `AppTrackingTransparency` prompt (`expo-tracking-transparency` if ever needed), required since iOS 14.5,
when an app "tracks" — links user/device data with data from _other companies'_ apps/sites for targeted ads/
measurement, or shares with data brokers.
**Why it gates shipping:** IDFA use or tracking without the ATT prompt violates §5.1.2(i) + ATT policy → rejection.
**URL:** https://developer.apple.com/app-store/user-privacy-and-data-use/
**Status:** Verified 2026-08-06. Avoiding IDFA/cross-app tracking avoids ATT (on-device-only linking and IDFV for
same-vendor analytics do NOT require ATT). A hashed email/phone as an IDFA workaround is **not** allowed.
**Given v1's PostHog/Sentry usage, no ATT prompt is required.**
**Applies:** v1 — action = "do nothing." **Cadence:** re-check whenever any new SDK is added (ad/attribution SDKs often add IDFA silently).

---

## 6. Export Compliance (Encryption) Declaration

**What:** Every build answers an encryption question in App Store Connect / at submission.
**Why it gates shipping:** Wrong answer → held submission pending French declaration / US CCATS docs → real delay.
**URL:** https://developer.apple.com/help/app-store-connect/manage-app-information/determine-and-upload-export-compliance-documentation/
**Status:** Verified 2026-08-06. **Correct answer for this app:** encryption limited to the OS (HTTPS/TLS + standard OS
crypto, no proprietary algorithm) → **no documentation required**. Set `ios.config.usesNonExemptEncryption: false` in
the Expo config (`app.json`/`app.config.*`) — Expo maps this to `ITSAppUsesNonExemptEncryption` in the generated
`Info.plist` — to skip the per-build question. Extra docs only trigger with self-implemented standard crypto (French
declaration) or proprietary crypto (CCATS + French) — not applicable here.
**Applies:** v1 — answer every build; no docs needed. **Cadence:** re-confirm before every submission; immediately if custom crypto is ever added.

---

## 7. Minimum SDK / Xcode Requirement for New Submissions

**What:** New app/update submissions must be built with a minimum Xcode/SDK — rolls annually. This applies to the
**build toolchain** (EAS Build's iOS builder image, or a local `expo run:ios` build using Xcode), regardless of the
app's source language.
**Why it gates shipping:** Builds under the minimum SDK are rejected at upload (`ITMS-90725`-class), no exceptions.
**URL:** https://developer.apple.com/news/upcoming-requirements/
**Status:** Verified 2026-08-06. **Current: Xcode 26 / iOS 26 SDK or later, effective April 28, 2026** (already active).
This is the **build SDK**, not the **deployment target** — the app can still support older iOS as its minimum
deployment target (governed by the Expo SDK's own floor — see `docs/tech-stack-and-infra.md`).
**Applies:** v1 — mandatory at build time. **Cadence:** **re-check before every submission** — the value changes yearly; never rely on a cached figure.

---

## 8. Monetization compliance — ads + IAP (DEFERRED; NOT v1)

**What:** The compliance surface that _activates_ when the deferred economy (`docs/monetization-and-roadmap.md`)
is added. **None of this applies to the v1 build** (v1 = no ads, no IAP → §5 ATT / §3 Payments / UMP all N/A).
Recorded now so the design doesn't box us in. **Re-verify live before implementing** — these rules move.
**Applies:** the first release that adds ads or IAP. **Cadence:** re-verify at that milestone and every submission after.

- **In-app purchases via a React Native wrapper over StoreKit 2** (e.g. `react-native-iap`). On-device transaction
  verification (no backend needed). Reopens **Review Guideline §3 (Payments)**. **Restore Purchases is mandatory**
  for the non-consumable "remove ads" (§3.1.1). Consumables (extra time, power-ups) must deliver what's described.
  Docs: https://developer.apple.com/in-app-purchase/
- **No randomized paid rewards (loot boxes/gacha).** Deterministic power-ups only (design rule) — randomized
  paid odds require **odds disclosure (§3.1.1)** and can raise the age rating in some regions. Avoided by design.
- **App Tracking Transparency (§5, revisited).** Ads served **non-personalized by default** → typically **no
  ATT prompt**. Adding an ad/attribution SDK often pulls in IDFA silently → re-audit §5 the moment any ad SDK lands.
- **UMP / EEA consent.** A **Google UMP (or equivalent) consent flow is mandatory in EEA / UK / Switzerland**
  regardless of personalization. Prefer a **single ad network (e.g. AdMob) over mediation** initially to keep
  the privacy surface small.
- **Privacy manifest + Nutrition Label (§4, revisited).** Any ad SDK ships its own `PrivacyInfo.xcprivacy` and
  adds new collected-data types → update the App Privacy label + re-answer the age-rating questionnaire's
  ads/monetization questions.
- **EU DSA trader-status** becomes a real gating item for EU-storefront distribution (see "Not covered here").

---

## Deferred — only if scope grows beyond v1

- **Game Center / GameKit** — only if leaderboards/achievements/multiplayer are added, via a React Native wrapper
  over GameKit. Start: https://developer.apple.com/game-center/ + https://developer.apple.com/documentation/gamekit
- **In-app purchases** — see **§8** above for the full ads/IAP compliance surface when monetization is added.

---

## Not covered here (flag if scope changes)

- **EU Digital Services Act (DSA) trader-status** — required for EU-storefront distribution; not evaluated (EU distribution unspecified). Flag if EU distribution is planned.
- **COPPA / GDPR substantive legal review** — this checklist verifies Apple's _own_ gating requirements, not underlying privacy law. Needs separate legal review if age rating/content changes.
- **PostHog's exact shipped `PrivacyInfo.xcprivacy`** — mapping above is inferred from vendor docs, not a manifest-file read; verify against the pinned SDK version at integration time.

## Open compliance decisions (feed these back into planning)

1. **Kids Category?** Recommend **NO** — keep the questionnaire-calculated rating (likely 4+) _without_ Kids-Category
   enrollment, so PostHog/Sentry remain permissible. (Enrolling would bar 3rd-party analytics/ads.)
2. **EU App Store distribution?** If yes → DSA trader-status registration becomes a separate gating requirement.
3. **Verify PostHog's actual privacy manifest** against the pinned SDK version once PostHog is actually integrated
   (not yet wired — see `CLAUDE.md`'s Infrastructure table).
