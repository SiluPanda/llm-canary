import { randomUUID } from 'crypto'
import type { CanaryToken, GenerateOptions } from './types'

export function generate(options?: GenerateOptions): CanaryToken {
  return {
    type: options?.type ?? 'zero-width',
    payload: options?.payload ?? randomUUID(),
    createdAt: new Date().toISOString(),
  }
}
