import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { backup, DatabaseSync } from 'node:sqlite'
import { openDatabase, resolveDatabasePath } from './database.js'

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function main() {
  const requestedBackup = process.argv[2]
  if (!requestedBackup) throw new Error('Provide the path to a SQLite backup file.')

  const backupPath = resolve(requestedBackup)
  const databasePath = resolveDatabasePath()
  if (!existsSync(backupPath)) throw new Error(`Backup file not found: ${backupPath}`)
  if (backupPath === databasePath) throw new Error('The backup file must be different from the live database.')

  const liveDatabase = openDatabase(databasePath)
  liveDatabase.close()
  const safetyPath = `${databasePath}.pre-restore-${timestamp()}.sqlite`
  const currentDatabase = new DatabaseSync(databasePath)
  try {
    await backup(currentDatabase, safetyPath)
  } finally {
    currentDatabase.close()
  }

  const sourceDatabase = new DatabaseSync(backupPath, { readOnly: true })
  try {
    await backup(sourceDatabase, databasePath)
  } finally {
    sourceDatabase.close()
  }
  console.log(`Database restored from ${backupPath}. Safety copy: ${safetyPath}`)
}

main().catch((error) => {
  console.error(`Restore failed: ${error.message}`)
  process.exitCode = 1
})
