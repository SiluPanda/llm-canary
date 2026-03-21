import { describe, it, expect } from 'vitest'
import { generate } from '../generate'
import { embed } from '../embed'
import { detect } from '../detect'
import { verify, createCanary } from '../canary'

const ZW_SPACE = '\u200B'
const ZW_NON_JOINER = '\u200C'
const ZW_JOINER = '\u200D'

function hasZeroWidthChars(text: string): boolean {
  return text.includes(ZW_SPACE) || text.includes(ZW_NON_JOINER) || text.includes(ZW_JOINER)
}

describe('generate()', () => {
  it('returns a token with a UUID payload by default', () => {
    const token = generate()
    expect(token.payload).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('returns zero-width type by default', () => {
    const token = generate()
    expect(token.type).toBe('zero-width')
  })

  it('uses custom payload when provided', () => {
    const token = generate({ payload: 'secret-id-123' })
    expect(token.payload).toBe('secret-id-123')
  })

  it('uses custom type when provided', () => {
    const token = generate({ type: 'homoglyph' })
    expect(token.type).toBe('homoglyph')
  })

  it('includes createdAt ISO timestamp', () => {
    const token = generate()
    expect(() => new Date(token.createdAt)).not.toThrow()
    expect(new Date(token.createdAt).toISOString()).toBe(token.createdAt)
  })
})

describe('embed() zero-width', () => {
  it('produces output containing zero-width chars', () => {
    const token = generate({ payload: 'test-payload' })
    const prompt = 'Hello, world!'
    const embedded = embed(prompt, token)
    expect(hasZeroWidthChars(embedded)).toBe(true)
  })

  it('appends to end by default', () => {
    const token = generate({ payload: 'end-test' })
    const prompt = 'My prompt'
    const embedded = embed(prompt, token)
    expect(embedded.startsWith(prompt)).toBe(true)
  })

  it('prepends when position is start', () => {
    const token = generate({ payload: 'start-test' })
    const prompt = 'My prompt'
    const embedded = embed(prompt, token, { position: 'start' })
    expect(hasZeroWidthChars(embedded.slice(0, 50))).toBe(true)
    expect(embedded).toContain(prompt)
  })
})

describe('detect()', () => {
  it('finds a zero-width embedded token', () => {
    const token = generate({ payload: 'detect-me' })
    const prompt = 'Some text here.'
    const embedded = embed(prompt, token)
    const result = detect(embedded)
    expect(result.found).toBe(true)
    expect(result.tokens).toHaveLength(1)
    expect(result.tokens[0].type).toBe('zero-width')
    expect(result.tokens[0].payload).toBe('detect-me')
    expect(result.tokens[0].checksumValid).toBe(true)
    expect(result.tokens[0].confidence).toBe('high')
  })

  it('returns found=false for plain text', () => {
    const result = detect('No hidden data here.')
    expect(result.found).toBe(false)
    expect(result.tokens).toHaveLength(0)
  })

  it('includes durationMs', () => {
    const result = detect('some text')
    expect(typeof result.durationMs).toBe('number')
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })
})

describe('verify() roundtrip', () => {
  it('returns true for correctly embedded token', () => {
    const token = generate({ payload: 'verify-roundtrip' })
    const embedded = embed('The prompt text.', token)
    expect(verify(embedded, token)).toBe(true)
  })

  it('returns false for plain text', () => {
    const token = generate({ payload: 'some-id' })
    expect(verify('plain text with no hidden data', token)).toBe(false)
  })

  it('returns false when payload does not match', () => {
    const token1 = generate({ payload: 'token-alpha' })
    const token2 = generate({ payload: 'token-beta' })
    const embedded = embed('Hello world.', token1)
    // token2 payload is different, should not be found
    expect(verify(embedded, token2)).toBe(false)
  })
})

describe('homoglyph roundtrip', () => {
  it('embed then detect finds correct payload', () => {
    // Packet = [0xCA, 0x1A, len, ...payload, xor] = 4+2 = 6 bytes = 48 bits needed
    // Use a short payload "ab" so packet is 6 bytes = 48 bits needed
    // Provide a prompt with well over 48 substitutable chars
    const prompt =
      'The quick brown fox jumps over the lazy dog. ' +
      'Pack my box with five dozen liquor jugs. ' +
      'How vexingly quick daft zebras jump! ' +
      'A complex mixture of every character type possible. ' +
      'Explore creative approaches to problems and overcome obstacles effectively.'
    const token = generate({ type: 'homoglyph', payload: 'ab' })
    const embedded = embed(prompt, token)
    const result = detect(embedded, { types: ['homoglyph'] })
    expect(result.found).toBe(true)
    expect(result.tokens[0].type).toBe('homoglyph')
    expect(result.tokens[0].payload).toBe('ab')
    expect(result.tokens[0].checksumValid).toBe(true)
  })

  it('throws when text has insufficient substitutable characters', () => {
    const token = generate({ type: 'homoglyph', payload: 'long-payload-that-needs-many-bits' })
    expect(() => embed('Hi.', token)).toThrow('Insufficient capacity')
  })
})

describe('createCanary()', () => {
  it('returns a canary object with token, embed, detect, verify', () => {
    const canary = createCanary()
    expect(canary.token).toBeDefined()
    expect(typeof canary.embed).toBe('function')
    expect(typeof canary.detect).toBe('function')
    expect(typeof canary.verify).toBe('function')
  })

  it('verify() returns true after embed()', () => {
    const canary = createCanary({ payload: 'canary-test' })
    const embedded = canary.embed('This is the prompt text to protect.')
    expect(canary.verify(embedded)).toBe(true)
  })

  it('respects config type homoglyph', () => {
    // payload "xy" -> packet = 6 bytes = 48 bits needed
    const canary = createCanary({ type: 'homoglyph', payload: 'xy' })
    expect(canary.token.type).toBe('homoglyph')
    // Provide a long prompt with many substitutable chars
    const prompt =
      'Type checking is very important in every project. ' +
      'Homoglyph encoding uses lookalike characters between Latin and Cyrillic alphabets. ' +
      'Accuracy matters when processing text at a byte level. ' +
      'Every character type must be handled properly to ensure correctness.'
    const embedded = canary.embed(prompt)
    expect(canary.verify(embedded)).toBe(true)
  })
})
