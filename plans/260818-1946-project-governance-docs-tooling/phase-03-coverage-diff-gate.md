---
title: 'Phase 3: Coverage Diff-Gate'
status: done
priority: P1
effort: '3-4h'
dependencies: []
---

# Phase 3: Coverage Diff-Gate

## Overview

Add coverage reporting scoped to the Vitest-testable surface, and a diff-gate that fails CI only when
coverage **drops below a committed baseline** — mirroring the existing `check-audit.mjs` pattern. No
misleading repo-wide %, no arbitrary floor picked before a baseline exists.

## Requirements

- Functional: `npm run coverage` produces a machine-readable summary scoped to `vitest.config.ts`'s
  existing `include` list (`src/core/**`, `render/geometry|move-offsets|contrast`) — nothing that imports
  Skia/gesture/worklets.
- Functional: `npm run coverage:diff` (a no-dep Node script) compares current coverage to a committed
  baseline (`.github/coverage-baseline.json`) and exits non-zero on a drop beyond a small epsilon.
- Functional: CI runs both; report is informational, diff-gate is the fail condition.
- Non-functional: deterministic, no network, no flaky "checkout main and re-run" step.

## Architecture

Mirror `scripts/check-audit.mjs`: a committed baseline JSON is the source of truth (like
`.github/audit-allowlist.json`). `check-coverage.mjs` reads Vitest's `coverage-summary.json`
(v8 provider, `json-summary` reporter) and compares lines/statements/functions/branches % against
the baseline **at two levels**: (a) `total.*.pct` for the whole surface, and (b) **per-file** for every
file present in BOTH the baseline and the current run. Per-file is what stops the gameable case — a PR that
adds a big well-tested file while an existing file silently regresses keeps `total` flat, so total-only
would pass. New files (in current, not baseline) are recorded into the next baseline, not failed. Ratchet =
update the baseline file in the same PR that raises coverage. Baseline IS the floor, and it auto-ratchets —
satisfying "diff-gate, no arbitrary floor".

## Related Code Files

- Modify: `package.json` — add `@vitest/coverage-v8` (pin to the Vitest 4 line), scripts `coverage`,
  `coverage:diff`
- Modify: `.github/dependabot.yml` — add `@vitest/coverage-v8` to the `dev-tooling` group (pattern
  `@vitest/*`, or the explicit name) so it version-tracks `vitest` in one grouped PR and can't skew on
  `main` once Phase 4 auto-merge is live. **This is the Phase 3 ↔ Phase 4 coupling** — `vitest` is a bare
  string in that group today; `@vitest/coverage-v8` is dynamically imported by vitest (not a strict npm
  peer), so nothing else catches a version skew.
- Modify: `vitest.config.ts` — `coverage: { provider: 'v8', reporter: ['text','json-summary'], include: [...same list...], reportsDirectory: './coverage' }`
- Create: `scripts/check-coverage.mjs` (mirror `check-audit.mjs` structure/comments)
- Create: `.github/coverage-baseline.json` (initial baseline captured from first `npm run coverage`)
- Modify: `.github/workflows/ci.yml` — add `npm run coverage` + `npm run coverage:diff` to the `quality` job
- Modify: `.gitignore` — ignore `/coverage` output dir
- Modify: `docs/security-and-supply-chain.md` OR the technical reference — document the coverage gate next to audit:diff

## Implementation Steps

1. Add `@vitest/coverage-v8` (version-matched to `vitest@^4`); configure coverage in `vitest.config.ts`
   scoped to the existing include list; `json-summary` + `text` reporters.
2. Run `npm run coverage`; capture totals AND per-file entries into `.github/coverage-baseline.json`
   (per-metric % + a single `epsilon` tolerance in **percentage points**, e.g. 0.5 pp).
3. Write `scripts/check-coverage.mjs`: read `coverage/coverage-summary.json`; compare `total.*.pct` to
   baseline totals AND each per-file `*.pct` to its baseline entry (only for files in both). Fail listing
   any total-metric OR any per-file metric that dropped > epsilon; record new files for the next baseline
   (don't fail on them); on an overall rise, print "safe to ratchet baseline".
4. Wire `coverage` + `coverage:diff` into CI `quality` job (after `npm test`).
5. Add `/coverage` to `.gitignore`. Document the gate.
6. Optionally add `coverage` to the Husky pre-push (keep pre-push fast — measure first).

## Todo

- [x] Install `@vitest/coverage-v8` (Vitest-4-matched)
- [x] Add `@vitest/coverage-v8` to the `dev-tooling` group in `.github/dependabot.yml` (Phase 3↔4 coupling)
- [x] Configure `coverage` in `vitest.config.ts` (scoped include, json-summary)
- [x] Add `coverage` + `coverage:diff` scripts to `package.json`
- [x] Capture initial `.github/coverage-baseline.json` (totals + per-file entries)
- [x] Write `scripts/check-coverage.mjs` (mirror check-audit.mjs; total + per-file diff)
- [x] Wire both into `ci.yml` quality job
- [x] `.gitignore` the `/coverage` dir; document the gate
- [x] Verify: local drop in a test → `coverage:diff` fails; rise → prints ratchet hint

## Success Criteria

- [x] `npm run coverage` reports only the testable surface (no Skia/worklet files inflating/deflating %).
- [x] `npm run coverage:diff` fails on a real coverage drop, passes at/above baseline, hints ratchet on rise.
- [x] CI runs both; no absolute floor beyond the committed baseline.

## Risk Assessment

- **`@vitest/coverage-v8` ↔ `vitest` version mismatch**: coverage errors. Signal: coverage run throws.
  Response: match the coverage package to the installed Vitest 4 line exactly (peer-locked).
- **Baseline set too high from a lucky run**: unrelated PRs fail. Signal: diff-gate red on untouched code.
  Response: baseline is a committed file — lower it in the same PR; epsilon absorbs noise.
- **v8 coverage of pure-TS only**: fine — the include list already excludes native layers by rule.
