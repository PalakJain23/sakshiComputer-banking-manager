import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createOwner, openDatabase } from './database.js'

let directory
let livePath
let snapshotPath
let frontendDirectory

before(async () => {
  directory = mkdtempSync(join(tmpdir(), 'sakshi-computer-backup-test-'))
  livePath = join(directory, 'live.sqlite')
  snapshotPath = join(directory, 'backup.sqlite')
  frontendDirectory = fileURLToPath(new URL('..', import.meta.url))

  const database = await openDatabase(livePath)
  await createOwner(database, 'backup-owner', 'fictional test passphrase 481')
  await database.execute(
    'INSERT INTO applications (id, data, status, submitted_on, account_opened_on, created_at, updated_at) VALUES (?, ?, ?, NULL, NULL, ?, ?)',
    ['backup-test-record', JSON.stringify({ firstName: 'Fictional Backup' }), 'Draft', '2026-10-24', '2026-10-24'],
  )
  await database.close()
})

after(() => {
  rmSync(directory, { recursive: true, force: true })
})

test('backup and restore commands preserve a separate SQLite test database', async () => {
  const environment = {
    ...process.env,
    DATABASE_PATH: livePath,
    BACKUP_PATH: snapshotPath,
  }
  execFileSync(process.execPath, ['server/backup.js'], { cwd: frontendDirectory, env: environment })

  const backupDatabase = await openDatabase(snapshotPath)
  const backupRows = await backupDatabase.execute('SELECT COUNT(*) AS count FROM applications')
  assert.equal(
    Number(backupRows.rows[0].count),
    1,
  )
  await backupDatabase.close()

  const liveDatabase = await openDatabase(livePath)
  await liveDatabase.execute('DELETE FROM applications')
  await liveDatabase.close()
  execFileSync(process.execPath, ['server/restore.js', snapshotPath], { cwd: frontendDirectory, env: environment })

  const restoredDatabase = await openDatabase(livePath)
  const restoredRows = await restoredDatabase.execute(
    'SELECT data FROM applications WHERE id = ?',
    ['backup-test-record'],
  )
  assert.equal(
    restoredRows.rows[0].data,
    JSON.stringify({ firstName: 'Fictional Backup' }),
  )
  await restoredDatabase.close()
})
