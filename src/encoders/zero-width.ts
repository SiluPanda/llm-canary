// Encode binary data as zero-width Unicode characters:
// bit 0 = U+200B (zero-width space)
// bit 1 = U+200C (zero-width non-joiner)
// byte separator = U+200D (zero-width joiner)

const BIT0 = '\u200B'
const BIT1 = '\u200C'
const SEP = '\u200D'

export function encodeZeroWidth(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''
  const parts: string[] = []
  for (const byte of bytes) {
    let byteStr = ''
    for (let bit = 7; bit >= 0; bit--) {
      byteStr += (byte >> bit) & 1 ? BIT1 : BIT0
    }
    parts.push(byteStr)
  }
  return parts.join(SEP)
}

export function decodeZeroWidth(text: string): Uint8Array | null {
  // Extract all zero-width chars
  const zwChars = [...text].filter(c => c === BIT0 || c === BIT1 || c === SEP)
  if (zwChars.length === 0) return null

  // Split on SEP to get per-byte bit strings
  const segments = zwChars.join('').split(SEP)
  const bytes: number[] = []
  for (const seg of segments) {
    if (seg.length === 0) continue
    if (seg.length !== 8) continue
    let byte = 0
    for (let i = 0; i < 8; i++) {
      byte = (byte << 1) | (seg[i] === BIT1 ? 1 : 0)
    }
    bytes.push(byte)
  }
  if (bytes.length === 0) return null
  return new Uint8Array(bytes)
}
