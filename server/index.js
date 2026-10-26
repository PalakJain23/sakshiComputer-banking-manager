import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import { openDatabase } from './database.js'

export function startServer({
  port = Number(process.env.PORT || 3001),
  host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
} = {}) {
  const database = openDatabase()
  const app = createApp({ database })
  const server = app.listen(port, host, () => {
    console.log(`Sakshi Computer API listening on http://${host}:${server.address().port}`)
  })
  server.on('close', () => database.close())
  return server
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer()
}
