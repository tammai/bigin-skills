# Model profiles

A profile sets both the **model** and the **effort** for each tier. Model is passed at spawn time; effort cannot be — the Agent tool has no effort parameter, so effort comes only from the spawned agent file's frontmatter. A profile that wants a tier at a non-default effort therefore routes to a different **agent**, not a different argument. `classify.mjs` resolves all three (`models`, `efforts`, `agents`) and the router spawns `routing.agents[tier]` verbatim.

## Profiles

| Profile                  | quick        | standard        | deep        | verifier        |
| ------------------------ | ------------ | --------------- | ----------- | --------------- |
| `opus-centric` (default) | `sonnet`/low | `opus`/medium   | `opus`/high | `sonnet`/high   |
| `frontier`               | `sonnet`/low | `opus`/high     | `fable`/high| `sonnet`/high   |
| `lean`                   | `sonnet`/low | `sonnet`/high   | `opus`/high | `sonnet`/medium |

`opus-centric` is the only ladder that routes the standard tier below `high`; the other two differ from each other on *model*, not on effort.

| Profile | Use when |
| --- | --- |
| `opus-centric` (default) | The cost-aware default. Standard tier matches an Opus-default session but at `medium`, leaning on the verifier round for the checking; no tier reaches for Fable's price tag. The deep tier's escalation over standard is effort (`high` vs `medium`), not a costlier model. |
| `frontier` | Everything above quick at full effort, deep on the top model. Opt in when a project's architectural calls are frequent, or when standard-tier work at `medium` has been coming back with verifier `FAIL`s often enough that paying up front beats paying per loop round. |
| `lean` | Cost-first, and it trades the *other* way: a cheaper model at fuller effort. The standard tier drops opus→sonnet but keeps `high`, buying back with thoroughness what it gives up in capability, and the verifier drops to `medium` since it's the single most-run agent in the loop. Deep still escalates to `opus` — the tier where a cheaper model actually costs you. |

**Agents per tier**, since effort determines which file gets spawned:

| Tier | `opus-centric` | `frontier` | `lean` |
| --- | --- | --- | --- |
| Quick | `quick-executor` | `quick-executor` | `quick-executor` |
| Standard | `standard-worker` | **`standard-worker-high`** | **`standard-worker-high`** |
| Deep | `deep-architect` | `deep-architect` | `deep-architect` |
| Verifier | `verifier` | `verifier` | **`verifier-medium`** |

Note that `standard-worker-high` serves `frontier` at `opus` and `lean` at `sonnet` — the variant fixes the *effort*, never the model, which still comes from `routing.models[tier]` at spawn time.

An effort variant is the same role at a different pin: its body is byte-identical to its base and its frontmatter differs only in `name` and `effort`. `tools/docs_sync.mjs --check` (pre-commit) fails the commit if either drifts, so edit the base and copy the body over — never patch a variant alone.

## Per-project config

`.claude/model-routing.json` in the target repo. Both keys optional — `profile` picks a ladder, `models` overrides individual tiers on top of it:

```json
{
  "profile": "opus-centric",
  "models": { "deep": "fable" }
}
```

Valid `profile`: `opus-centric` · `frontier` · `lean`. Valid tier keys: `quick` · `standard` · `deep` · `verifier`. Valid models: `fable` · `opus` · `sonnet` · `haiku`.

There is **no `effort` key** — it isn't settable here, because effort can only come from the spawned agent's frontmatter. Setting one produces a warning and is otherwise ignored; pick the profile whose effort ladder you want instead.

`scripts/classify.mjs` reads and resolves this file, emitting the result as `routing` in its JSON: `{profile, models, efforts, agents, source, warnings}`. `agents` is the tier → `subagent_type` map the router spawns verbatim; `efforts` is informational, for stating the pin in the routing rationale. `source` is `config` when the file was read, `default` otherwise. Every malformed input (bad JSON, unknown profile, unknown tier, unknown model) degrades to the default and is listed in `warnings` — the file can never block a routing decision. **Relay any non-empty `warnings` to the user**; a silently ignored config reads as a working config.

`bigin-harness-setup` writes this file from its Phase 1.5 `MODEL_ROUTING` decision. A project without the file gets the `opus-centric` default.

## Precedence

1. **On-demand instruction in the current request** — "run this one on fable", "use the lean ladder for this task". Wins for that spawn only; never edit `.claude/model-routing.json` to satisfy a one-off unless the user asks for the default to change.
2. **`.claude/model-routing.json`** — the project's standing choice.
3. **`opus-centric` default.**

An on-demand instruction names a *model*, not an effort level: "run this on fable at max effort" is not satisfiable at spawn time. Say so and offer the closest profile or tier instead of silently dropping the effort part. Requesting a *ladder* ("use lean here") does move effort, since that changes which agent is spawned.

## Why these effort levels

Start from the documented baseline: **`high` is the default effort on every model that supports effort** (the sole exception is Opus 4.7, which defaults to `xhigh`). Fable 5, Opus 5, and Sonnet 5 all accept the full `low`–`max` ladder. Anthropic's guidance is to *use the default* unless a failure diagnoses otherwise: a wrong answer despite full context means reach for a more capable **model**; a skipped file, unrun tests, or a refactor abandoned partway means raise **effort**. So each pin below has to earn its deviation.

**`high` is the ceiling, and that's a standing rule — no tier pins to `xhigh` or `max`, on any profile.** The checking a higher pin would buy is already supplied structurally by `task-workflow`'s implement/verify loop, which re-reads the diff against `PLAN.md` with a fresh agent — buying it twice is how you get slow, hedged output on work that didn't need it.

The pins below are the **default (`opus-centric`) ladder**. The other two deviate, and both deviations are documented in the profile table above: `frontier` raises standard to `high` (paying up front instead of per verifier round), and `lean` pairs a cheaper model with fuller effort while routing the verifier down. Only `opus-centric` runs the standard tier at `medium`, so the argument below is specifically *its* argument, not a property of the plugin.

- **Quick tier — `low`, below default.** Matches the documented use for `low`: short, scoped, latency-sensitive work that isn't intelligence-sensitive. High effort on a mechanical single-file edit produces slow, hedged output, so routing down is the point of the tier.
- **Standard tier — `medium`, below default.** The volume tier, and the deliberate route-down. Work reaching it scored 2–4: an established pattern to follow, with an approved `PLAN.md` already naming the files and the edge cases. Most of what default effort buys on that input is re-deriving decisions the plan already made. The failure mode `medium` risks — a skipped file, an unrun test — is precisely what the verifier round catches, at the cost of one loop iteration, and only on the tasks that actually miss. Raise this pin only if verifier `FAIL`s on standard-tier work become routine rather than occasional; a single bad round is the loop working, not evidence of an under-powered tier. When it *is* routine, the fix is switching that project to `frontier` (same model, standard at `high`) rather than editing this pin — the default has to hold for projects where it's working.
- **Deep tier — `high`, at default and at the ceiling.** The escalation is relative to `standard`, not to the documented baseline: this tier only receives work where a wrong structural or contract decision compounds and can't be cheaply reverted, so it gets the full default rather than the volume tier's route-down. Under `opus-centric` this effort step is the *entire* difference between deep and standard — both run `opus`, and that's the point: the diagnosis for this work is "didn't check its work," which is the effort axis, not the model axis. Projects that want the model axis too opt into `frontier`. **This tier never goes to `xhigh`** — that's a standing decision, not a default awaiting a good enough reason. Above-default effort buys hedging and overthinking on top of a verifier round that already catches the failure it targets; if deep-tier work is coming back wrong, the fix is upstream in `PLAN.md` or `.claude/rules/`, not a higher pin.
- **Verifier tier — `high`.** At the model default, deliberately. The output contract is cheap (one JSON object), but the *analysis* isn't: the verifier has to check every spec section against real code and catch **omissions** — what the diff fails to do — which is harder than judging what's present. And the error is asymmetric: a false `FAIL` costs one loop round, while a false `PASS` silently voids the guarantee the whole loop exists for. `low` would be an un-argued deviation from the default on the one agent whose failures are invisible.

**The one caveat on `lean`** is its verifier at `sonnet`/`medium`. Everything argued directly above is a reason *not* to route the verifier down, and `lean` does it anyway — knowingly, because the verifier runs on every round of every task and is the profile's largest single line item. The asymmetry doesn't disappear at `medium`; the bet is that a false `PASS` is rare enough at that pin to be worth the saving. If a project actually depends on the loop's guarantee, that's the tier to buy back first:

```json
{ "profile": "lean", "models": { "verifier": "opus" } }
```

(Model only — the `medium` pin stays, since effort isn't settable in this file. To get the verifier at `high` as well, use `opus-centric` or `frontier`.)

If you find yourself wanting to raise a tier's effort for a particular task, the guidance points upstream first: an under-specified `PLAN.md` or a missing convention in `.claude/rules/` is the more common root cause than an under-powered effort level.

**On Haiku:** no profile routes to it any more — `lean`'s quick and verifier tiers moved to `sonnet`. It stays a valid `models` override, and the constraint that made it awkward still applies: **Haiku 4.5 accepts no effort level**, so any tier overridden to `haiku` runs with its frontmatter pin inert. That's not an error, but it means an override to `haiku` on the verifier gives up effort control entirely.

**On models above Fable:** Anthropic's model line-up names Mythos above Fable, but **it isn't available to us — Fable is the ceiling.** So `fable` topping out the `frontier` ladder is the correct top rung, not a gap to close, and `classify.mjs`'s `fable`/`opus`/`sonnet`/`haiku` validation set is complete. Don't add a `mythos` rung on the strength of a blog post or docs table: an unknown model name in `.claude/model-routing.json` degrades to the profile default with a warning rather than failing loudly, so a wrong rung reads as a working config that silently isn't. Revisit only if access actually changes.
