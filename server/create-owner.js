import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { createPasswordHash } from './database.js'
import { readHidden } from './hidden-input.js'

async function main() {
  const terminal = createInterface({ input: stdin, output: stdout })
  try {
    stdout.write('Generate a salted scrypt hash for the Sakshi Computer owner password.\n')
    const confirmation = await terminal.question('Type GENERATE to continue: ')
    if (confirmation !== 'GENERATE') throw new Error('Password-hash generation cancelled.')
    terminal.close()

    const password = await readHidden('New owner password (at least 14 characters): ')
    const repeatedPassword = await readHidden('Confirm owner password: ')
    if (password !== repeatedPassword) throw new Error('Passwords do not match.')

    stdout.write(`OWNER_PASSWORD_HASH=${createPasswordHash(password)}\n`)
    stdout.write('Copy the hash directly into the server environment; do not share or commit it.\n')
  } finally {
    terminal.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
