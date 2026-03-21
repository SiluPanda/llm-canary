export type CanaryType = 'zero-width' | 'homoglyph' | 'whitespace' | 'custom'
export type Confidence = 'high' | 'medium' | 'low'

export interface CanaryToken {
  type: CanaryType
  payload: string
  createdAt: string
}

export interface GenerateOptions {
  payload?: string
  type?: CanaryType
}

export interface EmbedOptions {
  position?: 'start' | 'end' | 'after-first-sentence' | 'before-last-sentence' | 'random'
}

export interface DetectedToken {
  type: CanaryType
  payload: string
  confidence: Confidence
  checksumValid: boolean
  position: { start: number; end: number }
}

export interface DetectionResult {
  found: boolean
  tokens: DetectedToken[]
  durationMs: number
}

export interface DetectOptions {
  types?: CanaryType[]
  minConfidence?: Confidence
}

export interface CanaryConfig {
  type?: CanaryType
  payload?: string
  position?: EmbedOptions['position']
}

export interface Canary {
  token: CanaryToken
  embed(prompt: string, options?: EmbedOptions): string
  detect(text: string, options?: DetectOptions): DetectionResult
  verify(text: string): boolean
}
