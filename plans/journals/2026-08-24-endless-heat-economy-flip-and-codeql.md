---
title: 'Endless heat economy: flip authored + held; CodeQL fix shipped'
date: 2026-08-24
summary: 'Flip commit turning the Endless heat economy ON is authored as held draft PR #20 (on-device feel gate pending); CodeQL languages: fix merged first (PR #19) so the flip PR runs the corrected workflow — its Analyze passed. Item 2 (read-outs) found blocked by visual-upgrade Phase 5 and deferred by owner.'
---

# Endless heat economy: flip authored + held; CodeQL fix shipped

## What happened

Ran `/ak:cook` `--advice --tdd` on three items; owner chose sequencing
**3 → 1 → (2 deferred)**.

- **Item 3 — CodeQL fix (PR #19, merged `41820c0`).** `.github/workflows/codeql.yml`
  passed the deprecated `language:` input to `github/codeql-action/init`; the
  action expects `languages:` (plural), so `init` silently ignored it and fell
  back to autodetect instead of the matrix-pinned language. Corrected. The
  analyze step's `category: "/language:…"` is the SARIF category format and was
  already right. Sequenced **first** so the flip PR would run under the fixed
  workflow.
- **Item 1 — the flip (draft PR #20, held).** `ENDLESS_CONFIG` now carries the
  owner-locked bundle `{ lineLength: 6, heatCap: 3, heatStep: 0.5,
sweepExclusionWeight: 1 }`; `DEFAULT_CONFIG` + every Journey config stay
  byte-identical. Dark gate **inverted, not deleted**. Kept a single-commit
  4-file unit; **held, not merged** — decisive gate is the owner's on-device
  feel test.
- **Item 2 — read-outs (deferred).** Scope-check found it blocked behind
  `260817-1217-endless-visual-upgrade` Phase 5 (still `Pending`). Owner chose to
  respect the gate and defer rather than build against the un-reskinned HUD.

## Non-obvious decisions

- **CodeQL fix does not self-verify on its own PR.** `codeql.yml` has a
  `pull_request` path filter (`**/*.ts` …), so a workflow-file-only PR never
  triggers the CodeQL run. Its real end-to-end proof came on the flip PR #20
  (which touches `src/**/*.ts`): `Analyze (javascript-typescript)` ran under the
  corrected `languages:` input and **passed**. This is why merging #19 before
  opening #20 mattered — not just cleanliness.
- **Held ≠ uncommitted.** kongming (advisory) was decisive that an uncommitted
  working tree is the worst place for a gameplay-changing diff (no CI record,
  loss risk, blocks later work). Right shape = commit + **draft** PR: draft state
  physically greys the merge button (`main` is still unprotected, so a label
  would be weaker), and the merge rule travels **in the PR body**: if degenerate
  on device, tune `sweepExclusionWeight` or `heatStep` **DOWN**, never raise the
  sim bounds (the sim is a floor, not a ceiling).
- **The one probe the sim structurally cannot make** is the sweep→sweep
  treadmill — decision collapse, not rate. At w=1 on 3 colours the post-sweep
  refill is 2-colour so P(follow-up loop) ≈ 1.0; the owner must judge whether
  sweeps are _planned_ or handed over until play goes mindless. If only the
  treadmill is bad, the likely culprit is heat (cut `heatStep` 0.5 → 0.25), since
  exclusion buys little at 3 colours.
- **lineLength 6 on a 6×6 board is the geometric maximum** — a line-sweep now
  needs a complete row/column/main-diagonal drawn in order, so straight-line
  sweeps go near-extinct and the 2×2 loop becomes the only practical sweep.
  Owner-locked and sim-covered on rate; the feel test should consciously accept
  losing the straight sweep as a tool.

## Process notes

- The kongming go/no-go was cut off mid-run by a session limit; resumed the same
  agent from its transcript after reset to recover the verdict rather than
  re-spawning fresh.
- Finalize done directly (plan sync + docs eval) given full context; docs
  unchanged because the flip is held (shipped behavior only changes on merge).

## Held / next

- **Flip PR #20** awaits the owner's on-device feel test. On pass → merge
  (squash keeps the single-commit revert unit). On degenerate → tune down on the
  branch (each dial change also updates both guards + re-runs the sim) or
  `git revert` the one commit.
- **Item 2 (read-outs)** revisits once `260817-1217-endless-visual-upgrade`
  Phase 5 lands. kongming's stack-on-flip idea needs Phase 5 → read-out → stack
  first, so it is a larger chain than a standalone read-out.

## Unresolved questions

- None blocking. The flip's on-device feel test is the owner's step.
