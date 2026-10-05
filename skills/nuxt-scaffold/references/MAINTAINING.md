# nuxt-scaffold — maintainer notes

Not loaded at run time: `SKILL.md` keeps only what a scaffold run executes. Read this when changing `scripts/scaffold.mjs` or its templates. Paths below are relative to this skill's directory; `tools/regress.mjs` is in the bigin-skills repo.

## Manual validation (maintainers)

After changing `scaffold.mjs` or templates, verify in an empty temp dir on **both macOS and Windows**:

```sh
mkdir scaffold-test && cd scaffold-test
echo '{"projectName":"scaffold-test","packageManager":"pnpm","theme":{"primary":"orange","neutral":"slate"}}' > ../cfg.json
node <skill-dir>/scripts/scaffold.mjs --config ../cfg.json
```

Expect: exit 0, all three verify gates green, initial commit created. Then re-run the same command → must fail fast with "scaffold looks complete", exit 1, no files touched.

For a fast file-tree-only pass while iterating on templates (add `"skipInstall": true` to the config), expect exit 0 in a few seconds — no install, no verify, no hooks activated — then inspect the written files directly; don't treat that run as a stand-in for the full validation above.

At minimum also re-verify `template: "saas"` the same way (`echo '{"projectName":"scaffold-saas-test","packageManager":"pnpm","template":"saas","theme":{"primary":"orange","neutral":"slate"}}' > ../cfg.json`) whenever `templates/saas/` or the clone path in `stage1Init()` changes — it's the one template with bespoke files and a different Stage 1 command. The other 7 cloned slugs share the same generic clone-and-layer path; spot-check one (e.g. `dashboard` or `landing`) opportunistically rather than on every change.

Platform-risky code paths (all flagged in the header comment of `scaffold.mjs`): Windows `.cmd` shim resolution + the `shell: true`-on-win32 EINVAL workaround (`resolveBin`/`run`/`winQuote`), `^` in semver specs under cmd.exe, CRLF checkouts vs `@stylistic` lint rules, and utf8 decoding of subprocess output.
