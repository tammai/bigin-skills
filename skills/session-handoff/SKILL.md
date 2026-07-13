---
name: session-handoff
description: "Session handoff and state persistence. Use when: user says 'save session', '/save-session', 'near limit', 'running out of tokens', or needs to continue work in a new session. Saves current state (tasks, decisions, uncommitted changes) to SESSION.md and loads it on session resume."
effort: low
allowed-tools: Bash(git status) Bash(git diff --stat) Bash(mv SESSION.md *)
---

# session-handoff — Session State Persistence

This skill is mechanical: save state to SESSION.md or load it back. Do not deliberate — no thinking needed on any step here.

Saves and loads session state between Claude Code sessions, useful when approaching usage limits and needing to continue work later.

---

## When This Triggers

**Save session:**

- User says: "save session", "/save-session", "nearing limit", "running out of tokens"
- Or explicitly: "pause here", "save my work", "handoff"

**Load session:**

- Automatically at session start if SESSION.md exists with status: in-progress
- User says: "load session", "resume session", "continue where we left off"

**Complete session:**

- User says: "complete session", "/complete-session", "session done"
- Or after all tasks are completed and working tree is clean

---

## Session File Location

```
.claude/memory/SESSION.md
```

---

## Save Session Action

When user triggers save:

1. **Gather current state:**
   - Run `git status` to check uncommitted changes
   - Run `git diff --stat` for summary
   - Call TaskList to get all tasks with status
   - Note current branch, recent commits

2. **Write SESSION.md:**

   ```markdown
   ---
   session-id: <uuid>
   created: <ISO-timestamp>
   last-updated: <ISO-timestamp>
   status: in-progress
   ---

   # Session Handoff

   **Session saved:** <date-time>
   **Branch:** <branch-name>
   **Recent commits:** <latest commit hash: message>

   ## What We Were Working On

   <High-level summary of current task>

   ## Current State

   ### Tasks

   <Capture from TaskList with checkboxes and status>
   - [ ] Task 1 (in_progress)
   - [x] Task 2 (completed)
   - [ ] Task 3 (pending)

   ### Decisions Made

   <List key decisions with rationale>
   - **Decision 1:** <what and why>
   - **Decision 2:** <what and why>

   ### Uncommitted Changes
   ```

   <git diff --stat output>

   ```

   ### Next Steps
   1. <First next step>
   2. <Second next step>

   ## Context Notes
   <Any additional context for resumption>
   ```

3. **Return summary:**
   ```
   Session saved to SESSION.md
   Tasks: X total, Y in progress
   Uncommitted changes: <files modified>
   Resume: Next session will prompt to restore this session
   ```

---

## Load Session Action

**Triggered:** At session start (if SESSION.md exists with status: in-progress)

1. **Check for SESSION.md:**
   - Read `.claude/memory/SESSION.md`
   - If missing or status: complete, skip load

2. **Prompt user:**

   ```
   Found previous session from <date>:
   <summary from SESSION.md>

   Options:
   1. Resume session — Restore tasks and context
   2. Start fresh — Archive session and begin new
   3. View full details — Show complete SESSION.md
   ```

3. **If user resumes:**
   - Display "What We Were Working On" section
   - Display "Current State" (tasks, decisions, uncommitted changes)
   - Display "Next Steps"
   - Offer to restore task list via TaskCreate for each pending task

4. **If user starts fresh:**
   - Archive SESSION.md to SESSION.archive.<timestamp>.md
   - Remove active SESSION.md
   - Confirm: "Previous session archived. Starting fresh."

---

## Complete Session Action

When user triggers complete:

1. **Verify completion:**
   - Check git status — should be clean (no uncommitted changes)
   - Check TaskList — should have no in_progress tasks

2. **Archive session:**

   ```bash
   mv SESSION.md SESSION.archive.<timestamp>.md
   ```

3. **Confirm:**
   ```
   Session completed and archived
   Archived to: SESSION.archive.<timestamp>.md
   Ready for new session
   ```

**If not complete:**

- Warn user: "Session has uncommitted changes or in-progress tasks. Complete those first, or use /save-session to pause."

---

## SESSION.md Structure

The session file uses YAML frontmatter for metadata and markdown for content:

```yaml
---
session-id: uuid
created: ISO-8601 timestamp
last-updated: ISO-8601 timestamp
status: in-progress | complete
---
```

**Content sections:**

- What We Were Working On — high-level summary
- Current State — tasks, decisions, uncommitted changes
- Next Steps — what to do when resuming
- Context Notes — any additional context

---

## Integration with Harness Workflow

When session-handoff is used during harness execution:

**Mid-harness save (e.g., during Phase 3):**
SESSION.md includes harness-specific state:

```markdown
## Current Harness State

Phase: 3 (Stack Verification)
Project Type: Fullstack MVP
Selected Agents: architect, frontend-dev, qa
Optional Modules: auth disabled

## Progress

- [x] Phase 0: Repo detection (empty)
- [x] Phase 1: Type selection
- [x] Phase 2: Agent role selection
- [x] Phase 3: Stack verification
- [ ] Phase 4: Agent generation (NEXT)
- [ ] Phase 5: Skill install
- [ ] Phase 6: Orchestrator generation
- [ ] Phase 7: Validation
```

**On resume:**

- Harness skill reads SESSION.md
- Restores phase progress
- Continues from the next uncompleted phase

---

## Commands Reference

| Command             | Trigger                                                    | Action                            |
| ------------------- | ---------------------------------------------------------- | --------------------------------- |
| `/save-session`     | User says "save session", "/save-session", "nearing limit" | Write current state to SESSION.md |
| `/load-session`     | User says "load session", "resume session"                 | Read and display SESSION.md       |
| `/complete-session` | User says "complete session", "session done"               | Archive SESSION.md, mark complete |
| Auto-load           | Session start if SESSION.md exists                         | Prompt user: resume or fresh?     |

---

## Best Practices

1. **Save before hitting limit** — Don't wait until tokens are exhausted
2. **Include decisions in Context Notes** — Rationale is as important as outcome
3. **Keep Next Steps actionable** — Specific tasks, not vague goals
4. **Complete sessions cleanly** — Archive when done, don't leave stale sessions
5. **Verify on resume** — Check git branch and uncommitted changes match expectation
