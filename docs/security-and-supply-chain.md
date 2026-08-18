# Security & Supply Chain

The single owning doc for the repo's harness policy: Node lifecycle, the
Expo/native pin set, the `npm audit` advisory-diff gate, the coverage diff-gate,
secret scanning, vendored-agent-harness vetting, branch protection, and the
gated Dependabot auto-merge workflow. Update this doc in the same change whenever
the machine-checkable inputs it references (`.nvmrc`,
`.github/audit-allowlist.json`, `.github/coverage-baseline.json`,
`.github/vendored-pins.json`) change.

## Node lifecycle & toolchain floor

- **CI + dev pin:** [`.nvmrc`](../.nvmrc) = `24` (current Active LTS). Every
  workflow's `actions/setup-node` reads `node-version-file: .nvmrc` — one source
  of truth, so the CI Node and a contributor's `nvm use` can never drift.
  `.github/workflows/codeql.yml` pins no Node (no `setup-node` step); it runs on
  the runner default and needs no change.
- **Supported floor:** [`package.json#engines.node`](../package.json) =
  `^20.19.4 || ^22.13.0 || ^24.3.0 || >= 25.0.0` — copied verbatim from
  `react-native@0.86.2`'s declared `engines` (Expo `57.0.9` declares none, so RN
  is the binding floor). This is the real supported matrix, not a guess; a pinned
  `24` satisfies `^24.3.0`.
- Node 20 reaches end-of-life 2026-04-30; the previous CI pin of `20` is retired.
- **Fallback:** if a toolchain dep breaks on Node 24, drop `.nvmrc` (and CI) to
  the highest Expo-SDK-57-supported LTS (`22`); leave `engines` at the floor
  above. Not a replan.

## The Expo/native pin set — do not "fix" it

Expo SDK 57 owns one mutually-compatible native pin set: **Skia ↔ Reanimated ↔
Gesture Handler ↔ Worklets ↔ React Native ↔ React** (plus `react-native-mmkv`,
`react-native-nitro-modules`, `react-native-screens`,
`react-native-safe-area-context`). Bumping one in isolation breaks the set.

- **Upgrade only via `npx expo install --fix`**, which realigns the whole set to
  the SDK's tested versions.
- **`npm audit fix --force` is forbidden.** Here it resolves to an Expo 53 / RN
  0.72 **downgrade** — a false "fix" that regresses the whole app.
- [`.github/dependabot.yml`](../.github/dependabot.yml) groups these into a
  single **review-only** `expo-native` PR (never auto-merged) and batches
  dev-tooling separately.

## `npm audit` — advisory-diff gate

A raw `npm audit || true` always exits 0, so a genuinely new advisory just hides
among the pre-existing ones. Instead CI runs
[`scripts/check-audit.mjs`](../scripts/check-audit.mjs) (`npm run audit:diff`),
which collects the distinct advisory **source ids** and fails **only when a new
id appears beyond the allowlist** in
[`.github/audit-allowlist.json`](../.github/audit-allowlist.json). Pre-existing
build-time advisories stay informational.

### Allowlist triage (captured 2026-08-16)

`npm audit` reports 24 findings, but they trace to just **4 root advisory
source ids**. Each was followed down its `via` chain to the actually-vulnerable
leaf and classified build-time vs runtime. **All four are build-time / tooling
only — none is reachable in the shipped RN/Skia bundle.**

| Source id | Sev      | Leaf         | Reaches app via                             | Class               | Verdict                                                         |
| --------- | -------- | ------------ | ------------------------------------------- | ------------------- | --------------------------------------------------------------- |
| 1138808   | high     | `image-size` | `metro` bundler (`metro-transform-worker`)  | build-time          | Metro builds the JS bundle on dev/CI; not shipped. Allowlisted. |
| 1138809   | high     | `image-size` | `metro` bundler                             | build-time          | Same as above. Allowlisted.                                     |
| 1119441   | moderate | `uuid`       | `xcode` → `@expo/config-plugins` (prebuild) | build-time          | Native-project generation, not shipped. Allowlisted.            |
| 1139427   | high     | `nanoid`     | orphan leaf (`effects: []`)                 | build-time-adjacent | See "nanoid" below. Allowlisted (deferred).                     |

The high-severity flags on the **direct** packages (`expo`, `react-native`,
`@shopify/react-native-skia`, `react-native-reanimated`, `react-native-worklets`)
are inherited, not intrinsic: every one bottoms out at `metro`→`image-size`
(bundler) or `xcode`→`uuid` (prebuild). "It's just build tooling" was **proven**
from the `via` chains, not assumed from the names.

**Runtime-reachability evidence (all empty against `src/`):**

- `grep -rnE 'FlatList|VirtualizedList|SectionList' src/` → none. The one
  runtime-capable RN leaf (`@react-native/virtualized-lists`) is unreachable — the
  app renders no virtualized lists (Skia canvas only).
- `grep -rnE "from ['\"](image-size|nanoid|uuid)" src/` → none. No direct import
  of any flagged leaf.

**nanoid (1139427):** an orphaned leaf (`effects: []`) with a non-major fix
available. Left in place this pass: the only mechanism to apply it,
`npm audit fix`, also re-resolved a spread of unrelated `@expo/*` transitive
patch versions in the lockfile (some downward), which violates the "no version
bumps in the guardrail phase" rule. Deferred to a dedicated dependency pass; not
runtime-reachable in the meantime.

**Refreshing the allowlist:** when a new id legitimately appears (e.g. after a
sanctioned `expo install --fix`), triage it in this table, then add it to
`.github/audit-allowlist.json`. Prune ids the gate reports as no longer present.

## Coverage — diff-gate

Coverage has the same failure mode as `npm audit`: a single repo-wide % is
either misleading (native RN/Skia/worklet layers Vitest can't reach drag it
down) or an arbitrary floor picked before a baseline exists. So it uses the same
shape as the audit gate — a committed baseline is the source of truth, and CI
fails only on a **drop below it**.

[`scripts/check-coverage.mjs`](../scripts/check-coverage.mjs)
(`npm run coverage:diff`) reads Vitest's `coverage/coverage-summary.json` (v8
provider, `json-summary` reporter, scoped to the RN-free testable surface in
[`vitest.config.ts`](../vitest.config.ts)) and compares it to
[`.github/coverage-baseline.json`](../.github/coverage-baseline.json) at two
levels:

- **total** — statements / branches / functions / lines over the whole surface, and
- **per-file** — every file present in BOTH the baseline and the current run.

Per-file is what stops the gameable case: a PR that adds a big well-tested file
while an existing file silently regresses keeps `total` flat, so a total-only
gate would pass. A metric may slip at most `epsilon` (0.5 pp) before the gate
fails. New files (in current, not baseline) are reported to fold into the next
baseline, never failed; files no longer measured are reported as prunable.

**The baseline IS the floor, and it auto-ratchets.** On an overall rise the gate
prints a "safe to ratchet" hint — refresh `.github/coverage-baseline.json` (run
`npm run coverage`, then regenerate) in the same PR that raised coverage, to
lock the gain. Lower the baseline only when a drop is intentional and justified
(code deleted, not tests removed). CI runs `npm run coverage` then
`npm run coverage:diff` in the `quality` job; the report is informational, the
diff is the fail condition.

## Secret scanning (gitleaks)

Detects Sentry/PostHog keys and other credentials; reinforces the CLAUDE.md
key-hygiene rule. **This is detection + conditional enforcement, not a
guarantee** — the pre-commit hook is local and `--no-verify`-bypassable, so keys
_can_ still be forced into a commit. Real enforcement is the CI job as a
**required status check** (see branch protection).

- **CI:** `gitleaks/gitleaks-action@v2` (job `secret-scan` in
  [`ci.yml`](../.github/workflows/ci.yml)), full-history scan. Free for public
  repos.
- **Local:** [`.husky/pre-commit`](../.husky/pre-commit) runs
  `gitleaks protect --staged` **only if the binary is present** — a fresh clone
  without gitleaks warns and skips rather than blocking every commit (gitleaks is
  a Go binary, not an npm dep). Install: `brew install gitleaks`.
- **Config:** [`.gitleaks.toml`](../.gitleaks.toml) extends the default ruleset
  and allowlists `package-lock.json`. Scope future false positives here (path or
  rule) — never disable the hook wholesale.

## Vendored agent-harness vetting

Auto-loading third-party skill plugins live under `.tessl/plugins/` and are
surfaced to every agent session through symlinks in `.github/skills/`,
`.claude/skills/`, `.agents/skills/`, and `.codex/skills/`. Because they load
automatically, a pin change is a supply-chain event.

Discovered empirically — `git ls-files | grep -E '(tessl-package|tile)\.json$'`
plus the symlink surfaces above (a hand-typed list misses `.github/skills/`,
which feeds GitHub's own coding-agent harness).

| Plugin                     | Vetted SHA                                 | Provides             | Autoload side effects                                                                     |
| -------------------------- | ------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------- |
| `softaworks/agent-toolkit` | `3027f20f3181758385a1bb8c022d4041dfb4de84` | `react-dev` skill    | None — skill markdown only. No network / `exec` / `process.env` in any non-markdown file. |
| `vercel-labs/json-render`  | `9d3dfc8917c1c6aa5568acbe0969523f3307376c` | `react-native` skill | None — same.                                                                              |

Both manifests (`tessl-package.json`, `tile.json`) carry the SHA as `version`;
both are SHA-pinned. **Verdict: clean, pinned, no autoload side effects.**

**Not one-time:** [`scripts/check-vendored-pins.mjs`](../scripts/check-vendored-pins.mjs)
(`npm run vendored:check`, wired into CI) fails if any manifest's `version`
drifts from the vetted SHA in
[`.github/vendored-pins.json`](../.github/vendored-pins.json). Re-vet (SHA-pinned?
autoload side effects?) and update this table before bumping a pin.

## Branch protection — owner action

`main` is currently **unprotected** (`gh api repos/{owner}/{repo}/branches/main/protection`
→ `404 Branch not protected`). Enabling it is an outward-facing GitHub change
that needs repo-admin rights and **explicit owner confirmation** — it is not
applied by any automation in this repo.

Recommended command for this repo (solo flow — require the CI checks and dismiss
stale approvals, but allow the owner to self-merge with no second approver):

```sh
gh api -X PUT repos/{owner}/{repo}/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["quality", "secret-scan"] },
  "required_pull_request_reviews": { "dismiss_stale_reviews": true, "required_approving_review_count": 0 },
  "enforce_admins": false,
  "restrictions": null
}
JSON
```

Notes:

- `contexts` must match the CI job names exactly (`quality`, `secret-scan`); add
  `"Analyze (javascript-typescript)"` to also require CodeQL.
- `required_approving_review_count: 0` is the **solo-repo** setting (the decided
  flow): the CI checks must pass, but the owner can self-merge. Raise it to `1`
  once a second reviewer joins, to block self-merge.
- Enabling required status checks here is the precondition that makes the
  Dependabot auto-merge workflow
  ([`.github/workflows/dependabot-automerge.yml`](../.github/workflows/dependabot-automerge.yml))
  safe to activate — see its gating note; until then that workflow must not merge to `main`.
- If `gh api -X PUT` returns `403`, the account lacks admin; this stays a
  documented owner action.

## Dependabot auto-merge — gated on branch protection

[`.github/workflows/dependabot-automerge.yml`](../.github/workflows/dependabot-automerge.yml)
auto-approves and enables GitHub native auto-merge for **low-risk Dependabot PRs
only — the `dev-tooling` group at minor/patch**. It is **authored but inert**:
it changes nothing on `main` until the repo owner completes the setup below.

- **Default-deny scope.** The workflow proceeds only when
  `dependabot/fetch-metadata` reports `dependency-group == 'dev-tooling'` AND an
  update-type of `semver-minor` or `semver-patch`. The Expo/native `expo-native`
  group, the entire `github-actions` ecosystem, any **major** bump, and any
  ungrouped npm PR (empty group) all fall through untouched and wait for a human
  — consistent with the pin-set and action-vetting rules above.
- **Why it is safe only after branch protection.** `gh pr merge --auto` waits on
  the repo's **required** status checks. With no protection there are no required
  checks, so `--auto` has nothing to gate on and a bad dependency could land on
  `main` unreviewed. Do not rely on this workflow until `main` requires `quality`
  - `secret-scan` (see § Branch protection above).
- **Two owner-only repo settings** (Settings → Actions → General → Workflow
  permissions), or the approve step returns `403`: **"Allow auto-merge"** and
  **"Allow GitHub Actions to create and approve pull requests"** (the latter is
  OFF by default). Enable them in the same session as branch protection.
- **Least privilege.** No workflow-level permissions; the job grants only
  `contents: write` + `pull-requests: write`. The PR URL is passed via an `env:`
  var, never inlined into `run:` (script-injection guard).
- **Coverage coupling.** `@vitest/coverage-v8` is grouped with `vitest` in
  `dev-tooling` (see [`dependabot.yml`](../.github/dependabot.yml)) so they bump
  in one PR — auto-merge can never version-skew them on `main`.
- `dependabot/fetch-metadata` is SHA-pinned to its `v2` head
  (`21025c705c08248db411dc16f3619e6b5f9ea21a`); Dependabot's `github-actions`
  ecosystem proposes future bumps as review-only PRs — re-vet per the vetting
  rules above before merging one.
- **Verify synthetically, not organically:** open a throwaway branch that bumps a
  single `dev-tooling` dev-dependency by a patch, confirm it auto-merges once
  `quality` + `secret-scan` are green, then confirm a `github-actions` /
  `expo-native` PR is left untouched. Delete the throwaways after.
