#!/usr/bin/env node
// Docs-sync generator — regenerates the skills/agents inventory tables in
// README.md from the filesystem (skills/*/SKILL.md dirs,
// agents/*.md frontmatter) plus tools/docs-manifest.json (presentation-only:
// group + one-line summary per skill, summary + spawner per agent). Fails closed (exit 1) on any
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
// Every skill carries should-trigger/should-not-trigger cases. Gated rather than
// conventional because it regressed three times: a new skill ships, nothing fails,
// and the gap only surfaces at the next audit.
for (const dir of skillDirs) {
  const evals = `skills/${dir}/evals/evals.json`;
  if (!existsSync(evals)) fail(`${evals} not found — every skill needs should-trigger/should-not-trigger cases`);
  let cases;
  try {
    cases = JSON.parse(readFileSync(evals, "utf-8"));
  } catch (e) {
    fail(`${evals} is not valid JSON: ${e.message}`);
  }
  if (!Array.isArray(cases) || cases.length === 0) fail(`${evals}: expected a non-empty array of cases`);
  for (const [i, c] of cases.entries()) {
    if (typeof c?.query !== "string" || c.query.length === 0) fail(`${evals}[${i}]: "query" must be a non-empty string`);
    if (typeof c?.should_trigger !== "boolean") fail(`${evals}[${i}]: "should_trigger" must be a boolean`);
  }
  if (!cases.some(c => c.should_trigger)) fail(`${evals}: no should_trigger:true case — the skill would never be exercised`);
  if (!cases.some(c => !c.should_trigger)) fail(`${evals}: no should_trigger:false case — nothing checks over-triggering`);
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
  validateSummary(manifest.agents[key].routed, `${key}.routed`);
}

const agentFrontmatter = {};
const agentRaw = {};
const agentBody = {};
for (const name of agentFiles) {
  const text = readFileSync(join("agents", `${name}.md`), "utf-8");
  agentFrontmatter[name] = parseFrontmatter(text, `agents/${name}.md`);
  const end = text.indexOf("\n---\n", 4);
  agentRaw[name] = text.slice(4, end);
  agentBody[name] = text.slice(end + 5);
}

// --- routing ladder + effort-variant parity ---
//
// Effort can only come from an agent file's frontmatter (the Agent tool has no effort
// parameter), so a routing profile that wants a tier at a different effort needs its own
// agent file. Three things have to hold, and none of them fail loudly at runtime — a
// missing agent resolves to `null` and the router spawns nothing useful, and a drifted
// variant just quietly behaves differently from its base. So they're gated here.
//
// The ladder tables are imported, not restated: a second copy would be one more thing to
// keep in sync by hand, which is the failure this gate exists to prevent.
const { DEFAULT_PROFILE, EFFORTS, AGENTS } = await import("../skills/model-router/scripts/classify.mjs");

// 1. Every (profile, tier) effort the ladder can resolve to has an agent that carries it.
for (const [profile, tiers] of Object.entries(EFFORTS)) {
  for (const [tier, effort] of Object.entries(tiers)) {
    if (!AGENTS[tier]?.[effort]) {
      fail(
        `classify.mjs: profile "${profile}" pins the ${tier} tier at "${effort}", but AGENTS.${tier} has no agent for that effort — ` +
          `routing.agents.${tier} would resolve to null. Add the variant file and its AGENTS entry.`
      );
    }
  }
}

// 2. Every agent the ladder can name exists on disk.
for (const [tier, byEffort] of Object.entries(AGENTS)) {
  for (const [effort, name] of Object.entries(byEffort)) {
    if (!agentFiles.includes(name)) fail(`classify.mjs: AGENTS.${tier}.${effort} names "${name}" but agents/${name}.md does not exist`);
    if (agentFrontmatter[name].effort !== effort) {
      fail(
        `agents/${name}.md pins effort "${agentFrontmatter[name].effort}" but classify.mjs maps it to "${effort}" — ` +
          `the ladder would promise an effort the spawned agent doesn't carry`
      );
    }
  }
}

// 3. Each tier's non-default agents are effort variants of the default-profile one:
//    byte-identical bodies, frontmatter differing only in `name` and `effort`.
for (const [tier, byEffort] of Object.entries(AGENTS)) {
  const base = byEffort[EFFORTS[DEFAULT_PROFILE][tier]];
  for (const variant of Object.values(byEffort)) {
    if (variant === base) continue;
    if (agentBody[variant] !== agentBody[base]) {
      fail(
        `agents/${variant}.md body has drifted from agents/${base}.md — effort variants are the same role at a different pin. ` +
          `Edit ${base}.md, then copy its body verbatim into ${variant}.md.`
      );
    }
    // Raw frontmatter, not the parsed map: parseFrontmatter drops list values
    // (`skills:` and its indented items), so a parsed comparison would let a
    // difference in the variant's preloaded skills through unnoticed.
    const strip = (raw) => raw.split("\n").filter((l) => !/^(name|effort):/.test(l)).join("\n");
    if (strip(agentRaw[variant]) !== strip(agentRaw[base])) {
      fail(`agents/${variant}.md frontmatter differs from agents/${base}.md beyond name/effort — variants may differ only in those two`);
    }
  }
}

// --- plugin manifest parity (Claude Code <-> Cursor) ---
//
// The repo ships as a plugin to two hosts, each with its own manifest format:
// .claude-plugin/{plugin,marketplace}.json and .cursor-plugin/{plugin,marketplace}.json.
// Four files now carry the version and three carry the description, and nothing at
// runtime complains when they disagree — a Cursor user just silently installs a plugin
// stamped with last release's version. So the shared fields are gated here.
//
// Only genuinely shared fields are compared. The two schemas differ on purpose
// (Cursor's manifest declares skills/agents paths; Claude Code's declares neither), and
// keyword lists are allowed to diverge since each host's marketplace surfaces them
// differently — the Cursor list is deliberately the shorter, less stack-specific one.
function readJson(path) {
  if (!existsSync(path)) fail(`${path} not found`);
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    fail(`${path} is not valid JSON: ${e.message}`);
  }
}

const claudePlugin = readJson(".claude-plugin/plugin.json");
const cursorPlugin = readJson(".cursor-plugin/plugin.json");
const claudeMarket = readJson(".claude-plugin/marketplace.json");
const cursorMarket = readJson(".cursor-plugin/marketplace.json");

const VERSION = claudePlugin.version;
if (!/^\d+\.\d+\.\d+$/.test(VERSION ?? "")) {
  fail(`.claude-plugin/plugin.json: version "${VERSION}" is not semver — it is the source of truth for every other manifest`);
}

const versioned = [
  [".cursor-plugin/plugin.json", cursorPlugin.version],
  [".cursor-plugin/marketplace.json → metadata.version", cursorMarket.metadata?.version],
  [".cursor-plugin/marketplace.json → plugins[0].version", cursorMarket.plugins?.[0]?.version],
];
for (const [where, version] of versioned) {
  if (version !== VERSION) {
    fail(`${where} is "${version}" but .claude-plugin/plugin.json is "${VERSION}" — bump every manifest together`);
  }
}

if (cursorPlugin.name !== claudePlugin.name) {
  fail(`.cursor-plugin/plugin.json name "${cursorPlugin.name}" differs from .claude-plugin/plugin.json "${claudePlugin.name}"`);
}
if (cursorMarket.plugins?.[0]?.name !== claudePlugin.name) {
  fail(`.cursor-plugin/marketplace.json plugins[0].name must be "${claudePlugin.name}"`);
}
if (cursorMarket.name !== claudeMarket.name) {
  fail(`.cursor-plugin/marketplace.json name "${cursorMarket.name}" differs from .claude-plugin/marketplace.json "${claudeMarket.name}"`);
}

// Cursor resolves skills/agents through declared manifest paths rather than by
// convention, so a renamed or moved directory silently ships an empty plugin.
for (const [field, dir] of [["skills", cursorPlugin.skills], ["agents", cursorPlugin.agents]]) {
  if (typeof dir !== "string") fail(`.cursor-plugin/plugin.json: "${field}" must be a path string`);
  if (!existsSync(dir)) fail(`.cursor-plugin/plugin.json: "${field}" points at "${dir}", which does not exist`);
}

// Cursor requires every skill's `name` to equal its parent folder, and every skill and
// agent to carry a description. Claude Code is laxer, so without this gate the plugin
// installs fine here and is rejected — or worse, partially loaded — there.
for (const name of skillDirs) {
  const fm = parseFrontmatter(readFileSync(join("skills", name, "SKILL.md"), "utf-8"), `skills/${name}/SKILL.md`);
  if (fm.name !== name) {
    fail(`skills/${name}/SKILL.md: name is "${fm.name}" but Cursor requires it to match the folder name "${name}"`);
  }
  if (!fm.description) fail(`skills/${name}/SKILL.md: description missing — required by both hosts`);
}
for (const name of agentFiles) {
  if (agentFrontmatter[name].name !== name) {
    fail(`agents/${name}.md: name is "${agentFrontmatter[name].name}" but must match the filename "${name}"`);
  }
  if (!agentFrontmatter[name].description) fail(`agents/${name}.md: description missing — required by both hosts`);
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
    return [`\`${key}\``, `${fm.model}/${fm.effort}`, manifest.agents[key].routed, manifest.agents[key].summary];
  });
  return buildTable(["Agent", "Model / effort", "Spawned by", "Purpose"], rows);
}

// README.md is the only generated-table home. CLAUDE.md is always-loaded on every
// turn, and every skill's own `description:` frontmatter is too — an inventory table
// there is a second copy of context Claude already has.
const REGIONS = [
  { name: "gen:skills-core", file: "README.md", render: () => skillsGroupTable("core") },
  { name: "gen:skills-handoff", file: "README.md", render: () => skillsGroupTable("handoff") },
  { name: "gen:agents-table", file: "README.md", render: agentsTable },
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
