// llm-canary - Invisible canary tokens for prompt leakage detection
export { generate } from './generate'
export { embed } from './embed'
export { detect } from './detect'
export { verify, createCanary } from './canary'

export type {
  CanaryType,
  Confidence,
  CanaryToken,
  GenerateOptions,
  EmbedOptions,
  DetectedToken,
  DetectionResult,
  DetectOptions,
  CanaryConfig,
  Canary,
} from './types'
