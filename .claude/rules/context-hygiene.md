# Context Hygiene

This repo's always-loaded surface is the product, so its own budget is the demo.

- Explain work at minimum: outcome first, 1–3 sentences. No restating plans, no step narration, no option surveys.
- Never echo file contents or tool output back into chat — reference `file:line` instead.
- Read `references/*.md` with offset/limit when only a section is needed; these files are long by design.
- New durable facts → memory files, not `CLAUDE.md`. Every `CLAUDE.md` or unscoped-rule change must pass `node tools/context_budget.mjs`.
