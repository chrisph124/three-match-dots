---
phase: 1
title: 'Version & Guardrail Audit'
status: done # todo | in-progress | done
priority: P1
effort: '0.5d'
dependencies: []
---

# Phase 1: Version & Guardrail Audit

## Overview

Harden the harness before touching any product code: fix the one real
supply-chain/lifecycle gap (CI Node 20 is EOL 2026-04-30), lock the toolchain
floor, tighten Dependabot/secret-scanning, add an advisory-diff audit gate,
and vet the vendored AI-agent harness. Cheap, first, and zero product risk — a
clean, trustworthy pipeline underwrites Phases 2–3.

## Requirements

- Functional:
  - Every GitHub Actions workflow builds on a supported, non-EOL Node (target
    **24**, current Active LTS).
  - Repo declares its Node floor (`engines`) and a pinned dev/CI version
    (`.nvmrc`) so contributor and CI environments match.
  - Dependabot separates **native/Expo** packages (which must move together and
    are never auto-merged) from **dev-tooling** (batched, low-risk).
  - Secret scanning (gitleaks) provides pre-commit and CI **detection** of
    Sentry/PostHog keys (reinforces the existing CLAUDE.md key-hygiene rule).
    Enforcement as a _merge-blocking_ gate is contingent on branch protection
    (step 7) — pre-commit is `--no-verify`-bypassable and a CI failure only
    blocks a merge when configured as a required status check. Do not claim keys
    "can never land in git"; claim detection + (conditional) enforcement.
  - `npm audit` runs in CI as an **advisory-diff gate** (pre-existing highs stay
    informational; advisory IDs growing past the allowlist flag/fail), with a
    documented **per-advisory** build-time-vs-runtime triage — the "build-tool
    only" verdict is _proven_ from each advisory's `via` chain, not assumed from
    the package name.
  - Vendored third-party agent/skill/plugin code is enumerated, confirmed
    SHA-pinned, and reviewed for autoload side effects.
  - `main` branch protection state is verified and (owner-confirmed) enabled.
- Non-functional:
  - No dependency version bumps in this phase. Expo-managed deps move only via
    `npx expo install --fix`. **`npm audit fix --force` is forbidden** (it
    resolves to an Expo 53 / RN 0.72 downgrade — a false "fix").
  - All changes are config/CI/docs only; the app and `src/core/` are untouched.

## Architecture

Harness-only changes across four surfaces:

1. **Toolchain floor** — `package.json#engines` + `.nvmrc`.
2. **CI** — `.github/workflows/*.yml` Node bump + new gitleaks job + advisory-diff
   `npm audit` step.
3. **Dependency automation** — `.github/dependabot.yml` group split.
4. **Local hooks** — `.husky/pre-commit` gains a gitleaks scan.

Rationale to record in-repo (so future maintainers don't "fix" the pins):

- Expo SDK 57 owns the mutually-compatible native pin set (Skia ↔ Reanimated ↔
  Gesture Handler ↔ Worklets ↔ RN ↔ React). Bumping one in isolation breaks the
  set; that is why native deps are review-only and upgrades go through
  `expo install --fix`.
- The audit highs are attached to **direct** packages (`npm audit` flags `expo`,
  `react-native`, `react-native-reanimated`, `react-native-worklets`,
  `@shopify/react-native-skia` as `isDirect: true` high) — so "they're just build
  tooling" is **not** self-evident from the package name and must be proven, not
  asserted. Capture a fresh `npm audit --json` at execution and, for each
  advisory, follow the `via` chain to the actually-vulnerable code and classify
  it: **build-time** (Metro / `@expo/cli` / community-cli-plugin asset pipeline —
  not shipped) vs **runtime** (bundled into the RN/Skia app on the device).
  Explicitly name any runtime-capable leaf (e.g. verify
  `@react-native/virtualized-lists` is unreachable — `grep -rn
'FlatList\|VirtualizedList\|SectionList' src/` should be empty) and clear it by
  evidence. The stale `image-size`/`nanoid`/`uuid` example list is illustrative
  only — do not let it stand as the final verdict.

## Related Code Files

- Modify: `.github/workflows/ci.yml` (point `actions/setup-node` at
  `node-version-file: .nvmrc` — single source of truth, not a literal `24`; add
  gitleaks job; add informational advisory-diff `npm audit` step)
- Modify: `.github/workflows/codeql.yml` (confirm/raise runner Node if pinned)
- Modify: `.github/dependabot.yml` (split native/Expo vs dev-tooling groups)
- Modify: `package.json` (add `engines.node`)
- Modify: `.husky/pre-commit` (prepend gitleaks scan)
- Create: `.nvmrc` (pin `24`)
- Create: `.gitleaks.toml` (allowlist config, if defaults need scoping)
- Create: `docs/security-and-supply-chain.md` (audit policy + native-pin
  rationale + vendored-harness vetting record; the single owning doc)

## Implementation Steps

1. **Node lifecycle fix — single source of truth.** Create `.nvmrc` = `24`, then
   point every workflow's `actions/setup-node` at `node-version-file: .nvmrc` (do
   **not** hand-write a literal `node-version: 24` — two strings drift, the exact
   failure class this phase exists to kill). Verify 24 against the current Expo
   SDK 57 supported Node matrix. Covers `ci.yml` and any other workflow pinning
   Node.
2. **Toolchain floor.** Add `package.json#engines.node` set to the
   Expo-SDK-57 supported floor (confirm the exact floor from Expo docs at
   execution; do not guess a patch version). Keep `engines.node` and `.nvmrc`
   consistent.
3. **Dependabot split.** Rewrite `.github/dependabot.yml`: one group for the
   Expo/native pin set (`expo`, `react-native`, `react`, `react-dom`,
   `@shopify/react-native-skia`, `react-native-reanimated`,
   `react-native-gesture-handler`, `react-native-worklets`,
   `react-native-nitro-modules`, `react-native-mmkv`) — review-only, no
   auto-merge, with a comment pointing to `expo install --fix`; a second batched
   group for dev-tooling (`eslint*`, `prettier`, `typescript`, `vitest`,
   `husky`, `lint-staged`, `eslint-plugin-sonarjs`), weekly.
4. **Secret scanning.** Add a gitleaks CI job (`gitleaks/gitleaks-action`) — the
   real enforcement backstop. In `.husky/pre-commit` (before/alongside
   lint-staged), gate the local scan behind a presence check: `command -v
gitleaks >/dev/null 2>&1 && gitleaks protect --staged … || echo 'gitleaks not
installed — skipping local scan (CI enforces)'`. **Do not hard-fail the commit
   when the binary is absent** — `gitleaks` is a Go binary, not an npm dep
   resolvable via `npx`, so an unconditional call blocks every commit for any
   contributor who hasn't installed it (confirmed absent on a clean machine).
   Document the one-line install (`brew install gitleaks`) in
   `docs/security-and-supply-chain.md`. Add `.gitleaks.toml` only if the default
   ruleset needs scoping.
5. **Advisory-diff audit gate.** A raw `npm audit … || true` that always exits 0
   is a log nobody reads — a new advisory just becomes finding #25 among the ~24
   pre-existing and still passes. Instead: record the current set of advisory
   **IDs** as an allowlist in `docs/security-and-supply-chain.md`, and add a CI
   step that fails (or opens an issue) only when the set of advisory IDs grows
   **beyond** that allowlist — not on raw count/severity. Pre-existing highs stay
   informational; genuinely new ones surface. Also apply/record safe fixes: plain
   `npm audit fix` (never `--force`) for orphaned-leaf advisories with
   `fixAvailable: true` and `effects: []` (e.g. `nanoid`) — apply it if
   zero-blast-radius, or document explicitly why it was left.
6. **Vendored-harness vetting.** Discover surfaces **empirically**, not from a
   hand-typed list (which is already stale — `.agentkit/` is not tracked on
   `main`; it lives only on `archive/swift-pivot-260816`): run `git ls-files |
grep -E '(^|/)(skills|plugins)/'` plus `.tessl/`, `.agents/`, `.codex/`,
   `.claude/`, and the git-tracked **`.github/skills/`** symlinks that feed
   GitHub's own coding-agent harness (missed by any fixed list). For each: confirm
   it is SHA-pinned, and review for autoload side effects (network calls,
   secret/env access, shell exec on load). Record verdicts + the vetted
   SHA/version of each `tessl-package.json`/`tile.json` in
   `docs/security-and-supply-chain.md`. **Not one-time:** add a lightweight CI (or
   Dependabot-style) check that flags when any vetted pin drifts from the recorded
   value, since these skills auto-load into every agent session. Read-only; change
   nothing that works.
7. **Branch protection.** `main` is currently **unprotected** (verified: `gh api
.../branches/main/protection` → 404). Present the exact enabling command
   (require the CI checks + 1 approving review, dismiss stale approvals) and have
   the repo owner confirm before applying — it is an outward-facing GitHub change
   needing admin rights. **Hard stop for the execution agent: do NOT auto-run the
   `PUT` even if `gh` credentials are available in the environment — this needs an
   explicit human confirmation, not just a checked success box.**
8. Run `npm run lint && npm run typecheck && npm test` to prove the harness edits
   broke nothing; push a branch and confirm the new CI (Node 24 + gitleaks +
   audit) goes green.

## Success Criteria

- [x] No workflow builds on Node 20; CI green on Node 24. — `ci.yml` reads
      `node-version-file: .nvmrc` (=24); `codeql.yml` pins no Node. Local
      lint+typecheck+test green; CI-runner green pending first push.
- [x] `.nvmrc` and `package.json#engines.node` present and consistent with the
      Expo SDK 57 supported matrix. — `.nvmrc`=24; `engines.node` copied verbatim
      from RN 0.86.2's declared range; 24 satisfies `^24.3.0`.
- [x] Dependabot config has distinct native/Expo (review-only) and dev-tooling
      (batched) groups. — `expo-native` (all update-types, review-only) +
      `dev-tooling` (minor/patch batched).
- [~] gitleaks runs both pre-commit and in CI; a planted dummy secret is caught
  locally. — pre-commit (presence-gated) + CI `secret-scan` job both wired.
  Local-catch demo requires `brew install gitleaks` (absent on this machine;
  hook correctly warns-and-skips, CI is the backstop). Owner/on-device step.
- [x] CI runs an advisory-**diff** `npm audit` step: pre-existing highs stay
      informational, but the set of advisory IDs growing past the recorded
      allowlist fails/flags. Allowlist + per-advisory build-time-vs-runtime
      verdict recorded in `docs/security-and-supply-chain.md`. — `audit:diff`
      gate verified passing (4 allowlisted) and failing on a dropped id.
- [x] `docs/security-and-supply-chain.md` records the native-pin rationale, the
      `npm audit fix --force` prohibition (and any safe non-force fix applied),
      the vendored-harness vetting verdicts + vetted pins, and the pin-drift
      check. — nanoid safe-fix left-deferred with reason; `vendored:check` gate
      verified passing (2 plugins at vetted SHA).
- [~] Branch-protection decision is documented and (owner-confirmed) applied. —
  documented + exact `gh api -X PUT` command surfaced as an owner action;
  NOT auto-run (hard stop — needs explicit human confirmation + admin).

## Risk Assessment

- **Node 24 unsupported by a toolchain dep.** Signal: `npm ci` or a CI step fails
  on Node 24. Response: fall back to the highest Expo-SDK-57-supported LTS (22)
  for CI and `.nvmrc`; keep `engines` at the documented floor. Not a replan.
- **gitleaks binary absent on a contributor machine.** Signal: a fresh clone's
  first `git commit` fails at the pre-commit hook. Response: the hook must
  presence-check (`command -v gitleaks`) and warn-and-skip when absent (step 4);
  CI is the enforcement backstop. Never leave an unconditional `gitleaks` call in
  the hook.
- **gitleaks false positives block commits.** Signal: pre-commit rejects a
  legitimate change. Response: scope with `.gitleaks.toml` allowlist entries
  (path/rule), never disable the hook wholesale.
- **Owner lacks admin to set branch protection.** Signal: `gh api -X PUT` returns 403. Response: leave it as a documented owner action in
  `docs/security-and-supply-chain.md`; do not block the phase.
- **`expo install --fix` surfaces a native realignment.** Signal: it proposes
  version changes. Response: out of scope here — record it as a follow-up; this
  phase does not change dependency versions.
