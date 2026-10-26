import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { createOwner, openDatabase } from './database.js'

async function readHidden(prompt) {
  stdout.write(prompt)
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Owner setup requires an interactive terminal so the password is not exposed.')
  }

  return new Promise((resolve, reject) => {
    let value = ''
    const onData = (chunk) => {
      const text = chunk.toString()
      for (const character of text) {
        if (character === '\u0003') {
          cleanup()
          reject(new Error('Owner setup cancelled.'))
          return
        }
        if (character === '\r' || character === '\n') {
          cleanup()
          stdout.write('\n')
          resolve(value)
          return
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1)
        } else if (character >= ' ') {
          value += character
        }
      }
    }
    const cleanup = () => {
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
    }
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.resume()
    stdin.on('data', onData)
  })
}

async function main() {
  const terminal = createInterface({ input: stdin, output: stdout })
  let database
  try {
    stdout.write('Create the local owner account. No public registration is available.\n')
    const username = (await terminal.question('Owner username: ')).trim()
    const password = await readHidden('Password (at least 14 characters): ')
    const confirmation = await readHidden('Confirm password: ')
    if (password !== confirmation) throw new Error('Passwords do not match.')

    database = openDatabase()
    const owner = createOwner(database, username, password)
    stdout.write(`Owner account "${owner.username}" created. Keep the database file private.\n`)
  } finally {
    terminal.close()
    database?.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
