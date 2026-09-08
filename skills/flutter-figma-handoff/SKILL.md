---
name: flutter-figma-handoff
description: "Turns a Material 3 Figma handoff into Flutter code — variables into a seeded ColorScheme, components resolved to widgets via a mapping table. Triggers: 'implement this Figma screen in our Flutter app', 'sync the app theme with Figma'."
argument-hint: [figma file or frame url]
effort: medium
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/emit_theme.mjs *) Bash(flutter --version)
---

# flutter-figma-handoff

Design and mobile dev share one base: Google's **Material 3 Design Kit** on Figma Community, which is the same design system Flutter's widgets implement. Nothing is forked and nothing is authored — the kit is the shared vocabulary, and this skill resolves a frame built from it into widgets that already exist.

## When not to use

- **A frame not built from the M3 kit.** Free-drawn UI has nothing to resolve against; that's a plain design-to-code task, and the honest answer is to say so rather than guess which widget was meant.
- **Nuxt UI / web work** — that's `nuxt-ui-figma-handoff`, a separate skill with a separate theme model.
- **Cupertino or a custom design system.** Out of scope, per `references/flutter-mapping.md`.

## Step 1: Get the Figma link and the Flutter version

This needs a real Figma file or frame URL, not a description of it — the URL is what resolves the actual node's variables and component variants instead of inferring them secondhand. If the user hasn't given one, ask before doing anything else.

Then read the version the repo pins:

```sh
flutter --version
```

Both matter, and the second is the one people skip. The kit tracks the Material spec, which runs ahead of the framework, so a component can exist in Figma a year before its widget ships. Every mapping decision below is relative to this version.

## Step 2: Read the design

Use the Figma MCP tools (search for them via ToolSearch if deferred) against the URL to pull the node's **local variables** and **component/variant names**. That is ground truth; prefer it over reading a screenshot.

If the connector isn't authorized, say so plainly and offer the fallback rather than stalling: an exported variables JSON plus the component names, or screenshots plus a written list of which kit components each frame uses. Ask for the URL either way — it's useful context even when the MCP can't reach it.

## Step 3: Resolve every component

Look each one up in **`references/flutter-mapping.md`**.

A component with no row is a **stop**, not a judgement call. Report the component name, the Flutter version you checked against, and the two ways forward: redraw with a component that maps, or accept a hand-built widget as a deliberate exception recorded in the ADR. Never quietly build a custom-painted lookalike — that is the failure this skill exists to prevent, and it looks like success right up until the design system moves.

## Step 4: Emit the theme

Tokens go through the seeded scheme, not a hand-written `ColorScheme`:

```sh
node ${CLAUDE_SKILL_DIR}/scripts/emit_theme.mjs --seed '#6750A4' \
  [--overrides tokens.json] [--font 'Inter'] [--out lib/core/design/app_theme.dart]
```

`tokens.json` is `{ "light": { "<role>": "#rrggbb", ... }, "dark": { ... } }`, using Flutter's own `ColorScheme` role names. The script rejects an unknown role rather than dropping it — a silently ignored token is a design that quietly didn't apply — and rejects the three roles Flutter retired in 3.22, naming the replacement.

**Seed plus explicit overrides, deliberately.** The design side owes one seed colour and only the roles it genuinely diverges on; Flutter derives the rest. The trade is real and worth saying out loud in your summary: **changing the seed moves roles nobody edited.** That is correct behaviour, not a regression — and it is why the emitted file has a fixed role order, so the diff stays reviewable.

## Step 5: Build the screen

Compose the mapped widgets. Two rules from the Flutter profile that this step must not break:

- Theme values come from `Theme.of(context).colorScheme`, never a hardcoded `Color(0x...)` in a widget. The emitted file is the only place colours are literal.
- Widgets live in `features/<feature>/presentation/`; the theme lives in `core/design/`. A screen does not reach into another feature's presentation layer.

## Step 6: Summarize

Say four things, and don't skip the third:

1. Which components were mapped, and to which widgets.
2. What the theme emitter wrote, and how many explicit overrides there were.
3. **Anything that did not map**, and what you did about it.
4. That a seed change produces a wide theme diff by design, if the seed changed.
