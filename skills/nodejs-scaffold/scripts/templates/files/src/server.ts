import { buildApp } from './app.js'
import { env } from './config/env.js'

const app = buildApp()

async function start(): Promise<void> {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info(`${signal} received, shutting down`)
    app.close().finally(() => process.exit(0))
  })
}

start()
