import { describe, it, expect } from 'vitest'
import { encodeZeroWidth, decodeZeroWidth } from '../encoders/zero-width'

const ZW_SPACE = '\u200B'
const ZW_NON_JOINER = '\u200C'
const ZW_JOINER = '\u200D'

describe('encodeZeroWidth', () => {
  it('encodes bytes using only zero-width chars', () => {
    const bytes = new Uint8Array([0xAB, 0xCD])
    const encoded = encodeZeroWidth(bytes)
    for (const ch of encoded) {
      expect([ZW_SPACE, ZW_NON_JOINER, ZW_JOINER]).toContain(ch)
    }
  })

  it('returns empty string for empty bytes', () => {
    expect(encodeZeroWidth(new Uint8Array([]))).toBe('')
  })

  it('encodes a single byte as 8 zero-width bits', () => {
    const bytes = new Uint8Array([0b10101010])
    const encoded = encodeZeroWidth(bytes)
    // No separator for single byte, 8 bit chars
    const bits = [...encoded].filter(c => c !== ZW_JOINER)
    expect(bits).toHaveLength(8)
  })
})

describe('decodeZeroWidth roundtrip', () => {
  it('roundtrips single byte', () => {
    const bytes = new Uint8Array([42])
    const encoded = encodeZeroWidth(bytes)
    const decoded = decodeZeroWidth(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded).toEqual(bytes)
  })

  it('roundtrips multiple bytes', () => {
    const bytes = new Uint8Array([0, 127, 255, 0xCA, 0x1A])
    const encoded = encodeZeroWidth(bytes)
    const decoded = decodeZeroWidth(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded).toEqual(bytes)
  })

  it('returns null when no zero-width chars present', () => {
    expect(decodeZeroWidth('hello world')).toBeNull()
  })

  it('ignores surrounding normal text during roundtrip', () => {
    const bytes = new Uint8Array([99, 88])
    const encoded = 'prefix' + encodeZeroWidth(bytes) + 'suffix'
    const decoded = decodeZeroWidth(encoded)
    expect(decoded).toEqual(bytes)
  })
})
