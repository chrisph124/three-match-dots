# Three Dots — RnD Department (agents + workflow)

**Date:** 2026-08-06 (concept); retargeted to React Native 2026-08-16.
**Status:** Design approved (brainstorm, `--advice` supervised). Agents specified here; **created after the
level-script schema lands** (see sequencing).
**Purpose:** A small, disciplined "RnD department" that designs and enriches the game — scripts, art
direction, storyboards — _before_ build, so nothing is missed, inconsistent, or drifts from origin.
**Related:** `docs/creative-bible.md` (the rules), `docs/creative-tool-catalog.md` (the tools),
`docs/level-script-schema.md` (the contract), `docs/three-dots-game-design.md` (the game).

---

## Guiding principle

**Consistency comes from a written bible + a review gate + one tool per asset class — NOT from agent
headcount.** A solo/small team can't sustain eight standing specialist agents; it _can_ sustain one strong
bible, three focused agents, and a review step. So the brief's 8 requested roles are **all honored**, but
realized at the right weight: 3 become real committed subagents; the rest become bible sections, existing
agents, or on-demand help. Nothing is dropped.

## Roster — 3 committed subagents

Committed to `.claude/agents/*.md` so they auto-load for every teammate. Each has a tight mandate, defined
inputs/outputs, and reads the creative bible before acting.

| Agent                       | Mandate                                                                                                                                                                                              | Reads                                        | Produces                                                                                                                                   | Invoked                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| **`level-designer`**        | Author each city as a distinct challenge: board size, colors, objective, obstacle mix, timer, difficulty ramp. The "game creator / script per level" role.                                           | GDD, creative bible, **level-script schema** | Valid **level-script files** (schema-conformant) + a one-line design intent per city                                                       | Per city / per chapter                                          |
| **`storyboard-writer`**     | Turn a level or flow into a beat-by-beat script (screen flow, gameplay beats, juice/SFX cues, win/lose framing) for build + review. The "visualize script / storyboard" role.                        | GDD, creative bible, a level script          | A **trimmed Markdown beat-table**: beat / board-or-screen state / player action / juice+SFX cue / win-lose framing + a ~4-tag layer column | Per new screen / **representative** city — **not one per city** |
| **`art-director-reviewer`** | **The consistency gate.** Review any asset, level, or storyboard batch against the creative bible; flag drift; approve or send back. The discipline that keeps everything "not too far from origin." | creative bible, the batch under review       | A pass/fail review with specific bible-rule citations                                                                                      | Before any batch integrates                                     |

## The 8 requested roles → how each is realized

| Requested role                                             | Realized as                                                                                      | Why                                                                                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Game creator — script per level                            | **`level-designer`** subagent ✅                                                                 | Core, recurring, high-value — deserves a standing agent + the schema                                                                                          |
| Storyboard / visualize script                              | **`storyboard-writer`** subagent ✅                                                              | Recurring, concrete output                                                                                                                                    |
| _(consistency enforcement)_                                | **`art-director-reviewer`** subagent ✅ (new)                                                    | The mechanism that makes "disciplined + consistent" real                                                                                                      |
| Gameplay / mechanism / movement / **light-stage / camera** | GDD + `superpowers:brainstorming` + `kongming` counsel                                           | Skia is a 2D canvas — there is **no 3D camera/light rig**; "lighting" is painted into art (bible §2.1). Mechanics are a design decision, not a standing agent |
| Context / background / world-building                      | **Creative-bible world sections** (one writer pass per country)                                  | Consistency lives in the bible, not a separate agent                                                                                                          |
| Animation                                                  | **Bible §4 (motion language)** + Reanimated/Skia + `rive-react-native` production (tool catalog) | Motion is _specified_ in the bible and _produced_ in tools; no standing agent needed                                                                          |
| Designer — characters / board / UI                         | Existing **`ui-ux-designer`** agent + **bible §2–3**; art _made_ by a human in the catalog tools | UI/UX has a capable existing agent; character scope is tiny (dot skins + 1 mascot)                                                                            |
| UX director                                                | Existing **`ui-ux-designer`** agent + **bible §3**                                               | Same capability; no need to duplicate                                                                                                                         |
| Music / theme / audio                                      | Existing **`researcher`** agent (sourcing) + **bible §5**; produced in the catalog's audio tools | Sourcing is occasional research; tone is fixed in the bible                                                                                                   |

**Net new agents to author: 3.** Everything else = bible + existing `ui-ux-designer` / `researcher` + design docs.

## Inspiration basis (roles + culture)

The **agent files** are engineered on qualified Claude Code agent patterns (see authoring spec). The **roster

- culture** is modeled on real studios whose genre and scale match — not a copied org chart:

* **Roles ← King (Candy Crush).** The genre-exact analog (timed, level-based, world-map, obstacles, economy).
  It _validates_ our roles as real studio functions, not invented ceremony:

  | Our agent               | King / studio analog                                                                          |
  | ----------------------- | --------------------------------------------------------------------------------------------- |
  | `level-designer`        | Level / game designer — authors each level's board, objective, obstacle mix, difficulty curve |
  | `art-director-reviewer` | Art director — the consistency gate protecting a coherent visual identity                     |
  | `storyboard-writer`     | Game-feel / UX flow scripting — beats, juice, screen flow                                     |

* **Culture ← Supercell.** "A few small, autonomous _cells_ that fully own their lane; kill what doesn't work."
  This is _why_ we run **3 empowered agents, not 8 bureaucratic ones**, and why the other 5 requested roles stay
  as bible sections until a real recurring need proves one deserves promotion to a standing agent (YAGNI).
* **Lineage ← Playdots / Two Dots (Zynga).** The literal drag-link ancestor — kept as the mechanic reference,
  not an org model.

## Agent invocation & routing (how agents "show up" without being called)

**Reality:** Claude Code subagents do **not** self-activate — the orchestrating Claude delegates to them. The
"they know when to show up, I never call one by name" experience comes from two soft levers (no hook/gate — see
authoring spec + this map). Consistency is a _bias_, not a hard trigger; promote to a hook only if it proves leaky.

1. **Description-driven auto-selection.** Each agent's frontmatter `description` carries explicit "Use this agent
   when… + `<example>`" triggers (like the built-in `code-reviewer`). The orchestrator matches tasks to these
   automatically. **This is the primary lever** — a weak description = an agent that never shows up.
2. **Project routing map.** During `/ak:brainstorm` or planning, the orchestrator consults this stage→agent map
   (kept always-in-context via a short block in `CLAUDE.md` pointing here). Mirrors the global
   `skill-workflow-routing.md` pattern, at project scope:

   | When the brainstorm/plan touches…                             | Auto-route to                                                 |
   | ------------------------------------------------------------- | ------------------------------------------------------------- |
   | A level / city / new obstacle                                 | `level-designer` → then `art-director-reviewer` (bible check) |
   | A screen, HUD, or flow                                        | `ui-ux-designer` + `storyboard-writer`                        |
   | Any produced art / audio / level batch (before it integrates) | `art-director-reviewer` (the gate)                            |
   | Sourcing a tool / asset / audio track                         | `researcher`                                                  |
   | A hard design fork or a stuck step                            | `kongming` (advisory only)                                    |

## Agent-file authoring spec (qualified Claude Code pattern)

Each `.claude/agents/<name>.md` — committed, project-scoped, auto-loads for teammates — follows:

- **Frontmatter:** `name` (kebab-case); `description` that **starts with "Use this agent when…", names the
  trigger, and includes 1–3 `<example>` blocks** (this is what drives auto-routing — invest here); add a
  "PROACTIVELY" cue where the agent should self-suggest.
- **Minimal tool grant:** `level-designer` = Read/Write/Grep/Glob; `storyboard-writer` = Read/Write/Grep/Glob;
  `art-director-reviewer` = **Read/Grep/Glob only** (it reviews — it must not mutate assets).
- **Body:** role + mandate; **"read first"** (the creative bible always; the level-script schema for
  `level-designer`) by path; defined inputs → structured outputs; boundaries (advisory vs mutating); end with the
  orchestration status line (`Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`).

## Consistency mechanism (how drift is prevented)

1. **The creative bible is the boundary** — LOCKED rules + TBD slots. Creativity is free _inside_ the LOCKED rules.
2. **One tool per asset class** (catalog) — no parallel toolchains producing divergent looks.
3. **`art-director-reviewer` is the gate** — no asset/level/storyboard integrates without a pass against the bible.
4. **The bible is versioned** — changing a LOCKED rule is a recorded decision, not a silent per-asset exception.

## Workflow (idea → shipped asset/level)

```
1. FRAME    Design intent for the piece (a city, a screen, an asset) — from the GDD.
2. CHECK    Read the creative bible; identify which LOCKED rules apply and which TBD slots it fills.
3. PRODUCE  level-designer / storyboard-writer / ui-ux-designer / human-in-tool creates the piece
            (level-designer output MUST conform to the level-script schema).
4. REVIEW   art-director-reviewer checks it against the bible → PASS or SEND-BACK (with cited rules).
5. INTEGRATE On PASS, it enters the build. If it exposed a genuine new rule, UPDATE the bible deliberately.
```

This mirrors the team's 6-step flow (brainstorm → plan → implement → test → review → lesson) — the RnD
department is the _design-enrichment_ front end that feeds `superpowers:writing-plans` and the build.

## Sequencing — schema before agents (do not skip)

**The level-script schema must be locked BEFORE creating the `level-designer` agent** — if it shifts after, every
agent prompt and authored level gets rewritten. Order:

1. ✅ GDD + creative bible + tool catalog + this RnD design (brainstorm).
2. ✅ **Level-script schema v0** drafted (`docs/level-script-schema.md`, JSON) — confirm/lock it.
3. **Wire routing (schema-independent — not done on `main` yet):** add a short "AgentKit Routing — RnD
   Department" block to `CLAUDE.md` pointing every `/ak:*` run + the `ak:agentkit` router at this routing
   map, the bible, and the gate.
4. Author the 3 subagents in `.claude/agents/` per the **authoring spec** above (each reads bible + schema by path).
5. `level-designer` produces the v1 slice's cities against the schema; `art-director-reviewer` gates each batch.

## Not built yet (intentionally)

The 3 agent files are **specified here but not created** — they wait on the schema being locked (step 4). This
doc is the spec; authoring them, and wiring the CLAUDE.md routing block (step 3), are later, small steps.

## Open items

- **Confirm/lock schema v0** (`docs/level-script-schema.md`) before authoring agents.
- ✅ **Resolved:** `storyboard-writer` outputs a **trimmed Markdown beat-table** (columns above) on **new screens
  - representative cities only**, not one per city.
- If soft routing proves leaky in practice, revisit the enforcement-hook option (currently declined for KISS).
