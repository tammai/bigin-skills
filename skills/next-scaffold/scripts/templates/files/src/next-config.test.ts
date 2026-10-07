import { afterEach, describe, expect, it, vi } from 'vitest'
// Next bundles path-to-regexp, the matcher behind rewrites(), without a declaration file.
// @ts-expect-error -- no types for next/dist/compiled/path-to-regexp
import { pathToRegexp } from 'next/dist/compiled/path-to-regexp'
import nextConfig from '../next.config'

// next.config.ts calls initOpenNextCloudflareForDev() at import; stub it so no wrangler proxy starts.
vi.mock('@opennextjs/cloudflare', () => ({ initOpenNextCloudflareForDev: vi.fn() }))

type Rewrite = { source: string, destination: string }

async function rewrites(): Promise<Rewrite[]> {
  return (await nextConfig.rewrites!()) as Rewrite[]
}

describe('next.config rewrites (the /api pass-through)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('forwards only /api/v<digits>/** to API_ORIGIN, version and path kept', async () => {
    vi.stubEnv('API_ORIGIN', 'https://api.example.com')
    expect(await rewrites()).toEqual([{ source: '/api/v:ver(\\d+)/:path*', destination: 'https://api.example.com/api/v:ver/:path*' }])
  })

  it('accepts an origin with a trailing slash or a port, and keeps only the origin', async () => {
    vi.stubEnv('API_ORIGIN', 'http://localhost:8090/')
    expect((await rewrites())[0].destination).toBe('http://localhost:8090/api/v:ver/:path*')
  })

  // Matching is case-insensitive (Next's default), so /api/V1/x also forwards — to /api/v1/x,
  // since the destination spells the literal "v".
  it('matches versioned API paths and nothing else under /api', async () => {
    vi.stubEnv('API_ORIGIN', 'https://api.example.com')
    const [{ source }] = await rewrites()
    const regexp: RegExp = pathToRegexp(source)
    for (const path of ['/api/v1', '/api/v1/user/profile', '/api/v12/auth/session', '/api/v1/x/']) {
      expect(regexp.test(path), path).toBe(true)
    }
    for (const path of ['/api/v1x/y', '/api/v/x', '/api/other', '/api/internal/x', '/api', '/api/v1%2fx', '/x/api/v1/y']) {
      expect(regexp.test(path), path).toBe(false)
    }
  })

  it('fails with a message naming API_ORIGIN when it is unset', async () => {
    vi.stubEnv('API_ORIGIN', '')
    await expect(rewrites()).rejects.toThrow(/API_ORIGIN is not set/)
  })

  it.each(['not a url', 'ftp://api.example.com', 'https://api.example.com/api/v1', 'https://api.example.com?x=1', 'https://user:pw@api.example.com'])(
    'rejects %s as an origin',
    async (value) => {
      vi.stubEnv('API_ORIGIN', value)
      await expect(rewrites()).rejects.toThrow(/API_ORIGIN/)
    }
  )
})
