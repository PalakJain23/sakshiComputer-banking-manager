import { backup } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase, resolveDatabasePath } from './database.js'

const serverDirectory = dirname(fileURLToPath(import.meta.url))

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function main() {
  const databasePath = resolveDatabasePath()
  const backupPath = resolve(
    serverDirectory,
    process.env.BACKUP_PATH || `./backups/sakshi-backup-${timestamp()}.sqlite`,
  )
  if (backupPath === databasePath) {
    throw new Error('The backup path must be different from the live database path.')
  }
  mkdirSync(dirname(backupPath), { recursive: true })

  const database = openDatabase(databasePath)
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
