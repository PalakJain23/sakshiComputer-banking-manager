import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { authenticateOwner, openTursoDatabase } from './database.js'
import { readHidden } from './hidden-input.js'

async function main() {
  const url = process.env.TURSO_DATABASE_URL
  const engine = process.env.TURSO_DATABASE_ENGINE
  if (!url || !process.env.TURSO_AUTH_TOKEN || !engine) {
    throw new Error(
      'Credential check requires TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, and TURSO_DATABASE_ENGINE in the local environment.',
    )
  }
  const hostname = new URL(url).hostname

  const terminal = createInterface({ input: stdin, output: stdout })
  let database
  try {
    const username = await terminal.question('Owner username: ')
    terminal.close()
    const password = await readHidden('Owner password: ')

    database = await openTursoDatabase({ initialize: false })
    const authentication = await authenticateOwner(database, username, password)

    stdout.write(`Database hostname: ${hostname}\n`)
    stdout.write(`Database engine: ${engine}\n`)
    stdout.write(`Owner found: ${authentication.ownerFound ? 'yes' : 'no'}\n`)
    stdout.write(`Password verification: ${authentication.passwordVerified ? 'pass' : 'fail'}\n`)
  } finally {
    terminal.close()
    await database?.close()
  }
}

main().catch(() => {
  console.error('Credential check could not complete; no password or database credentials were displayed.')
  process.exitCode = 1
})
