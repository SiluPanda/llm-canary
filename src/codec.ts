// Packet format: [0xCA, 0x1A, length, ...payload bytes, xor_checksum]
const MAGIC = [0xca, 0x1a]

export function encodePacket(payload: string): Uint8Array {
  const encoder = new TextEncoder()
  const payloadBytes = encoder.encode(payload)
  if (payloadBytes.length > 255) {
    throw new Error(`Payload too large: ${payloadBytes.length} bytes (max 255)`)
  }
  let checksum = 0
  for (const b of payloadBytes) {
    checksum ^= b
  }
  const packet = new Uint8Array(MAGIC.length + 1 + payloadBytes.length + 1)
  packet[0] = MAGIC[0]
  packet[1] = MAGIC[1]
  packet[2] = payloadBytes.length
  packet.set(payloadBytes, 3)
  packet[packet.length - 1] = checksum
  return packet
}

export function decodePacket(bytes: Uint8Array): { payload: string; checksumValid: boolean } | null {
  if (bytes.length < 4) return null
  if (bytes[0] !== MAGIC[0] || bytes[1] !== MAGIC[1]) return null
  const length = bytes[2]
  if (bytes.length < 3 + length + 1) return null
  const payloadBytes = bytes.slice(3, 3 + length)
  const storedChecksum = bytes[3 + length]
  let computed = 0
  for (const b of payloadBytes) {
    computed ^= b
  }
  const checksumValid = computed === storedChecksum
  const decoder = new TextDecoder()
  const payload = decoder.decode(payloadBytes)
  return { payload, checksumValid }
}
