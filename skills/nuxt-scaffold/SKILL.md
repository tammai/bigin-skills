---
name: nuxt-scaffold
description: "Scaffolds a Nuxt 4 BFF app from scratch — non-interactive `npm create nuxt@latest`, then the BFF preset modules, then config + sample code. No GitHub clone. MUST use when user says: 'scaffold nuxt', 'create nuxt app', 'initialize nuxt project', 'new nuxt bff', 'set up nuxt', 'tạo nuxt', 'khởi tạo nuxt', 'cài nuxt', or when the repo has no nuxt.config.ts. Also invoked by bigin-harness-setup Phase 0.5 for the nuxt profile on an empty repo."
---

# nuxt-scaffold

Scaffolds a Nuxt 4 BFF app **from scratch**. The mechanical work is done by a deterministic script — `scripts/scaffold.mjs` (Node stdlib only, cross-platform, zero prompts). This skill's only jobs: **decide the config values, write them to a JSON file, run the script, report the result.** Do not perform any scaffolding steps yourself.

Stack: Nuxt 4, Nuxt UI v4, Nuxt ESLint, Pinia + Pinia Colada, VueUse, nuxt-auth-utils, Zod, Vitest, simple-git-hooks + lint-staged. BFF proxy layer — the backend owns data persistence.

> Governance (CLAUDE.md, `.claude/rules/`, AI guides, `bash-guard.mjs`) is **not** this skill's job — run `bigin-harness-setup` afterward to overlay it.

Prerequisites: Node.js 22+, pnpm. Scaffolding is **in-place** into the target directory (for a brand-new project: `mkdir my-app` first).

---

## Step 1: Detect state & confirm

Check the target directory:

- **`nuxt.config.ts` exists + both signature files (`vitest.config.ts`, `.claude/settings.json`) exist** → complete scaffold. Say so and stop.
- **`nuxt.config.ts` exists but a signature file is missing** → partial scaffold (prior failed run). Ask: *"Partial scaffold detected — resume (install BFF preset + apply artifacts + verify)? (yes / no)"*. If yes → set `resume: true` in the config and continue to Step 2 (theme/module answers are still needed for the artifact stage). If no → stop.
- **No `nuxt.config.ts`** → ask: *"Scaffold a Nuxt 4 BFF app in this repo (non-interactive npm create nuxt@latest + BFF preset + config)? (yes / no)"*. If no → stop.

(The script re-checks all of this and fails fast rather than overwriting — but resolving it conversationally first avoids a wasted run.)

## Step 2: Gather config

Ask everything **up front in one plain conversational message** — not via the AskUserQuestion tool (too many items/options for its limits, and two answers are regex-constrained free text). Enter = default:

```
Customize the scaffold (press Enter to keep the default):

1. Project name (kebab-case, used in package.json)
   > Default: <current directory name>
   > Must match ^[a-z0-9]+(-[a-z0-9]+)*$ — re-prompt if it doesn't.

2. Theme — primary color (Nuxt UI)
   > Default: blue
   > Options: blue / green / emerald / teal / cyan / sky / indigo / violet /
              purple / fuchsia / pink / rose / amber / yellow / lime / orange / red

3. Theme — neutral color (Nuxt UI)
   > Default: slate
   > Options: slate / gray / zinc / neutral / stone / taupe / mauve / mist / olive

4. Optional modules (comma-separated, or Enter for none)
   > Options: image / content   (fonts / icon / color-mode already come with Nuxt UI)

5. Dependency freshness for framework packages
   > Default: capped — latest minor/patch within the major this scaffold ships (safe)
   > Options: capped / latest (latest may need manual fixes until re-validated)

6. Database layer — add Drizzle + Cloudflare D1? (BFF default = no DB)
   > Default: no   (yes / no)

[If yes:]
7. Cloudflare D1 database ID (UUID from `wrangler d1 list`)
   > Default: leave as placeholder (replace before first deploy)
```

Show a summary table and confirm. If no → stop.

## Step 3: Write config & run the script

Write the answers to a JSON file **outside the target repo** (temp/scratchpad dir):

```jsonc
{
  "projectName": "my-app",           // required, kebab-case
  "targetDir": ".",                  // default "."
  "packageManager": "pnpm",          // BigIn standard; the script rejects anything else
  "theme": { "primary": "blue", "neutral": "slate" },
  "optionalModules": [],             // subset of ["image", "content"]
  "versionPolicy": "capped",         // "capped" | "latest"
  "drizzle": { "enabled": false, "d1DatabaseId": null },  // null → {D1_DATABASE_ID} placeholder
  "resume": false,                   // true only when Step 1 detected a partial scaffold
  "gitCommit": true                  // final "chore: scaffold Nuxt 4 BFF app" commit
}
```

Then run it from the target directory, streaming output (it can take several minutes — installs + lint + type-check + tests):

```sh
node <this-skill-dir>/scripts/scaffold.mjs --config <path-to-config.json>
```

Zero prompts occur once the script starts. Every step it performs (init, version refresh, BFF preset, artifacts, hooks, verify, commit) is internal — do not duplicate any of it.

## Step 4: Report

- **Exit 0** → relay the script's "Next steps" output verbatim.
- **Exit 2** → config problem; fix the JSON per the error message and re-run.
- **Exit 1** → runtime failure; the last `[scaffold] ERROR:` line names the failing stage/command. Common causes: Node < 22, pnpm missing, network failure during `npm create`, or a `create-nuxt@latest` behavior change (the error will say to re-verify `references/bootstrap.md`). A failed run partway through leaves a partial scaffold — after fixing the cause, re-run with `"resume": true`.

---

## Manual validation (maintainers)

After changing `scaffold.mjs` or templates, verify in an empty temp dir on **both macOS and Windows**:

```sh
mkdir scaffold-test && cd scaffold-test
echo '{"projectName":"scaffold-test","packageManager":"pnpm","theme":{"primary":"orange","neutral":"slate"}}' > ../cfg.json
node <skill-dir>/scripts/scaffold.mjs --config ../cfg.json
```

Expect: exit 0, all three verify gates green, initial commit created. Then re-run the same command → must fail fast with "scaffold looks complete", exit 1, no files touched.

Platform-risky code paths (all flagged in the header comment of `scaffold.mjs`): Windows `.cmd` shim resolution + the `shell: true`-on-win32 EINVAL workaround (`resolveBin`/`run`/`winQuote`), `^` in semver specs under cmd.exe, CRLF checkouts vs `@stylistic` lint rules, and utf8 decoding of subprocess output.

## References

- `scripts/scaffold.mjs` — the scaffold implementation (single file, Node stdlib only).
- `scripts/templates/` — **source of truth** for every file written/merged into the project.
- `references/bootstrap.md` — rationale for the command sequence the script executes.
- `references/artifacts.md` — rationale + merge semantics for each template.
- `references/modules.md` — BFF preset, optional-modules menu, Drizzle opt-in.
