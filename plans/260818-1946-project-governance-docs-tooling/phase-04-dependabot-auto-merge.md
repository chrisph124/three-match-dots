---
title: 'Phase 4: Dependabot Auto-Merge'
status: done-gated
priority: P2
effort: '2h'
dependencies: [1, 3]
---

# Phase 4: Dependabot Auto-Merge

## Overview

Auto-merge low-risk Dependabot PRs — **`dev-tooling` group, minor/patch only** — once required CI checks are
green. `github-actions` and the Expo/native `expo-native` group are **review-only** (never auto-merged):
`docs/security-and-supply-chain.md` mandates manual re-vetting of SHA-pinned actions before any bump, and
`expo-native` moves via `expo install --fix`. **Hard dependency on Phase 1**: GitHub native auto-merge
requires branch protection with required status checks, or it never actually waits on CI. **Soft dependency
on Phase 3**: `@vitest/coverage-v8` must already be in the `dev-tooling` dependabot group before this goes
live, or coverage tooling can version-skew on `main` unattended.

## Requirements

- Functional: a PR opened by `dependabot[bot]` in the `dev-tooling` group with update-type minor **or** patch
  is approved + set to auto-merge; it merges only after required checks (Phase 1) pass.
- Functional: `github-actions` and `expo-native` PRs are provably excluded (no approval, no auto-merge —
  they wait for a human).
- Non-functional: least-privilege, **job-level** `permissions`; classify via `dependabot/fetch-metadata`.
- Prerequisite (owner, one-time): two repo settings enabled — "Allow auto-merge" AND "Allow GitHub Actions
  to create and approve pull requests" (Settings → Actions → General → Workflow permissions). The second is
  OFF by default and is what lets `gh pr review --approve` succeed; without it the approve step 403s.

## Architecture

`.github/workflows/dependabot-automerge.yml` triggered on `pull_request` (NOT `pull_request_target` — the
workflow never checks out PR code, and since Oct 2021 `permissions:` is honored on dependabot-triggered
`pull_request` runs, so plain `pull_request` is the GitHub-endorsed, lower-risk choice). Guard
`if: github.actor == 'dependabot[bot]'`. `dependabot/fetch-metadata@v2` yields `dependency-group` and
`update-type` (values `version-update:semver-{patch,minor,major}`). Gate (default-deny): proceed only when
`dependency-group == 'dev-tooling'` AND `update-type ∈ {patch, minor}`. Then `gh pr merge --auto --squash`
(+ `gh pr review --approve`). The `gh` steps need `env: GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` — the CLI does
not read the token from the `permissions:` block alone. Auto-merge then waits for required checks (Phase 1)
before completing.

## Related Code Files

- Create: `.github/workflows/dependabot-automerge.yml`
- Reference (no edit): `.github/dependabot.yml` (group names `dev-tooling`, `expo-native`; the `expo-native`
  exclusion is already documented there). `@vitest/coverage-v8` is added to `dev-tooling` in **Phase 3**.
- Reference: Phase 1 (required checks must exist first), Phase 3 (dev-tooling group must include coverage-v8)

## Implementation Steps

1. Author the workflow: trigger `on: pull_request`; `if: github.actor == 'dependabot[bot]'`.
2. **Job-level** `permissions: { contents: write, pull-requests: write }` (minimum for merge+approve; do not
   grant at workflow level).
3. Step `dependabot/fetch-metadata@v2` → `steps.meta.outputs.{dependency-group,update-type}`.
4. Conditional (default-deny): proceed only if `dependency-group == 'dev-tooling'` AND
   `update-type` is `version-update:semver-patch` or `version-update:semver-minor`. Everything else
   (github-actions, expo-native, majors) falls through to no-op → stays open for review.
5. Approve + enable auto-merge, wiring the token explicitly:
   ```yaml
   - env:
       GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
       PR_URL: ${{ github.event.pull_request.html_url }}
     run: |
       gh pr review --approve "$PR_URL"
       gh pr merge --auto --squash "$PR_URL"
   ```
   Pass any `github.event.*` value through an `env:` var (as `PR_URL` above), never inline in `run:` — the
   convention that neutralizes script-injection even though this workflow only reads URLs/enum fields.
6. Owner enables BOTH repo settings (same session as Phase 1): "Allow auto-merge" and "Allow GitHub Actions
   to create and approve pull requests".

## Todo

- [ ] Confirm Phase 1 (branch protection + required checks) is green — BLOCKER — owner action / pending Phase 1
- [x] Confirm Phase 3 added `@vitest/coverage-v8` to the `dev-tooling` dependabot group — soft blocker
- [ ] Owner enables repo "Allow auto-merge" setting — owner action
- [ ] Owner enables "Allow GitHub Actions to create and approve pull requests" (OFF by default; needed for approve) — owner action
- [x] Create `.github/workflows/dependabot-automerge.yml` (job-level least-privilege perms)
- [x] Wire `env: GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` on the merge/approve step; PR URL via env var
- [x] Classify via `dependabot/fetch-metadata`; gate to `dev-tooling` minor/patch only (default-deny)
- [x] Explicitly exclude `github-actions` + `expo-native` (review-only)
- [ ] Verify with a synthetic throwaway PR (below), not just organic Dependabot scheduling — pending Phase 1

## Success Criteria

- [ ] A synthetic dev-tooling minor/patch PR with green CI auto-merges without human action. — pending Phase 1
- [ ] A `github-actions` PR and an `expo-native` PR are never auto-approved/merged. — pending Phase 1 (needs synthetic-PR verification)
- [ ] Auto-merge waits on required checks (proves Phase 1 dependency satisfied). — pending Phase 1

## Verification (synthetic, not organic)

Do not wait days for Dependabot to schedule a real PR. Verify by opening a throwaway branch that bumps a
single `dev-tooling` dev-dependency by a patch version, push, and confirm the workflow approves + auto-merges
once `quality` + `secret-scan` go green. Separately open a no-op branch simulating a `github-actions` /
`expo-native` change and confirm it is NOT touched. Close/delete the throwaways after.

## Risk Assessment

- **R4 — shipped before Phase 1**: auto-merge won't wait on checks; a bad dep could land on `main`.
  Signal: PR merges with checks pending/failed. Response: hard-block this phase on Phase 1 green.
- **Missing approve permission**: `gh pr review --approve` 403s. Signal: workflow log shows 403 on approve.
  Response: owner enables "Allow GitHub Actions to create and approve pull requests" (Step 6) — it's OFF by default.
- **Missing token env**: `gh` can't authenticate despite `permissions:`. Signal: `gh` auth error in logs.
  Response: `env: GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` on the `gh` step (Step 5).
- **Coverage version-skew**: `vitest` auto-merges while `@vitest/coverage-v8` lags → coverage throws on `main`.
  Signal: coverage step fails post-merge on an untouched PR. Response: Phase 3 puts both in one `dev-tooling`
  group so they bump together (this phase's soft dependency on Phase 3).
- **Metadata misclassification**: a native/actions bump slips through. Signal: a github-actions/expo-native PR
  auto-merges. Response: default-deny — only allow `dev-tooling` + {patch,minor} by group-name equality.
- **Over-broad token perms**: Response: scope job-level `permissions:` to contents+pull-requests write only.
