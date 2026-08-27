---
name: ask-bigin
description: "Routes a request to the right bigin-skills skill and hands off. Use when you don't know which one applies, or want the inventory. Triggers: 'which skill should I use', 'where do I start', 'what can you do', /ask-bigin."
argument-hint: [what you want to do]
effort: low
---

# ask-bigin

You name the skill that fits and hand off. **You never do the work yourself** — not the scoping,
not the spec, not the diff. One line of reasoning, then invoke. A router that starts implementing
is just a slower `task-workflow`.

## The two things you must not restate

This skill exists because there are many doors, not because routing needs a new definition. Both
inputs already have a home:

1. **The triage ladder** — [`../discovery-workflow/references/triage-ladder.md`](../discovery-workflow/references/triage-ladder.md).
   Three rungs, already read by `task-workflow`, `epic-workflow` and `discovery-workflow`. **Read
   it; never paraphrase it here.** You are its fourth reader, not a fourth bar. If your answer for
   build work disagrees with the ladder, the ladder is right and you are wrong.
2. **The inventory** — every skill's `description:` frontmatter is already in your context on every
   turn. That *is* the list. Derive any listing from what you can see loaded, never from a table
   written here: a hardcoded inventory drifts the moment a skill is added, and the generated tables
   in [`README.md`](../../README.md) are the human-facing copy that stays current mechanically.

## Procedure

1. **Read the request for what it names.** Not what it implies — what it names. "Write tests for
   the parser" names tests. "Why is this flaky" names a bug. "We want a client portal" names a
   product nobody has scoped.

2. **Is it build work?** — a change to this codebase, at any size. If yes, read the triage ladder
   and route by rung. Say the rung and the one discriminator that decided it:

   > Rung 2 — a contract and its consumers is two surfaces, so `epic-workflow` first.

   Do not re-derive the bar from memory. Two-plus surfaces, 3+ units, and "is the product shape
   settled" are the ladder's discriminators and they are written down.

3. **Otherwise route on the named subject.** These are the non-ladder doors — each is a skill whose
   own `description:` you can already see, so check that description rather than trusting this list
   to be complete:

   | The request names | Route to |
   | --- | --- |
   | tests for a named unit, or a PRD acceptance criterion | `write-tests` |
   | a bug that needs diagnosis before it can be scoped | `debug-workflow` (then rung 1) |
   | a third-party library at a version | `knowledge-distill` |
   | the end of a sprint, or what the team learned | `sprint-distill` |
   | a new repo or app from nothing | the matching `*-scaffold` |
   | AI rules, gates, or Cursor support for an existing repo | `bigin-harness-setup` |
   | a Figma handoff in a Nuxt UI app | `nuxt-ui-figma-handoff` |
   | a context limit, or saving state to resume | `session-handoff` |
   | which model or tier should run something | `model-router` |

   If nothing matches, say so plainly and answer the question directly instead of forcing a skill.
   "No skill covers this, here's the answer" is a correct outcome.

4. **No arguments given?** List what's available — grouped as build work, knowledge, scaffolding,
   and setup — one line each, from the loaded descriptions. Then ask what they're trying to do.
   Don't dump all fifteen with equal weight: lead with the ladder, since that's what most sessions
   need.

5. **Two candidates genuinely tied?** One `AskUserQuestion` with those two as the options and the
   real trade-off in each description, then route. Genuinely tied means you can state a concrete
   reason for each. One question, not a survey — if you can pick, pick.

6. **Hand off.** Invoke the chosen skill via the Skill tool. If the user asked which skill rather
   than asking you to run it, name it and stop — answering "which" with an unrequested invocation
   is its own failure.

## What this is not

- **Not a gate.** It approves nothing and blocks nothing. The spec gate still runs inside
  `task-workflow` exactly as it would have.
- **Not a step in any workflow.** Nothing invokes this skill; it's a door for a human who doesn't
  know which door. No skill should ever route *through* here.
- **Not a wrapper.** Routing to `task-workflow` and routing to `epic-workflow` cost the same from
  here: one line and a hand-off. If you find yourself summarizing what the next skill will do,
  stop — it will do it, and its own first step says so.
