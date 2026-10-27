import { backup, DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveDatabasePath } from './database.js'

const serverDirectory = dirname(fileURLToPath(import.meta.url))

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function main() {
  if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN || process.env.NODE_ENV === 'production') {
    throw new Error('This command backs up local SQLite only. Use `turso db shell <database-name> .dump` for a remote database.')
  }
  const databasePath = resolveDatabasePath()
  const backupPath = resolve(
    serverDirectory,
    process.env.BACKUP_PATH || `./backups/sakshi-backup-${timestamp()}.sqlite`,
  )
  if (backupPath === databasePath) {
    throw new Error('The backup path must be different from the live database path.')
  }
  mkdirSync(dirname(backupPath), { recursive: true })

  const database = new DatabaseSync(databasePath, { readOnly: true })
  try {
    await backup(database, backupPath)
  } finally {
    database.close()
  }
  console.log(`SQLite backup created at ${backupPath}`)
}

main().catch((error) => {
  console.error(`Backup failed: ${error.message}`)
  process.exitCode = 1
})
