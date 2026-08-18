# Phase 2 — Spec ↔ Code Reconciliation: docs-manager completion report

Scope executed: `plans/260816-1418-rn-three-dots-retarget/phase-02-spec-code-reconciliation.md`,
Implementation Steps 1–6.

## Files created (7, all under `docs/`)

- `docs/three-dots-game-design.md` — current design authority for both modes. Adds a "Status vs.
  shipped code" section up top (Endless shipped in full; Journey designed, not implemented — no
  `src/core/journey/` or `src/core/level/`). Core mechanic retargeted to 8-way adjacency with an
  explicit "code wins" note; documents the shipped ≥5-line color-sweep as a "shipped bonus
  mechanic" (cites `ChainKind: 'line'`, `ClearReason: 'color-sweep'`,
  `src/core/resolve/classify-chain.ts`, `src/core/resolve/collect-cleared.ts`) with an on-device
  tuning flag. Build-order steps 1–3 marked **Shipped**; 4–6 marked not yet built.
- `docs/creative-bible.md` — the LOCKED "color + shape/pattern, never color alone" accessibility
  rule now carries a blockquote: **"Shipped-status: not yet met — shape/pattern deferred"**, citing
  `src/render/dot-layer.tsx` (plain circles, no shape channel), with an explicit instruction not to
  cite the rule as satisfied in store copy or a compliance submission. Motion language retargeted to
  `react-native-reanimated` worklets + Skia primitives (in-scene) and `rive-react-native` (meta-UI).
- `docs/level-script-schema.md` — the TS+zod level-script contract. Contains: the JSON shape (`zod`
  validator, `parseLevelScript`, `LevelScript` type in `src/core/`); a Board→`GameConfig` mapping
  table (`src/core/types.ts` / `src/core/config.ts`); the `colors` bound (validator rejects beyond
  `src/render/palette.ts#DOT_COLORS` length — explicitly flags the doc's own `colors: 5` example as
  only valid once the palette is extended past its shipped 3); the new optional `seed` field
  (threads into `newGame(config, seed)`, pure schema addition); `spawnWeights` marked reserved/not
  wired, with the old `spawnWeights.length == colors` rule explicitly deleted and the reasoning
  stated (`src/core/resolve/refill.ts` draws uniformly, nothing consumes the field); `cagedDot` made
  positional-only (dropped authored `color`, cites `src/core/game.ts`); a restricted v0
  obstacle-type enum (`cagedDot` only) and objective-type enum (`clearColor`, `freeCaged` only),
  matching what Phase 3 actually implements; a "Freeing semantics" section (any clear frees a cage;
  loop/line sweeps free board-wide, cites `src/core/resolve/collect-cleared.ts`); a "Fail-fast
  validation rules" section including the board-legality invariant `colors × minChain ≤ rows × cols`
  that must fail at parse (cites `src/core/shuffle.ts`'s pigeonhole guarantee).
- `docs/monetization-and-roadmap.md` — deferred economy design. IAP retargeted to an RN wrapper
  over StoreKit 2 (`react-native-iap` / `expo-in-app-purchases`). Android step rewritten: no
  separate native track — ships from the same RN codebase via EAS Build once the iOS release and
  content are stable.
- `docs/apple-compliance-checklist.md` — carries a "Port note (2026-08-16)" disclaiming that
  engine references were retargeted but the underlying Apple-policy content was **not re-verified
  live** in this pass. Dropped the header link to the archive-only pivot doc. Guideline 4.7
  reasoning retargeted to "compiles RN/TypeScript to a native binary (Hermes) via Expo/EAS, not a
  WebView wrapper." SDK table retargeted to `@sentry/react-native` / `posthog-react-native`. Export
  compliance retargeted to Expo's `ios.config.usesNonExemptEncryption`.
- `docs/rnd-department.md` — agent roster + routing design, engine-agnostic content kept verbatim.
  One correction applied post-write (see "Disagreements" below).
- `docs/creative-tool-catalog.md` — animation row retargeted to `react-native-reanimated` +
  hand-rolled Skia particle draws (no first-party particle system ships with Skia the way
  `SKEmitterNode` ships with SpriteKit); Rive row retargeted to `rive-react-native`, marked not yet
  an installed dependency; audio playback retargeted to `expo-av`, also marked not yet installed;
  cross-cutting tooling pointer retargeted from the archive pivot doc to `CLAUDE.md` +
  `docs/tech-stack-and-infra.md`.

## Files modified

- `CLAUDE.md` — Project Overview reframed to "Three Dots" with Endless (shipped) + Journey
  (designed, vertical slice in progress) stated up front; Scope section splits Shipped / Vertical
  slice in progress / Out of scope for now (Android note added: same-codebase, deferred not
  blocked, consistent with the new monetization doc); Key References rewritten to list all 7 new
  docs plus the existing ones, every path link-checked against the filesystem.
- `docs/two-dots-game-design.md` — supersede banner extended with a pointer to
  `docs/three-dots-game-design.md` as current authority, plus a "Tombstone — Swift/SpriteKit pivot
  reversed" paragraph naming branch `archive/swift-pivot-260816` as the only place the pivot
  evaluation and `docs/native-swift-pivot-design.md` still exist.

## Where the archive doc and shipped code disagreed (and how resolved)

1. **Adjacency:** archive spec assumed 4-way/no-diagonals; shipped `src/core/hot/adjacency.ts` is
   8-way. Resolved in favor of code — `three-dots-game-design.md` states this as a "Locked
   decision" with an explicit "code wins" note, not a silent rewrite.
2. **Line-sweep mechanic:** not in the archived concept spec at all; shipped code has
   `ChainKind: 'line'` / `ClearReason: 'color-sweep'` / `lineLength = 5`. Documented as a "shipped
   bonus mechanic" with a tuning flag (colors=3 on a 6×6 board makes an accidental 5-run easy),
   rather than silently omitted or presented as originally designed.
3. **`spawnWeights` validation:** archive schema required `spawnWeights.length == colors`.
   Deleted — `src/core/resolve/refill.ts` draws uniformly via `nextInt(state, colors)`; there is no
   weighting consumer anywhere in `GameConfig` or the resolve layer, so enforcing shape on an unused
   field would only constrain future refactors for no present benefit.
4. **`cagedDot.color`:** archive schema authored a `color` on the obstacle. Dropped — `newGame`
   (`src/core/game.ts`) has no per-cell color override hook, so an authored color would be
   decorative/misleading; the schema doc instead points authors at seeded fixture tests to assert a
   cage's dealt color.
5. **Accessibility LOCKED rule vs. renderer:** creative-bible's "color + shape, never color alone"
   rule is unmet by `src/render/dot-layer.tsx` (plain circles, no shape channel). Annotated as
   "shipped-status: not yet met," not weakened or silently dropped.
6. **`colors: 5` schema example vs. shipped palette:** `src/render/palette.ts#DOT_COLORS` ships
   only 3 colors today. The schema doc keeps the illustrative `colors: 5` example but explicitly
   states it's only valid once the palette is extended — avoids overclaiming current capability.
7. **Objective/obstacle catalogs:** archived GDD catalog is broader (anchor, locked tile, color
   lock, clearTotal, reachScore, etc.) than what Phase 3 implements. `level-script-schema.md`
   restricts the _validated_ v0 enums to `cagedDot` / `clearColor` / `freeCaged` only, keeping the
   "fail fast on unknown type" validation rule internally consistent; the broader catalog stays in
   the GDD as design intent for a future `schemaVersion` bump.
8. **Timer field units:** archived doc used seconds-based names
   (`startSeconds`/`mistakePenaltySeconds`/`clearBonusSeconds`); renamed to ms-based
   (`startMs`/`mistakePenaltyMs`/`clearBonusMs`) to match Phase 3's internal
   `JourneyState.timeRemainingMs` / `tick(jstate, dtMs)` naming already specified in
   `phase-03-three-dots-vertical-slice.md`.
9. **False "already wired" claim (self-caught, not a spec/code conflict per se):** while porting
   `docs/rnd-department.md`, I initially copied the archive doc's Sequencing section verbatim,
   which checked off "✅ CLAUDE.md already has an AgentKit Routing — RnD Department block." That
   block exists on the archive branch's `CLAUDE.md` (confirmed at its line 135 via
   `git show archive/swift-pivot-260816:CLAUDE.md`) but does not exist on `main` (confirmed via
   grep). Corrected before finalizing to an unchecked, accurately-worded pending step.

## Validation run

- `grep -rn "native-swift-pivot\|SpriteKit\|SKAction\|SKEmitterNode\|SKAudioNode\|AVAudioEngine\|Codable\b\|swift-pivot" docs/ CLAUDE.md README.md` — the only hits remaining are explicit historical/tombstone mentions (branch name, or "no first-party particle system ships with Skia the way `SKEmitterNode` ships with SpriteKit" as a comparison, not an authority reference). No doc treats a Swift/SpriteKit/Codable construct as current.
- `grep -rn "](docs/native-swift-pivot-design.md)\|(docs/native-swift-pivot-design.md)"` across `docs/`, `CLAUDE.md`, `README.md` — zero hits; the only mention of that filename is inside `docs/two-dots-game-design.md`'s tombstone note, in prose stating it lives only on `archive/swift-pivot-260816`, not a link implying it resolves on `main`.
- Every `docs/*.md` path referenced from `CLAUDE.md` and from the 7 new/edited docs was checked against the filesystem with `[ -f "$path" ]` — all resolve except the one intentional archive-only mention above.
- Spot-checked 10 `src/*` paths cited across the new docs (`src/core/types.ts`, `config.ts`, `game.ts`, `hot/adjacency.ts`, `resolve/refill.ts`, `resolve/collect-cleared.ts`, `shuffle.ts`, `render/palette.ts`, `render/dot-layer.tsx`, `resolve/classify-chain.ts`) — all exist.
- No edits made under `src/`, `.github/`, `docs/security-and-supply-chain.md`, or any `plans/*` file other than this report.

## Docs impact

7 new authority docs under `docs/` (Three Dots concept, creative bible, level-script contract,
monetization roadmap, Apple compliance checklist, RnD department, creative tool catalog); `CLAUDE.md`
reframed to the two-mode concept with Journey as an in-progress vertical slice; the pre-existing
`docs/two-dots-game-design.md` retained as explicitly-superseded history with a pivot-reversal
tombstone. No `src/` behavior changed.

## Unresolved questions

- None blocking. One observation carried into the report rather than acted on unilaterally: the
  monetization doc's Android framing ("same RN codebase, no separate track") is now more detailed
  than `CLAUDE.md`'s terse "Android: deferred, not blocked" line — both agree, but if the
  orchestrator wants CLAUDE.md's Android line expanded further to mirror that framing, that's a
  small follow-up, not something this pass changed beyond the one added clause.

Status: DONE
Summary: Ported and RN-retargeted all 7 archived concept docs, reconciled every archived design
claim against shipped code (8-way adjacency, line-sweep mechanic, spawnWeights, cagedDot,
accessibility gap, timer units, restricted schema enums), reframed CLAUDE.md and the superseded
two-dots doc, and verified no doc on main links to the archive-only Swift/SpriteKit design.
Concerns/Blockers: none.
