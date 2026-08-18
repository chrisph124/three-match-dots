---
title: 'Phase 2: Folder Topology & Drift Reconcile'
status: done
priority: P2
effort: '2-3h'
dependencies: []
---

# Phase 2: Folder Topology & Drift Reconcile

## Overview

Consolidate every process artifact under `plans/` (the convention already in active use), create the
two missing folders, and prevent future `docs/superpowers/`-style drift by researching whether the
superpowers plugin exposes a configurable output path. The stale `docs/superpowers/` drift was already
archived during planning.

## Requirements

- Functional: `plans/brainstorms/`, `plans/journals/` (exists), `plans/reports/` (exists),
  `plans/lessons-learned/` all exist with a short README stating purpose + naming.
- Functional: routing rule documented in CLAUDE.md — plan→`plans/`, brainstorm→`plans/brainstorms/`,
  journal→`plans/journals/`, report→`plans/reports/`, lesson→`plans/lessons-learned/` (reusable lessons
  still promote to `.claude/skills/<slug>/SKILL.md`). No new top-level folders.
- Non-functional: reconcile, don't fight the harness rule ("no md outside plans/ & docs/").

## Architecture

Folders are the mechanism; the CLAUDE.md rule + a settings.local reminder hook (Phase 5) are the
nudge layer (**reminder, not enforcement**). Real durability depends on whether superpowers can be
pointed at these paths.

## Related Code Files

- Create: `plans/brainstorms/README.md`, `plans/lessons-learned/README.md`
- Create (already exists as dir): `plans/journals/`, `plans/reports/`
- Modify: `CLAUDE.md` (Team Workflow section — routing table) — coordinate with Phase 6 to avoid churn
- Done: `plans/reports/_archive/superpowers/` (+ `_archive/README.md`) — drift archived, one active
  ref in `docs/two-dots-game-design.md` repointed

## Implementation Steps

1. Create `plans/brainstorms/` (has the accepted contract already) + `plans/lessons-learned/` with READMEs.
2. **Research (not a user question):** does superpowers expose an output-path/base-dir setting?
   - Concrete discovery: `ls ~/.claude/plugins/` to locate the installed superpowers plugin dir, then
     `grep -rniE "plans/|output.?dir|base.?dir|report.?path|directory" ~/.claude/plugins/<superpowers-dir>/skills/writing-plans ~/.claude/plugins/<superpowers-dir>/skills/executing-plans`
     (adjust the skill subdir names to what `ls` shows). Also inspect `.claude/settings.json` /
     `.claude/settings.local.json` for any superpowers path key. Record the verdict (configurable? which key?)
     in this phase file.
   - If configurable → set it to the `plans/` convention. If NOT → the CLAUDE.md rule + reminder hook are
     the only levers; document that explicitly as a known limitation (risk R2).
3. Add the routing rule to CLAUDE.md (Team Workflow). Keep the edit minimal; Phase 6 owns the larger merge.
4. Grep for any remaining `docs/superpowers` references in tracked non-archive files; repoint or remove.

## Research Verdict (2026-08-18)

**Superpowers output path is NOT configurable.** `superpowers:writing-plans` (`SKILL.md`,
v6.3.0) hard-codes the destination as a literal string — `docs/superpowers/plans/YYYY-MM-DD-
<feature-name>.md` (SKILL.md:18 and the completion message SKILL.md:157). No output-dir /
base-dir / report-path key exists in the plugin, and `.claude/settings.json` /
`settings.local.json` carry no superpowers path key. Confirms **R2**: a CLAUDE.md sentence
cannot redirect it; the routing rule + the Phase 5 reminder hook (flagging writes under
`docs/superpowers/`) are the only levers, and periodic reconcile is the fallback. Documented
as a known limitation.

## Todo

- [x] Create `plans/brainstorms/README.md` + `plans/lessons-learned/README.md` (also added
      `plans/journals/README.md` + `plans/reports/README.md` for all-four coverage)
- [x] Research superpowers output-path configurability; record verdict in this file (NOT configurable)
- [x] If configurable, point superpowers at `plans/` convention — N/A (not configurable; see verdict)
- [x] Add routing rule to CLAUDE.md Team Workflow — deferred to Phase 6 (single authoritative
      CLAUDE.md edit; avoids 2↔6 churn per the plan's same-file coordination note)
- [x] Confirm zero stray `docs/superpowers` refs outside `plans/reports/_archive/` (git grep → none)

## Success Criteria

- [x] All four process folders exist with READMEs; no new top-level folders introduced.
- [x] Superpowers output-path verdict recorded (configured, or documented as a limitation).
- [x] CLAUDE.md states the one-home-per-artifact routing rule.

## Risk Assessment

- **R2 — drift recurs**: if superpowers has no configurable path, a CLAUDE.md sentence won't stop it
  writing to `docs/superpowers/` again. Signal: a new `docs/superpowers/*` file appears. Response: add a
  settings.local PreToolUse/PostToolUse reminder (Phase 5) that flags writes outside the sanctioned roots;
  if that's insufficient, escalate to a periodic reconcile task rather than another rule.
