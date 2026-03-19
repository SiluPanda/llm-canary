# llm-canary -- Task Breakdown

## Phase 1: Project Scaffolding and Type Definitions

- [ ] **Install dev dependencies** — Add `typescript`, `vitest`, and `eslint` as dev dependencies in `package.json`. Ensure `vitest` config works with the existing `tsconfig.json`. | Status: not_done

- [ ] **Add CLI bin entry to package.json** — Add `"bin": { "llm-canary": "dist/cli.js" }` to `package.json` so the CLI is available as an executable after global install or via `npx`. | Status: not_done

- [ ] **Define all TypeScript types in `src/types.ts`** — Create `src/types.ts` with all type definitions from the spec: `CanaryType`, `CanaryToken`, `GenerateOptions`, `EmbedPosition`, `EmbedOptions`, `Confidence`, `DetectedToken`, `TokenPosition`, `DetectionResult`, `DetectOptions`, `VerifyOptions`, `CanaryConfig`, `Canary`, `CustomMarkerConfig`. Ensure all JSDoc comments from the spec are included. | Status: not_done

- [ ] **Create directory structure** — Create the `src/encoders/` directory and the `src/__tests__/` and `src/__tests__/encoders/` directories to match the file structure defined in the spec. | Status: not_done

## Phase 2: Payload Serialization (`src/payload.ts`)

- [ ] **Implement payload serialization (encode)** — Implement a function that takes a payload string and produces a serialized byte sequence: 2-byte magic header (`0xCA 0x1A`), 1-byte length, N payload bytes (UTF-8), and 1-byte XOR checksum. Use `TextEncoder` for UTF-8 conversion. | Status: not_done

- [ ] **Implement payload deserialization (decode)** — Implement a function that takes a serialized byte sequence, verifies the magic header, reads the length byte, extracts the payload bytes, verifies the XOR checksum, and returns the decoded payload string plus a `checksumValid` flag. Use `TextDecoder` for UTF-8 conversion. | Status: not_done

- [ ] **Enforce payload size constraints** — Validate that the payload is at least 1 byte and at most 255 bytes when encoded as UTF-8. Throw a descriptive error for empty payloads and payloads exceeding 255 bytes. | Status: not_done

- [ ] **Implement byte-to-bit conversion utilities** — Implement helper functions for converting between byte arrays and bit arrays (MSB first). These are shared by all encoders. | Status: not_done

- [ ] **Write payload serialization tests (`src/__tests__/payload.test.ts`)** — Test round-trip serialize/deserialize for various payload sizes (1 byte, 16 bytes, 36-byte UUID, 255 bytes max). Test edge cases: empty string rejection, 256-byte payload rejection, non-ASCII UTF-8 multibyte payloads, special characters. Test checksum verification (valid and corrupted). Test magic header validation (missing/wrong header). | Status: not_done

## Phase 3: UUID Generation (`src/token.ts`)

- [ ] **Implement UUID v4 auto-generation** — Implement UUID v4 generation using `crypto.randomUUID()` (Node.js 19+) with a fallback to `crypto.getRandomValues()` for Node.js 18. Return a standard UUID string (36 characters, lowercase hex with hyphens). | Status: not_done

- [ ] **Implement token creation logic** — Implement the `generateToken` function that creates a `CanaryToken` object with `type`, `payload`, `encoded` (or `null` for homoglyph), and `createdAt` (ISO 8601 timestamp). Dispatch to the appropriate encoder based on type. | Status: not_done

## Phase 4: Zero-Width Encoder (`src/encoders/zero-width.ts`)

- [ ] **Implement zero-width character encoding** — Encode a serialized payload byte array into a string of zero-width Unicode characters: bit `0` maps to U+200B (ZWSP), bit `1` maps to U+200C (ZWNJ), and U+200D (ZWJ) is used as a byte separator between each 8-character group. Use `String.fromCodePoint()` for character generation. | Status: not_done

- [ ] **Implement zero-width character decoding** — Scan input text for sequences of U+200B, U+200C, and U+200D characters. Split on U+200D to recover byte groups. Map U+200B to `0` and U+200C to `1` to reconstruct each byte. Verify magic header and checksum. Return decoded payload, confidence level, and position information. | Status: not_done

- [ ] **Handle multiple zero-width sequences in text** — When scanning for zero-width sequences, find all contiguous runs of zero-width characters in the text (there may be multiple canary tokens or fragments). Attempt to decode each run independently. | Status: not_done

- [ ] **Write zero-width encoder/decoder tests (`src/__tests__/encoders/zero-width.test.ts`)** — Test round-trip encode/decode for various payloads (1 byte, UUID, max 255 bytes). Test determinism (same payload always produces same encoding). Test that the encoded string contains only zero-width characters. Test decoding from text that contains zero-width characters mixed with normal text. Test partial sequences (truncated tokens). Test that natural text without zero-width chars returns no detection. | Status: not_done

## Phase 5: Homoglyph Encoder (`src/encoders/homoglyph.ts`)

- [ ] **Define the homoglyph lookup map** — Create a bidirectional map of Latin characters to their Cyrillic homoglyph equivalents, covering all 19 pairs listed in the spec (both lowercase and uppercase). Include reverse lookup (homoglyph codepoint to Latin original). | Status: not_done

- [ ] **Implement homoglyph encoding** — Given a serialized payload bit sequence and a target text, scan the text for characters that have homoglyph equivalents to build an ordered list of substitutable positions. For each bit: if `1`, replace the character with its homoglyph; if `0`, leave the Latin original. Return error if the prompt has insufficient substitutable characters for the payload. | Status: not_done

- [ ] **Implement homoglyph decoding** — Scan input text for characters that are either Latin originals or their homoglyph equivalents. Build the substitutable position list. For each position, record `1` if homoglyph, `0` if Latin original. Reconstruct the byte sequence, verify magic header and checksum. Include the `latinTextRatio` check: skip homoglyph detection if fewer than 70% of alphabetic characters are Latin. | Status: not_done

- [ ] **Handle capacity errors for homoglyph encoding** — Calculate the number of substitutable positions in the prompt. If `substitutable_positions < (payload_bytes + 4) * 8` (payload + header/length/checksum, 8 bits each), throw a descriptive error explaining the prompt is too short or has too few substitutable characters. | Status: not_done

- [ ] **Write homoglyph encoder/decoder tests (`src/__tests__/encoders/homoglyph.test.ts`)** — Test round-trip encode/decode for various payloads. Test that encoded text looks visually identical (same string length, same visible appearance). Test capacity error when prompt has insufficient substitutable characters. Test that the `latinTextRatio` check skips detection for predominantly Cyrillic text. Test the full homoglyph map (all 19 pairs). Test behavior with Unicode normalization (NFC and NFKC). | Status: not_done

## Phase 6: Whitespace Encoder (`src/encoders/whitespace.ts`)

- [ ] **Implement whitespace encoding** — Encode a serialized payload bit sequence using three whitespace channels: (1) trailing spaces per line (0-7 trailing spaces encode 3 bits per line), (2) inter-paragraph spacing (single newline = `0`, double newline = `1`), (3) En Space (U+2002) vs regular Space (U+0020) substitution at selected word boundaries (1 bit per position). Process channels in order: trailing spaces first, then paragraph gaps, then En Space substitutions. | Status: not_done

- [ ] **Implement whitespace decoding** — Split text into lines, count trailing spaces modulo 8 per line to recover 3 bits each. Analyze inter-paragraph gaps for additional bits. Scan for En Space vs regular Space at word boundaries for remaining bits. Reconstruct byte sequence, verify magic header and checksum. | Status: not_done

- [ ] **Handle capacity errors for whitespace encoding** — Calculate total available bit capacity across all three whitespace channels. If the capacity is insufficient for the payload (including header and checksum), throw a descriptive error. | Status: not_done

- [ ] **Write whitespace encoder/decoder tests (`src/__tests__/encoders/whitespace.test.ts`)** — Test round-trip encode/decode for payloads within the capacity of the prompt. Test capacity error for short prompts. Test that encoded text preserves all visible content. Test resilience: what happens when trailing spaces are stripped (expected failure). Test En Space vs regular Space detection. Test with prompts of varying line counts and paragraph structures. | Status: not_done

## Phase 7: Semantic Marker Encoder (`src/encoders/semantic.ts`)

- [ ] **Define controlled vocabulary tables** — Define the two vocabularies of exactly 16 words each (4 bits per selection): adjectives (`clear`, `precise`, `thoughtful`, `balanced`, `consistent`, `thorough`, `measured`, `careful`, `grounded`, `practical`, `structured`, `focused`, `coherent`, `concise`, `natural`, `professional`) and nouns (`reasoning`, `accuracy`, `context`, `tone`, `clarity`, `standards`, `quality`, `alignment`, `integrity`, `relevance`, `perspective`, `objectivity`, `awareness`, `sensitivity`, `composure`, `professionalism`). Build index-based lookup maps for both encoding and decoding. | Status: not_done

- [ ] **Implement semantic marker encoding** — Convert serialized payload to 4-bit nibble pairs. For each pair of nibbles, select the adjective at `nibble[0]` and noun at `nibble[1]` from the controlled vocabularies. Construct the marker sentence: `"Always maintain {adjective} {noun} in your responses."` One sentence per byte of payload. Return the concatenated marker sentences. | Status: not_done

- [ ] **Implement semantic marker decoding** — Scan text using regex `/Always maintain (\w+) (\w+) in your responses\./g` to find all matching sentences. For each match, look up the adjective and noun indices in the controlled vocabularies. Combine indices into nibbles, then bytes. Verify magic header sequence across the decoded byte stream. Support fuzzy matching for paraphrased markers (closest vocabulary entry matching). | Status: not_done

- [ ] **Implement fuzzy matching for semantic markers** — When a sentence partially matches the template (e.g., "Always maintain clear reasoning in your answers" instead of "responses"), attempt to match by computing string similarity between detected words and vocabulary entries. Report matches with reduced confidence (`medium` or `low`). | Status: not_done

- [ ] **Write semantic marker encoder/decoder tests (`src/__tests__/encoders/semantic.test.ts`)** — Test round-trip encode/decode for short payloads (1-8 bytes). Test that generated sentences follow the exact template. Test all 16 adjectives and all 16 nouns are usable. Test fuzzy matching with slight paraphrasing. Test that natural English text containing "always maintain" does not produce false positives without the full template and vocabulary match. Test multi-sentence payloads. | Status: not_done

## Phase 8: Encoder Registry (`src/encoders/index.ts`)

- [ ] **Implement encoder registry and dispatch** — Create a central registry that maps `CanaryType` values to their respective encoder/decoder implementations. Provide `getEncoder(type)` and `getDecoder(type)` functions. Support registration of custom marker encoders/decoders. Default registry contains zero-width, homoglyph, whitespace, and semantic. | Status: not_done

- [ ] **Implement multi-type detection dispatch** — Provide a function that runs all registered decoders (or a subset specified by `types` option) sequentially against input text, collecting all detection results. Merge results and deduplicate. | Status: not_done

## Phase 9: Generate API (`src/index.ts` via `src/token.ts`)

- [ ] **Implement `generate()` function** — Implement the public `generate(options?: GenerateOptions)` function. Auto-generate UUID v4 payload when no payload is provided. Default type to `'zero-width'`. Validate payload size constraints. Dispatch to the appropriate encoder to produce the `encoded` field (`null` for homoglyph type since encoding requires target text). Return a `CanaryToken` object. | Status: not_done

- [ ] **Handle custom marker type in `generate()`** — When `type` is `'custom'`, require `custom` config with `encode`, `decode`, and `name` fields. Call `custom.encode(payload)` to produce the `encoded` field. Throw a descriptive error if `custom` config is missing. | Status: not_done

- [ ] **Write generate tests (`src/__tests__/generate.test.ts`)** — Test `generate()` with no options (auto UUID, zero-width type). Test with custom payload. Test with each token type. Test with custom marker config. Test payload validation (empty, too large). Test that `createdAt` is a valid ISO 8601 timestamp. Test determinism (same payload + type produces same `encoded` value). | Status: not_done

## Phase 10: Embed API (`src/embed.ts`)

- [ ] **Implement `embed()` function with `start` position** — Insert the canary token's encoded string at the very beginning of the system prompt, before the first visible character. | Status: not_done

- [ ] **Implement `embed()` with `end` position** — Insert the canary token's encoded string at the very end of the system prompt, after the last visible character. | Status: not_done

- [ ] **Implement `embed()` with `after-first-sentence` position** — Detect the first sentence boundary (`.`, `!`, or `?` followed by whitespace) and insert the canary token after it. Handle edge cases: prompt with no sentence-ending punctuation, prompt with only one sentence. | Status: not_done

- [ ] **Implement `embed()` with `before-last-sentence` position** — Detect the last sentence in the prompt and insert the canary token before it. Handle edge cases: single-sentence prompts. | Status: not_done

- [ ] **Implement `embed()` with `random` position** — Insert the canary token at a deterministically random position within the prompt. The position is seeded by a hash of the payload so it is reproducible given the same payload and prompt. | Status: not_done

- [ ] **Implement `embed()` with `multiple` position** — Insert copies of the canary token at multiple positions (default: `['start', 'end']`). Accept a `positions` array in `EmbedOptions`. Call the position-specific insertion logic for each position. | Status: not_done

- [ ] **Implement `embed()` with `custom` position** — Insert the canary token at a caller-specified character offset from `EmbedOptions.offset`. Validate that the offset is within the prompt bounds. | Status: not_done

- [ ] **Implement type-dependent default positions** — When no position is specified: `'end'` for zero-width and whitespace types, `'after-first-sentence'` for semantic, `'start'` for homoglyph. | Status: not_done

- [ ] **Handle homoglyph embedding specially** — For homoglyph type, the embedding modifies the prompt characters in-place (substitution, not insertion). The `embed()` function must call the homoglyph encoder with both the payload and the prompt text. The returned text has the same length but with some characters replaced. | Status: not_done

- [ ] **Handle semantic marker embedding specially** — For semantic type, the embedding inserts visible marker sentences. The `embed()` function must handle sentence-level insertion (adding sentences at the appropriate position, with proper spacing and punctuation). | Status: not_done

- [ ] **Write embed tests (`src/__tests__/embed.test.ts`)** — Test each position type (start, end, after-first-sentence, before-last-sentence, random, multiple, custom offset). Test that the embedded prompt preserves all original visible characters (for steganographic types). Test that the token is recoverable from the embedded prompt via `detect()`. Test default position selection per token type. Test multiple position embedding. Test edge cases: single-sentence prompt, empty prompt, prompt with no punctuation. | Status: not_done

## Phase 11: Detect API (`src/detect.ts`)

- [ ] **Implement `detect()` function** — Implement the public `detect(text: string, options?: DetectOptions)` function. Run all registered decoders (or the subset specified by `options.types`) against the input text. Collect all `DetectedToken` results. Filter by `minConfidence` (default `'medium'`). Measure scan duration using `performance.now()`. Return a `DetectionResult` with `found`, `tokens`, `durationMs`, and `scannedTypes`. | Status: not_done

- [ ] **Implement confidence level assignment** — Assign `'high'` when full token recovered with valid header and checksum. Assign `'medium'` when header is valid but checksum fails (partial recovery). Assign `'low'` for pattern matches that could be coincidental (e.g., partial semantic template match, short zero-width sequences). | Status: not_done

- [ ] **Implement partial token recovery** — When the magic header is found but the checksum fails, still report the decoded payload with `medium` confidence and `checksumValid: false`. When multiple copies of a token were embedded, attempt recovery from each copy independently and report the highest-confidence result. | Status: not_done

- [ ] **Implement type-restricted detection** — When `options.types` is provided, only run the specified decoders. This enables faster scanning when the caller knows which token type was used. | Status: not_done

- [ ] **Implement custom decoder support in detect** — When `options.customDecoders` is provided, include those custom decoders in the scan alongside built-in decoders. Call each custom decoder's `decode(text)` function. | Status: not_done

- [ ] **Write detect tests (`src/__tests__/detect.test.ts`)** — Test detection of each token type in text containing a single token. Test detection of multiple tokens (same type and different types). Test `found: false` for clean text. Test confidence levels (high, medium, low). Test partial token recovery (truncated tokens, corrupted checksums). Test type restriction (`types` option). Test `minConfidence` filtering. Test `durationMs` is populated. Test `scannedTypes` accuracy. Test custom decoders. | Status: not_done

## Phase 12: Verify API (`src/verify.ts`)

- [ ] **Implement `verify()` function** — Implement the public `verify(text: string, token: CanaryToken, options?: VerifyOptions)` function. Call `detect()` internally, then check if any detected token's payload matches the provided token's payload. Return `true` if a match is found at or above the specified `minConfidence` level (default `'medium'`). Return `false` otherwise. | Status: not_done

- [ ] **Write verify tests (`src/__tests__/verify.test.ts`)** — Test `verify()` returns `true` when the specific token is present. Test returns `false` when the token is absent. Test returns `true` when multiple tokens are present and the specified one is among them. Test `minConfidence` filtering (e.g., returns `false` when match is `low` confidence but `minConfidence` is `medium`). | Status: not_done

## Phase 13: Canary Factory (`src/canary.ts`)

- [ ] **Implement `createCanary()` factory** — Implement the public `createCanary(config: CanaryConfig)` function. Create a `CanaryToken` using `generate()` with the config's type, payload, and custom options. Return a `Canary` instance with `token`, `embed()`, `detect()`, and `verify()` methods. The returned methods use the config's defaults (position, minConfidence, etc.) but allow per-call overrides. | Status: not_done

- [ ] **Write factory tests (`src/__tests__/canary.test.ts`)** — Test `createCanary()` with various configs. Test `canary.embed()` uses the configured defaults. Test `canary.detect()` scans for all types by default. Test `canary.verify()` checks for the specific token. Test end-to-end workflow: `createCanary()` -> `canary.embed()` -> `canary.detect()` -> `canary.verify()`. Test per-call option overrides. | Status: not_done

## Phase 14: Public API Exports (`src/index.ts`)

- [ ] **Wire up all public exports in `src/index.ts`** — Export `generate`, `embed`, `detect`, `verify`, and `createCanary` from `src/index.ts`. Export all public type definitions from `src/types.ts`. Ensure the module's public API surface matches the spec exactly. | Status: not_done

## Phase 15: CLI Implementation (`src/cli.ts`)

- [ ] **Implement CLI argument parsing** — Parse CLI arguments using `util.parseArgs()` (Node.js 18+). Support commands: `generate`, `embed`, `detect`, `verify`. Parse global flags: `--version`, `--help`. Parse command-specific flags as defined in the spec. Support environment variable overrides (`LLM_CANARY_TYPE`, `LLM_CANARY_PAYLOAD`, `LLM_CANARY_FORMAT`, `LLM_CANARY_MIN_CONFIDENCE`). | Status: not_done

- [ ] **Implement `generate` CLI command** — Accept `--payload`, `--type`, `--format`. Generate a canary token. Output human-readable or JSON format. Exit code `0` on success, `2` on configuration error. | Status: not_done

- [ ] **Implement `embed` CLI command** — Accept prompt from `--prompt`, `--file`, or stdin. Accept `--payload`, `--type`, `--position`, `--format`, `--output`. Embed the canary token and output the marked prompt. Write to `--output` file if specified, otherwise stdout. Exit code `0` on success, `2` on configuration error. | Status: not_done

- [ ] **Implement `detect` CLI command** — Accept text from `--file` or stdin. Accept `--types`, `--min-confidence`, `--format`. Scan for canary tokens. Output results in human-readable or JSON format. Exit code `0` if token found, `1` if not found, `2` on configuration error. | Status: not_done

- [ ] **Implement `verify` CLI command** — Accept text from `--file` or stdin. Accept `--payload` (required), `--type`, `--format`. Check if the specified payload is present. Exit code `0` if found, `1` if not found, `2` on configuration error. | Status: not_done

- [ ] **Implement human-readable output formatting** — Format output for each command matching the examples in the spec: version header, labeled fields, clear messaging. Use proper indentation and spacing. | Status: not_done

- [ ] **Implement JSON output formatting** — Output structured JSON for each command when `--format json` is used. Include all relevant fields (payload, type, confidence, position, found, etc.). | Status: not_done

- [ ] **Implement `--help` and `--version` flags** — `--version` prints the version from `package.json` and exits. `--help` prints usage information covering all commands and flags. | Status: not_done

- [ ] **Add CLI shebang and entry point** — Add `#!/usr/bin/env node` shebang to the top of `cli.ts` (or ensure it is added to the compiled output). Ensure `dist/cli.js` is executable. | Status: not_done

- [ ] **Write CLI tests (`src/__tests__/cli.test.ts`)** — Test each CLI command with valid inputs and verify output format (both human-readable and JSON). Test exit codes: `0` for success, `1` for not-found, `2` for errors. Test stdin input, `--file` input, and `--prompt` input for `embed`. Test environment variable configuration overrides. Test `--version` and `--help` output. Test invalid command and invalid flags produce exit code `2`. | Status: not_done

## Phase 16: False Positive Tests

- [ ] **Write false positive tests (`src/__tests__/false-positives.test.ts`)** — Test that natural Arabic text with legitimate zero-width joiners does not trigger false zero-width detection. Test that Russian/Cyrillic text does not trigger false homoglyph detection (including the `latinTextRatio` < 70% check). Test that text with irregular whitespace (extra spaces, mixed tabs) does not trigger false whitespace detection. Test that natural English text containing words like "always maintain" does not trigger false semantic detection without a full valid template+vocabulary match. Test that emoji sequences containing ZWJ do not produce false positives. | Status: not_done

## Phase 17: Resilience Tests

- [ ] **Write resilience tests (`src/__tests__/resilience.test.ts`)** — Test copy-paste simulation: embed a token, pass the text through a simulated clipboard (preserve all characters), verify detection still works. Test whitespace normalization: embed a whitespace token, trim trailing spaces, verify token is lost and detection handles it gracefully. Test Unicode normalization: embed a homoglyph token, apply NFC normalization (should mostly survive), apply NFKC normalization (may destroy some substitutions), verify confidence degrades appropriately. Test partial text extraction: embed a token, take a substring of the text (simulating partial prompt extraction), verify `detect()` handles the partial token (medium/low confidence or not found). Test multiple-position redundancy: embed at both start and end, truncate the start, verify the end token is still detectable. | Status: not_done

## Phase 18: Integration Tests

- [ ] **Write end-to-end pipeline tests** — Test the full workflow: `generate()` -> `embed()` -> `detect()` -> verify payload matches. Cover each token type (zero-width, homoglyph, whitespace, semantic). Test with auto-generated UUID payloads and with custom payloads. | Status: not_done

- [ ] **Write multi-type detection tests** — Embed both a zero-width token and a semantic marker in the same prompt. Run `detect()` and verify both tokens are found with correct payloads and types. | Status: not_done

- [ ] **Write factory end-to-end tests** — Test `createCanary()` -> `canary.embed()` multiple prompts -> `canary.detect()` each -> `canary.verify()` each. Ensure the same canary instance works correctly across multiple embed/detect cycles. | Status: not_done

## Phase 19: Performance Benchmarks

- [ ] **Write performance benchmark tests (`src/__tests__/performance.test.ts`)** — Benchmark `generate()` for each token type and verify it completes under 1ms. Benchmark `embed()` for each token type with 1KB and 4KB prompts; verify under 1ms. Benchmark `detect()` (all types) with 1KB, 4KB, 10KB, and 100KB text; verify under 2ms for text under 10KB and under 10ms for 100KB. Benchmark `detect()` with type restriction (single type) and verify faster than all-type scan. Report mean and p99 latencies. | Status: not_done

## Phase 20: Documentation

- [ ] **Write README.md** — Create a comprehensive README with: package description, installation instructions, quick start example, API reference for `generate()`, `embed()`, `detect()`, `verify()`, and `createCanary()`. Document all token types with brief descriptions and use-case guidance. Document CLI commands, flags, and exit codes. Document environment variables. Include integration examples (with `jailbreak-heuristic`, `content-policy`, `llm-audit-log`, `llm-sanitize`). Include performance characteristics. Note the zero-dependency design. | Status: not_done

## Phase 21: Build and Publish Preparation

- [ ] **Verify TypeScript compilation** — Run `npm run build` (`tsc`) and verify all source files compile without errors. Verify `dist/` output contains `.js`, `.d.ts`, and `.d.ts.map` files for all source modules. | Status: not_done

- [ ] **Verify lint passes** — Run `npm run lint` and fix any ESLint issues. Ensure all source files follow consistent code style. | Status: not_done

- [ ] **Verify all tests pass** — Run `npm run test` (`vitest run`) and confirm 100% of tests pass. Review test coverage and add any missing edge cases. | Status: not_done

- [ ] **Bump version in package.json** — Bump the version from `0.1.0` to the appropriate version for the initial feature-complete release (likely `1.0.0` or `0.2.0` depending on stability assessment). | Status: not_done

- [ ] **Verify package contents** — Run `npm pack --dry-run` to verify that only the `dist/` directory is included in the published package (per the `"files": ["dist"]` config). Ensure no source files, test files, or spec files are included. | Status: not_done

- [ ] **Test global CLI installation** — Run `npm link` locally and verify that `llm-canary generate`, `llm-canary embed`, `llm-canary detect`, and `llm-canary verify` work as expected from the command line. | Status: not_done
