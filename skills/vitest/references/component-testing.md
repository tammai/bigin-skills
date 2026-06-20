# Component Testing with Vue Test Utils + Vitest

## Mount options

```ts
import { mount, shallowMount } from '@vue/test-utils'

// mount     — renders full component tree (children included)
// shallowMount — stubs all child components (faster, more isolated)
```

---

## Basic test structure

```ts
import { mount } from '@vue/test-utils'
import UserCard from '~/components/UserCard.vue'

describe('UserCard', () => {
  it('displays user name', () => {
    const wrapper = mount(UserCard, {
      props: { name: 'Tam Mai', role: 'admin' },
    })
    expect(wrapper.find('[data-test="name"]').text()).toBe('Tam Mai')
  })

  it('emits edit event on button click', async () => {
    const wrapper = mount(UserCard, {
      props: { name: 'Tam Mai', role: 'admin' },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('edit')).toBeTruthy()
    expect(wrapper.emitted('edit')![0]).toEqual([{ name: 'Tam Mai' }])
  })
})
```

---

## Props, slots, and attrs

```ts
// Named slots
mount(MyLayout, {
  slots: {
    default: '<p>Body content</p>',
    header: '<h1>Title</h1>',
  },
})

// Scoped slots
mount(MyList, {
  slots: {
    item: ({ item }) => `<span>${item.name}</span>`,
  },
})
```

---

## Async rendering

```ts
import { flushPromises } from '@vue/test-utils'

it('loads data and renders it', async () => {
  const wrapper = mount(UserList)
  await flushPromises()   // wait for all promises (fetch, nextTick, etc.)
  expect(wrapper.findAll('[data-test="user-row"]')).toHaveLength(3)
})
```

---

## Mocking `$fetch` / API calls

```ts
import { vi } from 'vitest'

vi.mock('#app', () => ({
  useNuxtApp: () => ({ $fetch: vi.fn() }),
}))

// Or mock at the module level
vi.mock('~/composables/useApi', () => ({
  useApi: () => ({
    getUsers: vi.fn().mockResolvedValue([{ id: 1, name: 'Tam' }]),
  }),
}))
```

---

## Nuxt UI components

Nuxt UI components are auto-imported. They render normally in the `nuxt` test environment — no stubs needed.

```ts
it('renders UButton with correct variant', () => {
  const wrapper = mount(MyForm)
  const btn = wrapper.findComponent({ name: 'UButton' })
  expect(btn.props('variant')).toBe('solid')
})
```

---

## Providing Pinia in component tests

```ts
import { createTestingPinia } from '@pinia/testing'

mount(MyComponent, {
  global: {
    plugins: [createTestingPinia({
      initialState: {
        counter: { count: 5 },
      },
    })],
  },
})
```

---

## data-test attribute convention

Always add `data-test` attributes to interactive/meaningful elements. Never query by CSS classes (they change during styling work).

```html
<!-- ✅ good -->
<button data-test="submit-btn">Submit</button>
<p data-test="error-msg">{{ error }}</p>

<!-- ❌ avoid -->
<button class="btn-primary">Submit</button>
```

```ts
wrapper.find('[data-test="submit-btn"]').trigger('click')
wrapper.find('[data-test="error-msg"]').text()
```
