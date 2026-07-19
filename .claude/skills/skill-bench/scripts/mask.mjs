#!/usr/bin/env node
// Masks/unmasks a plugin skill directory for skill-bench's "without-skill" trial arm.
// Idempotent by design: mask() and unmask() are no-ops if already in the target state, so
// a stale mask left behind by a crashed prior run self-heals the next time either command
// runs. That idempotency — not a language-level try/finally around an LLM call, which
// can't exist across a subagent dispatch — is the actual mechanism behind "the mask is
// restored even if a trial errors." SKILL.md's Phase 0 always calls `status` first so a
// leftover mask from a previous crash is caught before a new run starts.
// Usage: node mask.mjs <mask|unmask|status> <skill-name>

import { existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const SKILLS_DIR = join(process.cwd(), 'skills');

function paths(skill) {
  const dir = join(SKILLS_DIR, skill);
  return {
    active: join(dir, 'SKILL.md'),
    masked: join(dir, 'SKILL.md.bench-masked'),
  };
}

function mask(skill) {
  const { active, masked } = paths(skill);
  if (existsSync(masked)) return { skill, state: 'masked', changed: false };
  if (!existsSync(active)) return { skill, state: 'missing', changed: false, error: 'no SKILL.md to mask' };
  renameSync(active, masked);
  return { skill, state: 'masked', changed: true };
}

function unmask(skill) {
  const { active, masked } = paths(skill);
  if (existsSync(active)) return { skill, state: 'active', changed: false };
  if (!existsSync(masked)) return { skill, state: 'missing', changed: false, error: 'nothing masked to restore' };
  renameSync(masked, active);
  return { skill, state: 'active', changed: true };
}

function status(skill) {
  const { active, masked } = paths(skill);
  if (existsSync(masked)) return { skill, state: 'masked', changed: false };
  if (existsSync(active)) return { skill, state: 'active', changed: false };
  return { skill, state: 'missing', changed: false };
}

function main() {
  const [cmd, skill] = process.argv.slice(2);
  const fn = { mask, unmask, status }[cmd];
  if (!fn || !skill) {
    console.log(JSON.stringify({ error: 'usage: node mask.mjs <mask|unmask|status> <skill-name>' }));
    process.exit(1);
  }
  console.log(JSON.stringify(fn(skill)));
}

main();
