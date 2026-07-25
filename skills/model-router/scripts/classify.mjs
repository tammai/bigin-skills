#!/usr/bin/env node
// Computes mechanical model-router rubric signals from git state, plus the
// project's resolved model ladder. Node stdlib only.
// Usage: node classify.mjs [--base <ref>] [--paths <glob,glob>] [--plan <path>]
// Never hard-fails: on any error, prints the same JSON shape with empty/null
// fields plus an `error` string, so SKILL.md can fall back to pure reasoning.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, basename, join, extname } from 'node:path';

const LOCKFILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb']);

// --- Model ladder resolution (see references/model-profiles.md) ---

const ROUTING_CONFIG = '.claude/model-routing.json';
const DEFAULT_PROFILE = 'frontier';
const PROFILES = {
  frontier: { quick: 'sonnet', standard: 'opus', deep: 'fable', verifier: 'sonnet' },
  'opus-centric': { quick: 'sonnet', standard: 'opus', deep: 'opus', verifier: 'sonnet' },
  lean: { quick: 'haiku', standard: 'sonnet', deep: 'opus', verifier: 'haiku' },
};
const TIERS = ['quick', 'standard', 'deep', 'verifier'];
const MODELS = new Set(['fable', 'opus', 'sonnet', 'haiku']);

// Resolves profile + per-tier overrides into one model-per-tier map. Every
// invalid input degrades to the default and is reported in `warnings` — the
// router must never be blocked by a malformed config file.
function resolveRouting() {
  const routing = {
    profile: DEFAULT_PROFILE,
    models: { ...PROFILES[DEFAULT_PROFILE] },
    source: 'default',
    warnings: [],
  };

  if (!existsSync(ROUTING_CONFIG)) return routing;

  let config;
  try {
    config = JSON.parse(readFileSync(ROUTING_CONFIG, 'utf8'));
  } catch (err) {
    routing.warnings.push(`${ROUTING_CONFIG} is not valid JSON (${err.message}) — using the ${DEFAULT_PROFILE} default`);
    return routing;
  }
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    routing.warnings.push(`${ROUTING_CONFIG} must be a JSON object — using the ${DEFAULT_PROFILE} default`);
    return routing;
  }

  routing.source = 'config';

  if (config.profile !== undefined) {
    if (Object.hasOwn(PROFILES, config.profile)) {
      routing.profile = config.profile;
      routing.models = { ...PROFILES[config.profile] };
    } else {
      routing.warnings.push(
        `unknown profile "${config.profile}" in ${ROUTING_CONFIG} (known: ${Object.keys(PROFILES).join(', ')}) — using ${DEFAULT_PROFILE}`
      );
    }
  }

  if (config.models !== undefined) {
    if (config.models === null || typeof config.models !== 'object' || Array.isArray(config.models)) {
      routing.warnings.push(`"models" in ${ROUTING_CONFIG} must be an object of tier → model — ignored`);
    } else {
      for (const [tier, model] of Object.entries(config.models)) {
        if (!TIERS.includes(tier)) {
          routing.warnings.push(`unknown tier "${tier}" in ${ROUTING_CONFIG} (known: ${TIERS.join(', ')}) — ignored`);
        } else if (!MODELS.has(model)) {
          routing.warnings.push(
            `unknown model "${model}" for tier "${tier}" in ${ROUTING_CONFIG} (known: ${[...MODELS].join(', ')}) — keeping ${routing.models[tier]}`
          );
        } else {
          routing.models[tier] = model;
        }
      }
    }
  }

  return routing;
}

const HIGH_RISK_RE = /openapi\.ya?ml$|openapi\.json$|(^|\/)migrations?\/|schema\.(sql|prisma)$|\.env(\.|$)|docker-compose|Dockerfile|\.github\/workflows\/|\.claude\/(guards|rules)\//i;

const TEST_FILE_RE = /\.(test|spec)\.[jt]sx?$|_test\.go$|(^|\/)test_[^/]+\.py$|[^/]+_test\.py$/;

// No .trim() here — git status --porcelain's fixed-width status prefix on the
// first line includes a leading space that a whole-string trim would eat,
// corrupting the first parsed path. Callers trim per line/value as needed.
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function parseArgs(argv) {
  const out = { base: null, paths: [], plan: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base' && argv[i + 1]) {
      out.base = argv[i + 1];
      i++;
    } else if (argv[i] === '--paths' && argv[i + 1]) {
      // Comma-separated, and repeatable.
      out.paths.push(...argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean));
      i++;
    } else if (argv[i] === '--plan' && argv[i + 1]) {
      out.plan = argv[i + 1];
      i++;
    }
  }
  return out;
}

// --- Scoping (agent teams) ---
//
// In a team session every teammate's work sits in one working tree, so
// `git status` over the whole tree attributes everyone's changes to "this task"
// — inflating filesChanged/testCoverageRatio and firing the highRiskMatches
// auto-override on work this agent never touched. `--paths` (or `--plan`, which
// reads the plan's `Owns:` globs) narrows the signals to what this agent owns.
// With neither flag, behavior is exactly what it was before scoping existed.

// Single pass rather than sentinel substitution: a sentinel character breaks on
// any glob that legitimately contains it, and a literal control character in
// source is invisible to review.
function globToRe(glob) {
  let body = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '*') {
      if (glob[i + 1] === '*') {
        body += '.*'; // ** crosses directory separators
        i++;
      } else {
        body += '[^/]*'; // * stops at a separator
      }
    } else if (char === '?') {
      body += '[^/]';
    } else if ('.+^${}()|[]\\/'.includes(char)) {
      body += '\\' + char;
    } else {
      body += char;
    }
  }
  return new RegExp(`^${body}$`);
}

// Reads `Owns:` from a plan file. Returns [] when the file is missing or has no
// such line — an unscoped run is the correct degradation here, since this script
// only reports signals and never gates anything.
function ownsFromPlan(planPath) {
  try {
    if (!existsSync(planPath)) return [];
    // Header region only (before the first `##`), matching the guards: a spec
    // body that happens to start a line with "Owns:" is not a declaration.
    const header = readFileSync(planPath, 'utf8').split(/^##\s/m)[0];
    const match = header.match(/^Owns:\s*(.+)$/m);
    if (!match) return [];
    return match[1].split(',').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function resolveBase(explicitBase) {
  if (explicitBase) return explicitBase;
  try {
    git(['rev-parse', '--verify', 'origin/main']);
    return 'origin/main';
  } catch {
    return 'main';
  }
}

function getTouchedFiles(base) {
  // Uncommitted changes first — this is almost always what "this task" means.
  // `-uall` matters: without it git collapses an untracked directory into one
  // entry ("skills/foo/"), which both undercounts filesChanged and makes those
  // files invisible to a `--paths` glob that names anything below the directory.
  const statusOut = git(['status', '--porcelain', '-uall']);
  if (statusOut.trim()) {
    return statusOut
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3))
      .map((p) => (p.includes(' -> ') ? p.split(' -> ')[1] : p));
  }
  // Nothing uncommitted — fall back to the diff against base.
  const diffOut = git(['diff', '--name-only', `${base}...HEAD`]);
  return diffOut
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasSiblingTest(file) {
  const dir = dirname(file);
  const ext = extname(file);
  const base = basename(file, ext);
  if (ext === '.go') return existsSync(join(dir, `${base}_test.go`));
  if (ext === '.py') {
    return existsSync(join(dir, `test_${base}.py`)) || existsSync(join(dir, `${base}_test.py`));
  }
  if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
    const candidates = [
      join(dir, `${base}.test${ext}`),
      join(dir, `${base}.spec${ext}`),
      join(dir, '__tests__', `${base}.test${ext}`),
      join(dir, '..', '__tests__', `${base}.test${ext}`),
      join(dir, '..', 'tests', `${base}.test${ext}`),
    ];
    return candidates.some(existsSync);
  }
  return false;
}

// Scoped runs check the task's own plan (`--plan`), not the repo-root PLAN.md —
// otherwise any one teammate's full-spec plan auto-routes every sibling's
// unrelated task to the deep tier.
function detectFullSpec(planPath = 'PLAN.md') {
  if (!existsSync(planPath)) return false;
  const content = readFileSync(planPath, 'utf8');
  return /\[full-spec\]/.test(content) || /\bCovers\b/.test(content) || /FR-\d+/.test(content);
}

function classify(argv) {
  const { base: explicitBase, paths, plan } = parseArgs(argv);
  const base = resolveBase(explicitBase);

  const planGlobs = plan ? ownsFromPlan(plan) : [];
  const globs = [...paths, ...planGlobs];
  const scopeSource = paths.length > 0 ? (planGlobs.length > 0 ? 'paths+plan' : 'paths') : planGlobs.length > 0 ? 'plan' : null;

  const touchedFilesRaw = getTouchedFiles(base);
  const unscoped = touchedFilesRaw.filter((f) => !LOCKFILES.has(basename(f)));

  const matchers = globs.map(globToRe);
  const touchedFiles = matchers.length === 0 ? unscoped : unscoped.filter((f) => matchers.some((re) => re.test(f)));

  const highRiskMatches = touchedFiles.filter((f) => HIGH_RISK_RE.test(f));

  const nonTestFiles = touchedFiles.filter((f) => !TEST_FILE_RE.test(f));
  const testCoverageRatio =
    nonTestFiles.length === 0 ? null : nonTestFiles.filter(hasSiblingTest).length / nonTestFiles.length;

  const fullSpecDetected = detectFullSpec(plan ?? 'PLAN.md');

  // `filesChanged` stays the true count; the LIST is capped because it gets
  // pasted into a subagent's payload. Since the rubric's top band is "5+", a
  // count of 60 and 600 route identically — but 600 paths in a handoff is pure
  // context bloat, and it usually means untracked junk that belongs in
  // .gitignore rather than 600 files of real work.
  const LIST_CAP = 50;
  const listTruncated = touchedFiles.length > LIST_CAP;

  return {
    filesChanged: touchedFiles.length,
    touchedFiles: listTruncated ? touchedFiles.slice(0, LIST_CAP) : touchedFiles,
    ...(listTruncated
      ? { touchedFilesTruncated: `showing ${LIST_CAP} of ${touchedFiles.length} — if most are untracked junk, gitignore it; the count is inflating your routing signal` }
      : {}),
    highRiskMatches,
    testCoverageRatio,
    fullSpecDetected,
    // null on an unscoped run. `excluded` is the count of dirty files attributed
    // to somebody else — a non-zero value on a solo task means the scope is wrong.
    scopedTo:
      scopeSource === null
        ? null
        : { source: scopeSource, globs, plan: plan ?? null, excluded: unscoped.length - touchedFiles.length },
    routing: resolveRouting(),
  };
}

function main() {
  try {
    const result = classify(process.argv.slice(2));
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.log(
      JSON.stringify(
        {
          filesChanged: null,
          touchedFiles: [],
          highRiskMatches: [],
          testCoverageRatio: null,
          fullSpecDetected: false,
          scopedTo: null,
          routing: {
            profile: DEFAULT_PROFILE,
            models: { ...PROFILES[DEFAULT_PROFILE] },
            source: 'default',
            warnings: [`routing not resolved (${err.message}) — using the ${DEFAULT_PROFILE} default`],
          },
          error: err.message,
        },
        null,
        2
      )
    );
  }
}

main();
