#!/usr/bin/env node
// Computes mechanical model-router rubric signals, plus the project's resolved
// model ladder. Node stdlib only.
//
// Usage: node classify.mjs [--paths <a,b,c>]... [--base <ref>]
//
// Routing happens BEFORE work starts, so git state is usually the wrong input:
// on a clean tree at the tip of the base branch there is no diff to measure, and
// reporting 0 files / no high-risk paths would score every new task as trivial.
// So `--paths` takes the *planned* scope (from PLAN.md, or the user's description
// of what they're about to change) and scores that instead. With no --paths, the
// script falls back to uncommitted changes, then to the branch diff, and reports
// `scope: "none"` with null signals when neither exists — which SKILL.md treats
// like the error path: estimate the signals by reasoning, don't read them as zero.
//
// Never hard-fails: on any error, prints the same JSON shape with empty/null
// fields plus an `error` string, so SKILL.md can fall back to pure reasoning.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, basename, join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const LOCKFILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb']);

// --- Model ladder resolution (see references/model-profiles.md) ---

const ROUTING_CONFIG = '.claude/model-routing.json';
const DEFAULT_PROFILE = 'opus-centric';
const PROFILES = {
  'opus-centric': { quick: 'sonnet', standard: 'opus', deep: 'opus', verifier: 'sonnet' },
  frontier: { quick: 'sonnet', standard: 'opus', deep: 'fable', verifier: 'sonnet' },
  lean: { quick: 'sonnet', standard: 'sonnet', deep: 'opus', verifier: 'sonnet' },
};
const TIERS = ['quick', 'standard', 'deep', 'verifier'];
const MODELS = new Set(['fable', 'opus', 'sonnet', 'haiku']);

// Effort is NOT settable in .claude/model-routing.json and is not overridable at
// spawn time — the Agent tool has no effort parameter, so it can only come from an
// agent file's frontmatter. A profile that wants a different effort for a tier
// therefore has to name a different *agent*; AGENTS below maps (tier, effort) to the
// file that carries it, and every pair used in EFFORTS must exist there.
// These three tables are the single source of truth: tools/docs_sync.mjs imports them
// and fails the commit on an EFFORTS pair with no AGENTS entry, an AGENTS entry with no
// file, or a variant that has drifted from its base.
const EFFORTS = {
  'opus-centric': { quick: 'low', standard: 'medium', deep: 'high', verifier: 'high' },
  frontier: { quick: 'low', standard: 'high', deep: 'high', verifier: 'high' },
  lean: { quick: 'low', standard: 'high', deep: 'high', verifier: 'medium' },
};
const AGENTS = {
  quick: { low: 'quick-executor' },
  standard: { medium: 'standard-worker', high: 'standard-worker-high' },
  deep: { high: 'deep-architect' },
  verifier: { high: 'verifier', medium: 'verifier-medium' },
};

// Resolves profile + per-tier overrides into one model-per-tier map. Every
// invalid input degrades to the default and is reported in `warnings` — the
// router must never be blocked by a malformed config file.
function resolveRouting() {
  const routing = {
    profile: DEFAULT_PROFILE,
    models: { ...PROFILES[DEFAULT_PROFILE] },
    efforts: { ...EFFORTS[DEFAULT_PROFILE] },
    agents: {},
    source: 'default',
    warnings: [],
  };

  if (!existsSync(ROUTING_CONFIG)) return withAgents(routing);

  let config;
  try {
    config = JSON.parse(readFileSync(ROUTING_CONFIG, 'utf8'));
  } catch (err) {
    routing.warnings.push(`${ROUTING_CONFIG} is not valid JSON (${err.message}) — using the ${DEFAULT_PROFILE} default`);
    return withAgents(routing);
  }
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    routing.warnings.push(`${ROUTING_CONFIG} must be a JSON object — using the ${DEFAULT_PROFILE} default`);
    return withAgents(routing);
  }

  routing.source = 'config';

  if (config.profile !== undefined) {
    if (Object.hasOwn(PROFILES, config.profile)) {
      routing.profile = config.profile;
      routing.models = { ...PROFILES[config.profile] };
      routing.efforts = { ...EFFORTS[config.profile] };
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

  if (config.effort !== undefined || config.efforts !== undefined) {
    routing.warnings.push(
      `effort is not settable in ${ROUTING_CONFIG} — it comes from the spawned agent's frontmatter and the Agent tool has no effort parameter. Pick a profile whose effort ladder you want, or the pins stay as they are.`
    );
  }

  return withAgents(routing);
}

// Derives the subagent to spawn per tier from the resolved effort. Kept separate so
// every return path above goes through it and `agents` is never left empty.
function withAgents(routing) {
  routing.agents = Object.fromEntries(
    TIERS.map((tier) => [tier, AGENTS[tier]?.[routing.efforts[tier]] ?? null])
  );
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
  const out = { base: null, paths: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base' && argv[i + 1]) {
      out.base = argv[i + 1];
      i++;
    } else if (argv[i] === '--paths' && argv[i + 1]) {
      // Repeatable, and each value may itself be a comma-separated list.
      out.paths.push(...argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean));
      i++;
    }
  }
  return out;
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

// Returns { scope, files }. `scope` names where the file list came from, so the
// caller can tell "nothing changed yet" apart from "a change touching 0 files".
function getTouchedFiles(base, plannedPaths) {
  if (plannedPaths.length > 0) return { scope: 'planned', files: plannedPaths };

  // Uncommitted changes next — mid-task, this is what "this task" means.
  const statusOut = git(['status', '--porcelain']);
  if (statusOut.trim()) {
    return {
      scope: 'uncommitted',
      files: statusOut
        .split('\n')
        .filter(Boolean)
        .map((line) => line.slice(3))
        .map((p) => (p.includes(' -> ') ? p.split(' -> ')[1] : p)),
    };
  }

  // Nothing uncommitted — fall back to the diff against base.
  const diffOut = git(['diff', '--name-only', `${base}...HEAD`]);
  const files = diffOut
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return { scope: files.length > 0 ? 'branch' : 'none', files };
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

function detectFullSpec() {
  if (!existsSync('PLAN.md')) return false;
  const content = readFileSync('PLAN.md', 'utf8');
  return /\[full-spec\]/.test(content) || /\bCovers\b/.test(content) || /FR-\d+/.test(content);
}

function classify(argv) {
  const { base: explicitBase, paths: plannedPaths } = parseArgs(argv);
  const base = resolveBase(explicitBase);

  const { scope, files: touchedFilesRaw } = getTouchedFiles(base, plannedPaths);
  const touchedFiles = touchedFilesRaw.filter((f) => !LOCKFILES.has(basename(f)));

  // No diff and no planned scope: every file-derived signal is unknown, not zero.
  // Reporting 0 here is what made a clean tree score as a trivial task.
  if (scope === 'none') {
    return {
      scope,
      scopeNote:
        'no planned scope and no diff yet — filesChanged/testCoverageRatio/highRiskMatches are UNKNOWN, not zero. Re-run with --paths <planned files>, or estimate these signals by reasoning (SKILL.md Step 2). Do not score them as 0.',
      filesChanged: null,
      touchedFiles: [],
      highRiskMatches: null,
      testCoverageRatio: null,
      fullSpecDetected: detectFullSpec(),
      routing: resolveRouting(),
    };
  }

  const highRiskMatches = touchedFiles.filter((f) => HIGH_RISK_RE.test(f));

  const nonTestFiles = touchedFiles.filter((f) => !TEST_FILE_RE.test(f));
  const testCoverageRatio =
    nonTestFiles.length === 0 ? null : nonTestFiles.filter(hasSiblingTest).length / nonTestFiles.length;

  return {
    scope,
    filesChanged: touchedFiles.length,
    touchedFiles,
    highRiskMatches,
    testCoverageRatio,
    fullSpecDetected: detectFullSpec(),
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
          scope: 'none',
          filesChanged: null,
          touchedFiles: [],
          highRiskMatches: null,
          testCoverageRatio: null,
          fullSpecDetected: false,
          // withAgents, not a literal — the router reads routing.agents[tier] to pick
          // a subagent_type, so a fallback missing `agents` degrades into spawning
          // `bigin-skills:undefined` on exactly the path meant to fail soft.
          routing: withAgents({
            profile: DEFAULT_PROFILE,
            models: { ...PROFILES[DEFAULT_PROFILE] },
            efforts: { ...EFFORTS[DEFAULT_PROFILE] },
            agents: {},
            source: 'default',
            warnings: [`routing not resolved (${err.message}) — using the ${DEFAULT_PROFILE} default`],
          }),
          error: err.message,
        },
        null,
        2
      )
    );
  }
}

// Only run when executed directly — tools/docs_sync.mjs imports the ladder tables
// below to gate them, and importing must not emit JSON or read the filesystem.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

export { DEFAULT_PROFILE, PROFILES, EFFORTS, AGENTS, TIERS, MODELS };
