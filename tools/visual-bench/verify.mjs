/**
 * The actual gate: runs capture.mjs twice back to back into throwaway
 * directories, diffs them, and only promotes to the real output directory
 * (config.DEFAULT_OUT_DIR, unless --out overrides it) if the two runs came
 * back byte-for-byte identical. Any extra CLI args (--only, --themes) are
 * forwarded to both capture runs.
 *
 * Usage:
 *   node verify.mjs [--out DIR] [--only SUBSTRING] [--themes dark,light] [--keep-temp]
 */
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, cp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_OUT_DIR } from './lib/config.mjs';
import { compareDirs } from './diff-runs.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const forwarded = args.filter((_, i) => {
  if (args[i - 1] === '--out') return false;
  return args[i] !== '--out' && args[i] !== '--keep-temp';
});
const FINAL_OUT = path.resolve(flag('--out', DEFAULT_OUT_DIR));
const KEEP_TEMP = args.includes('--keep-temp');

function runCapture(outDir) {
  const result = spawnSync(
    process.execPath,
    [path.join(import.meta.dirname, 'capture.mjs'), '--out', outDir, ...forwarded],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    throw new Error(`capture.mjs exited ${result.status} (out=${outDir})`);
  }
}

async function main() {
  const base = await mkdtemp(path.join(tmpdir(), 'flui-visual-bench-'));
  const runA = path.join(base, 'run-a');
  const runB = path.join(base, 'run-b');

  console.log('=== Run 1/2 ===');
  runCapture(runA);
  console.log('\n=== Run 2/2 ===');
  runCapture(runB);

  console.log('\n=== Diffing the two runs ===');
  const report = await compareDirs(runA, runB);
  console.log(JSON.stringify(report, null, 2));

  if (!report.identical) {
    console.error(
      `\nNOT DETERMINISTIC — the two runs differ. Left as-is at:\n  ${runA}\n  ${runB}\n` +
        'Fix the hazard before trusting this bench (see README > Determinism). Nothing was promoted.',
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\nIdentical. Promoting run 2 to ${FINAL_OUT} ...`);
  await mkdir(path.dirname(FINAL_OUT), { recursive: true });
  await rm(FINAL_OUT, { recursive: true, force: true });
  await cp(runB, FINAL_OUT, { recursive: true });
  console.log('Done.');

  if (!KEEP_TEMP) {
    await rm(base, { recursive: true, force: true });
  } else {
    console.log(`(kept temp runs at ${base})`);
  }
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
