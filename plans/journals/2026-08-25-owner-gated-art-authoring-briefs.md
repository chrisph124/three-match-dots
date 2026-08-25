# Owner-gated art-authoring briefs (title.riv + mascot)

**Date:** 2026-08-25
**Branch:** feat/endless-ui-reskin
**Request:** `/ak-cook "work for Two owner-gated follow-ups remain"` — the two follow-ups
surfaced at the close of the endless-visual-upgrade reconcile (commit 4913e49).

## What the two follow-ups actually are

1. On-device Rive title animate (phase-06). Code wiring shipped (`src/render/rive-title.tsx`
   null-guards until art lands). Blocked only on a human-authored `assets/rive/title.riv`.
2. Phase-07 mascot moment. Blocked on mascot art; bible §2.6 LOCKS "exactly one mascot"
   but its design is TBD; phase-07 forbids shipping a placeholder.

## Key finding: neither asset is agent-producible; one blocker was smaller than assumed

- A `.riv` is a compiled Rive-editor binary and mascot art is human-authored (Procreate) —
  per the repo's own `docs/rnd-department.md`, agents spec/review, humans produce art. No
  image/animation-gen tool available. So "produce the assets" is out of scope by design.
- Correction to the earlier "owner device rebuild" assumption: `rive-react-native ^9.8.5`
  is already a dependency and already imported in shipped code, and `metro.config.js`
  already registers `.riv` in `assetExts`. So shipping `title.riv` is a JS/Metro-asset
  change (drop file + flip one line + reload Metro), NOT an `expo run:ios` native rebuild.
  Follow-up #1's only real blocker is the art file.

## What was produced (the sanctioned agent forward-work)

One brainstorm/design contract:
`plans/brainstorms/260825-1307-owner-gated-art-authoring-briefs.md`

- Brief 1 — `title.riv` authoring spec: pins the `rive-title.tsx` contract (default artboard
  must BE the lockup + autoplay, no named artboard/state-machine), the exact lockup to
  reproduce (tokens from `ui-theme.ts`), canvas/height reconciliation (150 placeholder vs
  ~105-120pt static lockup), calm one-shot assemble intent (bible §4), <=200KB budget,
  artist definition-of-done, and the two-step dev drop-in.
- Brief 2 — mascot design brief: 3 Japan/washi paper-craft concept options (Tsuru crane,
  Mame dot-spirit, Han seal-emblem), each with read/silhouette/palette/icon-legibility/one
  Journey motion beat/tone-hits/risk; placement map (complementary to the 三 lockup, not
  in-board); human Procreate+Rive production path; an owner-decision block that adopts none.

## Process note

Drafted by `ui-ux-designer` with the code contract pinned; bible-and-code conformance gate
performed in-session (the RnD `art-director-reviewer` is a documented subagent but is not a
spawnable agent type in this runtime, so the reviewer role was fulfilled directly against
the LOCKED bible + source). No code, tests, or plan checkboxes touched.

## Owner-gated, still remaining

- title: human authors `assets/rive/title.riv` per Brief 1; drop-in then trivial.
- mascot: owner picks a direction, then a human authors art (Procreate) + motion (Rive),
  which clears the bible review gate before integration.
