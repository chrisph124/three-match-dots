---
phase: 6
title: 'Docs sync + review close-out'
status: todo
priority: P1
effort: '2h'
dependencies: [1, 2, 3, 4, 5]
---

# Phase 6: Docs sync and review close-out

## Overview

Land the mechanic: synchronize the evergreen docs that anchor now touches, run the full CI-blocking
gate, obtain code review, and close out per the team workflow. No new behaviour — this phase makes the
change discoverable, verified, and merge-ready. Depends on all prior phases (docs describe shipped
behaviour; review covers the whole diff).

## Requirements

### Functional (docs sync — update in the SAME change as the behaviour)

- [ ] `docs/level-script-schema.md` — document the `anchor` obstacle variant (`{type:'anchor', cell}`),
      the `clearAnchors` objective, the `schemaVersion` union now accepting `3`, and the
      clearAnchors-requires-anchor validation gate. This is the level-author contract — it MUST match
      the Phase-1 schema exactly.
- [ ] `docs/three-dots-game-design.md` (current game-design authority) — add the anchor/weight
      mechanic: unlinkable, falls with gravity, removed by any 8-way-adjacent same-colour clear
      (single-hit), the `clearAnchors` objective, both modes. Keep it consistent with the cage section.
- [ ] `docs/tech-stack-and-infra.md` (the `src/` architecture map) — register the new modules
      (`src/core/obstacles/anchor.ts`, `src/core/resolve-anchor-chain.ts`,
      `src/render/anchor-overlay-layer.tsx`) and the `resolveChain` seam.
- [ ] `docs/project-bible.md` (docs index) — add a route entry ONLY if a doc was added or a concern
      renamed; otherwise leave untouched (cross-link, do not duplicate).
- [ ] `docs/creative-bible.md` is LOCKED — do NOT edit as a side effect. If the anchor art needs a new
      creative rule, raise it as a deliberate, owner-approved change, separate from this phase.
- [ ] Verify every doc claim against the shipped source (schema shape, field names, module paths)
      before committing — no stale or aspirational text.

### Functional (review + close-out)

- [ ] Run code review via `superpowers:requesting-code-review` over the full diff (Definition of Done
      step 2). Address findings via `receiving-code-review`.
- [ ] Red-team the diff for leaked keys/tokens/.env (none expected — pure-TS + TSX + docs), and confirm
      no AI attribution anywhere (commits/PRs/comments).
- [ ] If the review surfaces a reusable lesson (e.g. the "one removal rule, N callers" seam pattern),
      codify it via `superpowers:writing-skills` (step 6); otherwise note it in the PR description only.

### Non-functional (the CI-blocking gate — Definition of Done step 3-4)

- [ ] `npm run lint` clean (incl. sonarjs, no-`any`).
- [ ] `npm run typecheck` clean (strict).
- [ ] `npm test` green (the full pure-TS core, all new + existing suites).
- [ ] `npm run coverage:diff` at/above the committed baseline.
- [ ] `src/core/**` verified RN-free (grep anchored to `from '`/`require(`); `hot/**` unchanged
      (`git diff --stat src/core/hot/` empty).

## Architecture

Docs mirror the shipped seams: one home per concern (schema contract, game-design authority, `src/`
map, index). Cross-link rather than duplicate. The review + gate confirm the whole vertical (schema →
resolve → state → solver/generator → render) holds together and that Endless + existing caged behaviour
are untouched.

## Related Code Files

### Create

- None (docs + review only).

### Modify

- `docs/level-script-schema.md`
- `docs/three-dots-game-design.md`
- `docs/tech-stack-and-infra.md`
- `docs/project-bible.md` (index route — only if a doc was added/renamed)

### Delete

- None.

## Implementation Steps

1. Update the four docs against the shipped source; verify field names + module paths by grep.
2. Run the full gate: `npm run lint && npm run typecheck && npm test && npm run coverage:diff`.
3. Confirm `hot/**` and Endless are untouched (git diff scoped checks).
4. Request code review; apply findings.
5. Red-team the diff (no secrets, no AI attribution); open the PR (conventional commit, human-authored).
6. Decide on a lessons-learned skill (yes → `writing-skills`; no → PR note).

## Success Criteria

- [ ] `docs/level-script-schema.md` matches the Phase-1 schema exactly (variant, objective, version,
      validation gate).
- [ ] `docs/three-dots-game-design.md` describes the anchor mechanic + `clearAnchors` for both modes.
- [ ] `docs/tech-stack-and-infra.md` lists the new modules + the resolve seam; index updated only if
      needed. `docs/creative-bible.md` unchanged.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage:diff` all green.
- [ ] `src/core/**` RN-free; `src/core/hot/**` diff empty; Endless behaviour + visuals unchanged.
- [ ] Code review completed; diff red-teamed (no secrets, no AI attribution); PR opened with a
      conventional, human-authored commit.

## Risk Assessment

| Risk                                                       | Likelihood x Impact | Observable signal it broke                                                | Pre-decided response                                                                                                                                     |
| ---------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs drift from the shipped schema (aspirational text)     | Med x Med           | A level author follows the doc and `parseLevelScript` rejects their level | Verify each doc claim against source by grep before committing; the schema file is the contract                                                          |
| Coverage diff-gate fails on the new core modules           | Med x Med           | `npm run coverage:diff` reports a drop below baseline                     | New core logic (anchor.ts, seam, folds) is TDD'd in Phases 1-4; add tests to restore the baseline, never lower the baseline to pass                      |
| `creative-bible.md` edited as a side effect (it is LOCKED) | Low x High          | `git diff docs/creative-bible.md` non-empty                               | Revert any incidental edit; route a genuine creative change through owner approval separately                                                            |
| An AI-attribution string slips into a commit/PR/comment    | Low x High          | grep for "Claude"/"Generated with"/"Co-Authored" in the diff/commit       | Red-team before push; amend the commit if found                                                                                                          |
| Review surfaces a design gap late (rework)                 | Low x Med           | Reviewer flags a resolve/solver divergence                                | The one-rule-two-callers invariant + the enumerator≡deadlock test (Phase 4) are the guardrails; if a gap is real, fix at the shared rule, not per-caller |
