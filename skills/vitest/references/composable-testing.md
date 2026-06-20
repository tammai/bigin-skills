# Composable Testing with Vitest

## The withSetup helper

Composables that use lifecycle hooks or `inject`/`provide` must run inside a component instance. Use this helper:

```ts
import { createApp } from 'vue'

function withSetup<T>(composable: () => T): [T, ReturnType<typeof createApp>] {
  let result!: T
  const app = createApp({
    setup() {
      result = composable()
      return () => {}
    },
  })
  app.mount(document.createElement('div'))
  return [result, app]
}
```

---

## Testing a composable with lifecycle hooks

```ts
import { useMyComposable } from '~/composables/useMyComposable'

describe('useMyComposable', () => {
  it('initializes state on mount', async () => {
    const [result, app] = withSetup(() => useMyComposable())
    await flushPromises()
    expect(result.isReady.value).toBe(true)
    app.unmount()   // clean up lifecycle
  })
})
```

---

## Pure composables (no lifecycle / inject)

Simple composables can be called directly without the helper:

```ts
import { useCounter } from '~/composables/useCounter'

describe('useCounter', () => {
  it('increments', () => {
    const { count, increment } = useCounter()
    increment()
    expect(count.value).toBe(1)
  })

  it('resets to initial value', () => {
    const { count, reset } = useCounter(10)
    reset()
    expect(count.value).toBe(10)
  })
})
```

---

## Composables using $fetch / useFetch

Mock `$fetch` at the module level before the import:

```ts
import { vi } from 'vitest'

vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ id: 1, name: 'Tam' }))

describe('useUserProfile', () => {
  it('fetches and exposes user data', async () => {
    const [result] = withSetup(() => useUserProfile(1))
    await flushPromises()
    expect(result.user.value?.name).toBe('Tam')
  })
})
```

---

## Composables using useRuntimeConfig

```ts
vi.mock('#app', () => ({
  useRuntimeConfig: () => ({
    public: { apiBase: 'http://localhost:3000' },
  }),
}))
```

---

## Composables using router / route

```ts
import { useRouter, useRoute } from 'vue-router'
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: { id: '42' } }),
}))
```

---

## Cleanup pattern

Always unmount in `afterEach` when using `withSetup`:

```ts
let app: ReturnType<typeof createApp>

afterEach(() => {
  app?.unmount()
})

it('test', () => {
  const [result, _app] = withSetup(() => useMyComposable())
  app = _app
  // ...
})
```
