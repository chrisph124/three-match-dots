# Team Workflow Design — three-match-dots

**Date:** 2026-06-17
**Status:** Approved. Docs/config applied this round; Husky+CI deferred to Expo scaffold step.

## Problem Statement

Team builds `three-match-dots` together. Need ONE shared dev flow everyone follows, every time,
regardless of which AI model assists. Flow: **brainstorm → plan → implement → unit tests → review →
lesson-learned (to avoid repeat bugs)**. Must NOT depend on **claudekit (ck)** — it's paid and
teammates don't have it. **Superpowers (free)** is allowed and may be installed.

## Requirements (locked)

- **Audience:** all teammates use **Claude Code** → `CLAUDE.md` is single source of truth; no AGENTS.md needed.
- **Superpowers source:** official marketplace `anthropics/claude-plugins-official` (v6.0.0). No ck anywhere.
- **Lessons mechanism:** codify lessons as **superpowers `writing-skills`** project skills, committed in
  `.claude/skills/` so they auto-load for every teammate. Promotion threshold: only codify reusable/recurring
  lessons; one-offs stay in PR/commit notes.
- **Enforcement:** git hooks (**Husky + lint-staged**) + **GitHub Actions CI** + **branch protection**.
- **Sequencing:** docs + superpowers setup + `.claude/skills` convention NOW; wire Husky+CI at the
  **Expo scaffold** step (no `package.json` yet → nothing to lint/test today).

## Flow → Superpowers Mapping

| Step | Superpowers skill | Artifact | Enforced by |
|------|-------------------|----------|-------------|
| 1. Brainstorm | `superpowers:brainstorming` | design doc in `docs/` | PR review |
| 2. Plan | `superpowers:writing-plans` | plan in `plans/` | PR review |
| 3. Implement | `executing-plans` + `subagent-driven-development` | code on feature branch | — |
| 4. Unit tests | `test-driven-development` | tests (TDD, with/before code) | Husky pre-push + CI |
| 5. Review | `requesting-code-review` → `receiving-code-review` | PR + review | branch protection (CI + 1 approval) |
| 6. Lesson-learned | `writing-skills` | committed skill in `.claude/skills/` | retro checklist |

Support skills: `systematic-debugging` (step 4/bugs), `verification-before-completion` +
`finishing-a-development-branch` (close-out), `using-git-worktrees` (parallel work).

## Evaluated Decisions

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| Team tools | All Claude Code | mixed/AGENTS.md | simplest; superpowers covers everyone |
| SP source | official marketplace | obra/superpowers | curated, stable, already installed |
| Lessons | superpowers skills | lightweight file | auto-load + shared via repo; threshold prevents bloat |
| Enforcement | Husky+CI+branch protection | docs-only / lefthook | strongest; Husky auto-installs, JS-native |
| Sequencing | defer hooks/CI to scaffold | everything now | no package.json yet → avoid dead config |

## Repo Structure (target)

```
three-match-dots/
├── CLAUDE.md                 # tech stack (draft) + Team Workflow + SP setup + lessons convention
├── .claude/
│   ├── settings.json         # enabledPlugins: superpowers@claude-plugins-official
│   └── skills/README.md      # lesson-skill template + promotion threshold
├── .github/workflows/ci.yml  # DEFERRED → created at scaffold (lint+typecheck+test on PR)
├── .husky/                   # DEFERRED → created at scaffold (pre-commit, pre-push)
├── docs/                     # design docs (brainstorm output)
└── plans/                    # plan files (writing-plans output)
```

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Hooks/CI dead without package.json | Defer to scaffold step (decided) |
| Lesson-skill bloat (a skill per trivial bug) | Promotion threshold: codify only reusable/recurring lessons |
| Git hooks not version-controlled | Husky commits hooks + auto-installs on `npm install` |
| Teammate skips superpowers install | `.claude/settings.json` enabledPlugins prompts install; CLAUDE.md documents steps |
| Branch protection needs GitHub admin | Note in CLAUDE.md; repo owner sets required CI + 1 review |

## Success Criteria

- New teammate: clone → open in Claude Code → prompted to enable superpowers → reads CLAUDE.md → follows 6 steps.
- After scaffold: `git push` blocked if typecheck/tests fail; PR blocked if CI red or unreviewed.
- Recurring bug → a committed `.claude/skills/<lesson>/SKILL.md` exists and auto-loads for all.

## Next Steps / Dependencies

1. (This round) Update CLAUDE.md; add `.claude/settings.json` + `.claude/skills/README.md`.
2. Scaffold Expo app → THEN add Husky+lint-staged + `.github/workflows/ci.yml`.
3. Repo owner enables branch protection (require CI + 1 approval) on GitHub.
4. Commit + push the workflow setup.

## Unresolved Questions

- Lint/format toolchain (ESLint + Prettier vs Biome) — pick at scaffold.
- Test runner (Jest vs Vitest) for the pure-TS core — pick at scaffold.
- Who has GitHub admin to set branch protection?
