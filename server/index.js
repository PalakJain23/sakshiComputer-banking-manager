import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import {
  ensureConfiguredOwner,
  getDatabaseDiagnostics,
  openDatabase,
  readOwnerCredentials,
} from './database.js'

export async function startServer({
  port = Number(process.env.PORT || 3001),
  host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
} = {}) {
  const ownerCredentials = readOwnerCredentials()
  const database = await openDatabase()
  try {
    await ensureConfiguredOwner(database, ownerCredentials)
  } catch (error) {
    await database.close()
    throw new Error(`Could not prepare configured owner session record: ${error.message}`, { cause: error })
  }
  if (process.env.AUTH_DEBUG === 'true') {
    const { hostname, engine } = getDatabaseDiagnostics()
    const commit = process.env.RENDER_GIT_COMMIT || 'unknown'
    const deploymentCommit = /^[0-9a-f]{7,40}$/i.test(commit) ? commit : 'unknown'
    console.info(
      `AUTH_DIAGNOSTIC startup deploymentCommit=${deploymentCommit} `
      + `databaseHostname=${hostname} databaseEngine=${engine}`,
    )
  }
  const app = createApp({ database, ownerCredentials })
  const server = app.listen(port, host, () => {
    console.log(`Sakshi Computer API listening on http://${host}:${server.address().port}`)
  })
  server.on('close', () => {
    database.close().catch((error) => console.error(`Database close failed: ${error.message}`))
  })
  return server
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().catch((error) => {
    console.error(`Server startup failed: ${error.message}`)
    process.exitCode = 1
  })
}
