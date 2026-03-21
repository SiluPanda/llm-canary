// Latin <-> Cyrillic lookalike substitution
// bit 0 = keep Latin, bit 1 = substitute with Cyrillic

const PAIRS: [string, string][] = [
  ['a', 'а'], ['c', 'с'], ['e', 'е'], ['o', 'о'],
  ['p', 'р'], ['x', 'х'], ['y', 'у'],
  ['A', 'А'], ['B', 'В'], ['C', 'С'], ['E', 'Е'],
  ['H', 'Н'], ['K', 'К'], ['M', 'М'], ['O', 'О'],
  ['P', 'Р'], ['T', 'Т'], ['X', 'Х'], ['Y', 'У'],
]

// Build lookup maps
const latinToCyrillic = new Map<string, string>(PAIRS.map(([l, c]) => [l, c]))
const cyrillicToLatin = new Map<string, string>(PAIRS.map(([l, c]) => [c, l]))
const substitutable = new Set<string>(PAIRS.map(([l]) => l))

export function encodeHomoglyph(text: string, bytes: Uint8Array): string {
  // Find all substitutable positions in text
  const positions: number[] = []
  for (let i = 0; i < text.length; i++) {
    if (substitutable.has(text[i])) {
      positions.push(i)
    }
  }

  // We need one substitutable position per bit
  const bitsNeeded = bytes.length * 8
  if (positions.length < bitsNeeded) {
    throw new Error(
      `Insufficient capacity: need ${bitsNeeded} substitutable chars, found ${positions.length}`
    )
  }

  const chars = text.split('')
  let bitIndex = 0
  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex++) {
    for (let bit = 7; bit >= 0; bit--) {
      const bitVal = (bytes[byteIndex] >> bit) & 1
      const pos = positions[bitIndex]
      if (bitVal === 1) {
        chars[pos] = latinToCyrillic.get(chars[pos]) ?? chars[pos]
      }
      bitIndex++
    }
  }
  return chars.join('')
}

export function decodeHomoglyph(text: string): Uint8Array | null {
  // Collect positions that are either Cyrillic lookalikes (=1) or Latin substitutables (=0)
  const bits: number[] = []
  for (const ch of text) {
    if (cyrillicToLatin.has(ch)) {
      bits.push(1)
    } else if (substitutable.has(ch)) {
      bits.push(0)
    }
  }
  if (bits.length === 0) return null

  // Reconstruct bytes from bits (groups of 8)
  const byteCount = Math.floor(bits.length / 8)
  if (byteCount === 0) return null
  const bytes = new Uint8Array(byteCount)
  for (let i = 0; i < byteCount; i++) {
    let byte = 0
    for (let bit = 0; bit < 8; bit++) {
      byte = (byte << 1) | bits[i * 8 + bit]
    }
    bytes[i] = byte
  }
  return bytes
}
