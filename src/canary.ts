import { generate } from './generate'
import { embed } from './embed'
import { detect } from './detect'
import type { Canary, CanaryConfig, CanaryToken, DetectOptions, DetectionResult, EmbedOptions, Confidence } from './types'

export function verify(
  text: string,
  token: CanaryToken,
  options?: { minConfidence?: Confidence }
): boolean {
  const result: DetectionResult = detect(text, {
    types: [token.type],
    minConfidence: options?.minConfidence ?? 'medium',
  })
  return result.tokens.some(t => t.payload === token.payload)
}

export function createCanary(config?: CanaryConfig): Canary {
  const token = generate({ type: config?.type, payload: config?.payload })
  return {
    token,
    embed: (prompt: string, options?: EmbedOptions): string =>
      embed(prompt, token, { position: config?.position, ...options }),
    detect: (text: string, options?: DetectOptions): DetectionResult => detect(text, options),
    verify: (text: string): boolean => verify(text, token),
  }
}
