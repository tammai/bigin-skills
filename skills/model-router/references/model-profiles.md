# Model profiles

Which model each tier runs on is configurable; **effort is not** — it's pinned in each agent's frontmatter and the Agent tool has no effort override (only `model`). Changing a tier's effort means editing `agents/<name>.md` in this plugin, not the project config.

## Profiles

| Profile              | quick    | standard | deep    | verifier | Use when                                                                                 |
| -------------------- | -------- | -------- | ------- | -------- | ---------------------------------------------------------------------------------------- |
| `frontier` (default) | `sonnet` | `opus`   | `fable` | `sonnet` | Default. Standard tier matches an Opus-default session, deep tier gets the top model.     |
| `opus-centric`       | `sonnet` | `opus`   | `opus`  | `sonnet` | Same ladder minus Fable's price tag — no tier defaults to the most expensive model.       |
| `lean`               | `haiku`  | `sonnet` | `opus`  | `haiku`  | Cost-first. Note: Haiku 4.5 does not accept an effort level, so the pinned effort is inert on the `haiku` tiers. |

Effort per tier, fixed across all profiles: quick `low` · standard `high` · deep `xhigh` · verifier `high`.

## Per-project config

`.claude/model-routing.json` in the target repo. Both keys optional — `profile` picks a ladder, `models` overrides individual tiers on top of it:

```json
{
  "profile": "frontier",
  "models": { "deep": "opus" }
}
```

Valid `profile`: `frontier` · `opus-centric` · `lean`. Valid tier keys: `quick` · `standard` · `deep` · `verifier`. Valid models: `fable` · `opus` · `sonnet` · `haiku`.

`scripts/classify.mjs` reads and resolves this file, emitting the result as `routing` in its JSON: `{profile, models, source, warnings}`. `source` is `config` when the file was read, `default` otherwise. Every malformed input (bad JSON, unknown profile, unknown tier, unknown model) degrades to the default and is listed in `warnings` — the file can never block a routing decision. **Relay any non-empty `warnings` to the user**; a silently ignored config reads as a working config.

`bigin-harness-setup` writes this file from its Phase 1.5 `MODEL_ROUTING` decision. A project without the file gets the `frontier` default.

## Precedence

1. **On-demand instruction in the current request** — "run this one on fable", "use the lean ladder for this task". Wins for that spawn only; never edit `.claude/model-routing.json` to satisfy a one-off unless the user asks for the default to change.
2. **`.claude/model-routing.json`** — the project's standing choice.
3. **`frontier` default.**

An on-demand instruction names a *model*, not an effort level: "run this on fable at max effort" is not satisfiable at spawn time. Say so and offer the closest tier instead of silently dropping the effort part.

## Why these effort levels

Start from the documented baseline: **`high` is the default effort on every model that supports effort** (the sole exception is Opus 4.7, which defaults to `xhigh`). Fable 5, Opus 5, and Sonnet 5 all accept the full `low`–`max` ladder. Anthropic's guidance is to *use the default* unless a failure diagnoses otherwise: a wrong answer despite full context means reach for a more capable **model**; a skipped file, unrun tests, or a refactor abandoned partway means raise **effort**. So each pin below has to earn its deviation.

- **Standard tier — `high`.** This is the model default, not an escalation. It's the right setting for the tier that handles most feature and bug-fix work, and it's deliberately left alone.
- **Quick tier — `low`, below default.** Matches the documented use for `low`: short, scoped, latency-sensitive work that isn't intelligence-sensitive. High effort on a mechanical single-file edit produces slow, hedged output, so routing down is the point of the tier.
- **Deep tier — `xhigh`, above default.** The one genuine escalation here, and the justification is thoroughness rather than capability: this tier only receives work where a wrong structural or contract decision compounds and can't be cheaply reverted, which is exactly the "didn't check its work" failure mode effort addresses. `max` is left out on purpose — the docs flag it for diminishing returns and overthinking, and say to test before adopting it broadly.
- **Verifier tier — `high`.** At the model default, deliberately. The output contract is cheap (one JSON object), but the *analysis* isn't: the verifier has to check every spec section against real code and catch **omissions** — what the diff fails to do — which is harder than judging what's present. And the error is asymmetric: a false `FAIL` costs one loop round, while a false `PASS` silently voids the guarantee the whole loop exists for. `low` would be an un-argued deviation from the default on the one agent whose failures are invisible.
- **Haiku 4.5** — supports no effort level at all. Under the `lean` profile the quick and verifier tiers still carry their frontmatter `effort` (`low` and `high` respectively); it's inert on both, not an error.

**One caveat on `lean`:** it puts the verifier on `haiku`, where the `high` pin argued above has no effect — so the agent whose failures are silent runs at the least capable tier with no effort control. If the implement/verify loop's guarantee matters to a project, override just that tier and leave the rest of the cost saving intact:

```json
{ "profile": "lean", "models": { "verifier": "sonnet" } }
```

If you find yourself wanting to raise a tier's effort for a particular task, the guidance points upstream first: an under-specified `PLAN.md` or a missing convention in `.claude/rules/` is the more common root cause than an under-powered effort level.

**On models above Fable:** Anthropic's model line-up names Mythos above Fable, but **it isn't available to us — Fable is the ceiling.** So `fable` topping out the deep tier is the correct top rung, not a gap to close, and `classify.mjs`'s `fable`/`opus`/`sonnet`/`haiku` validation set is complete. Don't add a `mythos` rung on the strength of a blog post or docs table: an unknown model name in `.claude/model-routing.json` degrades to the profile default with a warning rather than failing loudly, so a wrong rung reads as a working config that silently isn't. Revisit only if access actually changes.
