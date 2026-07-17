#!/usr/bin/env node
// Docs-sync generator — regenerates the skills/agents inventory tables in
// CLAUDE.md and README.md from the filesystem (skills/*/SKILL.md dirs,
// agents/*.md frontmatter) plus tools/docs-manifest.json (presentation-only:
// group + one-line summary per skill/agent). Fails closed (exit 1) on any
// skill<->manifest or agent<->manifest mismatch so a new skill/agent can't
// silently go undocumented, and on any marker problem (missing/duplicate)
// or unparseable agent frontmatter.
//
// Modes:
//   node tools/docs_sync.mjs            regenerate every marked region in place
//   node tools/docs_sync.mjs --check    regenerate to memory, diff vs disk,
//                                        exit 1 listing stale regions, no writes
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CHECK = process.argv.includes("--check");
const SUMMARY_LIMIT = 160;

function fail(message) {
  console.log(`ERROR ${message}`);
  process.exit(1);
}

function readManifest() {
  const path = "tools/docs-manifest.json";
  if (!existsSync(path)) fail(`${path} not found`);
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    fail(`${path} is not valid JSON: ${e.message}`);
  }
}

function listSkillDirs() {
  if (!existsSync("skills")) return [];
  return readdirSync("skills", { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join("skills", d.name, "SKILL.md")))
    .map((d) => d.name);
}

function listAgentFiles() {
  if (!existsSync("agents")) return [];
  return readdirSync("agents")
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

function parseFrontmatter(text, filePath) {
  if (!text.startsWith("---\n")) fail(`${filePath}: missing frontmatter`);
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) fail(`${filePath}: unterminated frontmatter`);
  const block = text.slice(4, end);
  const fm = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].trim();
  }
  return fm;
}

function validateSummary(summary, key) {
  if (typeof summary !== "string" || summary.length === 0) fail(`manifest entry "${key}": summary missing`);
  if (summary.includes("\n")) fail(`manifest entry "${key}": summary must be a single line`);
  if (summary.length > SUMMARY_LIMIT) fail(`manifest entry "${key}": summary exceeds ${SUMMARY_LIMIT} chars (${summary.length})`);
}

// --- load + cross-check (fail closed both directions) ---

const manifest = readManifest();
const groups = manifest.groups ?? {};

const skillDirs = listSkillDirs();
const manifestSkills = Object.keys(manifest.skills ?? {});

for (const dir of skillDirs) {
  if (!manifestSkills.includes(dir)) fail(`skills/${dir}/SKILL.md exists but has no tools/docs-manifest.json entry — add one under "skills"`);
}
for (const key of manifestSkills) {
  if (!skillDirs.includes(key)) fail(`tools/docs-manifest.json has a "skills" entry for "${key}" but skills/${key}/SKILL.md does not exist — remove the entry`);
}
for (const key of manifestSkills) {
  const entry = manifest.skills[key];
  validateSummary(entry.summary, key);
  if (!entry.group || !(entry.group in groups)) fail(`manifest entry "${key}": group "${entry.group}" is not defined in "groups"`);
}

const agentFiles = listAgentFiles();
const manifestAgents = Object.keys(manifest.agents ?? {});

for (const name of agentFiles) {
  if (!manifestAgents.includes(name)) fail(`agents/${name}.md exists but has no tools/docs-manifest.json entry — add one under "agents"`);
}
for (const key of manifestAgents) {
  if (!agentFiles.includes(key)) fail(`tools/docs-manifest.json has an "agents" entry for "${key}" but agents/${key}.md does not exist — remove the entry`);
}
for (const key of manifestAgents) {
  validateSummary(manifest.agents[key].summary, key);
}

const agentFrontmatter = {};
for (const name of agentFiles) {
  const text = readFileSync(join("agents", `${name}.md`), "utf-8");
  agentFrontmatter[name] = parseFrontmatter(text, `agents/${name}.md`);
}

// --- table builders ---

function padRow(cells, widths) {
  return "| " + cells.map((c, i) => c.padEnd(widths[i])).join(" | ") + " |";
}

function buildTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const lines = [padRow(headers, widths), padRow(widths.map((w) => "-".repeat(w)), widths)];
  for (const r of rows) lines.push(padRow(r, widths));
  return lines.join("\n");
}

function skillsFlatTable() {
  const rows = manifestSkills.map((key) => [`\`${key}\``, manifest.skills[key].summary]);
  return buildTable(["Skill", "Purpose"], rows);
}

function skillsGroupTable(group) {
  const rows = manifestSkills
    .filter((key) => manifest.skills[key].group === group)
    .map((key) => [`**${key}**`, manifest.skills[key].summary]);
  return buildTable(["Skill", "Purpose"], rows);
}

function agentsTable() {
  const rows = manifestAgents.map((key) => {
    const fm = agentFrontmatter[key];
    if (!fm.model || !fm.effort) fail(`agents/${key}.md: frontmatter missing model or effort`);
    return [`\`${key}\``, `${fm.model}/${fm.effort} — ${manifest.agents[key].summary}`];
  });
  return buildTable(["Agent", "Purpose"], rows);
}

const REGIONS = [
  { name: "gen:skills-table", file: "CLAUDE.md", render: skillsFlatTable },
  { name: "gen:agents-table", file: "CLAUDE.md", render: agentsTable },
  { name: "gen:skills-core", file: "README.md", render: () => skillsGroupTable("core") },
  { name: "gen:skills-handoff", file: "README.md", render: () => skillsGroupTable("handoff") },
  { name: "gen:skills-addon", file: "README.md", render: () => skillsGroupTable("addon") },
];

// --- marker replacement ---

function replaceRegion(content, regionName, rendered, filePath) {
  const openTag = `<!-- ${regionName} -->`;
  const closeTag = `<!-- /${regionName} -->`;
  const openIdx = content.indexOf(openTag);
  if (openIdx === -1) fail(`${filePath}: marker ${openTag} not found`);
  const secondOpenIdx = content.indexOf(openTag, openIdx + openTag.length);
  if (secondOpenIdx !== -1) fail(`${filePath}: duplicate marker ${openTag}`);
  const closeIdx = content.indexOf(closeTag, openIdx);
  if (closeIdx === -1) fail(`${filePath}: marker ${closeTag} not found (or precedes ${openTag})`);
  const before = content.slice(0, openIdx + openTag.length);
  const after = content.slice(closeIdx);
  return `${before}\n${rendered}\n${after}`;
}

// --- apply per file ---

const byFile = {};
for (const region of REGIONS) {
  (byFile[region.file] ??= []).push(region);
}

let anyStale = false;
const summaries = [];

for (const [filePath, regions] of Object.entries(byFile)) {
  if (!existsSync(filePath)) fail(`${filePath} not found`);
  const original = readFileSync(filePath, "utf-8");
  let content = original;
  for (const region of regions) {
    content = replaceRegion(content, region.name, region.render(), filePath);
  }
  if (content !== original) {
    if (CHECK) {
      anyStale = true;
      console.log(`STALE ${filePath}: regenerated content differs from disk`);
    } else {
      writeFileSync(filePath, content, "utf-8");
      summaries.push(`${filePath}: regenerated`);
    }
  } else {
    summaries.push(`${filePath}: already fresh`);
  }
}

if (CHECK) {
  if (anyStale) {
    console.log("\ndocs_sync --check found stale generated regions. Run: node tools/docs_sync.mjs");
    process.exit(1);
  }
  console.log("OK all generated regions are fresh");
  process.exit(0);
}

for (const s of summaries) console.log(s);
