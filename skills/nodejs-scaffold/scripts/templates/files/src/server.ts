import { run } from 'graphile-worker'
import { buildApp } from './api/app.js'
import { env } from './shared/config/env.js'
import { registerAllSubscriptions } from './subscriptions.js'
import { taskList, crontab } from './shared/job-queue/task-list.js'

async function main(): Promise<void> {
  // Subscriptions MUST be registered before the job runner's first tick — the
  // outbox relay publishes to the in-process event bus, which only has handlers
  // if every module has run its subscribe() calls. Running the runner in THIS
  // process (not a separate worker) is what makes that possible. Future split
  // path: a second worker.ts entrypoint that imports this same registration.
  registerAllSubscriptions()

  const app = await buildApp()

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }

  const runner = await run({
    connectionString: env.DATABASE_URL,
    concurrency: 5,
    taskList,
    crontab
  })

  const shutdown = (signal: string): void => {
    app.log.info(`${signal} received, shutting down`)
    Promise.allSettled([app.close(), runner.stop()]).finally(() => process.exit(0))
  }
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => shutdown(signal))
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
