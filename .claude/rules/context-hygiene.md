# Context Hygiene

Keep the context window clean; every token in chat history is paid on every turn.

**Output discipline:**

- Explain work at minimum: outcome first, 1–3 sentences. No restating plans, no step narration, no option surveys.
- Never echo file contents or tool output back into chat — reference `file:line` instead.
- No verbose reasoning in responses; conclusions only.
- Prefer small targeted tool calls (Grep with head_limit, Read with offset/limit) so results stay small.

**Session practices:**

- Use Explore agents for open-ended searches; never dump whole large files into main context.
- Read `references/*.md` with offset/limit when only a section is needed.
- Don't re-read files already in context — the harness tracks file state.
- Run `/session-handoff` when nearing the context limit; state goes in SESSION.md, not chat.
- New durable facts → memory files, not CLAUDE.md. CLAUDE.md changes must pass `tools/context_budget.mjs`.
