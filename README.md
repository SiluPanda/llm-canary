# llm-canary

Invisible canary tokens for prompt leakage detection. Embed hidden markers in prompts using zero-width Unicode characters or homoglyph substitution, then detect whether the prompt was leaked or reproduced by an untrusted party.

## Install

```bash
npm install llm-canary
```

## Quick start

```typescript
import { generate, embed, detect, verify, createCanary } from 'llm-canary'

// Generate a canary token
const token = generate()
console.log(token.payload) // UUID like "3f2a1b4c-..."

// Embed into a prompt (zero-width chars appended by default)
const prompt = 'You are a helpful assistant. Answer the question below.'
const protected = embed(prompt, token)

// Later: detect if the prompt was leaked
const result = detect(receivedText)
if (result.found) {
  console.log('Canary detected:', result.tokens[0].payload)
}

// Or verify a specific token
const leaked = verify(receivedText, token)
console.log('Token present:', leaked)
```

## createCanary() convenience API

```typescript
const canary = createCanary({ payload: 'my-secret-id' })
const protected = canary.embed('System prompt here.')
console.log(canary.verify(protected)) // true
```

## Encoding types

### zero-width (default)

Encodes the payload as a binary packet using zero-width Unicode characters appended (or prepended) to the text:

- `U+200B` = bit 0
- `U+200C` = bit 1
- `U+200D` = byte separator

The binary packet format is `[0xCA, 0x1A, length, ...payload bytes, xor_checksum]`.

Invisible to the human eye and to most rendered views; detected with high confidence when the XOR checksum is valid.

### homoglyph

Encodes bits by substituting Latin characters with Cyrillic lookalikes (e.g. `a` → `а`, `o` → `о`). The substitution is invisible in most fonts.

```typescript
const token = generate({ type: 'homoglyph', payload: 'my-id' })
const protected = embed(longPrompt, token) // needs enough substitutable chars
```

The text needs sufficient substitutable characters (Latin letters in the PAIRS list). An error is thrown if capacity is insufficient.

## embed() options

```typescript
embed(prompt, token, { position: 'after-first-sentence' })
```

Positions: `'start'` | `'end'` (default) | `'after-first-sentence'` | `'before-last-sentence'` | `'random'`

Only applies to `zero-width` and `whitespace` types; `homoglyph` always modifies the text in-place.

## detect() options

```typescript
const result = detect(text, {
  types: ['zero-width'],        // limit which encodings to check
  minConfidence: 'high',        // 'high' | 'medium' | 'low'
})
```

## verify()

```typescript
import { verify } from 'llm-canary'
const present = verify(text, token)                          // default medium confidence
const strict  = verify(text, token, { minConfidence: 'high' })
```

## License

MIT
