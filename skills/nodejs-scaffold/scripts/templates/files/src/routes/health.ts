import { readFileSync } from 'node:fs'
import type { FastifyInstance } from 'fastify'
import { checkConnection } from '../db/client.js'

let openapiSpec: string | undefined
try {
  openapiSpec = readFileSync(new URL('../../openapi.yaml', import.meta.url), 'utf8')
} catch {
  openapiSpec = undefined
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async () => 'ok')

  app.get('/readyz', async (_request, reply) => {
    const ok = await checkConnection()
    if (!ok) {
      reply.code(503)
      return 'db unavailable'
    }
    return 'ready'
  })

  app.get('/openapi.yaml', async (_request, reply) => {
    if (!openapiSpec) {
      reply.code(404)
      return
    }
    reply.type('application/yaml')
    return openapiSpec
  })

  app.get('/docs', async (_request, reply) => {
    reply.type('text/html')
    return docsHTML
  })
}

const docsHTML = `<!doctype html>
<html>
  <head>
    <title>API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({ url: '/openapi.yaml', dom_id: '#swagger-ui' })
      }
    </script>
  </body>
</html>`
