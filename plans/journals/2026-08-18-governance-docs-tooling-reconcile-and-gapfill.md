---
title: 'Governance, docs & tooling: reconcile + gap-fill'
date: 2026-08-18
summary: '9-phase governance plan executed on feat/governance-docs-tooling; coverage diff-gate + gated Dependabot auto-merge + doc-sync/bible index landed; 2 owner GitHub actions remain'
---

# Governance, docs & tooling: reconcile + gap-fill

## What happened

Executed the accepted 9-phase plan `plans/260818-1946-project-governance-docs-tooling/`
on branch `feat/governance-docs-tooling`. This was **reconcile + gap-fill, not
greenfield** — extend an already-mature governance layer (CI gates, gitleaks,
audit-diff, vendored-pin-check, dependabot grouping, Husky), merging new rules
into existing CLAUDE.md sections rather than appending. Real execution order
`1 → {2,3,5,7,8,9} → 6 → 4`, honoring 8→7 and 6-after-7 (both edit CLAUDE.md Key
References).

- **Phase 2 (folder topology):** `plans/{brainstorms,journals,lessons-learned,reports}/`
  seeded with READMEs; `docs/superpowers/` archived under `plans/reports/_archive/superpowers/`.
- **Phase 3 (coverage diff-gate):** `scripts/check-coverage.mjs` mirrors the
  `check-audit.mjs` advisory-diff pattern — committed baseline
  (`.github/coverage-baseline.json`) is the source of truth, gate fails ONLY on a
  drop > epsilon (0.5pp) vs baseline, at two levels (total + per-file `*.pct`).
  v8 provider + json-summary reporter, scoped to the RN-free testable surface;
  wired into `ci.yml` + `package.json` (`coverage`, `coverage:diff`); `/coverage`
  gitignored; `@vitest/*` folded into the dependabot `dev-tooling` group so
  coverage tooling can't version-skew.
- **Phase 4 (Dependabot auto-merge) — authored + gated:**
  `.github/workflows/dependabot-automerge.yml` — `on: pull_request`,
  `dependabot[bot]` actor guard, workflow-level `permissions: {}` +
  job-level `contents/pull-requests: write`, `dependabot/fetch-metadata` SHA-pinned
  to v2, default-deny gate (dev-tooling + semver minor/patch only), `PR_URL` via
  env not inline. Loud DO-NOT-ACTIVATE header; gating documented in the security doc.
- **Phase 5 (guardrail hooks + no-leak):** `.claude/settings.local.json` pre-PR
  reminder hook (labeled advisory); no-leak policy bullet in CLAUDE.md Code Standards.
- **Phase 6 (CLAUDE.md consolidation):** in-place merges — DoD pre-PR checklist +
  coverage gate, doc-sync rule, artifact-routing table, three.js on-demand, no-leak,
  bible/gameplay/tech-ref paths; Enforcement reconciled to the solo count-0 flow.
- **Phase 7 (docs reconcile):** `docs/project-bible.md` index, `three-dots-gameplay-script.md`
  walkthrough, `tech-stack-and-infra.md` `src/` architecture map; supersede banners on
  the two-dots docs; README points to the bible.
- **Phase 8 (game-scripts):** `docs/game-scripts/` (index + 8 sections), linked from the bible.
- **Phase 9 (three.js on-demand):** allowed via `npx expo install` only, NOT installed;
  Skia stays the primary renderer — noted in settings.local + CLAUDE.md Tech Stack.

## Decision

- **"Author now, gate docs" for Phase 4 (user decision).** The auto-merge workflow
  is written and reviewable but INERT: GitHub native auto-merge waits on required
  status checks, which don't exist until branch protection is live. The workflow
  file + security doc both loudly state it must not merge to `main` until the owner
  enables Phase 1 + two repo settings ("Allow auto-merge", "Allow GitHub Actions to
  create and approve pull requests").
- **Solo repo, `required_approving_review_count: 0` (user decision).** Branch
  protection requires checks to pass but allows self-merge — documented as the exact
  `gh api` command in `security-and-supply-chain.md`.
- **Honesty over aspiration in the docs.** Code review (DONE_WITH_CONCERNS) caught
  CLAUDE.md asserting `secret-scan`/`quality` are present-tense "required checks"
  while `main` is unprotected; softened both to "become merge-blocking required
  checks once branch protection is enabled (pending owner action)". A green local
  run explicitly does not replace the CI checks on the PR.
- **Coverage gate hardened (review nit).** Added `assertMetrics()` — a baseline
  entry missing any of the 4 metrics now hard-fails (exit 2) instead of silently
  masking a regression as `NaN`. Verified: real baseline passes, malformed fires the guard.
- **Committed authority = CLAUDE.md.** `.claude/settings.local.json` is gitignored
  (global `~/.config/git/ignore`), so the guardrail hook is a local convenience;
  the durable, teammate-visible policy lives in CLAUDE.md.

## Verified

`npm run lint` 0 errors · `npm run typecheck` clean (strict, no-any) · `npm test`
green · `npm run coverage:diff` OK (94.61% stmts, at/above baseline) · audit-diff +
vendored-check green. Code review ran (code-reviewer subagent) → all should-fix +
the hardening nit applied and re-verified. Plan synced files-first: all 9 phase
files + plan.md reflect Done / owner-pending / authored-gated.

## Next steps (human gates — cannot run here)

1. **Branch protection PUT on `main`** (owner GitHub-admin action) — require
   `quality` + `secret-scan`, count 0. The exact command is in `security-and-supply-chain.md`.
2. **Enable the two repo settings** ("Allow auto-merge" + "Allow GitHub Actions to
   create and approve pull requests"), then verify the auto-merge workflow with a
   synthetic throwaway PR.
3. **Deferred drift (out of governance scope):** `docs/three-dots-game-design.md`
   and CLAUDE.md still say Journey is "not yet implemented on main", but
   `src/core/journey/` + `level/` + `obstacles/` are committed (93e1553);
   `tech-stack-and-infra.md` is the ground-truth map. Reconcile the design-doc +
   CLAUDE.md status lines in a dedicated game-side pass.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
