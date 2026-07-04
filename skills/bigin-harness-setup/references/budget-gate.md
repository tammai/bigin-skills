# Context Budget Gate

Script written into the target repo at `tools/context_budget.mjs`. Run by the pre-commit hook and on demand. Node (`.mjs`) so it runs on macOS, Linux, and Windows.

**Fails (exit 1) when:**
- `CLAUDE.md` exceeds 60 lines
- Any `.claude/rules/*.md` file with **no** `paths:` frontmatter exceeds 40 lines
- Total always-loaded content (CLAUDE.md + unscoped rule files) exceeds 12 000 chars (~3 000 tokens at 4 chars/token)

Path-scoped rule files (those with `paths:` frontmatter) are not counted against the always-loaded budget — they only load when matching files are in context.

---

## tools/context_budget.mjs

Write to `tools/context_budget.mjs`, then `chmod +x tools/context_budget.mjs`.

```javascript
#!/usr/bin/env node
// Context budget gate — keeps the always-loaded harness within token budget.
//
// Fails (exit 1) on:
//   CLAUDE.md > 60 lines
//   Any .claude/rules/*.md without paths: frontmatter AND > 40 lines
//   Total always-loaded chars (CLAUDE.md + unscoped rules) > 12 000 (~3 000 tokens)
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const CLAUDE_MD_LIMIT = 60
const UNSCOPED_RULE_LIMIT = 40
const ALWAYS_LOADED_CHAR_LIMIT = 12_000

function hasPathsFrontmatter(text) {
  if (!text.startsWith('---\n')) return false
  const end = text.indexOf('\n---\n', 4)
  if (end === -1) return false
  return text.slice(4, end).includes('paths:')
}

function countLines(text) {
  if (text === '') return 0
  return text.replace(/\n$/, '').split('\n').length
}

const errors = []
let alwaysLoadedChars = 0

if (existsSync('CLAUDE.md')) {
  const content = readFileSync('CLAUDE.md', 'utf-8')
  const lines = countLines(content)
  alwaysLoadedChars += content.length
  if (lines > CLAUDE_MD_LIMIT) {
    errors.push(`CLAUDE.md: ${lines} lines (limit: ${CLAUDE_MD_LIMIT})`)
  }
} else {
  console.log('WARN CLAUDE.md not found — skipping')
}

const rulesDir = '.claude/rules'
if (existsSync(rulesDir)) {
  const ruleFiles = readdirSync(rulesDir).filter(f => f.endsWith('.md')).sort()
  for (const name of ruleFiles) {
    const ruleFile = join(rulesDir, name)
    const content = readFileSync(ruleFile, 'utf-8')
    if (hasPathsFrontmatter(content)) continue // path-scoped — not always loaded
    const lines = countLines(content)
    alwaysLoadedChars += content.length
    if (lines > UNSCOPED_RULE_LIMIT) {
      errors.push(`${ruleFile}: ${lines} lines, no paths: frontmatter (limit: ${UNSCOPED_RULE_LIMIT})`)
    }
  }
} else {
  console.log('WARN .claude/rules/ not found — skipping rule checks')
}

if (alwaysLoadedChars > ALWAYS_LOADED_CHAR_LIMIT) {
  const estTokens = Math.floor(alwaysLoadedChars / 4)
  const limitTokens = Math.floor(ALWAYS_LOADED_CHAR_LIMIT / 4)
  errors.push(
    `Always-loaded: ${alwaysLoadedChars} chars (~${estTokens} tokens) `
    + `exceeds limit of ${ALWAYS_LOADED_CHAR_LIMIT} chars (~${limitTokens} tokens)`
  )
}

if (errors.length > 0) {
  for (const e of errors) console.log(`ERROR ${e}`)
  console.log(`\n${errors.length} context budget violation(s). Fix before committing.`)
  process.exit(1)
}

const est = Math.floor(alwaysLoadedChars / 4)
console.log(`OK always-loaded: ${alwaysLoadedChars} chars (~${est} tokens) — within budget`)
```
