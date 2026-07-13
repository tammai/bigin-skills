---
name: nuxt-ui-figma-handoff
description: "Extracts a Nuxt UI Figma design handoff into the right code changes — main.css (Tailwind @theme tokens, base radius) and app.config.ts (semantic ui.colors mapping + per-component Tailwind Variants overrides). Requires a Figma file/frame URL from the user — ask for one before doing anything else if it wasn't given, since the skill reads the actual design variables and component variants through that link rather than guessing from a description. MUST use when user says: 'implement this Figma design in our Nuxt UI app', 'wire this Figma redesign into app.config.ts', 'apply these Nuxt UI design tokens from Figma', 'sync our theme with the new Figma handoff', 'match this Figma design', 'get this Figma theme into the codebase', 'chuyển giao thiết kế Figma vào code', 'đồng bộ theme Nuxt UI theo Figma', 'cập nhật app.config.ts theo design Figma', or whenever a designer has cloned/customized the official Nuxt UI Figma kit and handed off a design for implementation. Do NOT use for Figma-to-code work unrelated to Nuxt UI theming (a different component library, or building a screen from scratch — that's a plain design-to-code task, not this skill), and don't use when there's no Nuxt UI project in scope."
effort: medium
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/generate_color_scale.mjs *)
---

# nuxt-ui-figma-handoff

Nuxt UI's official Figma kit mirrors the code library almost exactly — same semantic
color roles, same radius/spacing scale, same component variants. A designer's tweaks in
Figma map to a specific, small edit in one of two files, never a rewrite. The job here is
finding that mapping precisely instead of guessing at pixel values or dumping a giant
theme object where a three-line diff would do.

## Step 1: Get the Figma link

This skill needs a real Figma file or frame URL, not a paraphrased description of what
changed — the URL is what resolves the specific node so its actual variables and
component variants can be read, rather than inferred secondhand. If the user hasn't
given one, ask for it before doing anything else.

If the Figma MCP connector isn't authorized in this session, say so plainly and offer
the fastest fallback instead of stalling: Nuxt's own recommended handoff tool is
**TemPad Dev** (a Chrome extension + official Nuxt UI plugin that inspects a selected
component in Figma dev mode and outputs its real Tailwind classes/props). An exported
variables JSON or screenshots + a plain-language changelist also work. Still ask for the
Figma URL alongside whichever of these the user provides — it's useful context even when
the MCP itself can't reach it yet.

## Step 2: Read the design

Once the connector is available, use Figma MCP tools (search for them via ToolSearch if
deferred) against the given URL to pull the frame/node's local variables and component
variant info — variable name, resolved value, and which component/variant it's scoped
to. This is ground truth; prefer it over eyeballing a screenshot.

Your goal is a list of *changed* tokens, not the whole design — each tied to either a
global role (a color, the radius, a font) or a specific component + variant.

## Step 3: Locate the project's theme files

Use Glob/Grep, don't assume paths:

- CSS entry point: usually `app/assets/css/main.css`, sometimes `assets/css/main.css`.
  Confirm with `@import "@nuxt/ui"`.
- Config: usually `app/app.config.ts`, sometimes `app.config.ts` at the root. Confirm
  with `defineAppConfig`.
- Check the installed `@nuxt/ui` version in `package.json`. Everything below assumes
  **v4** (Tailwind CSS v4, CSS-first `@theme` tokens). If the project is on v2 or v3,
  the shapes differ meaningfully — flag this rather than silently applying v4-shaped
  config to an older project.
- If a component override is needed, read that component's **current** default theme
  before writing anything, so the result is a diff, not a full re-declaration. If
  `@nuxt/ui` is installed, its source is under `node_modules/@nuxt/ui` (look for a
  `theme` folder). Otherwise fetch from
  `github.com/nuxt/ui/tree/v4/src/theme/<component>.ts`, matching the tag to the
  installed version.

Read `references/nuxt-ui-v4-theming.md` before making edits — exact CSS variable names,
the semantic color table, and worked examples of the component override shape. Small
naming mistakes (e.g. inventing a variable instead of using `--ui-radius`) silently do
nothing.

## Step 4: Classify each changed token

| What changed in Figma | Where it goes |
|---|---|
| A brand color's full palette (new hex ramp) | `main.css`, `@theme` block, `--color-<name>-50` through `-950` |
| Which color fills a semantic role (e.g. "primary is now this purple") | `app.config.ts`, `ui.colors.<role>` |
| Base corner radius | `main.css`, `:root { --ui-radius: ... }` |
| Font family | `main.css`, `@theme { --font-sans: ... }` |
| Container max width / header height | `main.css`, `:root { --ui-container / --ui-header-height }` |
| A specific component's padding, font weight, a variant's color/ring, default size/color/variant | `app.config.ts`, `ui.<component>.{slots,variants,compoundVariants,defaultVariants}` |

If the designer only gave one swatch for a new brand color (not a full 50–950 ramp —
the most common gap in a handoff), don't invent numbers by eye. Run:

```sh
node <this-skill-dir>/scripts/generate_color_scale.mjs <hex> --name <color-name> [--anchor 500]
```

and say clearly in the summary that the ramp is algorithmically generated and worth a
design sign-off, not a transcription of something the designer specified.

## Step 5: Apply the changes

If a project is connected: `Read` the existing `main.css` and `app.config.ts`, then
`Edit` them — merge into the existing structure, don't overwrite unrelated content. Only
add the keys that actually changed; resist restating the whole default theme.

If no project is connected, or the files don't exist yet: produce the same edits as
clearly-labeled code blocks, one per file, with the exact file path noted above each
block.

## Step 6: Summarize

Close with a short, concrete list of what changed and where (e.g. "`primary` role moved
from green to violet — `app.config.ts`", "base radius 0.25rem → 0.5rem — `main.css`").
Flag anything inferred or generated — like an auto-generated color ramp, or a token that
didn't map cleanly to an existing role — so it gets a design check before merging.
