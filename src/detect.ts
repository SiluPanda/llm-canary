import { decodeZeroWidth } from './encoders/zero-width'
import { decodeHomoglyph } from './encoders/homoglyph'
import { decodePacket } from './codec'
import type { DetectedToken, DetectionResult, DetectOptions, Confidence, CanaryType } from './types'

const CONFIDENCE_ORDER: Record<Confidence, number> = { high: 3, medium: 2, low: 1 }

function meetsMinConfidence(conf: Confidence, min: Confidence): boolean {
  return CONFIDENCE_ORDER[conf] >= CONFIDENCE_ORDER[min]
}

export function detect(text: string, options?: DetectOptions): DetectionResult {
  const start = Date.now()
  const enabledTypes: CanaryType[] = options?.types ?? ['zero-width', 'homoglyph', 'whitespace']
  const minConfidence: Confidence = options?.minConfidence ?? 'low'
  const tokens: DetectedToken[] = []

  if (enabledTypes.includes('zero-width')) {
    const bytes = decodeZeroWidth(text)
    if (bytes) {
      const decoded = decodePacket(bytes)
      if (decoded) {
        const confidence: Confidence = decoded.checksumValid ? 'high' : 'medium'
        if (meetsMinConfidence(confidence, minConfidence)) {
          // Find position of zero-width chars in text
          const startIdx = text.search(/[\u200B\u200C\u200D]/)
          let endIdx = startIdx
          if (startIdx !== -1) {
            for (let i = startIdx; i < text.length; i++) {
              const c = text[i]
              if (c === '\u200B' || c === '\u200C' || c === '\u200D') {
                endIdx = i + 1
              } else if (endIdx > startIdx) {
                break
              }
            }
          }
          tokens.push({
            type: 'zero-width',
            payload: decoded.payload,
            confidence,
            checksumValid: decoded.checksumValid,
            position: { start: startIdx === -1 ? 0 : startIdx, end: endIdx },
          })
        }
      }
    }
  }

  if (enabledTypes.includes('homoglyph')) {
    const bytes = decodeHomoglyph(text)
    if (bytes) {
      const decoded = decodePacket(bytes)
      if (decoded) {
        const confidence: Confidence = decoded.checksumValid ? 'high' : 'medium'
        if (meetsMinConfidence(confidence, minConfidence)) {
          tokens.push({
            type: 'homoglyph',
            payload: decoded.payload,
            confidence,
            checksumValid: decoded.checksumValid,
            position: { start: 0, end: text.length },
          })
        }
      }
    }
  }

  if (enabledTypes.includes('whitespace')) {
    const lines = text.split('\n')
    const bits: number[] = []
    for (const line of lines) {
      const trailingMatch = line.match(/ +$/)
      if (trailingMatch) {
        bits.push(trailingMatch[0].length >= 2 ? 1 : 0)
      }
    }
    const byteCount = Math.floor(bits.length / 8)
    if (byteCount > 0) {
      const wsBytes = new Uint8Array(byteCount)
      for (let i = 0; i < byteCount; i++) {
        let byte = 0
        for (let b = 0; b < 8; b++) {
          byte = (byte << 1) | bits[i * 8 + b]
        }
        wsBytes[i] = byte
      }
      const decoded = decodePacket(wsBytes)
      if (decoded) {
        const confidence: Confidence = decoded.checksumValid ? 'high' : 'medium'
        if (meetsMinConfidence(confidence, minConfidence)) {
          tokens.push({
            type: 'whitespace',
            payload: decoded.payload,
            confidence,
            checksumValid: decoded.checksumValid,
            position: { start: 0, end: text.length },
          })
        }
      }
    }
  }

  return {
    found: tokens.length > 0,
    tokens,
    durationMs: Date.now() - start,
  }
}
