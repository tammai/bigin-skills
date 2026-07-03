# Context Budget Gate

Script written into the target repo at `tools/context_budget.py`. Run by the pre-commit hook and on demand.

**Fails (exit 1) when:**
- `CLAUDE.md` exceeds 60 lines
- Any `.claude/rules/*.md` file with **no** `paths:` frontmatter exceeds 40 lines
- Total always-loaded content (CLAUDE.md + unscoped rule files) exceeds 12 000 chars (~3 000 tokens at 4 chars/token)

Path-scoped rule files (those with `paths:` frontmatter) are not counted against the always-loaded budget — they only load when matching files are in context.

---

## tools/context_budget.py

Write to `tools/context_budget.py`, then `chmod +x tools/context_budget.py`.

```python
#!/usr/bin/env python3
"""
Context budget gate — keeps the always-loaded harness within token budget.

Fails (exit 1) on:
  CLAUDE.md > 60 lines
  Any .claude/rules/*.md without paths: frontmatter AND > 40 lines
  Total always-loaded chars (CLAUDE.md + unscoped rules) > 12 000 (~3 000 tokens)
"""
import sys
from pathlib import Path

CLAUDE_MD_LIMIT = 60
UNSCOPED_RULE_LIMIT = 40
ALWAYS_LOADED_CHAR_LIMIT = 12_000


def has_paths_frontmatter(text: str) -> bool:
    if not text.startswith("---\n"):
        return False
    end = text.find("\n---\n", 4)
    if end == -1:
        return False
    return "paths:" in text[4:end]


errors = []
always_loaded_chars = 0

claude_md = Path("CLAUDE.md")
if claude_md.exists():
    content = claude_md.read_text(encoding="utf-8")
    lines = len(content.splitlines())
    always_loaded_chars += len(content)
    if lines > CLAUDE_MD_LIMIT:
        errors.append(f"CLAUDE.md: {lines} lines (limit: {CLAUDE_MD_LIMIT})")
else:
    print("WARN CLAUDE.md not found — skipping")

rules_dir = Path(".claude/rules")
if rules_dir.is_dir():
    for rule_file in sorted(rules_dir.glob("*.md")):
        content = rule_file.read_text(encoding="utf-8")
        if has_paths_frontmatter(content):
            continue  # path-scoped — not always loaded
        lines = len(content.splitlines())
        always_loaded_chars += len(content)
        if lines > UNSCOPED_RULE_LIMIT:
            errors.append(
                f"{rule_file}: {lines} lines, no paths: frontmatter (limit: {UNSCOPED_RULE_LIMIT})"
            )
else:
    print("WARN .claude/rules/ not found — skipping rule checks")

if always_loaded_chars > ALWAYS_LOADED_CHAR_LIMIT:
    est_tokens = always_loaded_chars // 4
    limit_tokens = ALWAYS_LOADED_CHAR_LIMIT // 4
    errors.append(
        f"Always-loaded: {always_loaded_chars} chars (~{est_tokens} tokens) "
        f"exceeds limit of {ALWAYS_LOADED_CHAR_LIMIT} chars (~{limit_tokens} tokens)"
    )

if errors:
    for e in errors:
        print(f"ERROR {e}")
    print(f"\n{len(errors)} context budget violation(s). Fix before committing.")
    sys.exit(1)

est = always_loaded_chars // 4
print(f"OK always-loaded: {always_loaded_chars} chars (~{est} tokens) — within budget")
```
