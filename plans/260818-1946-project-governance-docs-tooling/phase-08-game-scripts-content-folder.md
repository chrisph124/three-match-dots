---
title: 'Phase 8: Game-Scripts Content Folder'
status: done
priority: P3
effort: '2-3h'
dependencies: []
---

# Phase 8: Game-Scripts Content Folder

## Overview

Create `docs/game-scripts/` as the creative pre-production home (item 8) — the Confluence-style space for
ideas, characters, game modes, levels, materials, font style, philosophy, and game spirit. Wire the
doc-sync rule so that updating it triggers updates to the technical + gameplay + general docs.

## Requirements

- Functional: `docs/game-scripts/` with an `index.md` (or `README.md`) + one seeded `.md` per section:
  `ideas.md`, `characters.md`, `game-modes.md`, `levels.md`, `materials.md`, `font-style.md`,
  `philosophy.md`, `game-spirit.md`. Each is a real template with headings + placeholders (no fake content).
- Functional: the index links each section and states the confluence sync contract (per Phase 6 rule).
- Functional: game-scripts is CONTENT (like `creative-bible.md`), lives under `docs/`, not `plans/`.
- Non-functional: consistent with `creative-bible.md` / `three-dots-game-design.md` tone; kebab-case files.

## Architecture

Content folder under `docs/`. The index is the entry point; the doc-sync rule (Phase 6) makes changes here
cascade into the technical reference + gameplay walkthrough + bible index. No code.

## Related Code Files

- Create: `docs/game-scripts/index.md`
- Create: `docs/game-scripts/{ideas,characters,game-modes,levels,materials,font-style,philosophy,game-spirit}.md`
- Referenced by (no edit here): `docs/project-bible.md` — Phase 7 (which depends on this phase) links this
  folder from the bible index. This phase lands first and does NOT edit the bible.
- Reference: `CLAUDE.md` doc-sync rule (Phase 6), `docs/creative-bible.md`, `docs/level-script-schema.md`

## Implementation Steps

1. Create `docs/game-scripts/` + the 8 section files + `index.md`; each with a template skeleton (purpose,
   headings, "how to add", cross-links to owning docs like `level-script-schema.md`, `creative-bible.md`).
2. `index.md` states the confluence contract: "when you add/enrich a script here, update the technical
   reference + gameplay walkthrough + bible index in the same change (see CLAUDE.md doc-sync rule)."
3. Do NOT edit the bible here — Phase 7 (depends on this phase) owns linking `docs/game-scripts/` from the
   bible index. This phase just creates the folder so that link resolves.
4. Confirm no overlap-authority with `creative-bible.md` / `level-script-schema.md` (link, don't restate).

## Todo

- [x] Create `docs/game-scripts/` + `index.md`
- [x] Seed 8 section templates (ideas, characters, game-modes, levels, materials, font-style, philosophy, game-spirit)
- [x] Write the confluence sync contract into `index.md`
- [x] (Phase 7 links this folder from the bible index — no bible edit in this phase)
- [x] Verify cross-links to owning docs resolve; no duplicated authority

## Success Criteria

- [x] `docs/game-scripts/` has an index + 8 seeded section templates (real skeletons, no fake data).
- [x] Index states the doc-sync/confluence contract and links owning docs.
- [x] Game-scripts space is linkable from the bible index (Phase 7 performs the link).

## Risk Assessment

- **Becomes a dumping ground / drifts from docs**: Signal: sections filled but tech/gameplay docs never
  updated. Response: the Phase 6 doc-sync rule + reminder hook (Phase 5) are the levers; index restates the
  contract at the point of edit.
- **Authority overlap with creative-bible/level-schema**: Signal: contradictory content. Response: game-scripts
  is pre-production ideation; it links to the LOCKED/authority docs rather than redefining them.
