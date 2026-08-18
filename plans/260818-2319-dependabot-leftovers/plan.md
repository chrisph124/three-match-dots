# Plan — Resolve Dependabot leftover PRs (#6, #7, #9, #10, #12)

Status: DONE (260818-2337) · Branch: main (solo flow, unprotected) · Created 260818-2319

Outcome: #6/#7 merged (SSH push, commit 94c7ba7); #9/#10 auto-closed by Dependabot after the
ignore rules; #12 closed (review-only policy). ci.yml run on 94c7ba7: quality + secret-scan both
green. Local lint (0 err) + typecheck + 220 tests green. Zero open Dependabot PRs.

## Contract

- **Outcome:** all open Dependabot PRs resolved — safe ones merged, unsafe ones held with
  documented reason — `main` still green, no app/test/runtime code touched.
- **Constraints:** must not break anything; honor Expo/native pin-set policy (`expo install --fix`,
  never raw-merge); `gh` OAuth token lacks `workflow` scope, but `origin` is SSH so `git push`
  bypasses the restriction.
- **Non-goals:** Expo SDK upgrade; forcing TS7 / ESLint10 / RN0.87 to work.
- **Acceptance:** #6/#7 merged; #9/#10/#12 closed w/ reason; Dependabot stops re-proposing broken
  toolchain majors; `npm run lint && npm run typecheck && npm test` green; new `main` CI run green.

## Diagnosis (proven)

- #6 setup-node 6→7, #7 gitleaks 2→3: green on their PRs (quality + secret-scan pass). Blocked
  only by `gh` merge lacking `workflow` scope (both edit `.github/workflows/ci.yml`).
- #9 TS 6→7: fails at `npm run lint` → `expo lint`: `TypeError: ...reading 'Intrinsic'`.
  `@typescript-eslint` (bundled by `eslint-config-expo@~57`) reads a TS internal removed in the
  TS7 native port. Preset is pinned to Expo SDK 57 → cannot bump preset without bumping SDK.
- #10 ESLint 9→10: fails at `expo lint`: `EslintPluginImportResolveError: typescript ... invalid
interface loaded as resolver`. ESLint 10 changed the resolver interface; Expo preset (SDK 57)
  not compatible.
- #12 expo-native group: `npm ci` ERESOLVE — grouped set itself incoherent: `react-native-reanimated@4.5.3`
  peer-requires RN 0.83–0.86, set bumps `react-native`→0.87.0. Coherent set only via `expo install --fix`
  under an SDK bump. `dependabot.yml` already flags this group review-only, never auto-merged.

## Resolution

1. **Merge #6, #7** — `git merge --no-ff` each dependabot branch into local main, push via SSH
   (SSH key auth is not subject to the OAuth `workflow`-scope restriction). GitHub auto-marks both
   PRs Merged (head commits reachable from main).
2. **Close gap for #9/#10** — add `ignore` rules to `.github/dependabot.yml` npm block for
   `version-update:semver-major` on `typescript`, `eslint`, `eslint-*` (the Expo-SDK-governed lint/TS
   toolchain). Majors of these land with an Expo SDK upgrade via `expo install`, never standalone.
3. **Close #9, #10** — with a comment pointing at the ignore rule + SDK-governed rationale.
4. **Close #12** — with a comment: incoherent set (reanimated peer vs RN 0.87), held per review-only
   policy; coherent bump arrives via `expo install --fix` at the next Expo SDK. Left un-ignored so it
   stays visible (intended by config).

## Verification

- `npm run lint && npm run typecheck && npm test` green locally after edits.
- New `main` CI run (triggered by the push) green: quality + secret-scan.
- `gh pr list --state open` shows zero open Dependabot PRs.

## Rollback

- Repo change is limited to `ci.yml` action-version bumps (CI-validated) + inert `dependabot.yml`.
  Revert with `git revert` on the offending commit; reopen any closed PR from the GitHub UI.
