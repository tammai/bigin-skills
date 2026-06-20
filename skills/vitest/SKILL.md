---
name: vitest
version: 1.0.0
description: "Write unit tests with Vitest for Vue 3 / Nuxt v4 projects. Use when writing component tests, composable tests, Pinia store tests, setting up vitest.config.ts, configuring coverage, or running the test suite. Also triggers for: 'test this component', 'add unit tests', 'write tests for this composable/store', 'set up vitest', 'check test coverage'."
---

# Vitest — Unit Testing for Vue 3 / Nuxt v4

Fast unit testing with Vitest, Vue Test Utils, and Nuxt Test Utils.

---

## Quick Setup / Cài đặt nhanh

→ See [setup](references/setup.md) for `vitest.config.ts`, package installs, and Nuxt-specific configuration.

---

## Writing Tests / Viết test

### Component tests
→ See [component-testing](references/component-testing.md)
- Mount a component, interact with it, assert the DOM
- `mount` vs `shallowMount`, slots, props, emits
- Async rendering with `flushPromises`

### Composable tests
→ See [composable-testing](references/composable-testing.md)
- Test composables inside `withSetup()` helper
- Lifecycle hooks, `inject`/`provide`, reactive state

### Pinia store tests
→ See [store-testing](references/store-testing.md)
- `setActivePinia(createPinia())` before each test
- Testing actions, getters, state mutations
- Mocking `$fetch` / Pinia Colada queries

### Coverage
→ See [coverage](references/coverage.md)
- V8 provider config, thresholds, HTML report

---

## Core Patterns / Mẫu cơ bản

```ts
// component unit test skeleton
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import MyComponent from '~/components/MyComponent.vue'

describe('MyComponent', () => {
  it('renders the title prop', () => {
    const wrapper = mount(MyComponent, {
      props: { title: 'Hello' },
    })
    expect(wrapper.text()).toContain('Hello')
  })
})
```

```ts
// store unit test skeleton
import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { useCounterStore } from '~/stores/counter'

describe('useCounterStore', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('increments count', () => {
    const store = useCounterStore()
    store.increment()
    expect(store.count).toBe(1)
  })
})
```

---

## CLI Commands / Lệnh CLI

```bash
pnpm vitest            # watch mode
pnpm vitest run        # single run (CI)
pnpm vitest --ui       # browser UI
pnpm vitest run --coverage  # with coverage report
```

---

## File Conventions / Quy ước file

| Test type | Location | Naming |
|-----------|----------|--------|
| Component | `tests/components/` | `MyComponent.test.ts` |
| Composable | `tests/composables/` | `useMyComposable.test.ts` |
| Store | `tests/stores/` | `myStore.test.ts` |
| Util / helper | `tests/utils/` | `myUtil.test.ts` |

---

## References / Tài liệu tham khảo

- [Vitest Docs](https://vitest.dev/)
- [Vue Test Utils](https://test-utils.vuejs.org/)
- [Nuxt Test Utils](https://nuxt.com/docs/getting-started/testing)
- [Pinia Testing Guide](https://pinia.vuejs.org/cookbook/testing.html)
