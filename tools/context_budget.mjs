#!/usr/bin/env node
// Context budget gate — keeps the always-loaded harness within token budget.
//
// Fails (exit 1) on:
//   CLAUDE.md > 60 lines
//   Any .claude/rules/*.md without paths: frontmatter AND > 40 lines
//   Any skills/*/SKILL.md description: > 350 chars
//   Total always-loaded chars (CLAUDE.md + unscoped rules + skill descriptions) > 12 000 (~3 000 tokens)
//
// Skill `description:` frontmatter counts because it is injected for every skill on
// every turn — the same always-loaded surface as CLAUDE.md, just spread across files.
// The skills/ scan no-ops in repos that don't author skills.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CLAUDE_MD_LIMIT = 60;
const UNSCOPED_RULE_LIMIT = 40;
const SKILL_DESCRIPTION_LIMIT = 350;
const ALWAYS_LOADED_CHAR_LIMIT = 12_000;

// Pulls `description:` out of YAML frontmatter, following indented continuation
// lines so a wrapped multi-line description is measured whole, not just its first line.
function readDescription(text) {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return null;
  const lines = text.slice(4, end).split("\n");
  const start = lines.findIndex((l) => /^description:/.test(l));
  if (start === -1) return null;
  const parts = [lines[start].replace(/^description:\s*/, "")];
  for (let i = start + 1; i < lines.length && /^\s+\S/.test(lines[i]); i++) {
    parts.push(lines[i].trim());
  }
  return parts.join(" ").trim();
}

function hasPathsFrontmatter(text) {
  if (!text.startsWith("---\n")) return false;
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return false;
  return text.slice(4, end).includes("paths:");
}

function countLines(text) {
  if (text === "") return 0;
  return text.replace(/\n$/, "").split("\n").length;
}

const errors = [];
let alwaysLoadedChars = 0;

if (existsSync("CLAUDE.md")) {
  const content = readFileSync("CLAUDE.md", "utf-8");
  const lines = countLines(content);
  alwaysLoadedChars += content.length;
  if (lines > CLAUDE_MD_LIMIT) {
    errors.push(`CLAUDE.md: ${lines} lines (limit: ${CLAUDE_MD_LIMIT})`);
  }
} else {
  console.log("WARN CLAUDE.md not found — skipping");
}

const rulesDir = ".claude/rules";
if (existsSync(rulesDir)) {
  const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith(".md")).sort();
  for (const name of ruleFiles) {
    const ruleFile = join(rulesDir, name);
    const content = readFileSync(ruleFile, "utf-8");
    if (hasPathsFrontmatter(content)) continue; // path-scoped — not always loaded
    const lines = countLines(content);
    alwaysLoadedChars += content.length;
    if (lines > UNSCOPED_RULE_LIMIT) {
      errors.push(`${ruleFile}: ${lines} lines, no paths: frontmatter (limit: ${UNSCOPED_RULE_LIMIT})`);
    }
  }
} else {
  console.log("WARN .claude/rules/ not found — skipping rule checks");
}

for (const root of ["skills", ".claude/skills"]) {
  if (!existsSync(root)) continue;
  const skillDirs = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, "SKILL.md")))
    .map((d) => d.name)
    .sort();
  for (const name of skillDirs) {
    const skillFile = join(root, name, "SKILL.md");
    const description = readDescription(readFileSync(skillFile, "utf-8"));
    if (description === null) {
      errors.push(`${skillFile}: no description: in frontmatter — the skill will never trigger`);
      continue;
    }
    alwaysLoadedChars += description.length;
    if (description.length > SKILL_DESCRIPTION_LIMIT) {
      errors.push(
        `${skillFile}: description is ${description.length} chars (limit: ${SKILL_DESCRIPTION_LIMIT}) — always loaded, every turn`
      );
    }
  }
}

if (alwaysLoadedChars > ALWAYS_LOADED_CHAR_LIMIT) {
  const estTokens = Math.floor(alwaysLoadedChars / 4);
  const limitTokens = Math.floor(ALWAYS_LOADED_CHAR_LIMIT / 4);
  errors.push(
    `Always-loaded: ${alwaysLoadedChars} chars (~${estTokens} tokens) ` +
      `exceeds limit of ${ALWAYS_LOADED_CHAR_LIMIT} chars (~${limitTokens} tokens)`
  );
}

if (errors.length > 0) {
  for (const e of errors) console.log(`ERROR ${e}`);
  console.log(`\n${errors.length} context budget violation(s). Fix before committing.`);
  process.exit(1);
}

const est = Math.floor(alwaysLoadedChars / 4);
console.log(`OK always-loaded: ${alwaysLoadedChars} chars (~${est} tokens) — within budget`);
