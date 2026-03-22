# llm-canary

Invisible canary tokens for LLM prompt leakage detection.

[![npm version](https://img.shields.io/npm/v/llm-canary.svg)](https://www.npmjs.com/package/llm-canary)
[![license](https://img.shields.io/npm/l/llm-canary.svg)](https://github.com/SiluPanda/llm-canary/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/llm-canary.svg)](https://nodejs.org)

---

## Description

`llm-canary` embeds invisible, machine-recoverable canary tokens into LLM system prompts using steganographic techniques -- zero-width Unicode characters, Cyrillic homoglyph substitution, or whitespace patterns. When a system prompt leaks (through direct extraction, paraphrasing, copy-paste, or side-channel exposure), the canary token travels with the leaked content and can be detected programmatically to prove the leakage and trace its origin.

Key characteristics:

- **Zero runtime dependencies.** All encoding, decoding, and Unicode manipulation use built-in Node.js APIs.
- **Deterministic.** The same payload and encoding type always produce the same canary token.
- **Fast.** Embedding completes in under 1ms. Detection completes in under 2ms for text under 10KB.
- **Typed.** Full TypeScript type definitions ship with the package.
- **Node.js 18+.** Uses `crypto.randomUUID()` and `TextEncoder`/`TextDecoder`.

---

## Installation

```bash
npm install llm-canary
```

---

## Quick Start

```typescript
import { generate, embed, detect, verify } from 'llm-canary';

// 1. Generate a canary token (auto-generates a UUID v4 payload)
const token = generate();

// 2. Embed into a system prompt
const prompt = 'You are a helpful assistant. Answer the question below.';
const marked = embed(prompt, token);

// 3. Later, scan text for leaked canary tokens
const result = detect(suspiciousText);
if (result.found) {
  console.log('Leak detected:', result.tokens[0].payload);
}

// 4. Or verify a specific token is present
const leaked = verify(suspiciousText, token);
console.log('Token present:', leaked); // true or false
```

---

## Features

- **Zero-width encoding** -- Encodes payloads as invisible zero-width Unicode character sequences. Completely invisible in rendered text.
- **Homoglyph encoding** -- Substitutes Latin characters with visually identical Cyrillic counterparts to encode payload bits. Text length and visible appearance are preserved.
- **Whitespace encoding** -- Encodes bits using trailing space patterns on each line. Useful for multi-line prompts.
- **Configurable embed positions** -- Insert canary tokens at the start, end, after the first sentence, before the last sentence, or at a random position.
- **Confidence-based detection** -- Detection results include `high`, `medium`, or `low` confidence based on checksum validity and recovery completeness.
- **Packet integrity** -- Binary packet format with magic header (`0xCA 0x1A`) and XOR checksum ensures reliable detection and rejects false positives.
- **Factory API** -- `createCanary()` returns a preconfigured instance for repeated embed/detect/verify operations with a single token.

---

## API Reference

### `generate(options?)`

Creates a new canary token.

```typescript
import { generate } from 'llm-canary';

const token = generate();
// { type: 'zero-width', payload: '550e8400-...', createdAt: '2025-01-15T...' }

const custom = generate({ type: 'homoglyph', payload: 'tenant-42:prod' });
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `options.payload` | `string` | Auto-generated UUID v4 | The payload string to encode in the canary token. |
| `options.type` | `CanaryType` | `'zero-width'` | Encoding type: `'zero-width'`, `'homoglyph'`, `'whitespace'`, or `'custom'`. |

**Returns:** `CanaryToken`

```typescript
interface CanaryToken {
  type: CanaryType;
  payload: string;
  createdAt: string; // ISO 8601 timestamp
}
```

---

### `embed(prompt, token, options?)`

Inserts a canary token into a system prompt string.

```typescript
import { generate, embed } from 'llm-canary';

const token = generate();
const prompt = 'You are a helpful assistant.';

// Default: append zero-width chars at the end
const marked = embed(prompt, token);

// Insert after the first sentence
const marked2 = embed(prompt, token, { position: 'after-first-sentence' });
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `prompt` | `string` | -- | The system prompt text to embed the token into. |
| `token` | `CanaryToken` | -- | The canary token returned by `generate()`. |
| `options.position` | `EmbedPosition` | `'end'` | Where to insert the token in the prompt. |

**Position values:**

| Position | Behavior |
|----------|----------|
| `'start'` | Prepend the encoded token before the first character. |
| `'end'` | Append the encoded token after the last character. |
| `'after-first-sentence'` | Insert after the first sentence boundary (`.`, `!`, or `?` followed by whitespace). Falls back to `'end'` if no sentence boundary is found. |
| `'before-last-sentence'` | Insert before the last sentence. Falls back to `'start'` if only one sentence exists. |
| `'random'` | Insert at a random character position within the prompt. |

**Returns:** `string` -- The prompt with the canary token embedded.

**Type-specific behavior:**

- **zero-width**: Inserts an invisible zero-width character sequence at the specified position. The returned string is longer than the input but visually identical.
- **homoglyph**: Replaces Latin characters in-place with Cyrillic lookalikes. Position option is ignored. The returned string has the same length but some characters have different codepoints. Throws an error if the prompt has insufficient substitutable characters for the payload.
- **whitespace**: Appends trailing spaces to each line to encode bits. One bit per line using single space (bit 0) or double space (bit 1).

---

### `detect(text, options?)`

Scans text for embedded canary tokens.

```typescript
import { detect } from 'llm-canary';

const result = detect(text);

if (result.found) {
  for (const token of result.tokens) {
    console.log(token.type);          // 'zero-width' | 'homoglyph' | ...
    console.log(token.payload);       // the decoded payload string
    console.log(token.confidence);    // 'high' | 'medium' | 'low'
    console.log(token.checksumValid); // true if XOR checksum passed
    console.log(token.position);      // { start: number, end: number }
  }
}
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | -- | The text to scan for canary tokens. |
| `options.types` | `CanaryType[]` | `['zero-width', 'homoglyph', 'whitespace']` | Restrict detection to specific encoding types. |
| `options.minConfidence` | `Confidence` | `'low'` | Minimum confidence level to include in results. |

**Returns:** `DetectionResult`

```typescript
interface DetectionResult {
  found: boolean;         // true if at least one token was detected
  tokens: DetectedToken[];
  durationMs: number;     // scan duration in milliseconds
}

interface DetectedToken {
  type: CanaryType;
  payload: string;
  confidence: Confidence; // 'high' | 'medium' | 'low'
  checksumValid: boolean;
  position: { start: number; end: number };
}
```

**Confidence levels:**

| Level | Meaning |
|-------|---------|
| `'high'` | Full token recovered with valid magic header and checksum. |
| `'medium'` | Magic header found but checksum failed (partial recovery or corruption). |
| `'low'` | Pattern match that could be coincidental. |

---

### `verify(text, token, options?)`

Checks whether a specific canary token is present in text.

```typescript
import { verify } from 'llm-canary';

const isLeaked = verify(suspiciousText, token);

// Require high confidence
const strict = verify(suspiciousText, token, { minConfidence: 'high' });
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | -- | The text to scan. |
| `token` | `CanaryToken` | -- | The specific token to look for. |
| `options.minConfidence` | `Confidence` | `'medium'` | Minimum confidence required for a positive result. |

**Returns:** `boolean` -- `true` if the token's payload was found in the text at or above the specified confidence level.

---

### `createCanary(config?)`

Factory function that creates a preconfigured `Canary` instance for repeated use with a single token.

```typescript
import { createCanary } from 'llm-canary';

const canary = createCanary({
  type: 'zero-width',
  payload: 'deployment:us-east-1:v3',
  position: 'end',
});

// Embed into multiple prompts
const prompt1 = canary.embed('You are a helpful assistant.');
const prompt2 = canary.embed('You are a code reviewer.');

// Detect in any text
const result = canary.detect(suspiciousText);

// Verify this specific canary
const leaked = canary.verify(suspiciousText);
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `config.type` | `CanaryType` | `'zero-width'` | Encoding type for the token. |
| `config.payload` | `string` | Auto-generated UUID v4 | Payload to encode. |
| `config.position` | `EmbedPosition` | `'end'` | Default embed position. |

**Returns:** `Canary`

```typescript
interface Canary {
  token: CanaryToken;
  embed(prompt: string, options?: EmbedOptions): string;
  detect(text: string, options?: DetectOptions): DetectionResult;
  verify(text: string): boolean;
}
```

The `embed` method uses the configured `position` as its default but accepts per-call overrides via `options.position`. The `detect` method delegates to the top-level `detect()` function. The `verify` method checks for this specific canary's token.

---

## Configuration

### Encoding Types

| Type | Visibility | Capacity | Resilience | Best For |
|------|-----------|----------|------------|----------|
| `'zero-width'` | Fully invisible (zero-width Unicode) | Unlimited (payload appended) | Survives copy-paste; lost if zero-width chars are stripped | General-purpose prompt protection |
| `'homoglyph'` | Visually identical (Cyrillic substitution) | Limited by substitutable Latin chars in prompt | Survives copy-paste and most rendering; vulnerable to Unicode normalization (NFKC) | Prompts with enough Latin text |
| `'whitespace'` | Invisible (trailing spaces) | One bit per line | Lost if trailing whitespace is trimmed | Multi-line prompts in controlled environments |

### Homoglyph Character Pairs

The homoglyph encoder uses 19 Latin-to-Cyrillic character pairs:

| Latin | Cyrillic | Latin | Cyrillic |
|-------|----------|-------|----------|
| a | U+0430 | A | U+0410 |
| c | U+0441 | B | U+0412 |
| e | U+0435 | C | U+0421 |
| o | U+043E | E | U+0415 |
| p | U+0440 | H | U+041D |
| x | U+0445 | K | U+041A |
| y | U+0443 | M | U+041C |
| | | O | U+041E |
| | | P | U+0420 |
| | | T | U+0422 |
| | | X | U+0425 |
| | | Y | U+0423 |

### Binary Packet Format

All encoding types serialize the payload using a binary packet:

```
[0xCA, 0x1A, length, ...payload_bytes, xor_checksum]
```

| Field | Size | Description |
|-------|------|-------------|
| Magic header | 2 bytes | `0xCA 0x1A` -- identifies the packet as a canary token. |
| Length | 1 byte | Payload length in bytes (1--255). |
| Payload | N bytes | UTF-8 encoded payload string. |
| Checksum | 1 byte | XOR of all payload bytes. |

---

## Error Handling

### Homoglyph Capacity Error

The homoglyph encoder throws when the prompt does not contain enough substitutable Latin characters:

```typescript
import { generate, embed } from 'llm-canary';

const token = generate({ type: 'homoglyph', payload: 'long-payload-string' });

try {
  const marked = embed('Hi', token);
} catch (err) {
  // Error: Insufficient capacity: need 184 substitutable chars, found 1
}
```

To resolve this, use a longer prompt or a shorter payload, or switch to `'zero-width'` encoding which has no capacity constraints.

### Detection Failures

`detect()` never throws. When no canary tokens are found, it returns `{ found: false, tokens: [], durationMs: ... }`. Corrupted tokens (valid header but failed checksum) are reported with `'medium'` confidence and `checksumValid: false`.

---

## Advanced Usage

### Multi-Tenant Prompt Protection

Embed a unique canary per tenant to trace leaks to their source:

```typescript
import { generate, embed, detect } from 'llm-canary';

function buildPrompt(tenantId: string, basePrompt: string): string {
  const token = generate({ payload: `tenant:${tenantId}` });
  return embed(basePrompt, token);
}

// In your response handler
function checkForLeakage(response: string): void {
  const result = detect(response);
  if (result.found) {
    const tenantId = result.tokens[0].payload.replace('tenant:', '');
    console.error(`Prompt leak detected for tenant ${tenantId}`);
  }
}
```

### Real-Time Response Scanning

Scan every LLM response for prompt leakage as part of your middleware:

```typescript
import { createCanary } from 'llm-canary';

const canary = createCanary({ payload: 'prod:chat-v3:us-east-1' });

// At startup: embed into system prompt
const systemPrompt = canary.embed('You are a helpful assistant. Follow all guidelines.');

// On every LLM response
function onResponse(output: string): void {
  if (canary.verify(output)) {
    // System prompt content appeared in the output -- log and alert
    console.error('Canary detected in LLM output');
  }
}
```

### Redundant Embedding

Embed at multiple positions for resilience against partial text extraction:

```typescript
import { generate, embed } from 'llm-canary';

const token = generate({ payload: 'critical-prompt-v2' });
let prompt = 'You are a helpful assistant. Follow the rules. Be concise.';

// First embed at start, then embed the result at end
prompt = embed(prompt, token, { position: 'start' });
prompt = embed(prompt, token, { position: 'end' });

// Even if the attacker extracts only the beginning or end, the token is recoverable
```

### Restricting Detection to Specific Types

Speed up detection by scanning only the encoding types you use:

```typescript
import { detect } from 'llm-canary';

// Only check for zero-width tokens (skip homoglyph and whitespace scanning)
const result = detect(text, { types: ['zero-width'] });
```

### Strict Confidence Filtering

Require high confidence to reduce false positives:

```typescript
import { detect, verify } from 'llm-canary';

// Only return tokens with valid checksums
const result = detect(text, { minConfidence: 'high' });

// Verify with strict confidence
const leaked = verify(text, token, { minConfidence: 'high' });
```

---

## TypeScript

All public types are exported from the package entry point:

```typescript
import type {
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
} from 'llm-canary';
```

### Type Definitions

```typescript
type CanaryType = 'zero-width' | 'homoglyph' | 'whitespace' | 'custom';

type Confidence = 'high' | 'medium' | 'low';

interface CanaryToken {
  type: CanaryType;
  payload: string;
  createdAt: string;
}

interface GenerateOptions {
  payload?: string;
  type?: CanaryType;
}

interface EmbedOptions {
  position?: 'start' | 'end' | 'after-first-sentence' | 'before-last-sentence' | 'random';
}

interface DetectedToken {
  type: CanaryType;
  payload: string;
  confidence: Confidence;
  checksumValid: boolean;
  position: { start: number; end: number };
}

interface DetectionResult {
  found: boolean;
  tokens: DetectedToken[];
  durationMs: number;
}

interface DetectOptions {
  types?: CanaryType[];
  minConfidence?: Confidence;
}

interface CanaryConfig {
  type?: CanaryType;
  payload?: string;
  position?: EmbedOptions['position'];
}

interface Canary {
  token: CanaryToken;
  embed(prompt: string, options?: EmbedOptions): string;
  detect(text: string, options?: DetectOptions): DetectionResult;
  verify(text: string): boolean;
}
```

---

## License

MIT
