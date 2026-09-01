/**
 * Byte-for-byte comparison of two capture output directories. This is the
 * actual determinism gate: two directories from consecutive `node
 * capture.mjs` runs must come back with zero differences before the bench
 * counts as done (see README > The gate).
 *
 * Usage as a CLI:
 *   node diff-runs.mjs <dirA> <dirB>
 *
 * Also exported for verify.mjs to call directly.
 */
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { MANIFEST_FILENAME } from './lib/config.mjs';

// Fields inside MANIFEST.json that are expected to differ between two runs
// taken minutes apart and carry no information about whether the capture
// itself was deterministic (only the real wall-clock moment the script ran).
const MANIFEST_IGNORE_KEYS = new Set(['generatedAt']);

async function sha256(filePath) {
  const buf = await readFile(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

function stripIgnored(obj) {
  const copy = { ...obj };
  for (const key of MANIFEST_IGNORE_KEYS) delete copy[key];
  return copy;
}

export async function compareDirs(dirA, dirB) {
  const [filesA, filesB] = await Promise.all([readdir(dirA), readdir(dirB)]);
  const setA = new Set(filesA);
  const setB = new Set(filesB);

  const onlyInA = [...setA].filter((f) => !setB.has(f)).sort();
  const onlyInB = [...setB].filter((f) => !setA.has(f)).sort();
  const shared = [...setA].filter((f) => setB.has(f)).sort();

  const differing = [];

  for (const file of shared) {
    if (file === MANIFEST_FILENAME) {
      const [a, b] = await Promise.all([
        readFile(path.join(dirA, file), 'utf8').then(JSON.parse),
        readFile(path.join(dirB, file), 'utf8').then(JSON.parse),
      ]);
      const aStr = JSON.stringify(stripIgnored(a), null, 2);
      const bStr = JSON.stringify(stripIgnored(b), null, 2);
      if (aStr !== bStr) differing.push({ file, reason: 'manifest content differs (excluding generatedAt)' });
      continue;
    }
    const [hashA, hashB] = await Promise.all([sha256(path.join(dirA, file)), sha256(path.join(dirB, file))]);
    if (hashA !== hashB) differing.push({ file, reason: 'sha256 mismatch' });
  }

  return {
    identical: onlyInA.length === 0 && onlyInB.length === 0 && differing.length === 0,
    onlyInA,
    onlyInB,
    differing,
  };
}

function isMain() {
  return process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href;
}

if (isMain()) {
  const [dirA, dirB] = process.argv.slice(2);
  if (!dirA || !dirB) {
    console.error('Usage: node diff-runs.mjs <dirA> <dirB>');
    process.exit(2);
  }
  const report = await compareDirs(path.resolve(dirA), path.resolve(dirB));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.identical ? 0 : 1);
}
