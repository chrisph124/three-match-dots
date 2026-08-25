# Launch SIGABRT from the Dependabot worklets bump — pinned back below the Xcode floor

**Date:** 2026-08-25
**Branch:** feat/endless-ui-reskin
**Request:** `/ak-fix` — "simulator crashed by something in our code, rebuild + reopen
iOS sim, check for remaining issues in code or logs."

## Symptom

App crashed at launch on the iOS simulator. Native crash report (`.ips`,
`~/Library/Logs/DiagnosticReports/threematchdots-*.ips`), not a JS redbox.
Backtrace: `__assert_rtn` → SIGABRT at `-[WorkletsModule start]` →
`worklets::WorkletRuntime::legacyModeInit` / `UnpackerLoader::installUnpacker`.

## Root cause (proven)

Dependabot PR #16 (`e1b4e38`, 2026-08-24) auto-bumped the **expo-native group**
(7 pkgs) above the Expo SDK 57 pins. The load-bearing one:
`react-native-worklets` `0.10.1 → 0.11.4`. The Reanimated/worklets babel plugin
injects a version-stamped "unpacker" into the JS bundle; native
`installUnpacker` reads it via `jsi::Value::getObject` and **asserts on a version
mismatch**. Bundle (built against 0.11.4 tooling) vs native module pin drift →
assert → SIGABRT before first frame. SDK 57 pins worklets at 0.10.1.

## Fix

Revert PR #16's **entire** expo-native group to the SDK-57 pins (partial revert
would mismatch the dependency graph): skia, react, gesture-handler, reanimated,
safe-area-context, screens, worklets — in `package.json` + `package-lock.json`,
reinstalled with `npm ci`. rive-react-native re-added (a naive bulk checkout of
the pre-PR commit would have dropped it).

## The trap that cost the most time: the Xcode floor

`expo install --fix` "correctly" reverted worklets to 0.10.1 **but also** bumped
expo `57.0.14 → 57.0.16`, which pulls `expo-modules-jsi 57.0.5`. That version's
`SWIFT_RETURNS_RETAINED` interop only compiles on **Xcode 26.4.1 / Swift 6.3**
(expo/expo#47957). This machine is **Xcode 26.2 / Swift 6.2.3** → build failed
(xcodebuild 65) on `RuntimeScheduler.h`. That was the 3rd distinct build failure
→ hit the ak-fix "3+ attempts" gate → escalated to kongming + user.

Resolution (user chose "surgical revert now"): hold expo at **57.0.14**
(→ jsi 57.0.4 + the existing `abs()`→`Swift.abs()` shadow patch, which builds on
26.2). So the pin set is deliberately **below the SDK head**; `expo install
--check` reporting "update to 57.0.16" is expected drift, NOT to be resolved
until Xcode is updated.

kongming caught two procedure bugs pre-flight: (a) the npm tilde trap — must
restore lockfile too and use `npm ci`, not `npm install`; (b) the rive drop.

## Verification

Build Succeeded (0 err) · app launched, survived worklets init · no new `.ips`
across 3 relaunches · Metro bundled clean · DoD gates green (typecheck, lint,
402/402 tests, coverage:diff, audit:diff, vendored:check) · code-reviewer PASS.

## Prevention

- Two memory landmines written (Xcode floor / do-not-`expo install --fix`; the
  Dependabot group needs an ignore rule).
- Docs: `docs/security-and-supply-chain.md` § Expo/native pin set now records the
  Xcode floor + intentional pin-down + the PR #16 incident.

## Unresolved / follow-ups

- Install **Xcode 26.4.1**, then re-align to 57.0.16 and delete the abs patch.
- Add an `ignore` rule for the `expo-native` group in `.github/dependabot.yml`
  — PR #16 merged despite the "never auto-merged" doc, so the guard is
  documentation-only today and will re-open the same bump on schedule.
- On-device "feel" pass (touch, chains, sweeps, mmkv score persistence) — human;
  Metro left running on :8081.
