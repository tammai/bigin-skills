#!/usr/bin/env node
// Computes mechanical model-router rubric signals from git state. Node stdlib only.
// Usage: node classify.mjs [--base <ref>]
// Never hard-fails: on any error, prints the same JSON shape with empty/null
// fields plus an `error` string, so SKILL.md can fall back to pure reasoning.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, basename, join, extname } from 'node:path';

const LOCKFILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb']);

const HIGH_RISK_RE = /openapi\.ya?ml$|openapi\.json$|(^|\/)migrations?\/|schema\.(sql|prisma)$|\.env(\.|$)|docker-compose|Dockerfile|\.github\/workflows\/|\.claude\/(guards|rules)\//i;

const TEST_FILE_RE = /\.(test|spec)\.[jt]sx?$|_test\.go$|(^|\/)test_[^/]+\.py$|[^/]+_test\.py$/;

// No .trim() here — git status --porcelain's fixed-width status prefix on the
// first line includes a leading space that a whole-string trim would eat,
// corrupting the first parsed path. Callers trim per line/value as needed.
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function parseArgs(argv) {
  const out = { base: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base' && argv[i + 1]) {
      out.base = argv[i + 1];
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

function getTouchedFiles(base) {
  // Uncommitted changes first — this is almost always what "this task" means.
  const statusOut = git(['status', '--porcelain']);
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

function detectFullSpec() {
  if (!existsSync('PLAN.md')) return false;
  const content = readFileSync('PLAN.md', 'utf8');
  return /\[full-spec\]/.test(content) || /\bCovers\b/.test(content) || /FR-\d+/.test(content);
}

function classify(argv) {
  const { base: explicitBase } = parseArgs(argv);
  const base = resolveBase(explicitBase);

  const touchedFilesRaw = getTouchedFiles(base);
  const touchedFiles = touchedFilesRaw.filter((f) => !LOCKFILES.has(basename(f)));

  const highRiskMatches = touchedFiles.filter((f) => HIGH_RISK_RE.test(f));

  const nonTestFiles = touchedFiles.filter((f) => !TEST_FILE_RE.test(f));
  const testCoverageRatio =
    nonTestFiles.length === 0 ? null : nonTestFiles.filter(hasSiblingTest).length / nonTestFiles.length;

  const fullSpecDetected = detectFullSpec();

  return {
    filesChanged: touchedFiles.length,
    touchedFiles,
    highRiskMatches,
    testCoverageRatio,
    fullSpecDetected,
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
          error: err.message,
        },
        null,
        2
      )
    );
  }
}

main();
