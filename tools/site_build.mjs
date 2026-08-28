#!/usr/bin/env node
// site_build.mjs — assembles site/dist/ from site/src/.
//
// Usage:
//   node tools/site_build.mjs            build site/dist/ in place
//   node tools/site_build.mjs --check    build to memory, diff against dist,
//                                        exit 1 listing stale files, no writes
//
// Why this exists: the landing page and the handbook were two hand-maintained
// HTML files that each carried their own copy of the <head>, the nav, the
// footer, the palette and the floating chrome — and their own hand-typed
// count of how many skills the plugin ships. That count went stale (v1.85.1
// fixed "16 skills" on a page that said "17 skills" twice elsewhere). Facts
// about the plugin now come from the plugin's own manifests at build time, so
// that class of drift cannot recur.
//
// Node stdlib only, no dependencies — same constraint as every other script
// in this repo. Templating is deliberately tiny: {{ key }} substitution and
// {{> partial }} inclusion, nothing more. If a page ever needs a loop, write
// the loop here in JS and expose the rendered string as one key.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'site', 'src');
const DIST = path.join(ROOT, 'site', 'dist');
const SITE_URL = 'https://bigin-skills.pages.dev';

const CHECK = process.argv.includes('--check');

function fail(message) {
  console.error(`ERROR ${message}`);
  process.exit(1);
}

// ── repo facts ──────────────────────────────────────────────────────────
// Everything here is read from the same sources docs_sync.mjs uses, so the
// site and README can never disagree about the plugin.

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch (e) {
    fail(`cannot read ${rel}: ${e.message}`);
  }
}

function collectData() {
  const plugin = readJson('.claude-plugin/plugin.json');
  const manifest = readJson('tools/docs-manifest.json');

  const skills = Object.keys(manifest.skills ?? {});
  const agents = Object.keys(manifest.agents ?? {});
  if (skills.length === 0) fail('tools/docs-manifest.json lists no skills');
  if (agents.length === 0) fail('tools/docs-manifest.json lists no agents');

  // Cross-check the manifest against what is actually on disk. docs_sync.mjs
  // gates this too, but a site build that silently rendered a stale count
  // would defeat the whole point of generating it.
  const onDisk = fs.readdirSync(path.join(ROOT, 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, 'skills', d.name, 'SKILL.md')))
    .map((d) => d.name);
  const missing = onDisk.filter((s) => !skills.includes(s));
  if (missing.length > 0) {
    fail(`skills present on disk but absent from tools/docs-manifest.json: ${missing.join(', ')}`);
  }

  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const latest = changelog.match(/^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/m);
  if (!latest) fail('CHANGELOG.md has no parseable "## [x.y.z] - date" heading');
  if (latest[1] !== plugin.version) {
    fail(`CHANGELOG.md's newest entry is ${latest[1]} but .claude-plugin/plugin.json says ${plugin.version}`);
  }

  return {
    version: plugin.version,
    release_date: latest[2],
    skill_count: String(skills.length),
    agent_count: String(agents.length),
    skill_count_word: numberWord(skills.length),
    skill_count_word_cap: capitalize(numberWord(skills.length)),
    agent_count_word: numberWord(agents.length),
    site_url: SITE_URL,
    year: String(new Date(latest[2]).getUTCFullYear())
  };
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty'];
function numberWord(n) {
  return WORDS[n] ?? String(n);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── templating ──────────────────────────────────────────────────────────

function parseFrontmatter(text, file) {
  if (!text.startsWith('---\n')) fail(`${file}: missing --- frontmatter block`);
  const end = text.indexOf('\n---\n', 3);
  if (end === -1) fail(`${file}: frontmatter block is not closed`);
  const data = {};
  for (const line of text.slice(4, end).split('\n')) {
    if (!line.trim()) continue;
    const at = line.indexOf(':');
    if (at === -1) fail(`${file}: frontmatter line is not "key: value": ${line}`);
    data[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return { data, body: text.slice(end + 5) };
}

function loadPartials() {
  const dir = path.join(SRC, '_partials');
  const out = {};
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.html')) out[path.basename(f, '.html')] = fs.readFileSync(path.join(dir, f), 'utf8').trim();
  }
  return out;
}

// Substitution is single-pass over a combined map, then partials, then a
// second substitution pass so a partial can use {{ }} keys of its own.
// Anything left unresolved is a build error rather than a {{ hole }} shipped
// to a reader.
function render(template, vars, partials, where) {
  let out = template.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (m, name) => {
    if (!(name in partials)) fail(`${where}: unknown partial {{> ${name} }}`);
    return partials[name];
  });
  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
    if (!(key in vars)) fail(`${where}: unknown key {{ ${key} }}`);
    return vars[key];
  });
  const leftover = out.match(/\{\{[^}]*\}\}/);
  if (leftover) fail(`${where}: unresolved template expression ${leftover[0]}`);
  return out;
}

// ── build ───────────────────────────────────────────────────────────────

function buildPages(data, partials) {
  const layout = fs.readFileSync(path.join(SRC, '_layouts', 'base.html'), 'utf8');
  const files = new Map();
  const pages = [];

  for (const name of fs.readdirSync(path.join(SRC, 'pages')).sort()) {
    if (!name.endsWith('.html')) continue;
    const file = path.join(SRC, 'pages', name);
    const { data: fm, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'), `pages/${name}`);
    for (const required of ['title', 'description', 'url', 'css', 'js']) {
      if (!fm[required]) fail(`pages/${name}: frontmatter is missing "${required}"`);
    }

    // `nav_end` names a nav-end-*.html partial rather than holding markup:
    // a page never links to itself, so the handbook swaps its CTA for GitHub
    // and drops the handbook link. Defaults to the landing page's tail.
    const navEnd = `nav-end-${fm.nav_end ?? 'default'}`;
    if (!(navEnd in partials)) {
      fail(`pages/${name}: nav_end "${fm.nav_end}" has no _partials/${navEnd}.html`);
    }

    const vars = {
      ...data,
      ...fm,
      nav_end: partials[navEnd],
      og_description: fm.og_description ?? fm.description,
      body_class_attr: fm.body_class ? ` class="${fm.body_class}"` : ''
    };
    vars.content = render(body, vars, partials, `pages/${name}`);
    files.set(name, render(layout, vars, partials, `pages/${name} via _layouts/base.html`));
    if (fm.noindex !== 'true') pages.push(fm.url);
  }
  return { files, pages };
}

function buildSitemap(urls, date) {
  const entries = urls.map((u) => `  <url>\n    <loc>${SITE_URL}${u}</loc>\n    <lastmod>${date}</lastmod>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

function collectAssets() {
  const dir = path.join(SRC, 'assets');
  const out = new Map();
  for (const f of fs.readdirSync(dir)) {
    out.set(path.join('assets', f), fs.readFileSync(path.join(dir, f)));
  }
  return out;
}

function build() {
  const data = collectData();
  const partials = loadPartials();
  const { files, pages } = buildPages(data, partials);

  const output = new Map();
  for (const [name, html] of files) output.set(name, Buffer.from(html, 'utf8'));
  for (const [rel, buf] of collectAssets()) output.set(rel, buf);
  output.set('sitemap.xml', Buffer.from(buildSitemap(pages, data.release_date), 'utf8'));
  output.set('robots.txt', Buffer.from(`User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`, 'utf8'));
  return output;
}

function listDist() {
  const out = new Map();
  if (!fs.existsSync(DIST)) return out;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else out.set(path.relative(DIST, full), fs.readFileSync(full));
    }
  };
  walk(DIST);
  return out;
}

const built = build();

if (CHECK) {
  const existing = listDist();
  const stale = [];
  for (const [rel, buf] of built) {
    const have = existing.get(rel);
    if (!have) stale.push(`${rel} — missing from site/dist/`);
    else if (!have.equals(buf)) stale.push(`${rel} — out of date`);
  }
  for (const rel of existing.keys()) {
    if (!built.has(rel)) stale.push(`${rel} — orphan, no longer produced by the build`);
  }
  if (stale.length > 0) {
    console.error('ERROR site/dist/ is stale. Run: node tools/site_build.mjs');
    for (const s of stale) console.error(`  ${s}`);
    process.exit(1);
  }
  console.log(`OK site/dist/ is fresh (${built.size} files)`);
} else {
  fs.rmSync(DIST, { recursive: true, force: true });
  for (const [rel, buf] of built) {
    const dest = path.join(DIST, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
  }
  console.log(`OK site/dist/ written (${built.size} files)`);
}
