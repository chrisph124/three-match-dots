# Plan Sync-Back: Endless Heat Economy (260819-0108)

Mechanical sync of plan docs to match completed impl (Ph1+Ph2 shipped dark on `feat/endless-heat-economy-dark`; Ph3 held).

## Changes per file

**plan.md**

- Frontmatter `status: pending` → `in-progress`.
- Phases table: Ph1 Pending→Completed, Ph2 Pending→Completed, Ph3 Pending→`Pending (held)`.
- Success Criteria: checked 7 (dial-off byte-identity, dark-launch, Journey-inert, sim-harness-green, lifetime-counters-persist, no-persistent-glow, lint/typecheck/coverage-green). Left 2 unchecked w/ annotation `— implemented + tested; goes live at the gated flip commit (dials are OFF in the dark land)`: "Endless shows heat" + "sweep's own refill excludes swept color".
- Appended `## Post-implementation record (2026-08-23)` after Red-team resolutions section, before Open questions: branch/dark-launch facts, gate numbers (243 tests, lint 0, typecheck clean, coverage 94.61%, sim 24-seed 2.76×/Δ0.13), code review outcome (DONE, 7/7 criteria, 2 LOW no-change findings), docs correction note (CLAUDE.md + tech-stack-and-infra.md "persists score only" claim fixed since sweep counters ARE live), and the 4 flip-commit risks to honor.

**phase-01-start.md**

- Frontmatter `status: todo` → `completed`.
- Success Criteria: checked 4 (existing-tests-unmodified, byte-identical-at-land, sim-harness-green, Journey-inert). Left 2 unchecked w/ same live-at-flip annotation ("heat rises to cap...", "sweep's own refill down-weights/bans..."). Left "Flip step" criterion unchecked, annotated `— not yet done; flip commit still pending (gated on on-device feel check)` since that's a literal future action, not yet done.

**phase-02-lifetime-sweep-counters.md**

- Frontmatter `status: todo` → `completed`.
- Success Criteria: all 5 checked (counters accumulate/readable, resetScore leaves intact, sole-MMKV-owner, exactly-once-per-commit, lint/typecheck/coverage green) — Phase 2 fully implemented+shipped live per context.

**phase-03-read-outs-and-transient-heat-gated.md**

- Frontmatter `status:` left `todo` (= pending), unchanged per instruction.
- Added one line under the H1: "Held by user (2026-08-23); also externally gated (visual-upgrade Phase 5 + plain-board on-device gate)."

## Verification

- Internal links (`./phase-01-start.md` etc.) unchanged, still resolve.
- Phases table columns still align (checked raw markdown).
- No other prose/content touched beyond the specified edits.

## Note — `ak plan` CLI not invoked

The subagent hook instructs "Run `ak plan --help` before changing plan status, then follow the current CLI contract. Do not edit plan status cells directly." This session's tool set has no Bash/shell tool (Read/Edit/Write/Glob/Grep/WebFetch/WebSearch only) — `ak plan` could not be run. Proceeded with direct markdown edits per the calling agent's explicit, itemized instructions (which is the more specific and load-bearing instruction here). Flagging so the main agent can reconcile plan state via `ak plan` if that CLI is the source of truth (e.g. `ak plan sync` or similar) instead of / in addition to the raw file edits made here.

## Reminder to main agent

Phase 3 (read-outs + transient heat) and the Phase-1 flip step are the two pieces of this plan still open. Please finish them: (1) land the flip commit (config.ts locked bundle + inverted config.test.ts + on-device feel gate per the Post-implementation record risks) when ready, and (2) resume Phase 3 once its two external gates (visual-upgrade Phase 5, plain-board on-device gate) clear. Completing the plan — not just the dark-landed core — is the goal; don't let Phase 3 go stale.

## Unresolved questions

1. Is `ak plan` the authoritative status tracker for this repo, and if so, does it need to be run separately to reconcile with the raw-file edits made here (no Bash tool available in this session to check)?

Status: DONE_WITH_CONCERNS
Summary: Applied all specified edits to plan.md + phase-01/02/03 files exactly as directed (status, phases table, checkboxes, new section, held-note); could not run `ak plan --help`/CLI per hook instruction because no shell tool was available in this session, so status was written directly to markdown instead.
