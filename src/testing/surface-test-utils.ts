import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import Ajv2020 from 'ajv/dist/2020';
import schema from '@flui-cloud/semantic-surface/docs/agent-surface/semantic-surface.schema.json';
import {
  validateSurfaceSemantics,
  SemanticValidationOptions,
} from '@flui-cloud/semantic-surface/lib/agent-surface/surface-semantics';
import { renderSurfaceDigest, DigestOptions } from '@flui-cloud/semantic-surface/lib/agent-surface/surface-digest';

// `renderSurfaceDigest` and the package's own schema validator are Node-only
// (`Buffer.byteLength`, `node:fs` reading the schema file off disk) and cannot load in
// this project's browser test bundle (Karma/ChromeHeadless). Every producer spec needs
// the same two workarounds, so they live here once: a `Buffer.byteLength` shim, and a
// browser-safe Ajv instance compiled against the real, frozen schema.json (imported as
// a static JSON module instead of read from disk). This is a TEST-ONLY workaround — no
// production code imports this file or exercises the package's own validate/digest path
// in a browser at runtime; validation of a real request happens server-side, in flui-core.
(globalThis as unknown as { Buffer: { byteLength: (s: string) => number } }).Buffer ??= {
  byteLength: (value: string) => new TextEncoder().encode(value).length,
};

const validateSchema = new Ajv2020({ allErrors: true, strict: false, logger: false }).compile(schema);

/**
 * The gate every producer's own test suite must pass, per the pre-deploy plan's own
 * words: "ogni pagina produce uno snapshot che valida contro lo schema." Asserts both
 * levels — schema (structural) and semantics (cross-reference, §12.3) — against the
 * real, frozen schema.json, not a hand-rolled stand-in for it.
 */
export function expectValidSurface(snapshot: SurfaceSnapshot, options?: SemanticValidationOptions): void {
  const schemaOk = validateSchema(snapshot);
  expect(schemaOk).withContext(JSON.stringify(validateSchema.errors ?? [])).toBe(true);
  expect(validateSurfaceSemantics(snapshot, options)).toEqual([]);
}

/** The digest gate: same input, twice, must produce byte-identical output (§8.4/§9). */
export function expectDeterministicDigest(snapshot: SurfaceSnapshot, options?: DigestOptions): void {
  const first = renderSurfaceDigest(snapshot, options);
  const second = renderSurfaceDigest(snapshot, options);
  expect(first.text).toBe(second.text);
  expect(first.bytes).toBe(second.bytes);
}

export { renderSurfaceDigest, validateSurfaceSemantics };
