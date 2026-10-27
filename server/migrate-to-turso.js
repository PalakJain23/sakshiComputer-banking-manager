import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'
import { openDatabase, resolveDatabasePath } from './database.js'

function readLocalRecords(database) {
  const requiredTables = ['owners', 'sessions', 'applications']
  for (const table of requiredTables) {
    const exists = database.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
    ).get(table)
    if (!exists) throw new Error(`The local SQLite database is missing its ${table} table.`)
  }

  const applicationColumns = database.prepare('PRAGMA table_info(applications)').all()
  const openedDateColumn = applicationColumns.some((column) => column.name === 'account_opened_on')
    ? 'account_opened_on'
    : 'NULL AS account_opened_on'
  return {
    owners: database.prepare('SELECT id, username, password_salt, password_hash, created_at FROM owners').all(),
    sessions: database.prepare('SELECT token_hash, owner_id, expires_at FROM sessions').all(),
    applications: database.prepare(`
      SELECT id, data, status, submitted_on, ${openedDateColumn}, created_at, updated_at
      FROM applications
    `).all(),
  }
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    throw new Error('No data was copied. Review the source and target, then rerun with --confirm.')
  }
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN || !process.env.TURSO_DATABASE_ENGINE) {
    throw new Error(
      'Migration requires TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, and TURSO_DATABASE_ENGINE; local-only mode is not allowed.',
    )
  }

  const sourcePath = resolveDatabasePath()
  if (!existsSync(sourcePath)) throw new Error(`Local SQLite database not found: ${sourcePath}`)

  const source = new DatabaseSync(sourcePath, { readOnly: true })
  let records
  try {
    source.exec('BEGIN')
    records = readLocalRecords(source)
    source.exec('COMMIT')
  } catch (error) {
    try {
      source.exec('ROLLBACK')
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'SQLite read and rollback both failed.')
    }
    throw error
  } finally {
    source.close()
  }

  const database = await openDatabase()
  try {
    const counts = await Promise.all(['owners', 'sessions', 'applications'].map(async (table) => {
      const result = await database.execute(`SELECT COUNT(*) AS count FROM ${table}`)
      return Number(result.rows[0].count)
    }))
    if (counts.some((count) => count !== 0)) {
      throw new Error('The Turso target is not empty. Migration stopped without changing it.')
    }

    await database.transaction(async (transaction) => {
      for (const owner of records.owners) {
        await transaction.execute(
          'INSERT INTO owners (id, username, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
          [owner.id, owner.username, owner.password_salt, owner.password_hash, owner.created_at],
        )
      }
      for (const session of records.sessions) {
        await transaction.execute(
          'INSERT INTO sessions (token_hash, owner_id, expires_at) VALUES (?, ?, ?)',
          [session.token_hash, session.owner_id, session.expires_at],
        )
      }
      for (const application of records.applications) {
        await transaction.execute(
          `INSERT INTO applications
            (id, data, status, submitted_on, account_opened_on, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            application.id,
            application.data,
            application.status,
            application.submitted_on,
            application.account_opened_on,
            application.created_at,
            application.updated_at,
          ],
        )
      }
    })
    console.log(
      `Migration complete: ${records.owners.length} owner(s), ${records.sessions.length} session(s), `
      + `${records.applications.length} application(s) copied. The local SQLite database was not changed.`,
    )
  } finally {
    await database.close()
  }
}

main().catch((error) => {
  console.error(`Turso migration failed: ${error.message}`)
  process.exitCode = 1
})
