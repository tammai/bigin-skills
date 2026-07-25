# Agent-teams platform facts

The contract our team-mode guidance and guards are built on. **Verified against Claude Code 2.1.219** (binary build `2026-07-24`), docs page `code.claude.com/docs/en/agent-teams` as of v2.1.178+, and the upstream CHANGELOG.

Re-run the runbook below after any Claude Code minor upgrade — teams are experimental and the contract has already changed once (`TeamCreate`/`TeamDelete` existed until v2.1.178).

## Confirmed

| Fact | Source | Why we care |
|---|---|---|
| Teams are off unless `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set in `settings.json` `env` or the environment. Without it no team is created and Claude won't propose teammates | docs | The harness's `AGENT_TEAMS` decision writes exactly this |
| One implicit team per session, named `session-` + first 8 chars of the **lead's** session id | docs + on-disk | A teammate can't derive its own team dir path from its own session id |
| `~/.claude/teams/{team}/config.json` is **runtime state** — overwritten on every state update. A project-level `.claude/teams/*.json` is *not* recognized as config | docs | **Never scaffold a team file.** Teams form by prompting |
| Task list at `~/.claude/tasks/{team}/{id}.json`: `{id, subject, description, activeForm, status, blocks[], blockedBy[]}`, plus `.lock` and `.highwatermark`. `TaskUpdate` also sets `owner` | on-disk + tool schemas | Our execution tracker; `subject` carries the `PLAN.md` task id |
| Task **claiming** is file-locked. File **writes** are not locked at all | docs | The gap our ownership protocol fills — `spec-gate-guard.mjs`'s scoped mode is what stops two agents writing one file |
| Teammates share the lead's `cwd`. No per-teammate worktree on the documented spawn path; the docs' only mitigation is advisory ("break the work so each teammate owns a different set of files") | docs | File ownership has to be our mechanism |
| Teammate spawn = **Agent tool with a `name` param** (plus `mode`, `plan_mode_required`). `team_name` is accepted but ignored | CHANGELOG v2.1.178 + binary | Skills can spawn teammates programmatically |
| Subagent definition as a teammate: `tools` applied, `model` applied, body **appended** to the system prompt. `skills:` and `mcpServers:` **not** applied | docs | `standard-worker`'s `skills:` is inert as a teammate — it must invoke them via `Skill` |
| Teammates **inherit the lead's effort**; a definition's `effort:` is not applied | docs | Our per-tier effort ladder applies to subagents only |
| Teammate model resolution: `CLAUDE_CODE_SUBAGENT_MODEL` → per-call `model` → frontmatter → `teammateDefaultModel` → lead's model | binary | `model-router`'s per-spawn `model` override works unchanged |
| Teammates keep `TaskCreate`/`TaskGet`/`TaskList`/`TaskUpdate` + cron tools **even under a `tools:` allowlist**. No `TaskOutput` | docs | `verifier`'s read-only allowlist still gains task + messaging tools |
| `AskUserQuestion` is stripped from **every** subagent | docs | Human gates belong to the lead, not a spawned agent |
| Three team hooks, no `matcher`, exit 2 = block + stderr feedback: `TeammateIdle`, `TaskCreated`, `TaskCompleted`. Also accept `{"decision":"block","reason":…}` / `{"continue":false,"stopReason":…}` | docs + binary | Our enforcement surface |
| `SessionStart`, `PreToolUse`, `PostToolUse` fire **per agent**; `PreCompact` in the lead | docs | Why every teammate independently hits `session-resume-check.mjs` |
| A hook process inherits the **whole** Claude process environment — not just the documented `CLAUDE_PROJECT_DIR` / `CLAUDE_PLUGIN_ROOT` / `CLAUDE_SESSION_ID`. `CLAUDE_CODE_SESSION_ID` (this agent's own id) and `CLAUDE_EFFORT` are observable | measured, this repo | A way to test the effort claim; **not** an authorization signal |
| There is **no** teammate-name environment variable, and no `agent_name`/`teammate_name` on `PreToolUse` | measured + binary | Ownership can't be keyed by name from a `PreToolUse` hook |
| The generic hook payload is `{session_id, transcript_path, cwd, prompt_id?, permission_mode?, agent_id?, agent_type?, effort?}`. `agent_id` is documented as *"Present only when the hook fires from within a subagent … Absent for the main thread"*; `agent_type` is the **definition** name, so two teammates from one definition are indistinguishable | binary schema | **No payload field binds an actor to the teammate name the lead assigned.** This is why ownership is path-scoped, not actor-scoped |
| A team member record carries `agentId` (`name@team`), `name`, `agentType`, `cwd`, `backendType` — and **no session id** | measured | A guard holding `session_id` cannot look itself up in the roster |
| **Two teammate backends.** `teammateMode` ∈ `in-process` (default) \| `tmux` \| `iterm2` \| `auto`. Pane backends launch a child process with `--agent-name`/`--team-name`; **in-process teammates run inside the lead's OS process**, identity resolved via an async-local store | binary | Argv sniffing is unusable; and every probe must be run on **both** backends |
| Teammates **cannot** get a worktree — the teammate spawn path passes the lead's `cwd` hardcoded and returns before `isolation`/`cwd` are consulted. But plain subagents (Agent tool, **no** `name` param) *can*: `isolation: "worktree"` gives a real per-agent worktree under `.claude/worktrees/`, with in-CLI enforcement | binary, at the spawn site | The isolated alternative the skill must name up front — on that path the shared-tree defects don't exist at all |
| Task records have a `metadata` bag (`TaskUpdate` merges keys; `null` deletes) | on-disk + tool schema | Available if we ever need per-task state the description shouldn't carry |
| `.claude/plans/` is **already claimed** — a settings key sets a project-relative plan directory | binary | Our per-task plans go in `.claude/task-plans/` |
| The CLI itself bundles `proper-lockfile` (atomic `mkdir` + mtime staleness) and uses `writeFileSync(…, {flag:'wx'})` for the task-store lock | binary | Precedent if we ever do need a lock primitive in the guards — we deliberately ship none today, since path-scoped ownership makes same-file contention unrepresentable |
| Known limits: `/resume` and `/rewind` don't restore in-process teammates; no nested teams; an in-process teammate can't spawn **background** subagents (`run_in_background` errors); the lead is fixed for the session's lifetime | docs | `session-handoff` must record team state; never use `run_in_background` inside a teammate |

**"FleetView" is a different feature** — it's the internal codename for Agent View (the background-agent dashboard, `claude agents`). Agent teams are internally "swarm" (`launchSwarm`, `swarm_*` telemetry). Don't conflate them.

## Measured on a real two-teammate run

`teammateMode: "in-process"` (the default), Claude Code 2.1.219, two teammates `alpha`/`beta` spawned **without** a `subagent_type`, each editing its own file and creating + completing one task. 11 hook records.

| Finding | Evidence | Consequence |
|---|---|---|
| **`PreToolUse` fires for teammate edits** | 2 records, one per teammate | The ownership gate works on the default backend. This was the make-or-break question |
| **`agent_type` on a teammate's `PreToolUse` is the teammate's assigned *name*** — `alpha`, `beta` — and `agent_id` is `a<name>-<hash>` (`aalpha-b8a10f9ec6273187`) | 2 records | **A guard can identify the acting teammate.** Name-keyed ownership is verifiable, not self-declared — but see open question 1: these teammates carried no `subagent_type`, and for a plain subagent `agent_type` is the *definition* name |
| **All agents share the lead's `session_id`** (`51e5716f-…`, matching team `session-51e5716f`) | 11/11 records | `session_id` is **useless** as an actor discriminator. It also makes `injection-scan-guard.mjs`'s tmpdir flag **team-global**: teammate A's flag gates teammate B's next tool call, and whoever consumes it first wins |
| **Teammates do NOT fire `SessionStart`** | 1 record, the lead's only | The "N resume prompts" problem **doesn't exist** on this backend, so `session-resume-check.mjs` needs no fix. `canary-seed.mjs` also doesn't re-seed per teammate, so no sibling clobbering — but teammates never receive the canary token in context, so the trap isn't baited for them |
| Team-hook payloads populate **`task_id`, `task_subject`, `task_description`, `teammate_name`, `team_name`** on both `TaskCreated` and `TaskCompleted` | 2+2 records | Both gates can rely on `task_description` and report `teammate_name`. Still treat `teammate_name` as optional — the schema marks it so |
| `TeammateIdle` carries `teammate_name` + `team_name` + `permission_mode`; fired 4× for 2 teammates | 4 records | It fires more than once per teammate — another reason not to gate on it |
| Teammate member records now include `model`, `planModeRequired`, `prompt`, `color`, `agentType` — and still **no session field** | `config.json` | Confirms there's no roster join key by session; the join is `agent_type`/`agent_id` instead |
| The **hook** environment is lean: beyond the documented vars, only `CLAUDECODE` and `CLAUDE_ENV_FILE`. `CLAUDE_CODE_SESSION_ID` is **not** there (it is in the Bash tool's env) | 11/11 records | Guards must use the payload's `session_id`, never the env var. `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` **was** visible in 11/11, so env-var team-liveness detection works |
| `PreToolUse` also carries `effort`, `permission_mode`, `prompt_id`, `tool_use_id`; `SessionStart` carries `model` and `source` | records | Available if ever needed |

### Follow-up run: a teammate spawned from one of our definitions

Same session, one teammate requested as name `alpha` with `subagent_type: bigin-skills:standard-worker`.

| Finding | Evidence | Consequence |
|---|---|---|
| **The payload's `agent_type` is still the teammate *name*, not the definition** — `"alpha-2"`, never `"standard-worker"` | `PreToolUse: agent_type="alpha-2" agent_id="aalpha-2-b44c934e34c2e02e"` | The name binding survives definition-spawned teammates, so a guard *can* attribute an edit to a named teammate |
| **Names are silently de-duplicated.** `alpha` was already taken in that team, so the teammate became `alpha-2` | roster + payload agree | **The name the lead asks for is not guaranteed to be the name assigned.** Read the actual name back; never assume your requested name stuck — this is why authorization must not key on a name |
| **Two similarly-named fields mean different things.** The roster member's `agentType` is the *definition* (`bigin-skills:standard-worker`); the hook payload's `agent_type` is the *teammate name* | `config.json` vs payload | Don't cross-reference them as if they were the same field |
| Our plugin agents do resolve as teammate types, and the definition's `model` is applied (`model: 'sonnet'` on the member record) | roster | The roster story in `references/roster.md` holds |
| `agent_type` is **polymorphic**: teammate name for a teammate, definition name for a plain subagent | this run + docs | A gate that assumed "this is a name" would mis-fire for ordinary subagents |

### Third run: headless `claude -p` — and why it proved nothing about teams

Attempted from inside another Claude session: `claude -p --effort low --agents '{"probe-high":{…,"effort":"high"}}'` with a prompt to spawn a named teammate. It produced a working agent that edited a file and reported back, and it *looked* like a teammate. It wasn't.

| Finding | Evidence | Consequence |
|---|---|---|
| **Headless `-p` does not form a team.** Claude silently used a plain subagent instead | no `TeammateIdle`/`TaskCreated` records; no new `~/.claude/teams/` dir; `agent_id` was `ad70a0fada4e54518` (subagent format) not `a<name>-<hash>`; `agent_type` was the *definition* name `probe-high`, not the requested teammate name `probe1` | **Team facts cannot be measured headlessly.** `--report` now prints a loud warning when a log has no team events and no teammate-format ids, so a future run can't be misread the same way |
| **The payload's `effort` is an object** — `{"level":"high"}` — not a string | payload dump | Comparing raw values compares object identities. The probe now reads `effort.level`; before the fix it reported every record as a different effort |
| **`CLAUDE_EFFORT` is inherited by a child `claude` process.** Launching from inside a Claude session leaks the parent's effort, so `--effort low` did not take | env showed `high` in all records despite `--effort low` | The env var is unreliable for this test; use the **payload** `effort.level`. And run the probe from a plain terminal, not from inside a Claude session |
| A **subagent** spawned from a definition had no `AskUserQuestion` in its tool list (it reported: `Agent, Artifact, Bash, Edit, Read, Skill, ToolSearch, Write`) | teammate self-report | Corroborates the documented subagent filter. Says nothing about *teammates* — that case is still open |

**Design conclusion.** Authorization stays **path-scoped** (`Owns:` globs) — it needs no identity, is immune to the de-duplication rename, and its overlap rule doubles as the collision detector. `agent_type` is used for **attribution only**: naming the acting teammate in a block message. Keying authorization on the name would add three failure modes (rename drift, polymorphism, and a pre-authored owner that never matches) while protecting nothing that path-scoping doesn't already make unrepresentable.

**Not settled by this run:** whether teammates truly inherit the lead's effort. With one shared `session_id` there is exactly one `CLAUDE_EFFORT` value, so the comparison can't distinguish — the docs' claim stands unverified either way. Treat a definition's `effort:` as inert for teammates (the documented behavior) and don't rely on it.

## Open questions

Settle these with the runbook before writing any guard that depends on them.

Everything load-bearing is answered. What remains is optional hardening — none of it blocks the current design, which keys on nothing uncertain:

| # | Question | Status |
|---|---|---|
| 1 | Do these fields populate the same way on the **`tmux`** backend? Pane teammates are real child processes | Blocked: tmux isn't installed on this machine (`brew install tmux`). The design uses `agent_type` only for message attribution, so a divergence degrades a *message*, not a gate |
| 2 | Is `AskUserQuestion` available to a **teammate**? | Open. Confirmed absent for a *subagent* (run 3), which the docs already said. Needs one interactive teammate to settle. Design assumes **no** either way — human gates live with the lead |
| 3 | Do teammates inherit the lead's effort, or does a definition's `effort:` apply? | Open, but now **measurable**: the payload's `effort.level` is per-invocation, so it works even though teammates share one `session_id`. Needs an interactive run where the lead's effort differs from the spawned definition's — and launched from a plain terminal, since `CLAUDE_EFFORT` leaks into a nested `claude` |

**To settle 2 and 3 in one interactive session** (from a plain terminal, not inside Claude Code):

```bash
cd <scratch repo with the probe hooks>   # node tools/team-probe.mjs --settings
claude --effort low
```

Then: *"Spawn a teammate named probe1 using the bigin-skills:standard-worker agent type. Have it append a comment to alpha.ts, then tell me whether AskUserQuestion is in its tool list."* `standard-worker` declares `effort: high` while the lead runs `low`, so the payload `effort.level` on that teammate's `PreToolUse` is decisive: `low` ⇒ teammates inherit the lead (our docs are right), `high` ⇒ the definition applies (our docs are wrong and the effort ladder does reach teammates). Confirm the report does **not** print the no-team warning before believing either answer.

## Runbook

`tools/team-probe.mjs` answers 1-4 and 6 in one session. It's a hook that logs each invocation's payload keys, identity fields, and safe env vars to `.claude/team-probe.jsonl` (gitignored), plus a `--report` mode that reduces the log to answers.

**It cannot be run from inside an existing session** — the team is created at session start, so the flag has to be set *before* `claude` launches.

```bash
node tools/team-probe.mjs --settings   # print the env + hooks block
```

1. Merge that block into `.claude/settings.local.json`.
2. Start a **new** `claude` session in this repo. **Do the whole run twice** — once with `"teammateMode": "in-process"` and once with `"tmux"`. In-process is the default *and* the `auto` fallback, so it's the backend most users get; pane teammates are separate processes and may answer questions 0, 2 and 3 differently.
3. Drive a real two-teammate run, e.g.: *"Spawn two teammates named alpha and beta. Have alpha add a comment to `tools/team-probe.mjs` and beta add one to `tools/context_budget.mjs`, then both go idle."* Two teammates with **disjoint** files is the minimum that exercises per-agent `SessionStart`, `PreToolUse`, `TaskCreated`/`TaskCompleted`, and `TeammateIdle`.
4. For question 5, ask a teammate directly to use `AskUserQuestion` and record whether the tool exists for it.
5. Back in any session: `node tools/team-probe.mjs --report`.
6. Fold the answers into the Confirmed table above, note the version they were measured against, and **remove the probe hooks from `.claude/settings.local.json`** — they log every matching tool call.

The probe records values only for a small allowlist of non-secret `CLAUDE_*` vars; every other `CLAUDE_*` var is recorded by name only, so the log never captures credentials.

## Sources

- [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents) — frontmatter table, subagent tool filters, teammate carve-outs
- [Hooks reference](https://code.claude.com/docs/en/hooks) — team hook events
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference) — plugin agent frontmatter support
- [anthropics/claude-code CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) — teams from v2.1.32; v2.1.178 spawn change
