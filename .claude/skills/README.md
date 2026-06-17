# Project Skills — Lessons Learned

Committed skills here **auto-load for every teammate** using Claude Code in this repo.
This is step 6 of the team workflow (see root `CLAUDE.md` → Team Workflow).

## When to add a lesson-skill

After a bug fix or code review, ask: **is this lesson reusable / will it recur?**

- **Yes (recurring / reusable)** → codify it here as a skill.
- **No (one-off)** → note it in the PR description / commit message. Do NOT author a skill.

Goal: capture the *why* so the same bug never ships twice — without bloating the repo with a skill per trivial fix.

## How to add one

Use the superpowers skill (recommended — it scaffolds correctly):

```
superpowers:writing-skills
```

It creates `.claude/skills/<lesson-slug>/SKILL.md`. Commit it so the whole team gets it.

## Skill template

```markdown
---
name: <lesson-slug>
description: Use when <situation that triggers this lesson> — prevents <the bug class>
---

## The lesson
<one-line rule>

## Why (the bug it prevents)
<what went wrong, the root cause — stable, not tied to a PR/phase number>

## How to apply
<concrete checklist or pattern to follow next time>
```

## Naming

- Folder slug: kebab-case, describes the rule — e.g. `keep-game-core-rn-free`, `pin-skia-reanimated-versions`.
- Do NOT reference PR numbers, phase labels, or finding codes in the skill — describe the durable *why*.
