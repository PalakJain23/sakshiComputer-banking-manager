import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import {
  createPasswordHash,
  createSession,
  ensureConfiguredOwner,
  findSession,
  authenticateOwner,
  openDatabase,
  openTursoDatabase,
  readOwnerCredentials,
} from './database.js'

const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  TURSO_DATABASE_ENGINE: process.env.TURSO_DATABASE_ENGINE,
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
}

function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

after(restoreEnvironment)

test('production refuses to open a local database without Turso credentials', async () => {
  process.env.NODE_ENV = 'production'
  delete process.env.TURSO_DATABASE_ENGINE
  delete process.env.TURSO_DATABASE_URL
  delete process.env.TURSO_AUTH_TOKEN

  await assert.rejects(
    openDatabase(),
    /Production requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN/,
  )
})

test('Turso configuration rejects a missing token or engine selection', async () => {
  process.env.NODE_ENV = 'test'
  process.env.TURSO_DATABASE_URL = 'libsql://example.turso.io'
  delete process.env.TURSO_AUTH_TOKEN
  process.env.TURSO_DATABASE_ENGINE = 'libsql'
  await assert.rejects(openDatabase(), /Set both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN/)

  process.env.TURSO_AUTH_TOKEN = 'not-a-real-token'
  delete process.env.TURSO_DATABASE_ENGINE
  await assert.rejects(openDatabase(), /Set TURSO_DATABASE_ENGINE/)
})

test('configured owner authentication preserves existing rows and customer data', async () => {
  process.env.NODE_ENV = 'test'
  delete process.env.TURSO_DATABASE_ENGINE
  delete process.env.TURSO_DATABASE_URL
  delete process.env.TURSO_AUTH_TOKEN
  await assert.rejects(openTursoDatabase(), /requires Turso URL, auth token, and engine/)

  const directory = mkdtempSync(join(tmpdir(), 'sakshi-owner-reset-test-'))
  const database = await openDatabase(join(directory, 'isolated.sqlite'))
  try {
    assert.throws(() => readOwnerCredentials({}), /OWNER_USERNAME is required/)
    assert.throws(
      () => readOwnerCredentials({ OWNER_USERNAME: 'SakshiComputer', OWNER_PASSWORD_HASH: 'plaintext' }),
      /scrypt hash/,
    )

    const legacyOwnerResult = await database.execute(
      'INSERT INTO owners (id, username, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      ['legacy-fictional-owner-id', 'Fictional.Owner', 'legacy-fictional-salt', 'legacy-fictional-hash', '2026-10-27'],
    )
    assert.equal(legacyOwnerResult.rowsAffected, 1)

    const password = 'fictional test passphrase 624'
    const encodedHash = createPasswordHash(password)
    const [, salt, hash] = encodedHash.split('$')
    const credentials = { username: 'fictional.owner', encodedHash, salt, hash }
    const owner = await ensureConfiguredOwner(database, credentials)
    assert.equal(owner.id, 'legacy-fictional-owner-id')
    assert.deepEqual(await ensureConfiguredOwner(database, credentials), owner)
    assert.equal(
      (await authenticateOwner(database, ' Fictional.Owner ', password, credentials)).owner.id,
      owner.id,
    )
    assert.equal(
      (await authenticateOwner(database, 'Fictional.Owner', `${password}wrong`, credentials)).failureStage,
      'PASSWORD_MISMATCH',
    )
    assert.equal(
      (await authenticateOwner(database, 'not-the-owner', password, credentials)).failureStage,
      'OWNER_NOT_FOUND',
    )

    const preservedOwner = await database.execute(
      'SELECT password_salt, password_hash FROM owners WHERE id = ?',
      [owner.id],
    )
    assert.equal(preservedOwner.rows[0].password_salt, 'legacy-fictional-salt')
    assert.equal(preservedOwner.rows[0].password_hash, 'legacy-fictional-hash')

    const session = await createSession(database, owner.id)
    await database.execute(
      `INSERT INTO applications
        (id, data, status, submitted_on, account_opened_on, created_at, updated_at)
        VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
      [
        'fictional-owner-reset-record',
        JSON.stringify({ firstName: 'Fictional Customer' }),
        'Draft',
        '2026-10-27',
        '2026-10-27',
      ],
    )

    assert.equal((await findSession(database, session.token)).id, owner.id)

    const records = await database.execute(
      'SELECT id, data FROM applications WHERE id = ?',
      ['fictional-owner-reset-record'],
    )
    assert.equal(records.rows.length, 1)
    assert.equal(JSON.parse(records.rows[0].data).firstName, 'Fictional Customer')

    const newEncodedHash = createPasswordHash('another fictional passphrase 738')
    const [, newSalt, newHash] = newEncodedHash.split('$')
    const newCredentials = {
      username: 'second-fictional-owner',
      encodedHash: newEncodedHash,
      salt: newSalt,
      hash: newHash,
    }
    const insertedOwner = await ensureConfiguredOwner(database, newCredentials)
    assert.equal(insertedOwner.username, newCredentials.username)
    const insertedSession = await createSession(database, insertedOwner.id)
    assert.equal((await findSession(database, insertedSession.token)).id, insertedOwner.id)
  } finally {
    await database.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
