import { randomInt } from 'node:crypto'
import { encodeZeroWidth } from './encoders/zero-width'
import { encodeHomoglyph } from './encoders/homoglyph'
import { encodePacket } from './codec'
import type { CanaryToken, EmbedOptions } from './types'

function insertAt(prompt: string, marker: string, position: EmbedOptions['position']): string {
  const pos = position ?? 'end'
  if (pos === 'start') {
    return marker + prompt
  }
  if (pos === 'end') {
    return prompt + marker
  }
  if (pos === 'after-first-sentence') {
    const match = prompt.match(/[.!?]\s/)
    if (match && match.index !== undefined) {
      const idx = match.index + match[0].length
      return prompt.slice(0, idx) + marker + prompt.slice(idx)
    }
    return prompt + marker
  }
  if (pos === 'before-last-sentence') {
    // Find start of last sentence
    const trimmed = prompt.trimEnd()
    const match = [...trimmed.matchAll(/[.!?]\s+/g)].at(-1)
    if (match && match.index !== undefined) {
      const idx = match.index + match[0].length
      return prompt.slice(0, idx) + marker + prompt.slice(idx)
    }
    return marker + prompt
  }
  if (pos === 'random') {
    const idx = randomInt(0, prompt.length + 1)
    return prompt.slice(0, idx) + marker + prompt.slice(idx)
  }
  return prompt + marker
}

export function embed(prompt: string, token: CanaryToken, options?: EmbedOptions): string {
  const bytes = encodePacket(token.payload)

  if (token.type === 'homoglyph') {
    // encodeHomoglyph replaces chars in-place, returns full modified text
    return encodeHomoglyph(prompt, bytes)
  }

  if (token.type === 'whitespace') {
    // Encode as trailing spaces per line: 1 space = bit 0, 2 spaces = bit 1
    // Each line carries one bit; we need bytes.length * 8 lines
    const bits: number[] = []
    for (const byte of bytes) {
      for (let bit = 7; bit >= 0; bit--) {
        bits.push((byte >> bit) & 1)
      }
    }
    const lines = prompt.split('\n')
    if (lines.length < bits.length) {
      throw new Error(`Insufficient whitespace capacity: need ${bits.length} lines, found ${lines.length}`)
    }
    let bitIndex = 0
    const encodedLines = lines.map(line => {
      if (bitIndex >= bits.length) return line
      const trailing = bits[bitIndex] === 1 ? '  ' : ' '
      bitIndex++
      return line + trailing
    })
    return encodedLines.join('\n')
  }

  // zero-width (default)
  const marker = encodeZeroWidth(bytes)
  return insertAt(prompt, marker, options?.position)
}
