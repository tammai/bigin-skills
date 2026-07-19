#!/usr/bin/env node
// Scores one skill-bench trial against a task's rubric. Every criterion type is checkable
// by command or file assertion — never judgment — per skill-bench's rubric-subjectivity
// mitigation (a rubric line that needs judgment gets rewritten or cut, not scored here).
// Node stdlib only.
// Usage: node score.mjs <path-to-trial-spec.json>
//   trial-spec.json: { "worktree": "<abs-or-cwd-relative-path>", "rubric": [criterion, ...] }
//   criterion: { type: "file-exists", path, expect?: boolean, description }
//            | { type: "file-contains", path, pattern (regex source), description }
//            | { type: "command", cmd, expectExit?: number (default 0), description }

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, isAbsolute } from 'node:path';

function resolvePath(worktree, p) {
  return isAbsolute(p) ? p : join(worktree, p);
}

function checkFileExists(worktree, criterion) {
  const found = existsSync(resolvePath(worktree, criterion.path));
  return found === (criterion.expect ?? true);
}

function checkFileContains(worktree, criterion) {
  const p = resolvePath(worktree, criterion.path);
  if (!existsSync(p)) return false;
  return new RegExp(criterion.pattern).test(readFileSync(p, 'utf8'));
}

function checkCommand(worktree, criterion) {
  const expectExit = criterion.expectExit ?? 0;
  try {
    execSync(criterion.cmd, { cwd: worktree, stdio: 'pipe' });
    return expectExit === 0;
  } catch (err) {
    return (err.status ?? 1) === expectExit;
  }
}

const CHECKERS = {
  'file-exists': checkFileExists,
  'file-contains': checkFileContains,
  command: checkCommand,
};

function scoreRubric(worktree, rubric) {
  const results = rubric.map((criterion) => {
    const checker = CHECKERS[criterion.type];
    if (!checker) {
      return { description: criterion.description, type: criterion.type, pass: false, error: `unknown criterion type: ${criterion.type}` };
    }
    let pass;
    try {
      pass = checker(worktree, criterion);
    } catch {
      pass = false;
    }
    return { description: criterion.description, type: criterion.type, pass };
  });
  return { trialPasses: results.every((r) => r.pass), results };
}

function main() {
  const [specPath] = process.argv.slice(2);
  if (!specPath) {
    console.log(JSON.stringify({ error: 'usage: node score.mjs <path-to-trial-spec.json>' }));
    process.exit(1);
  }
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  console.log(JSON.stringify(scoreRubric(spec.worktree, spec.rubric), null, 2));
}

main();
