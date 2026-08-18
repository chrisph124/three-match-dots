---
title: 'RN Three Dots retarget: harness, docs, Journey slice'
date: 2026-08-16
summary: '3-phase retarget shipped on one branch (PR #5, draft); closed two instances of a timer-vs-unlock race in Journey'
---

# RN Three Dots retarget: harness, docs, Journey slice

## What happened

Executed the accepted 3-phase plan `plans/260816-1418-rn-three-dots-retarget/`
under `--advice` (kongming) supervision, on one branch `feat/rn-three-dots-retarget`
→ draft PR #5.

- **Phase 1 (harness):** CI onto a supported Node floor (`engines` + `.nvmrc`);
  Dependabot split by ecosystem; presence-gated gitleaks pre-commit hook
  (warn-and-skip when the binary is absent, CI enforces); advisory-diff `npm audit`
  gate against a recorded allowlist (replacing the old always-green gate);
  vendored-harness pin-drift check. No dependency version bumps (Phase-1 rule).
- **Phase 2 (docs↔code):** design docs retargeted from the archived Swift/4-way
  direction to the shipped engine — adjacency corrected to **8-way**, level-script
  schema + fail-fast bounds documented, Three Dots creative bible/tool-catalog/
  roadmap/Apple-compliance ported. Colour+shape accessibility flagged **not-yet-met**
  (renderer draws plain circles) rather than asserting behaviour the code lacks.
- **Phase 3 (Journey slice):** a timed **Japan Journey** mode folded over the
  existing colour-match core **without touching it** — zod-validated level script,
  an independent hook (`src/meta/use-journey-state.ts`) owning a timestamp-delta
  countdown (paused on background via `AppState`), a mistake-time penalty, and
  `clearColor`/`freeCaged` objective tracking; a caged-dot obstacle as a
  Journey-layer overlay that survives gravity + deadlock reshuffles by remapping
  cell indices (identity-default for cells that don't move). Palette extended
  **append-only** (Endless indices 0–2 byte-for-byte unchanged). TDD throughout.

## Decision

- **Endless is untouched.** `src/core/resolve/**`, `hot/**`, `game.ts`, `config.ts`,
  `src/app/game.tsx`, `src/meta/score-storage.ts` are all diff-clean; Journey writes
  **no** MMKV (no shared `'score'` key). Verified by grep + git-status.
- **Race class — the session's real bug.** `playMove`/`playClear` route `onDone`
  through `runOnJS`, so animation-completion callbacks interleave as macrotasks with
  the countdown `setInterval`. Any unlock callback firing after the ~FALL_MS/~SHUFFLE_MS
  window MUST re-check `latest.current.status === 'playing'` before unlocking, else it
  stomps the lock the terminal-status effect already set. kongming's first review found
  the FALL_MS→settle instance (fixed: parameterless `settle` re-reads `latest.current`;
  `commit` null-branch gates unlock on `penalized.status`). kongming's **final** review
  found a **second** instance one call site over — `settle`'s `moves>0` reshuffle branch
  unlocked unconditionally after SHUFFLE_MS. Inherited verbatim from Endless's
  `use-game-state.ts`, where it's correct (Endless has no terminal state). Fixed in
  `24d00dd` with the same status guard. This was treated as a real blocker (new evidence
  = distinct call site), not an abstract audit concern.
- **Single branch + one PR, draft-gated.** `main` has **no** branch protection
  (`gh api …/protection` → 404, live-confirmed), so a `> [!CAUTION]` DO-NOT-MERGE banner
  - draft status are the only merge guards until the owner sets protection (an owner
    action, deliberately not auto-run).

## Verified

`npm test` 209/209 (22 files) · `npm run typecheck` clean (strict, no-any) ·
`npm run lint` 0 errors (2 pre-existing warnings) · all 4 CI checks green on `24d00dd`
(quality, secret-scan, Analyze/CodeQL). kongming's Conditional-GO assessment posted as
a PR comment.

## Next steps (human gates — cannot run here)

1. **On-device QA** (Skia/Reanimated/gesture/AppState are outside the Vitest boundary).
   Highest risk first: AppState background/foreground pause (first `AppState` use in the
   repo; iOS App Switcher swipe-hold fires `'inactive'` not `'background'`), then
   caged-dot remap under real fall/reshuffle timing, then kill-and-relaunch.
2. **Branch protection PUT on `main`** (owner GitHub-settings action).
3. Once both clean: drop the draft state + DO-NOT-MERGE banner, then merge.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
