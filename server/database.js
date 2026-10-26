import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000
const SERVER_DIRECTORY = dirname(fileURLToPath(import.meta.url))

export function openDatabase(databasePath = process.env.DATABASE_PATH) {
  const resolvedPath = resolve(SERVER_DIRECTORY, databasePath || './data/sakshi.sqlite')
  mkdirSync(dirname(resolvedPath), { recursive: true })
  const database = new DatabaseSync(resolvedPath)
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS owners (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Draft', 'Form ready', 'Submitted', 'Account opened')),
      submitted_on TEXT,
      account_opened_on TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS applications_updated_at ON applications(updated_at DESC);
    CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
  `)
  const applicationColumns = database.prepare('PRAGMA table_info(applications)').all()
  if (!applicationColumns.some((column) => column.name === 'account_opened_on')) {
    database.exec('ALTER TABLE applications ADD COLUMN account_opened_on TEXT')
  }
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
  return database
}

export function resolveDatabasePath(databasePath = process.env.DATABASE_PATH) {
  return resolve(SERVER_DIRECTORY, databasePath || './data/sakshi.sqlite')
}

export function createOwner(database, username, password) {
  if (database.prepare('SELECT COUNT(*) AS count FROM owners').get().count > 0) {
    throw new Error('The one-time owner setup has already been completed for this database.')
  }
  const normalizedUsername = username.trim()
  if (normalizedUsername.length < 3 || normalizedUsername.length > 64) {
    throw new Error('Username must be between 3 and 64 characters.')
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(normalizedUsername)) {
    throw new Error('Username may only contain letters, numbers, dots, underscores, and hyphens.')
  }
  if (password.length < 14 || password.length > 256) {
    throw new Error('Password must be at least 14 characters and no more than 256 characters.')
  }

  const id = randomBytes(16).toString('hex')
  const salt = randomBytes(16).toString('hex')
  const passwordHash = scryptSync(password, salt, 64).toString('hex')
  database.prepare(
    'INSERT INTO owners (id, username, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, normalizedUsername, salt, passwordHash, new Date().toISOString())
  return { id, username: normalizedUsername }
}

export function verifyOwner(database, username, password) {
  const owner = database.prepare(
    'SELECT id, username, password_salt, password_hash FROM owners WHERE username = ? COLLATE NOCASE',
  ).get(username.trim())
  if (!owner) {
    scryptSync(password, 'sakshi-computer-invalid-user-salt', 64)
    return null
  }
  const actualHash = scryptSync(password, owner.password_salt, 64)
  const expectedHash = Buffer.from(owner.password_hash, 'hex')
  if (actualHash.length !== expectedHash.length || !timingSafeEqual(actualHash, expectedHash)) return null
  return { id: owner.id, username: owner.username }
}

export function createSession(database, ownerId) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = Date.now() + SESSION_DURATION_MS
  database.prepare('INSERT INTO sessions (token_hash, owner_id, expires_at) VALUES (?, ?, ?)').run(
    hashSessionToken(token),
    ownerId,
    expiresAt,
  )
  return { token, expiresAt }
}

export function findSession(database, token) {
  if (!token) return null
  const row = database.prepare(`
    SELECT owners.id, owners.username, sessions.expires_at
    FROM sessions
    JOIN owners ON owners.id = sessions.owner_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(hashSessionToken(token), Date.now())
  return row ? { id: row.id, username: row.username, expiresAt: row.expires_at } : null
}

export function deleteSession(database, token) {
  if (token) database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(token))
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export const SESSION_COOKIE_NAME = 'sakshi_owner_session'
