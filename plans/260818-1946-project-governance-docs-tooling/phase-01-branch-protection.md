---
title: 'Phase 1: Branch Protection (owner action)'
status: owner-action
priority: P1
effort: '15m (owner)'
dependencies: []
---

# Phase 1: Branch Protection (owner action)

## Overview

Enable branch protection on `main` with required CI checks. This is the keystone: dependabot
auto-merge, review-before-PR, and every guardrail rule are habit-only until this lands. It is an
**outward-facing GitHub change requiring repo-admin rights and explicit owner confirmation** — no
automation in this repo applies it, and an agent cannot do it.

## Requirements

- Functional: `main` requires the CI `quality` + `secret-scan` checks to pass and (team flow) 1
  approving review before merge; stale approvals dismissed.
- Non-functional: command is already drafted and verified in `docs/security-and-supply-chain.md`
  (§ Branch protection) — reuse it verbatim; do not re-derive.

## Architecture

GitHub branch-protection API. Required-status-check `contexts` must match CI job names **exactly**
(`quality`, `secret-scan` from `.github/workflows/ci.yml`). CodeQL is optional
(`"Analyze (javascript-typescript)"`).

## Related Code Files

- Reference (no edit): `docs/security-and-supply-chain.md` (command + notes)
- Reference (no edit): `.github/workflows/ci.yml` (job names)

## Implementation Steps

1. Owner runs (fill `{owner}/{repo}`):
   ```sh
   gh api -X PUT repos/{owner}/{repo}/branches/main/protection --input - <<'JSON'
   { "required_status_checks": { "strict": true, "contexts": ["quality", "secret-scan"] },
     "required_pull_request_reviews": { "dismiss_stale_reviews": true, "required_approving_review_count": 1 },
     "enforce_admins": false, "restrictions": null }
   JSON
   ```
2. Solo-repo variant: drop `required_approving_review_count` to `0` (still requires checks, allows self-merge).
3. Verify: `gh api repos/{owner}/{repo}/branches/main/protection` returns 200 (not 404).

## Todo

- [ ] Owner confirms intent (team flow → keep review count 1; solo → 0) — owner action
- [ ] Run the `gh api -X PUT` protection command — owner action
- [ ] Verify protection is active (200, not 404) — owner action
- [ ] Record enabled state in `docs/security-and-supply-chain.md` (flip "currently unprotected" note) — pending Phase 1

## Success Criteria

- [ ] `main` protection returns 200 with required contexts `quality`, `secret-scan`. — owner action
- [ ] Security doc updated to reflect protected state. — pending Phase 1

## Risk Assessment

- **Owner unavailable / lacks admin** (`gh api` → 403): stays a documented owner action; do NOT
  ship Phase 4 auto-merge until this is green (auto-merge would be inert/unsafe). Signal: 403 or 404.
  Response: block Phase 4, keep this phase open, proceed with 2/3/5/7/8/9.
- **Wrong context names**: PRs stuck "waiting for status". Signal: required check never resolves.
  Response: match `contexts` to actual CI job names exactly.
