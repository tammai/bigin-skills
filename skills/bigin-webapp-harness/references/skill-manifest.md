# Skill Manifest
# Danh sách skill theo loại dự án

Maps each project type to the skills that should be copied into the project during Phase 5.

Skills live in the plugin's `skills/` directory (sibling to `bigin-webapp-harness/`).  
Copy them to `{project}/.claude/skills/{skill-name}/`.

---

## Type 1: Fullstack MVP

```
nuxt                       → .claude/skills/nuxt/
nuxt-ui                    → .claude/skills/nuxt-ui/
pinia                      → .claude/skills/pinia/
pinia-colada               → .claude/skills/pinia-colada/
vue                        → .claude/skills/vue/
vue-best-practices         → .claude/skills/vue-best-practices/
vue-testing-best-practices → .claude/skills/vue-testing-best-practices/
vitest                     → .claude/skills/vitest/
vueuse-functions           → .claude/skills/vueuse-functions/
pnpm                       → .claude/skills/pnpm/
cloudflare-pages           → .claude/skills/cloudflare-pages/
drizzle                    → .claude/skills/drizzle/           (optional — only when D1 is enabled)
nuxt-auth-utils            → .claude/skills/nuxt-auth-utils/  (optional — only when auth is needed)
github-actions             → .claude/skills/github-actions/
```

**Total: 14 skills** (11 base + drizzle optional + nuxt-auth-utils optional + github-actions)

---

## Type 2: SPA Frontend

```
nuxt                       → .claude/skills/nuxt/
nuxt-ui                    → .claude/skills/nuxt-ui/
pinia                      → .claude/skills/pinia/
pinia-colada               → .claude/skills/pinia-colada/
vue                        → .claude/skills/vue/
vue-best-practices         → .claude/skills/vue-best-practices/
vue-testing-best-practices → .claude/skills/vue-testing-best-practices/
vitest                     → .claude/skills/vitest/
vueuse-functions           → .claude/skills/vueuse-functions/
pnpm                       → .claude/skills/pnpm/
nuxt-auth-utils            → .claude/skills/nuxt-auth-utils/  (optional — only when auth is needed)
github-actions             → .claude/skills/github-actions/
```

**Total: 12 skills** (no cloudflare-pages/drizzle — SPA has no Cloudflare server binding needs; nuxt-auth-utils optional)

---

## Type 3: Backend (Go)

```
(none from current library)
```

Go projects get no pre-built skills copied. The harness generates a Go-specific `setup`, `api-development`, and `testing` skill inline during Phase 5 from the `backend-go.md` spec.

---

## Copy Instructions

Use the bash tool or file copy tools to copy each directory recursively:

```bash
# Example: Fullstack MVP install
cp -r {plugin_dir}/skills/nuxt          {project}/.claude/skills/nuxt
cp -r {plugin_dir}/skills/nuxt-ui       {project}/.claude/skills/nuxt-ui
cp -r {plugin_dir}/skills/pinia         {project}/.claude/skills/pinia
# ... etc
```

**`{plugin_dir}`** = the directory containing the plugin's `skills/` folder.  
To find it: the harness SKILL.md lives at `{plugin_dir}/skills/bigin-webapp-harness/SKILL.md` — go two levels up.

**Rules:**
- Never overwrite an existing `.claude/skills/{name}/` directory — skip and notify
- Copy entire directory including all `references/` subdirs
- After copying, print a confirmation list of installed skills
