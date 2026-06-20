# Pinia Store Testing with Vitest

## Required setup — before each test

```ts
import { setActivePinia, createPinia } from 'pinia'

beforeEach(() => {
  setActivePinia(createPinia())
})
```

Never share a Pinia instance across tests. `createPinia()` in `beforeEach` gives each test a clean slate.

---

## Testing state and actions

```ts
import { useCartStore } from '~/stores/cart'

describe('useCartStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('starts with empty cart', () => {
    const store = useCartStore()
    expect(store.items).toEqual([])
    expect(store.total).toBe(0)
  })

  it('addItem increases count', () => {
    const store = useCartStore()
    store.addItem({ id: 1, name: 'Widget', price: 9.99 })
    expect(store.items).toHaveLength(1)
    expect(store.total).toBe(9.99)
  })

  it('removeItem removes by id', () => {
    const store = useCartStore()
    store.addItem({ id: 1, name: 'Widget', price: 9.99 })
    store.removeItem(1)
    expect(store.items).toHaveLength(0)
  })
})
```

---

## Testing async actions ($fetch)

```ts
import { vi } from 'vitest'
import { useUserStore } from '~/stores/user'

vi.stubGlobal('$fetch', vi.fn())

describe('useUserStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('fetchUser populates user state', async () => {
    const mockUser = { id: 1, name: 'Tam Mai', email: 'tam@bigin.vn' }
    vi.mocked($fetch).mockResolvedValueOnce(mockUser)

    const store = useUserStore()
    await store.fetchUser(1)

    expect(store.user).toEqual(mockUser)
    expect(store.loading).toBe(false)
    expect($fetch).toHaveBeenCalledWith('/api/users/1')
  })

  it('fetchUser sets error on failure', async () => {
    vi.mocked($fetch).mockRejectedValueOnce(new Error('Network error'))

    const store = useUserStore()
    await store.fetchUser(1)

    expect(store.error).toBe('Network error')
    expect(store.user).toBeNull()
  })
})
```

---

## Using createTestingPinia (for component-level store testing)

When testing a **component** that uses a store, use `createTestingPinia` instead:

```ts
import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { useCartStore } from '~/stores/cart'
import CheckoutPage from '~/app/pages/checkout.vue'

it('shows item count from cart store', () => {
  const wrapper = mount(CheckoutPage, {
    global: {
      plugins: [createTestingPinia({
        initialState: {
          cart: { items: [{ id: 1, name: 'Widget', price: 9.99 }] },
        },
        stubActions: false,   // set true to stub all actions automatically
      })],
    },
  })

  // Access the store inside the component test
  const store = useCartStore()
  expect(wrapper.find('[data-test="item-count"]').text()).toBe('1')
})
```

---

## Testing getters

```ts
it('total sums all item prices', () => {
  const store = useCartStore()
  store.$patch({
    items: [
      { id: 1, price: 10 },
      { id: 2, price: 20 },
    ],
  })
  expect(store.total).toBe(30)
})
```

`$patch` is the fastest way to set initial state in a store without calling actions.

---

## Resetting store between tests

If state leaks between tests, use `$reset()` (only works on Options stores):

```ts
afterEach(() => {
  useCartStore().$reset()
})
```

For Composition API stores, `setActivePinia(createPinia())` in `beforeEach` is the reliable alternative.
