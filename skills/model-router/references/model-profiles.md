# Model profiles

A profile sets both the **model** and the **effort** for each tier. Model is passed at spawn time; effort cannot be — the Agent tool has no effort parameter, so effort comes only from the spawned agent file's frontmatter. A profile that wants a tier at a different effort therefore routes to a different **agent**, not a different argument. `classify.mjs` resolves all three (`models`, `efforts`, `agents`) and the router spawns `routing.agents[tier]` verbatim.

## Profiles

Two implementer tiers plus the verifier. Capability 0–4 routes to **worker**, 5+ (or an auto-override) to **architect**.

| Profile                | worker        | architect     | verifier      |
| ---------------------- | ------------- | ------------- | ------------- |
| `balanced` (default)   | `sonnet`/high | `opus`/medium | `sonnet`/high |
| `frontier`             | `opus`/medium | `opus`/high   | `sonnet`/high |

| Profile | Use when |
| --- | --- |
| `balanced` (default) | The cost-aware default. The volume tier runs on Sonnet at full effort; Opus is spent only where a task scored as an architectural call, at its own default effort. |
| `frontier` | Capability first. Worker-tier work moves to Opus, and the architect tier gets one effort step more. Opt in when a project's worker-tier work keeps coming back with verifier `FAIL`s a stronger model would have avoided, or its architectural calls are frequent and expensive to get wrong. |

Neither profile routes to Fable or Haiku. Both stay valid per-tier `models` overrides (below).

**Agents per tier**, since effort determines which file gets spawned:

| Tier | `balanced` | `frontier` |
| --- | --- | --- |
| Worker | `worker` | **`worker-frontier`** |
| Architect | `architect` | **`architect-frontier`** |
| Verifier | `verifier` | `verifier` |

A `-frontier` agent is the same role as its base: its body is byte-identical, and its frontmatter differs only in `name`, `model`, `effort` and `description`. `tools/docs_sync.mjs --check` (pre-commit) fails the commit if the body or any other frontmatter key drifts, or if a frontmatter `model` disagrees with the ladder above — so edit the base and copy the body over, never patch a variant alone. The variant fixes the *effort*; the model still comes from `routing.models[tier]` at spawn time, so a `models` override runs on the variant the profile picked.

## Pricing and effort, per model

| Model | $/1M input | $/1M output | Effort |
| --- | --- | --- | --- |
| Fable 5.1 | 10 | 50 | accepts effort |
| Opus 5.5 | 4 | 20 | default `medium` |
| Sonnet 5.5 | 2 | 10 | accepts effort |
| Haiku 4.5 | 1 | 5 | **accepts no effort level** |

Per token, Sonnet 5.5 is half of Opus 5.5 and Fable 5.1 is two and a half times Opus. Effort moves the token count, not the price, so these ratios compare models, not task costs. Check a model's default effort in the model-config docs rather than asserting it from memory; the only default this file relies on is Opus 5.5's `medium`.

## Per-project config

`.claude/model-routing.json` in the target repo. Both keys optional — `profile` picks a ladder, `models` overrides individual tiers on top of it:

```json
{
  "profile": "balanced",
  "models": { "architect": "fable" }
}
```

Valid `profile`: `balanced` · `frontier`. Valid tier keys: `worker` · `architect` · `verifier`. Valid models: `fable` · `opus` · `sonnet` · `haiku`.

There is **no `effort` key** — it isn't settable here, because effort can only come from the spawned agent's frontmatter. Setting one produces a warning and is otherwise ignored; pick the profile whose effort ladder you want instead.

`scripts/classify.mjs` reads and resolves this file, emitting the result as `routing` in its JSON: `{profile, models, efforts, agents, source, warnings}`. `agents` is the tier → `subagent_type` map the router spawns verbatim; `efforts` is informational, for stating the pin in the routing rationale. `source` is `config` when the file was read, `default` otherwise. Every malformed input (bad JSON, unknown profile, unknown tier, unknown model) degrades to the default and is listed in `warnings` — the file can never block a routing decision. **Relay any non-empty `warnings` to the user**; a silently ignored config reads as a working config.

`bigin-harness-setup` writes this file from its Phase 1.5 `MODEL_ROUTING` decision. A project without the file gets the `balanced` default.

## Precedence

1. **On-demand instruction in the current request** — "run this one on fable", "use the frontier ladder for this task". Wins for that spawn only; never edit `.claude/model-routing.json` to satisfy a one-off unless the user asks for the default to change.
2. **`.claude/model-routing.json`** — the project's standing choice.
3. **`balanced` default.**

An on-demand instruction names a *model*, not an effort level: "run this on fable at max effort" is not satisfiable at spawn time. Say so and offer the closest profile or tier instead of silently dropping the effort part. Requesting a *ladder* ("use frontier here") does move effort, since that changes which agent is spawned.

## Why these pins

Two rules frame every pin. **Model choice answers "could it do this at all"; effort answers "did it check its work."** A wrong answer despite full context means reach for a more capable model; a skipped file, unrun tests, or a refactor abandoned partway means raise effort.

**`high` is the ceiling, and that's a standing rule — no tier pins to `xhigh` or `max`, on any profile.** The checking a higher pin would buy is already supplied structurally by `task-workflow`'s implement/verify loop, which re-reads the diff against `PLAN.md` with a fresh agent — buying it twice is how you get slow, hedged output on work that didn't need it. If a tier's work keeps coming back wrong, the fix is upstream in `PLAN.md` or `.claude/rules/`, not a higher pin.

- **Worker, `balanced` — `sonnet`/high.** The volume tier: everything from a one-line copy fix to a multi-file feature on an established pattern. Work reaching it follows a pattern the codebase already has, so its failures are mostly of the "didn't check its work" kind — the effort axis. Sonnet at full effort buys that thoroughness at half Opus's per-token price. The verifier round catches what slips through, at the cost of one loop iteration on the tasks that actually miss. Raise it (switch the project to `frontier`) only if verifier `FAIL`s on worker-tier work become routine rather than occasional; a single bad round is the loop working.
- **Architect, `balanced` — `opus`/medium.** This tier only receives work where a wrong structural or contract decision compounds, so it gets the stronger model: the capability axis. `medium` is Opus 5.5's own default, so this pin is no deviation at all — and the approved `PLAN.md` plus the verifier round already supply the checking that a higher pin would buy.
- **Worker, `frontier` — `opus`/medium.** Trades the other way from `balanced`: a stronger model at its default effort instead of a cheaper one pushed to full effort. For projects whose worker-tier misses are "it tried and got it wrong", which effort does not fix.
- **Architect, `frontier` — `opus`/high.** One step above Opus's default, and at the ceiling. The model can't climb further without leaving the ladder — Fable is reachable as a `models.architect` override, at two and a half times the price — so the extra rigor comes from effort.
- **Verifier — `sonnet`/high, on both profiles.** The output contract is cheap (one JSON object), but the *analysis* isn't: the verifier has to check every spec section against real code and catch **omissions** — what the diff fails to do — which is harder than judging what's present. And the error is asymmetric: a false `FAIL` costs one loop round, while a false `PASS` silently voids the guarantee the whole loop exists for. No profile economises on the one agent whose failures are invisible.

A project that wants more than `sonnet` on the verifier buys the model back per tier:

```json
{ "profile": "balanced", "models": { "verifier": "opus" } }
```

(Model only — effort isn't settable in this file, and at `high` there is nothing left there to set.)

**On Haiku:** no profile routes to it. It stays a valid `models` override, with one constraint: **Haiku 4.5 accepts no effort level**, so any tier overridden to `haiku` runs with its frontmatter pin inert. That's not an error, but an override to `haiku` on the verifier gives up effort control entirely.

**On Fable and above:** Fable is reachable only as an override — no profile spawns it. Anthropic's model line-up names Mythos above Fable, but **it isn't available to us — Fable is the ceiling**, and `classify.mjs`'s `fable`/`opus`/`sonnet`/`haiku` validation set is complete. Don't add a `mythos` rung on the strength of a blog post or docs table: an unknown model name in `.claude/model-routing.json` degrades to the profile default with a warning rather than failing loudly, so a wrong rung reads as a working config that silently isn't. Revisit only if access actually changes.
