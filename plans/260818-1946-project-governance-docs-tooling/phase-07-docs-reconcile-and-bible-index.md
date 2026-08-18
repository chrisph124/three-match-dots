---
title: 'Phase 7: Docs Reconcile & Bible Index'
status: done
priority: P2
effort: '4-5h'
dependencies: [8]
---

# Phase 7: Docs Reconcile & Bible Index

## Overview

Deliver the "bible" (item 3), technical document, and gameplay walkthrough (item 7) by **reconciling and
indexing** the existing 17-doc set — not by adding overlapping net-new files. The bible is an INDEX (avoids
name-collision with the LOCKED `creative-bible.md`); the gameplay walkthrough supersedes the two-dots
version; the technical reference extends `tech-stack-and-infra.md`.

## Requirements

- Functional: `docs/project-bible.md` — a curated index/overview linking the one-doc-per-concern set
  (design, creative bible, tech stack, security, level schema, monetization, compliance, gameplay, etc.),
  each with a one-line "what/authority" note. States the "clean structure" map (item 1).
- Functional: `docs/three-dots-gameplay-script.md` — the gameplay walkthrough, superseding
  `docs/two-dots-gameplay-script.md` (mark old one "superseded by", keep for history — matches the
  `two-dots-game-design.md → three-dots-game-design.md` precedent).
- Functional: technical reference — **extend `docs/tech-stack-and-infra.md`** (decided: no new file) with an
  architecture-map section that indexes the `src/` layers (core/render/input/effects/meta) and links
  security/team-workflow. Avoids a new-file/duplication ambiguity for the implementer.
- Functional: `README.md` (repo root) gains a one-line pointer to `docs/project-bible.md` as the docs entry
  point — item 1's "clean/discoverable structure" needs a root signpost, not just a CLAUDE.md Key-References line.
- Non-functional: zero duplicated authority; `creative-bible.md` untouched; every link resolves.

## Architecture

One-doc-per-concern + a top index. The bible does not restate content — it routes to the owning doc, like a
Confluence landing page. Technical reference maps the layered architecture (core/render/input/effects/meta)
already described in CLAUDE.md, linking source dirs.

## Related Code Files

- Create: `docs/project-bible.md` (index)
- Create: `docs/three-dots-gameplay-script.md` (walkthrough; supersedes two-dots version)
- Modify: `docs/two-dots-gameplay-script.md` (add "superseded by" banner)
- Modify: `docs/tech-stack-and-infra.md` — extend with the `src/`-layer architecture map (no new file)
- Modify: `README.md` (repo root) — add a one-line pointer to `docs/project-bible.md`
- Reference (no edit): `docs/creative-bible.md` (LOCKED), `docs/three-dots-game-design.md`, `CLAUDE.md` Key References
- Modify: `CLAUDE.md` Key References — add bible + gameplay-walkthrough + technical-ref links (Phase 6 owns
  the actual CLAUDE.md edit; leave a note for it rather than editing Key References here, to avoid a 6↔7 clash)

## Implementation Steps

1. Inventory the 17 docs; classify each as authority / superseded / reference. Decide bible index groupings.
2. Write `docs/project-bible.md`: sections (Product & Design, Creative, Technical, Security & Supply Chain,
   Levels/Journey, Monetization/Compliance, Process/Workflow, Game-Scripts) each linking owning docs + 1-liner.
   The Game-Scripts section links `docs/game-scripts/index.md` — Phase 8 creates that folder first, so this
   phase depends on Phase 8 and Phase 7 is the SOLE owner of the bible's game-scripts link (Phase 8 adds none).
3. Write `docs/three-dots-gameplay-script.md` from `three-dots-game-design.md` (current authority); add a
   "supersedes two-dots-gameplay-script.md" note and banner the old file.
4. Extend `docs/tech-stack-and-infra.md` with the `src/`-layer architecture map (core/render/input/effects/
   meta), linking security + team-workflow; no new tech doc.
5. Add the `README.md` root pointer to `docs/project-bible.md`. Hand the CLAUDE.md Key-References additions to
   Phase 6 (don't edit CLAUDE.md here — Phase 6 owns that file to avoid a same-file clash).
6. Verify every link resolves; run the doc-sync rule (Phase 6) mentally against this set.

## Todo

- [x] Inventory + classify the 17 docs (authority/superseded/reference)
- [x] Write `docs/project-bible.md` index (routes, doesn't restate)
- [x] Write `docs/three-dots-gameplay-script.md`; banner the superseded two-dots version
- [x] Extend `docs/tech-stack-and-infra.md` with the `src/`-layer architecture map (no new file)
- [x] Add `README.md` root pointer to `docs/project-bible.md`
- [x] Hand CLAUDE.md Key-References additions to Phase 6 (don't edit CLAUDE.md here)
- [x] Verify all links resolve

## Success Criteria

- [x] `docs/project-bible.md` indexes the doc set with authority notes; `creative-bible.md` unchanged.
- [x] Gameplay walkthrough exists and supersedes the two-dots script (old kept, bannered).
- [x] Technical reference exists without duplicating tech-stack/security content.
- [x] No broken links; CLAUDE.md Key References current.

## Risk Assessment

- **Duplication creep**: bible restates instead of routing → "which doc is authoritative?" confusion.
  Signal: content copied from owning docs. Response: bible holds links + 1-liners only.
- **Name collision**: a reader confuses `project-bible.md` with LOCKED `creative-bible.md`. Signal: edits
  land in the wrong file. Response: bible's intro explicitly states it's an index and creative-bible is LOCKED.
