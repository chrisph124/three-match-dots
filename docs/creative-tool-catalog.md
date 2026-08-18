# Three Dots — Creative Tool Catalog

**Date:** 2026-08-06 (concept); retargeted to React Native 2026-08-16.
**Status:** Qualified shortlist for a React Native (Expo + Skia) casual game. **Pricing drifts — re-verify
the exact plan + license terms at adoption** (figures below are as-of-2026 approximations, not a quote).
**Purpose:** Qualified free + paid tools per asset class, with trade-offs, pricing, and licensing traps, so
choices are deliberate. **The #1 rule: one tool per asset class** (anti-drift — see `docs/creative-bible.md` §6).
**Related:** `docs/rnd-department.md`, `docs/creative-bible.md`.

> **Licensing golden rule:** "royalty-free" ≠ "public domain" ≠ "free to use in a paid app." For a game that
> may later monetize, every asset needs a license that explicitly permits **commercial + monetized app use**,
> and you must **keep proof of license** (receipt / license file / export). When in doubt, don't ship it.

---

## 1. Art — sprites, UI, textures

| Class                                      | **Pick**             | Free/Paid          | ~Price                                               | License note                                           | Why                                                                                            |
| ------------------------------------------ | -------------------- | ------------------ | ---------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Dot/board/pixel & sprite art               | **Aseprite**         | Paid (one-time)    | ~$20 one-time (or free if self-compiled from source) | You own your output; commercial use fine               | Best-in-class sprite/animation tool; one-time cost; ideal for the crisp paper-craft dots/skins |
| Vector UI, screens, icon, layout           | **Figma**            | Free tier / Paid   | Free (starter) → paid seats                          | Your designs are yours; check font licenses separately | Industry-standard UI design + prototyping; the `ui-ux-designer` pass lives here                |
| Paper textures, hand-painted city/backdrop | **Procreate** (iPad) | Paid (one-time)    | ~$13 one-time                                        | You own output; commercial fine                        | Perfect for the paper-craft grain/fold textures + isometric building painting                  |
| _(Free alternative to Aseprite/Procreate)_ | **Krita**            | Free (open source) | $0                                                   | Own output; commercial fine                            | Legit fallback if avoiding paid tools; heavier for pixel animation than Aseprite               |

**Verdict:** Aseprite (sprites) + Figma (UI/icon) + Procreate (textures/city). One tool per class; no overlap.
Exported sprites land in `assets/` and are drawn by Skia (`@shopify/react-native-skia`), not packed into a
native asset catalog.

## 2. Animation

| Class                                                        | **Pick**                                                                                                            | Free/Paid                                | ~Price                         | License note                                         | Why                                                                                                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In-scene game motion (pop, fall, clear, combo)               | **`react-native-reanimated` worklets driving Skia primitives**                                                      | Free (OSS, already a project dependency) | $0                             | MIT                                                  | Runs UI-thread worklets with zero JS-bridge cost — the correct default for board juice on this stack. Bible §4 locks this                                                                                   |
| Meta-UI micro-motion (buttons, transitions, mascot flourish) | **Rive** (via `rive-react-native`)                                                                                  | Free tier / Paid                         | Free (starter) → ~$24+/mo team | Runtime is open source; check plan for team features | Small runtime, interactive state machines, **solid iOS support**. Chosen over Lottie. Not yet an installed dependency — adopt when a meta-UI screen actually needs vector state animation                   |
| _(considered)_ Lottie                                        | —                                                                                                                   | Free                                     | $0                             | —                                                    | Fine for playback, but heavier/less interactive than Rive for game UI; **not** chosen                                                                                                                       |
| Particles (burst, sparkle)                                   | **Hand-rolled Skia particle draws** (`@shopify/react-native-skia` primitives animated via Reanimated shared values) | Free (OSS, already a project dependency) | $0                             | MIT                                                  | No first-party particle system ships with Skia the way `SKEmitterNode` ships with SpriteKit — bursts/sparkles are hand-built from Skia primitives, kept to the same one-tool-per-layer discipline as motion |

**Verdict:** `react-native-reanimated` + Skia primitives for everything in-scene; **Rive**
(`rive-react-native`) for meta-UI motion only. Never mix in-scene and meta-UI motion tools.

## 3. Audio — music & SFX

| Class                          | **Pick**                                     | Free/Paid                                 | ~Price                      | License note                                                                                          | Why                                                                                                                            |
| ------------------------------ | -------------------------------------------- | ----------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Original music (themes, loops) | **Suno**                                     | Paid (commercial rights need a paid plan) | ~$8–24+/mo tiers            | ⚠️ **See trap below**                                                                                 | Fast original, on-brand music generation; must be on a plan that grants commercial ownership                                   |
| Licensed music + SFX library   | **Uppbeat**                                  | Free tier / Paid                          | Free (with limits) → ~$7/mo | Cleaner monetized-app licensing than most free libraries; **keep the license/credit as required**     | Purpose-built for creators who monetize; good SFX + music breadth                                                              |
| SFX (broad, free)              | **Pixabay**                                  | Free                                      | $0                          | ⚠️ Pixabay content license is generally permissive but **verify per-asset**; some tracks have caveats | Big free pool; use only after confirming each asset's terms                                                                    |
| DAW (edit/produce/trim)        | **GarageBand** (free) / **Logic Pro** (paid) | Free / ~$200 one-time                     | —                           | You own your edits                                                                                    | Native Apple; GarageBand is free and sufficient for trims/loops                                                                |
| In-app playback                | **`expo-av`**                                | Free (OSS, Expo-maintained)               | $0                          | N/A                                                                                                   | The project's decided RN audio-playback layer (see `CLAUDE.md`; not yet installed) — low-latency enough for SFX + a music loop |

### Licensing traps (read before sourcing any audio)

- **Suno:** commercial ownership requires a **paid** plan (free-tier output is generally non-commercial). As of
  2026 there is **active label litigation and no copyright indemnification** from AI-music vendors — for a
  storefront game, prefer AI-music for _placeholder/prototype_ and confirm the release track's terms, or use a
  cleanly-licensed library track for ship. Document the decision per track.
- **Uppbeat vs Pixabay:** Uppbeat's licensing is explicitly built for monetized apps (often needs a credit or a
  paid plan to drop it); Pixabay is free but its terms are per-asset and less tailored to paid apps — **verify
  each Pixabay asset individually.**
- **Always keep proof-of-license** (license PDF / receipt / export) in the repo's asset-license record.

## 4. Cross-cutting

- **Tooling for the build itself** (not creative assets) — Expo, EAS Build/Submit, ESLint (+ sonarjs), Vitest,
  Husky — live in `CLAUDE.md` and `docs/tech-stack-and-infra.md`, not here.
- **Fonts:** any non-system typeface needs a license permitting app embedding + commercial use — verify at the
  `ui-ux-designer` pass (bible §3). Prefer system fonts or clearly app-licensed families.

## 5. The one-tool-per-class summary (lock)

| Asset class                 | Tool (locked default)                                            |
| --------------------------- | ---------------------------------------------------------------- |
| Sprites / dots / skins      | **Aseprite**                                                     |
| UI / screens / app icon     | **Figma**                                                        |
| Textures / city / backdrop  | **Procreate**                                                    |
| In-scene motion + particles | **`react-native-reanimated` + Skia primitives**                  |
| Meta-UI motion              | **Rive (`rive-react-native`)**                                   |
| Music                       | **Suno** (with licensing discipline) / **Uppbeat** for ship-safe |
| SFX                         | **Uppbeat** (Pixabay only per-asset-verified)                    |
| Audio editing               | **GarageBand** (Logic if needed)                                 |
| In-app audio                | **`expo-av`**                                                    |

## Open items

- Confirm the **v1 music strategy** (AI-generated vs licensed-library for the _shipped_ build) given the Suno
  indemnification caveat — decide before the first store submission.
- Re-verify every price + license tier at actual adoption (they change).
