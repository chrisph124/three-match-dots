---
name: three-dots-retarget-plan-review-workflow
description: How this project runs plan validation/red-team rounds and what kongming is asked to do at each round
metadata:
  type: project
---

This project (three-match-dots) runs plan review as staged rounds recorded directly in `plan.md`'s
"Validation Log" and "Red Team Review" sections (not separate report files):
`/ak:plan validate --advice` first (fact-check + contract-verify claims, draft kongming review),
then `/ak:plan red-team --advice` (multiple adversarial reviewer personas + fact/contract checkers,
findings deduped and severity-adjudicated, user makes explicit scope decisions on ambiguous forks,
then kongming is consulted for a final go/no-go).

kongming's role at the red-team round: after the user applies accepted findings + records their own
scope decisions (labeled A/B/C/D-style in `plan.md`), kongming is asked a narrow question — does
any user override introduce NEW uncovered risk, and is the plan safe to hand to `/ak:cook`. This is
scoped review of the delta, not a full re-audit: don't re-litigate confirmed user decisions (creative/
design calls especially — see [[three-dots-retarget-palette-risk]] for an example of "override
respected, residual risk still named concretely with file:line").

Expect terse, concrete, file:line-anchored answers to be valued here over broad re-analysis — the
plan.md Red Team Review table format (finding / severity / resolution) is the house style; matching
that terseness in kongming's own replies fits how this team consumes advisory output.
