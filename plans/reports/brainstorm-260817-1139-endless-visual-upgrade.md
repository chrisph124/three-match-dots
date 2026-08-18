# Brainstorm — Endless Visual Upgrade

**Date:** 2026-08-17 · **Status:** all decisions locked; next = HTML mockup → plan · **Advice:** run under `kongming` supervision (`--advice`)
**Feeds:** an implementation plan → `/ak:cook`. **Authority checked:** `docs/creative-bible.md`, `docs/three-dots-game-design.md`.
**Mockup (sign-off):** annotated paper-craft proof sheet → https://claude.ai/code/artifact/2527d519-55f7-44a3-8246-8965f4cddefd (source: `scratchpad/endless-visual-mockup.html`).

## Contract

- **Outcome:** Endless looks/feels premium. On chain-commit the linked dots visibly **chase and merge first→last**; the board sits on a **frosted-vellum panel** over a **receded paper-craft city backdrop** that **evolves at score milestones**; the bare text screens become a **fuller paper-craft UI** (HUD, animated title, mascot moment, transitions).
- **Constraints:** preserve shipped Endless _logic_ (`src/core/**`, scoring, gesture wiring, score persistence) — reskin only; worklet-safe hot path (no alloc); files <200 lines; **respect Reduce Motion** (bible §4, currently zero infra); dots stay readable over any backdrop; **one Skia canvas** (bible §2.5). Three of four decisions are bible-compliant as-is; the procedural score-gated backdrop is a **scoped deviation from §2.5's LOCKED isometric-sprite / unlock-on-city-clear approach** (art assets/sprite kit don't exist yet) — recorded as an explicit §2.5 amendment in the plan's Phase 4 doc pass per the bible's own §6.4, not a silent exception.
- **Non-goals:** Journey/world-map; timers/fail-state in Endless; audio; dependency sprawl (only `rive-react-native` added).
- **Acceptance (on-device):** merge reads clearly first→last; backdrop cross-fades at milestones without hurting dot contrast; UI reads as intentional paper-craft; Reduce Motion swaps every animation for a static/reduced variant; Endless still un-timed, no fail state, one continuous board.

## Resolved decisions (user)

1. **Backdrop art direction = paper-craft cities** (Japan/washi first), receded. No generated/neon art; motionsites.ai **not used** (emits web shaders that can't enter a Skia canvas + points at ruled-out neon look).
2. **Board cover = frosted-paper / vellum panel** (matte translucency + baked blur-behind), not glossy glassmorphism (which is a bible anti-word).
3. **Endless progression = score-milestone backdrops** — backdrop theme is a **pure function of the already-persisted score**; no timer, no fail state, one continuous board (preserves the shipped zen contract).
4. **UI = fuller redesign** — HUD, animated title, mascot moment, screen transitions.

## Execution architecture (from `kongming` counsel)

- **Merge animation:** dedicated `mergeRank`/`mergeTarget`/`mergeSpan`/`mergeT` shared values (do **not** overload `clearRank`/`clearT` — different consumers: position-lerp vs radius-shrink). Chase target = a **static original center** (no live moving-target dependency in the hot path): each drawn-chain dot chases the next chain dot first→last. **Validation update (2026-08-17, decision #4):** on a **sweep** (≥5 / 2×2-loop), the swept extras also animate — each chases the **terminal cell** (the chain's last dot = collapse point) — instead of popping in place; on a plain clear `cleared === chain`, so there are no extras. Keep it **~100–120ms** — it extends the `isResolving` gesture-lock window (`CLEAR_MS 200 + FALL_MS 220`). On-device feel-test is a hard gate.
- **Canvas = single expanded canvas** (a 2nd canvas violates bible §2.5 **and** can't backdrop-blur across canvases). **Landmine:** expanding past the board breaks the LOCKED invariant "canvas coords == board coords" (`board-canvas.tsx:17-20`, `geometry.ts` `centerX/centerY/cellAtPoint`). Fix = add a **board-origin offset** to `BoardLayout` + geometry, shipped as its own **zero-visual-diff PR with Vitest coverage** before any backdrop art.
- **Paper-craft = procedural (no art assets for v1):** Skia `Path`/`RoundedRect` folded-paper shapes + soft top-left shadow + SkSL `RuntimeShader` paper-grain + washi gradient sky; **theme by palette/shape swap**. Blur the backdrop **once (baked)**, never per-frame. Not a redo trap — Skia `useImage` loads real washi raster into the same canvas later, same coord space, no arch change.
- **Dot contrast safeguard:** frosted panel has a **hard alpha/coverage floor** (≈≥90%) over a fixed neutral base → decouples dot-on-panel contrast from the backdrop theme; tune **once**, not per-theme. Dot hexes **never** vary by theme (already LOCKED append-only palette, `palette.ts:6-9`). One-time WCAG check at design time. **No** live luminance clamp (YAGNI).
- **Meta-UI motion = `rive-react-native`** (bible §4 + tool catalog: meta-UI micro-motion is rive; Skia/Reanimated for it is a violation). Add rive now; animated title ships with a placeholder state machine. **Mascot deferred** (design TBD — gated on art, blocks nothing).
- **Reduce Motion:** build one `useReduceMotion()` hook (`AccessibilityInfo.isReduceMotionEnabled()` + `reduceMotionChanged` listener) in the **first PR** (with the merge animation); every later phase consumes it. Repo currently has **zero** reduce-motion infra.
- **Persistence:** **no new MMKV key.** Current theme derives from the already-persisted score (auto-correct on Settings `resetScore`). A separate "furthest city" key = second source of truth + reset-desync risk.
- **New deps:** only `rive-react-native`. **Not** expo-blur (wrong layer, mixing-tools violation), **not** expo-image (use Skia `useImage`), noise = SkSL (native to Skia).

## Recommended phase sequence (PR series)

1. **A — Merge animation + `useReduceMotion()` hook** (self-contained, no deps; hook reused by 3–6).
2. **B0 — Canvas-coordinate plumbing**: expand canvas, board-origin offset in `geometry.ts`, gesture math, new Vitest cases. **Zero visual diff** (pure refactor, reviewable alone).
3. **B1 — Procedural paper-craft backdrop + frosted panel**, parametrized by theme from day one (even with 1–2 themes). First visual payoff.
4. **C — Score-milestone theme index** (new `src/meta` or `src/render` module), reuses B1's theme catalog, derives theme from score, cross-fade via `useReduceMotion()`.
5. **D-static — HUD / title / chrome reskin** of `game.tsx` / `index.tsx` (paper-card look, framed board). Parallel-safe with B/C (different files); final sign-off after B1 lands.
6. **D-motion — add `rive-react-native`**, wire animated title (placeholder state machine OK).
7. **Mascot moment** — separate slice, gated on mascot art (Procreate / rnd-department). Blocks nothing.

## Doc debt to update during delivery

- `docs/three-dots-game-design.md:93` — amend the Endless "single board / no progression" **table row** (an explicit edit, not a footnote) to record score-milestone backdrops.
- `docs/creative-bible.md` — §2.5-adjacent note distinguishing **"Endless score-gated backdrop theme"** from **"Journey world-map city."** Name the two "city" concepts distinctly so future readers don't conflate them.

## Scope resolutions (user, 2026-08-17)

1. **City asset scope → shared catalog.** Endless milestone backdrops and Journey both draw from ONE paper-craft city theme catalog. B1 is parametrized by a shared theme module (`src/render/themes/` or similar); Journey reuses it later for free. No Endless-only fork.
2. **UI-rework file scope → Endless + title + settings.** Reskin `game.tsx`, `index.tsx`, `settings.tsx`. **`journey.tsx` deferred** — separate WIP vertical slice with a known input-lock race; do not churn it in this effort.
3. **Next artifact → mockup, then plan.** Produce an annotated paper-craft HTML mockup (frontend-design) for sign-off FIRST, then hand the brief + approved mockup to the plan skill / `/ak:cook --advice`.
