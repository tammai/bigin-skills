#!/usr/bin/env node
// Context budget gate — keeps the always-loaded harness within token budget, per host.
//
// Fails (exit 1) on:
//   CLAUDE.md or AGENTS.md > 60 lines
//   Any .claude/rules/*.md without paths: frontmatter AND > 40 lines
//   Any always-applied .cursor/rules/*.mdc (no globs:, or alwaysApply: true) AND > 40 lines
//   Any skills/*/SKILL.md or agents/*.md description: > 350 chars
//   Either host's always-loaded total > 12 000 chars (~3 000 tokens)
//   CLAUDE.md missing — the gate resolves paths from the repo root, never the cwd, so
//   a missing brief means a broken checkout, not a subdirectory run
//
// Claude Code loads CLAUDE.md + unscoped .claude/rules/; Cursor loads AGENTS.md +
// always-applied .cursor/rules/. Skill descriptions count toward BOTH: Cursor discovers
// skills from Claude's directories as well as its own. The two totals are capped
// separately because only one of them loads per session.
//
// Skill `description:` frontmatter counts because it is injected for every skill on
// every turn — the same always-loaded surface as CLAUDE.md, just spread across files.
// Agent descriptions (agents/, .claude/agents/) count for the same reason: every one is
// listed with the Agent tool in every session. A `disable-model-invocation: true` skill
// is the exception — it is reachable only as /name and never listed — so it is capped
// but not counted.
// The skills/ scan no-ops in repos that don't author skills, and the Cursor checks
// no-op in repos with no mirror. Keep in sync with the templated copy in
// skills/bigin-harness-setup/references/budget-gate.md.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Paths resolve from the repo root (this file lives in tools/), not the cwd: run from a
// subdirectory, a cwd-relative gate finds nothing, measures nothing and exits 0.
process.chdir(fileURLToPath(new URL("..", import.meta.url)));

// CRLF-normalised: a Windows checkout under core.autocrlf=true would otherwise defeat
// every "---\n" frontmatter match below and count every scoped rule as unscoped.
const read = (file) => readFileSync(file, "utf-8").replace(/\r\n/g, "\n");

const BRIEF_LIMIT = 60;
const UNSCOPED_RULE_LIMIT = 40;
const SKILL_DESCRIPTION_LIMIT = 350;
const ALWAYS_LOADED_CHAR_LIMIT = 12_000;

function frontmatter(text) {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return null;
  return text.slice(4, end);
}

// Pulls `description:` out of YAML frontmatter, following indented continuation
// lines so a wrapped multi-line description is measured whole, not just its first line.
// Blank lines are followed too when more indented text comes after them: a `>` or `|`
// block scalar with a paragraph break is one value, and stopping at the break would
// let a 500-char description pass as its first paragraph.
function readDescription(text) {
  const fm = frontmatter(text);
  if (fm === null) return null;
  const lines = fm.split("\n");
  const start = lines.findIndex((l) => /^description:/.test(l));
  if (start === -1) return null;
  const head = lines[start].replace(/^description:\s*/, "");
  const block = /^[|>][+-]?[1-9]?[+-]?\s*$/.test(head);
  const parts = block ? [] : [head];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s+\S/.test(lines[i])) { parts.push(lines[i].trim()); continue; }
    if (lines[i].trim() !== "") break;
    const next = lines.slice(i + 1).find((l) => l.trim() !== "");
    if (next === undefined || !/^\s/.test(next)) break;
    parts.push("");
  }
  return parts.join(block && head[0] === "|" ? "\n" : " ").replace(/ ?\n? ?$/, "").trim();
}

function isUserOnly(text) {
  return /^disable-model-invocation:\s*(true|yes|on)\s*$/im.test(frontmatter(text) ?? "");
}

// Claude Code scoping: a `paths:` list in frontmatter.
function isScopedRule(text) {
  return (frontmatter(text) ?? "").includes("paths:");
}

// Cursor scoping: a `globs:` line, unless alwaysApply: true overrides it.
function isScopedMdc(text) {
  const fm = frontmatter(text) ?? "";
  if (/^alwaysApply:\s*true/m.test(fm)) return false;
  return /^globs:/m.test(fm);
}

function countLines(text) {
  if (text === "") return 0;
  return text.replace(/\n$/, "").split("\n").length;
}

const errors = [];
const totals = { claude: 0, cursor: 0 };

// Is Cursor parity actually installed? Skill descriptions are always-loaded on both
// hosts, but attributing them to Cursor in a repo with no mirror would invent a second
// budget line out of nothing.
const cursorInstalled = existsSync("AGENTS.md") || existsSync(".cursor/rules");

// The brief. CLAUDE.md is canonical and what Claude Code loads; AGENTS.md is its
// generated mirror and what Cursor loads. A repo without Cursor parity skips that half.
for (const [file, host] of [
  ["CLAUDE.md", "claude"],
  ["AGENTS.md", "cursor"],
]) {
  if (!existsSync(file)) {
    if (host === "claude") errors.push("CLAUDE.md not found at the repo root — nothing to measure, so nothing passes");
    continue;
  }
  const content = read(file);
  const lines = countLines(content);
  totals[host] += content.length;
  if (lines > BRIEF_LIMIT) {
    errors.push(`${file}: ${lines} lines (limit: ${BRIEF_LIMIT})`);
  }
}

const RULE_TREES = [
  { dir: ".claude/rules", ext: ".md", host: "claude", scoped: isScopedRule, why: "no paths: frontmatter" },
  { dir: ".cursor/rules", ext: ".mdc", host: "cursor", scoped: isScopedMdc, why: "no globs:, or alwaysApply: true" },
];

for (const tree of RULE_TREES) {
  if (!existsSync(tree.dir)) {
    if (tree.host === "claude") console.log("WARN .claude/rules/ not found — skipping rule checks");
    continue;
  }
  const files = readdirSync(tree.dir).filter((f) => f.endsWith(tree.ext)).sort();
  for (const name of files) {
    const ruleFile = join(tree.dir, name);
    const content = read(ruleFile);
    if (tree.scoped(content)) continue; // path-scoped — not always loaded
    const lines = countLines(content);
    totals[tree.host] += content.length;
    if (lines > UNSCOPED_RULE_LIMIT) {
      errors.push(`${ruleFile}: ${lines} lines, ${tree.why} (limit: ${UNSCOPED_RULE_LIMIT})`);
    }
  }
}

// Skill and agent descriptions are always-loaded on both hosts — Cursor reads Claude's
// skill and agent directories too.
const DESCRIBED = [];
for (const root of ["skills", ".claude/skills"]) {
  if (!existsSync(root)) continue;
  for (const d of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (d.isDirectory() && existsSync(join(root, d.name, "SKILL.md"))) DESCRIBED.push(["skill", join(root, d.name, "SKILL.md")]);
  }
}
for (const root of ["agents", ".claude/agents"]) {
  if (!existsSync(root)) continue;
  for (const f of readdirSync(root).filter((f) => f.endsWith(".md")).sort()) DESCRIBED.push(["agent", join(root, f)]);
}
for (const [kind, file] of DESCRIBED) {
  const text = read(file);
  const description = readDescription(text);
  if (description === null) {
    errors.push(`${file}: no description: in frontmatter — the ${kind} will never be selected`);
    continue;
  }
  if (description.length > SKILL_DESCRIPTION_LIMIT) {
    errors.push(
      `${file}: description is ${description.length} chars (limit: ${SKILL_DESCRIPTION_LIMIT}) — always loaded, every turn`
    );
  }
  if (kind === "skill" && isUserOnly(text)) continue; // /name only — never listed, so never loaded
  totals.claude += description.length;
  if (cursorInstalled) totals.cursor += description.length;
}

const LABELS = {
  claude: "Claude Code (CLAUDE.md + unscoped .claude/rules/ + skill and agent descriptions)",
  cursor: "Cursor (AGENTS.md + always-applied .cursor/rules/ + skill and agent descriptions)",
};

const est = (chars) => Math.floor(chars / 4);
const limitTokens = est(ALWAYS_LOADED_CHAR_LIMIT);

for (const [host, chars] of Object.entries(totals)) {
  if (host === "cursor" && !cursorInstalled) continue;
  if (chars > ALWAYS_LOADED_CHAR_LIMIT) {
    errors.push(
      `${LABELS[host]}: ${chars} chars (~${est(chars)} tokens) ` +
        `exceeds limit of ${ALWAYS_LOADED_CHAR_LIMIT} chars (~${limitTokens} tokens)`
    );
  }
}

if (errors.length > 0) {
  for (const e of errors) console.log(`ERROR ${e}`);
  console.log(`\n${errors.length} context budget violation(s). Fix before committing.`);
  process.exit(1);
}

for (const [host, chars] of Object.entries(totals)) {
  if (chars === 0 || (host === "cursor" && !cursorInstalled)) continue;
  console.log(`OK ${LABELS[host]}: ${chars} chars (~${est(chars)} tokens) — within budget`);
}
if (totals.claude > 0 && cursorInstalled) {
  const both = totals.claude + totals.cursor;
  console.log(`   (a client that loads CLAUDE.md and AGENTS.md together would see ${both} chars / ~${est(both)} tokens)`);
}
