import { stdin, stdout } from 'node:process'

let discardNextLineFeed = false

export function readHidden(prompt, input = stdin, output = stdout) {
  output.write(prompt)
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Password input requires an interactive terminal so it is not exposed.')
  }

  return new Promise((resolve, reject) => {
    let value = ''
    let settled = false
    const cleanup = () => {
      input.off('data', onData)
      input.setRawMode(false)
      input.pause()
    }
    const finish = (error) => {
      if (settled) return
      settled = true
      cleanup()
      if (error) reject(error)
      else {
        output.write('\n')
        resolve(value)
      }
    }
    const onData = (chunk) => {
      const text = chunk.toString()
      for (let index = 0; index < text.length; index += 1) {
        const character = text[index]
        if (discardNextLineFeed) {
          discardNextLineFeed = false
          if (character === '\n') continue
        }
        if (character === '\u0003') {
          finish(new Error('Password input cancelled.'))
          return
        }
        if (character === '\r' || character === '\n') {
          discardNextLineFeed = character === '\r' && index + 1 === text.length
          finish()
          return
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1)
        } else if (
          character.codePointAt(0) >= 0x20
          && !(character.codePointAt(0) >= 0x7f && character.codePointAt(0) <= 0x9f)
        ) {
          value += character
        }
      }
    }

    input.setRawMode(true)
    input.setEncoding('utf8')
    input.resume()
    input.on('data', onData)
  })
}
