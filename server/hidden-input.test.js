import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import { readHidden } from './hidden-input.js'

test('hidden input ends on Enter and excludes control characters', async () => {
  const input = new PassThrough()
  input.isTTY = true
  input.setRawMode = (enabled) => {
    input.rawMode = enabled
  }
  let outputText = ''
  const output = { write: (text) => { outputText += text } }

  const password = readHidden('Password: ', input, output)
  input.write('Fictional\u0000 \u0085pass\u001bword\r')
  assert.equal(await password, 'Fictional password')
  assert.equal(input.rawMode, false)

  const confirmation = readHidden('Confirm: ', input, output)
  input.write('\nFictional password\r')
  assert.equal(await confirmation, 'Fictional password')
  assert.equal(input.rawMode, false)
  assert.equal(outputText, 'Password: \nConfirm: \n')
  input.destroy()
})
