# Security & Supply Chain

The single owning doc for the repo's harness policy: Node lifecycle, the
Expo/native pin set, the `npm audit` advisory-diff gate, secret scanning,
vendored-agent-harness vetting, and branch protection. Update this doc in the
same change whenever the machine-checkable inputs it references
(`.nvmrc`, `.github/audit-allowlist.json`, `.github/vendored-pins.json`) change.

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

Recommended command (require the CI checks + 1 approving review, dismiss stale
approvals):

```sh
gh api -X PUT repos/{owner}/{repo}/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["quality", "secret-scan"] },
  "required_pull_request_reviews": { "dismiss_stale_reviews": true, "required_approving_review_count": 1 },
  "enforce_admins": false,
  "restrictions": null
}
JSON
```

Notes:

- `contexts` must match the CI job names exactly (`quality`, `secret-scan`); add
  `"Analyze (javascript-typescript)"` to also require CodeQL.
- `required_approving_review_count: 1` blocks self-merge without a second
  approver — intended for the team flow; drop it to `0` for a solo repo that
  still wants required checks.
- If `gh api -X PUT` returns `403`, the account lacks admin; this stays a
  documented owner action.
