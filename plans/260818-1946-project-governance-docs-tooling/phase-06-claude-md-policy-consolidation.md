---
title: 'Phase 6: CLAUDE.md Policy Consolidation'
status: done
priority: P1
effort: '2-3h'
dependencies: [2, 3, 5, 7, 8, 9]
---

# Phase 6: CLAUDE.md Policy Consolidation

## Overview

Merge all new policy into the EXISTING CLAUDE.md sections (not appended as disconnected rules): the pre-PR
checklist, the doc-sync/confluence rule, the three.js on-demand note, and cross-links to the no-leak policy.
CLAUDE.md is already ~220 coherent lines — additions must extend its structure or it self-contradicts.
Depends on Phases 2/3/5/7/8/9 so every reference it writes (folder routing, `coverage:diff` script, hook
framing, bible/gameplay/tech-doc paths, `docs/game-scripts/` path, three.js note) points at something that
already exists. Runs after Phase 7 so both aren't editing `CLAUDE.md` Key References at once.

## Requirements

- Functional — **Definition of Done**: add the pre-PR checklist — before pushing a commit or opening a PR,
  re-run lint + typecheck + test + **coverage(diff)** + code review + red-team/secret-scan. Label the
  red-team/session-hook parts "reminder, not enforcement"; the CI required checks are the hard gate.
- Functional — **doc-sync rule**: when `docs/game-scripts/` OR architecture/codebase/feature/style changes →
  update the technical reference + gameplay walkthrough + the general docs (bible index) in the SAME change.
- Functional — **Team Workflow**: the one-home-per-artifact routing rule (from Phase 2).
- Functional — **Tech Stack / Code Standards**: three.js/r3f/drei on-demand note (detail in Phase 9).
- Non-functional: merge into existing sections; no duplication; keep the "no AI attribution" and existing
  standards intact.

## Architecture

CLAUDE.md sections to touch (by current heading): "Definition of Done", "Team Workflow", "Development Rules"
/ "Code Standards", "Tech Stack (decided)" or "Key References". Edit in place; cross-link rather than restate.

## Related Code Files

- Modify: `CLAUDE.md` (multiple existing sections — Definition of Done, Team Workflow, Code Standards, refs)
- Reference: Phase 2 (routing), Phase 3 (`coverage:diff` script name), Phase 5 (no-leak + reminder framing),
  Phase 7 (bible/tech/gameplay doc paths), Phase 8 (game-scripts path), Phase 9 (three.js note)

## Implementation Steps

1. Definition of Done: append the pre-PR checklist as an item under the existing DoD list; name the exact
   commands (`npm run lint/typecheck/test/coverage:diff`) + "run code review + red-team before push".
2. Add the doc-sync/confluence rule near Documentation Management / Key References.
3. Add the routing rule to Team Workflow (or reconcile with Phase 2's minimal edit — one authoritative spot).
4. Add a one-line three.js on-demand pointer under Tech Stack (full policy lives in the doc from Phase 9).
5. Cross-link the no-leak policy (Phase 5) from Code Standards.
6. Re-read the whole CLAUDE.md for contradictions (whole-doc consistency), especially against existing
   "Definition of Done" and "Team Workflow (everyone follows this)".

## Todo

- [x] Add pre-PR checklist to Definition of Done (exact commands + honest framing)
- [x] Add doc-sync/confluence rule (game-scripts/arch/feature/style → update tech + gameplay + general docs)
- [x] Add artifact-routing rule to Team Workflow (single authoritative location)
- [x] Add three.js on-demand pointer to Tech Stack
- [x] Cross-link no-leak policy from Code Standards
- [x] Whole-doc consistency re-read; resolve contradictions

## Success Criteria

- [x] All new rules live INSIDE existing sections; no orphan "rules" block; no duplication.
- [x] Pre-PR checklist names real scripts and correctly separates hard gates from reminders.
- [x] Doc-sync + routing + three.js pointers present and internally consistent.

## Risk Assessment

- **Contradiction with existing DoD/Team Workflow**: two conflicting checklists. Signal: reviewer finds two
  "before merge" lists. Response: merge into the single existing DoD; delete redundancy.
- **Reference drift**: naming a script/path that Phases 3/7/9 didn't create. Signal: dead reference.
  Response: this phase runs after 2/3/5; verify each referenced path/script exists before writing it.
