# next-scaffold — maintainer notes

Not loaded at run time: `SKILL.md` keeps only what a scaffold run executes. Read this when changing `scripts/scaffold.mjs` or its templates. Paths below are relative to this skill's directory; `tools/regress.mjs` is in the bigin-skills repo.

## Manual validation (maintainers)

After changing `scaffold.mjs` or templates, verify in an empty temp dir on **both macOS and Windows**:

```sh
mkdir scaffold-test && cd scaffold-test
echo '{"projectName":"scaffold-test","packageManager":"pnpm"}' > ../cfg.json
node <skill-dir>/scripts/scaffold.mjs --config ../cfg.json
```

Expect: exit 0, all three verify gates green, initial commit created. Then re-run the same command → must fail fast with "scaffold looks complete", exit 1, no files touched.

For a fast file-tree-only pass while iterating on templates (add `"skipInstall": true` to the config), expect exit 0 in a few seconds — no install, no shadcn init, no verify, no hooks activated — then inspect the written files directly; don't treat that run as a stand-in for the full validation above.

At minimum also re-verify `template: "saas"` and `template: "dashboard"` the same way whenever `templates/saas/` or the `TEMPLATE_BLOCKS` map changes — `saas` is the one template with bespoke files, `dashboard` is the one that depends on the shadcn block registry still shipping `dashboard-01`.

Platform-risky code paths (all flagged in the header comment of `scaffold.mjs`): Windows `.cmd` shim resolution + the `shell: true`-on-win32 EINVAL workaround (`resolveBin`/`run`/`winQuote`), CRLF checkouts vs ESLint's stylistic rules, and utf8 decoding of subprocess output.
