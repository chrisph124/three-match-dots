# Game Scripts — Creative Pre-Production

The Confluence-style space for creative pre-production: ideas, characters, game modes, levels,
materials, font style, philosophy, and game spirit. This is **content** (like
[`creative-bible.md`](../creative-bible.md)) — it lives under `docs/`, not `plans/`.

> **Not authority.** These are pre-production ideation notes. They **link to** the owning docs
> rather than redefining them. When a section here conflicts with an authority doc, the
> authority doc wins:
>
> - **Look / feel / tone (LOCKED):** [`creative-bible.md`](../creative-bible.md)
> - **What the game is:** [`three-dots-game-design.md`](../three-dots-game-design.md)
> - **Level contract:** [`level-script-schema.md`](../level-script-schema.md)
> - **Tools that produce assets:** [`creative-tool-catalog.md`](../creative-tool-catalog.md)
> - **Who + workflow:** [`rnd-department.md`](../rnd-department.md)

## Sections

| Section                            | Purpose                                             | Links to authority          |
| ---------------------------------- | --------------------------------------------------- | --------------------------- |
| [ideas.md](./ideas.md)             | Creative idea backlog — anything not yet committed. | design + bible              |
| [characters.md](./characters.md)   | Characters / mascots / narrators.                   | creative-bible (tone)       |
| [game-modes.md](./game-modes.md)   | Mode concepts (Endless, Journey, future).           | three-dots-game-design      |
| [levels.md](./levels.md)           | Level pre-production sketches before scripting.     | level-script-schema         |
| [materials.md](./materials.md)     | Paper-craft material / texture ideation.            | creative-bible §2.1         |
| [font-style.md](./font-style.md)   | Typography exploration.                             | creative-bible (typography) |
| [philosophy.md](./philosophy.md)   | Design philosophy — the "why".                      | creative-bible §1           |
| [game-spirit.md](./game-spirit.md) | The emotional core / feel we protect.               | creative-bible (tone words) |

## Doc-sync contract (Confluence-style)

When you **add or enrich a script here**, update the downstream docs **in the same change**:

1. the **technical reference** (the `src/`-layer architecture map in
   [`tech-stack-and-infra.md`](../tech-stack-and-infra.md)) — if it implies engine/behavior work;
2. the **gameplay walkthrough** ([`three-dots-gameplay-script.md`](../three-dots-gameplay-script.md))
   — if it changes how the game plays;
3. the **bible index** ([`project-bible.md`](../project-bible.md)) — if it adds/renames a concern.

This is the same rule stated in `CLAUDE.md` (Documentation Management → doc-sync). It keeps
pre-production from drifting away from the shipped game.

## How to add a script

1. Pick the right section file (or add one, kebab-case, and list it in the table above).
2. Write the idea under a clear heading; keep authority in the owning doc and **link** to it.
3. Run the doc-sync contract above before you open a PR.
