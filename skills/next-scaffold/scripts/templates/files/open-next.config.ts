import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// Default OpenNext-on-Cloudflare config: no incremental cache, no R2/KV bindings. This app is
// client-rendered and keeps no server state; add a cache override here only if you add ISR.
export default defineCloudflareConfig()
