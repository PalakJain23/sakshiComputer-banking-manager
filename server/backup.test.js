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

before(() => {
  directory = mkdtempSync(join(tmpdir(), 'sakshi-computer-backup-test-'))
  livePath = join(directory, 'live.sqlite')
  snapshotPath = join(directory, 'backup.sqlite')
  frontendDirectory = fileURLToPath(new URL('..', import.meta.url))

  const database = openDatabase(livePath)
  createOwner(database, 'backup-owner', 'fictional test passphrase 481')
  database.prepare(
    'INSERT INTO applications (id, data, status, submitted_on, account_opened_on, created_at, updated_at) VALUES (?, ?, ?, NULL, NULL, ?, ?)',
  ).run('backup-test-record', JSON.stringify({ firstName: 'Fictional Backup' }), 'Draft', '2026-10-24', '2026-10-24')
  database.close()
})

after(() => {
  rmSync(directory, { recursive: true, force: true })
})

test('backup and restore commands preserve a separate SQLite test database', () => {
  const environment = {
    ...process.env,
    DATABASE_PATH: livePath,
    BACKUP_PATH: snapshotPath,
  }
  execFileSync(process.execPath, ['server/backup.js'], { cwd: frontendDirectory, env: environment })

  const backupDatabase = openDatabase(snapshotPath)
  assert.equal(
    backupDatabase.prepare('SELECT COUNT(*) AS count FROM applications').get().count,
    1,
  )
  backupDatabase.close()

  const liveDatabase = openDatabase(livePath)
  liveDatabase.prepare('DELETE FROM applications').run()
  liveDatabase.close()
  execFileSync(process.execPath, ['server/restore.js', snapshotPath], { cwd: frontendDirectory, env: environment })

  const restoredDatabase = openDatabase(livePath)
  assert.equal(
    restoredDatabase.prepare('SELECT data FROM applications WHERE id = ?').get('backup-test-record').data,
    JSON.stringify({ firstName: 'Fictional Backup' }),
  )
  restoredDatabase.close()
})
