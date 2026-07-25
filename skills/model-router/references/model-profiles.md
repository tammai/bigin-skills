# Model profiles

Which model each tier runs on is configurable; **effort is not** — it's pinned in each agent's frontmatter and the Agent tool has no effort override (only `model`). Changing a tier's effort means editing `agents/<name>.md` in this plugin, not the project config.

## Profiles

| Profile              | quick    | standard | deep    | verifier | Use when                                                                                 |
| -------------------- | -------- | -------- | ------- | -------- | ---------------------------------------------------------------------------------------- |
| `frontier` (default) | `sonnet` | `opus`   | `fable` | `sonnet` | Default. Standard tier matches an Opus-default session, deep tier gets the top model.     |
| `opus-centric`       | `sonnet` | `opus`   | `opus`  | `sonnet` | Same ladder minus Fable's price tag — no tier defaults to the most expensive model.       |
| `lean`               | `haiku`  | `sonnet` | `opus`  | `haiku`  | Cost-first. Note: Haiku 4.5 does not accept an effort level, so the pinned effort is inert on the `haiku` tiers. |

Effort per tier, fixed across all profiles: quick `low` · standard `high` · deep `xhigh` · verifier `low`.

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

- **Fable 5 / Opus 5** — `high` is the API default and right for most work; `xhigh` is Anthropic's recommendation for coding/agentic and capability-sensitive work, and is Claude Code's own default. The deep tier gets `xhigh` because a wrong architectural or contract decision compounds; `max` is left out — it shows diminishing returns and can overthink.
- **Sonnet 5** — default `high`, and it supports the full `low`–`max` ladder. The quick tier runs `low` deliberately: the tier exists for mechanical work, where high effort produces slow, hedged output.
- **Haiku 4.5** — does not accept an effort level at all. Under the `lean` profile the quick/verifier tiers still carry `effort: low` in frontmatter; it's inert there, not an error.
