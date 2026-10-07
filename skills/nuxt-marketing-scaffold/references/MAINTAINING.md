# nuxt-marketing-scaffold — maintainer notes

Not loaded at run time: `SKILL.md` keeps only what a scaffold run executes. Read this when changing `scripts/scaffold.mjs` or its templates. Paths below are relative to this skill's directory; `tools/regress.mjs` is in the bigin-skills repo.

## Why this is not a `nuxt-scaffold` template

`nuxt-scaffold` never installs `@nuxtjs/i18n` (condition 3 of the `nuxt-marketing`
detection rung), and until v1.109.0 it installed `nuxt-auth-utils`, the auth marker
condition 4 tests for. A marketing site scaffolded
through it resolves to `nuxt` on the next run and gets pass-through and Pinia-Colada
conventions written into a site that has neither — the failure the profile exists to
prevent, and one that looks like success at install time.

**Do not merge the two scaffolders.** The separation is the safeguard.

## The four things the layout guarantees

1. `@nuxt/content` **and** `@nuxtjs/i18n` land in `dependencies`, never
   `devDependencies` — conditions 2 and 3 of the detection rung.
2. No auth dependency of any kind — condition 4.
3. `server/api/` holds the two form routes and nothing else. The rung
   deliberately does not test for that directory, precisely so a site keeps
   detecting once it grows a contact form.
4. No `fallbackLocale` anywhere: a missing locale renders nothing rather than
   shipping untranslated copy. The profile's pre-commit gate greps for it.

## Verifying a change to this skill

Detection alone is not enough, and assuming it was is how four build-breaking
defects shipped green in v1.88.0: the suite scaffolded a site, checked that it
*detected* as `nuxt-marketing`, and never checked that it compiled.

- `node tools/regress.mjs` — the structural cases. Fast, always on, run by the
  commit hook. They catch an unsubstituted token, a flag that never reaches the
  generated file, an import of a package no manifest declares, a helper nothing
  defines, and a command the profile's CI templates invoke that this manifest
  declares no script for.
- `node tools/regress.mjs --build` — really installs a three-locale scaffold,
  runs every `pnpm` step the generated GitHub workflow runs, and asserts one
  prerendered entry point per locale. Slow and network-bound, so it is opt-in;
  run it for any change to a template, the manifest or the substitution map.
- `bigin-harness-setup`'s Phase 0 against the result must still print
  `PROFILE = nuxt-marketing`.
