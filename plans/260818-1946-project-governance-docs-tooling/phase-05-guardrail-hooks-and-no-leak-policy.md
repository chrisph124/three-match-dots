---
title: 'Phase 5: Guardrail Hooks & No-Leak Policy'
status: done
priority: P2
effort: '3-4h'
dependencies: []
---

# Phase 5: Guardrail Hooks & No-Leak Policy

## Overview

Add project-local `.claude/settings.local.json` with advisory reminder hooks that nudge a Claude session
to run secret-scan / red-team / the pre-PR checklist before `git push` / `gh pr create`, plus the
no-leak policy text. **Everything here is labeled "reminder, not enforcement"** — real enforcement is the
existing gitleaks (CI required check + pre-commit) and `audit:diff`. Never call these "guardrails/guarantees".

## Requirements

- Functional: `.claude/settings.local.json` exists with a PreToolUse (or UserPromptSubmit) hook that fires
  on push/PR-shaped Bash commands (`git push`, `gh pr create`) and prints the pre-PR checklist reminder.
- Functional: the hook is additive to the existing `enabledPlugins` in `.claude/settings.json` (local
  overrides/merges; do not clobber the plugin enablement).
- Functional: no-leak policy documented in CLAUDE.md (Code Standards), pointing at gitleaks (local+CI) +
  `.gitleaks.toml` + `audit:diff` as the real mechanisms.
- Non-functional: hook must be safe (never blocks, never mutates), fast, and clearly self-labeled advisory.

## Architecture

Claude Code hooks in `settings.local.json` shape only Claude sessions and are bypassable — strictly weaker
than a git hook. Matcher targets Bash tool calls whose command matches push/PR patterns; action prints a
reminder to run: code review → lint → coverage → test → red-team/secret-scan. This is a nudge layer atop
the enforcement stack (Husky + CI). Reuse the honest wording already in
`docs/security-and-supply-chain.md` § Secret scanning ("detection + conditional enforcement, not a guarantee").

## Related Code Files

- Create: `.claude/settings.local.json` (hooks; three.js allowance note lands here too in Phase 9)
- Modify: `CLAUDE.md` (Code Standards — no-leak policy; coordinate with Phase 6)
- Reference (no edit): `.gitleaks.toml`, `.husky/pre-commit`, `docs/security-and-supply-chain.md`
- Optional create: `.claude/hooks/pre-pr-reminder.sh` if the hook needs a script body (keep inline if possible)

## Implementation Steps

1. Verify the exact hook schema the harness supports (event names, matcher shape) before authoring —
   confirm against the installed Claude Code version; do not guess field names.
2. Author `settings.local.json`: hook on push/PR Bash commands → echo the pre-PR checklist + "reminder,
   not enforcement". Keep `enabledPlugins` intact (merge, don't replace).
3. Add the no-leak policy to CLAUDE.md Code Standards: never commit keys/API/critical info; the real gates
   are gitleaks (pre-commit + CI required check) and `audit:diff`; scope false positives in `.gitleaks.toml`,
   never disable the hook.
4. Sanity-check the hook fires and never blocks (dry run a fake `git push` in a scratch context).

## Todo

- [x] Confirm supported hook event/matcher schema for the installed Claude Code
- [x] Create `.claude/settings.local.json` with the advisory pre-PR reminder hook (preserve enabledPlugins)
- [x] Label the reminder "not enforcement" in its output text
- [x] Add no-leak policy to CLAUDE.md Code Standards (real mechanisms named)
- [x] Verify hook fires on push/PR and never blocks/mutates

## Success Criteria

- [x] `.claude/settings.local.json` present; `enabledPlugins` preserved; hook fires on push/PR intent.
- [x] Reminder text explicitly says "reminder, not enforcement".
- [x] CLAUDE.md no-leak policy points at gitleaks + audit:diff as the enforcing mechanisms.

## Risk Assessment

- **R3 — false confidence**: wording that implies these hooks _prevent_ leaks manufactures false security.
  Signal: any "guardrail/guarantee/blocks" phrasing in hook or docs. Response: label advisory everywhere;
  reviewer checks wording before merge.
- **Clobbering plugin config**: replacing `settings.json` disables superpowers. Signal: plugin no longer
  loads. Response: put session hooks in `settings.local.json`; never overwrite `settings.json`.
- **Unsupported hook schema**: hook silently no-ops. Signal: reminder never prints. Response: validate the
  schema against the installed version first (Step 1).
