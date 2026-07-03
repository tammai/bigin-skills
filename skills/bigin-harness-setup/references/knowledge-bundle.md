# Knowledge Bundle Templates

Templates for the optional internal Knowledge Bundle convention (inspired by [Open Knowledge Format v0.1](https://openknowledgeformat.com) — we own this spec, no OKF tooling dependency). Scaffolded by `SKILL.md` Phase 5.5 when the user opts in.

Before writing, replace `{DATE}` with today's date in ISO 8601 (`YYYY-MM-DD`) in every template below.

---

## knowledge.md

```markdown
# Knowledge Bundle Rules

`knowledge/` holds domain knowledge — what the system is and why. Rules (`.claude/rules/`) hold how we work. Don't mix the two.

## Before non-trivial changes
Read `knowledge/index.md`. The one-line summaries there are usually sufficient. Open a concept file only when the index summary is insufficient for the change at hand — don't read concept files preemptively.

## Writing or updating a concept file
- One concept per file, kebab-case name, under `knowledge/<folder>/`.
- Frontmatter is required: `type` (one of Index, Contract, System, Domain, Table, Metric, Playbook, Constraint, Log), plus `title`, `description`, `tags`, `timestamp` when relevant.
- Link relationships with bundle-relative Markdown links (e.g. `/contracts/openapi-contract.md`).
- Claims from an external source get a `# Citations` section.
- Keep it under ~60 lines. Terse beats complete.

## Link, don't copy
Concept files point to sources of truth (`openapi.yaml`, `.claude/rules/`, source code) — they never duplicate that content. If you're about to paste code or a schema into `knowledge/`, link to it instead.

## Staleness
A PR that meaningfully changes behavior updates the related concept file(s) in the same PR. Add one entry to `knowledge/log.md` per sprint.

Full spec: `knowledge/meta/knowledge-bundle-spec.md`.
```

---

## knowledge/meta/knowledge-bundle-spec.md

```markdown
---
type: Constraint
title: Knowledge Bundle Spec
description: Frontmatter schema, folder layout, linking, and staleness rules for the knowledge/ bundle.
tags: [knowledge-bundle, meta, spec]
timestamp: {DATE}T00:00:00Z
---

# Knowledge Bundle Spec

Internal convention inspired by [Open Knowledge Format v0.1](https://openknowledgeformat.com). We own this spec — no OKF tooling dependency.

## Purpose
`knowledge/` answers "what the system is and why." Skills/rules (`.claude/rules/`) answer "how we work." Don't mix the two.

## Structure
- One concept per Markdown file, under `knowledge/` (the bundle root).
- **Every** `.md` file under `knowledge/` is a concept file with valid frontmatter — no freeform docs, no exceptions.
- Folders group by kind: `contracts/`, `domains/`, `constraints/`, `meta/`, etc. Add folders as needed.
- Filenames: kebab-case, singular concept per file (`openapi-contract.md`, not `contracts.md`).
- Bundle-relative links resolve against `knowledge/` (e.g. `/contracts/openapi-contract.md` = `knowledge/contracts/openapi-contract.md`).

## Frontmatter schema
Required:
- `type` — one of: `Index`, `Contract`, `System`, `Domain`, `Table`, `Metric`, `Playbook`, `Constraint`, `Log`

Recommended:
- `title`, `description`, `resource` (external URL/path this concept documents), `tags` (array), `timestamp` (ISO 8601, bumped on meaningful edits)

Extension keys are allowed but must not collide with the above.

## Linking & citations
- Relationships between concepts = bundle-relative Markdown links.
- Concept files **add context and point to sources of truth** (`openapi.yaml`, `.claude/rules/`, source code) — never duplicate their content. Link, don't copy.
- Any claim depending on an external source (paper, RFC, vendor doc, incident report) gets a `# Citations` section listing the source.

## Staleness policy
- Any PR that meaningfully changes behavior must update the related concept file(s) in the same PR.
- `knowledge/log.md` (type: Log) gets one entry per sprint summarizing what changed in the bundle.
- Concept files not linked from `knowledge/index.md` are stale by definition — the validator warns on these.

## Validation
`tools/knowledge_validate.py` enforces: valid frontmatter + `type` on every file, `type` in the allowed list, all bundle-relative links resolve, `timestamp` is valid ISO 8601 when present. Missing `description`/`tags` and index-unreachable files are warnings, not failures.
```

---

## knowledge/index.md

The index is the primary read target — one-line summaries must be self-sufficient for routine work. Open a concept file only when the summary is insufficient.

```markdown
---
type: Index
title: Knowledge Bundle Index
description: Root map of all concept files in this bundle. Read this first — summaries are self-sufficient for most changes; open a concept file only when you need more detail.
tags: [knowledge-bundle, index]
timestamp: {DATE}T00:00:00Z
---

# Knowledge Bundle

Root map of everything under `knowledge/`. Read this before non-trivial changes. Format: `- [Title](path) — one-line summary (sufficient for routine reads)`.

## Meta
- [Knowledge Bundle Spec](/meta/knowledge-bundle-spec.md) — frontmatter schema, folder layout, linking, and staleness rules

## Contracts
- [OpenAPI Contract](/contracts/openapi-contract.md) — openapi.yaml is the source of truth; FE types generated from it, breaking changes require a version bump

## Constraints
- [Agent Rules](/constraints/agent-rules.md) — what agents must check before touching handlers, migrations, or security-sensitive code

## Log
- [Bundle Log](/log.md) — one entry per sprint summarizing changes to the bundle
```

---

## knowledge/contracts/openapi-contract.md

```markdown
---
type: Contract
title: OpenAPI Contract
description: openapi.yaml is the source of truth for the API surface between frontend and backend.
resource: openapi.yaml
tags: [api, contract, openapi]
timestamp: {DATE}T00:00:00Z
---

# OpenAPI Contract

`openapi.yaml` (repo root) is the source of truth for every route, request, and response shape between the frontend and backend. See `.claude/rules/architecture.md` for the additive-first change policy.

## Rules
- Backend leads with backward-compatible (additive) changes.
- Breaking change = version bump (`/v2/`). Frontend adopts after backend ships.
- Frontend generates types from `openapi.yaml` — never hand-write response shapes.

## Drift gate
CI (or the local gate) fails if generated frontend types don't match the checked-in `openapi.yaml`. See the type-generation step in the build/CI config for the exact command.

## Citations
- `openapi.yaml` — repo root, the actual contract
- `.claude/rules/architecture.md` — dependency direction + contract policy
```

---

## knowledge/constraints/agent-rules.md

```markdown
---
type: Constraint
title: Agent Rules
description: Boundaries agents must respect in this repo, beyond what lint/tests catch.
tags: [agents, constraints, guardrails]
timestamp: {DATE}T00:00:00Z
---

# Agent Rules

## Before touching handlers/routes
Read `knowledge/contracts/openapi-contract.md` and confirm the change stays additive, or that a version bump is the explicit plan.

## Never edit a merged migration
Write a new migration instead. See `.claude/rules/conventions.md` for the migration pattern.

## Security-sensitive code
Anything touching auth, secrets, or PII goes through `.claude/rules/security.md` before merging.

## Spec-before-code
Non-trivial features need an approved spec first — see `AI_TASK_GUIDE.md`. Don't start implementation on an unapproved spec.

## Citations
- `.claude/rules/conventions.md`, `.claude/rules/security.md` — enforced rule files
- `AI_TASK_GUIDE.md` — spec gate workflow
```

---

## knowledge/log.md

```markdown
---
type: Log
title: Knowledge Bundle Log
description: One entry per sprint summarizing changes to the knowledge bundle.
tags: [knowledge-bundle, log]
timestamp: {DATE}T00:00:00Z
---

# Knowledge Bundle Log

## {DATE}
Bundle created: `index.md`, `contracts/openapi-contract.md`, `constraints/agent-rules.md`, `meta/knowledge-bundle-spec.md`. Validator added at `tools/knowledge_validate.py`.
```

---

## tools/knowledge_validate.py

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "python-frontmatter",
#     "pyyaml",
# ]
# ///
"""Validate the knowledge/ bundle: frontmatter, allowed types, link resolution, timestamps."""

import argparse
import re
import sys
from datetime import datetime
from pathlib import Path

import frontmatter
import yaml

BUNDLE_ROOT = "knowledge"

ALLOWED_TYPES = {
    "Index", "Contract", "System", "Domain", "Table",
    "Metric", "Playbook", "Constraint", "Log",
}

LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")


def iso8601(value):
    if not isinstance(value, str):
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def bundle_relative_links(content):
    links = []
    for match in LINK_RE.finditer(content):
        target = match.group(1).strip()
        if target.startswith("/"):
            links.append(target.split("#", 1)[0])
    return links


def load_bundle(root):
    files = {}
    for path in sorted(root.rglob("*.md")):
        rel = "/" + path.relative_to(root).as_posix()
        files[rel] = path
    return files


def main():
    parser = argparse.ArgumentParser(description="Validate a knowledge bundle.")
    parser.add_argument("--root", default=BUNDLE_ROOT, help=f"bundle root (default: {BUNDLE_ROOT})")
    args = parser.parse_args()

    root = Path(args.root)
    errors = []
    warnings = []

    if not root.is_dir():
        print(f"ERROR {root}: bundle root does not exist")
        return 1

    files = load_bundle(root)
    if not files:
        print(f"ERROR {root}: no .md files found in bundle")
        return 1

    parsed = {}
    index_rels = []

    for rel, path in files.items():
        try:
            post = frontmatter.load(str(path))
        except yaml.YAMLError as exc:
            errors.append(f"{path}: invalid frontmatter YAML ({exc})")
            continue

        parsed[rel] = post
        meta = post.metadata

        if "type" not in meta:
            errors.append(f"{path}: missing required frontmatter key 'type'")
        elif meta["type"] not in ALLOWED_TYPES:
            errors.append(f"{path}: type '{meta['type']}' not in allowed list ({', '.join(sorted(ALLOWED_TYPES))})")
        elif meta["type"] == "Index":
            index_rels.append(rel)

        if "timestamp" in meta and not iso8601(str(meta["timestamp"])):
            errors.append(f"{path}: timestamp '{meta['timestamp']}' is not valid ISO 8601")

        for link in bundle_relative_links(post.content):
            if link not in files:
                errors.append(f"{path}: broken link '{link}' (no file at {args.root}{link})")

        if not meta.get("description"):
            warnings.append(f"{path}: missing recommended key 'description'")
        if not meta.get("tags"):
            warnings.append(f"{path}: missing recommended key 'tags'")

    if not index_rels:
        warnings.append(f"{root}: no file with type 'Index' found — cannot check reachability")
    else:
        reachable = set(index_rels)
        stack = list(index_rels)
        while stack:
            rel = stack.pop()
            post = parsed.get(rel)
            if not post:
                continue
            for link in bundle_relative_links(post.content):
                if link in files and link not in reachable:
                    reachable.add(link)
                    stack.append(link)
        for rel in files:
            if rel not in reachable:
                warnings.append(f"{files[rel]}: not reachable from an Index file")

    for msg in errors:
        print(f"ERROR {msg}")
    for msg in warnings:
        print(f"WARN {msg}")

    if errors:
        print(f"\n{len(errors)} error(s), {len(warnings)} warning(s)")
        return 1

    print(f"\n0 errors, {len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```
