import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baselinePath = path.join(root, 'tools/slop/baseline.json');
const args = process.argv.slice(2);
const update = args.includes('--update');
const topIndex = args.indexOf('--top');
const top = topIndex >= 0 ? Number(args[topIndex + 1]) : 0;

const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';

const RULES = {
  'palette-color': new RegExp(
    `\\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|divide|shadow|decoration|caret|placeholder)-(?:${PALETTE})-\\d{2,3}\\b`,
    'g',
  ),
  gradient: /\bbg-gradient-|\b(?:linear|radial|conic)-gradient\(/g,
  shadow: /\bshadow-(?:md|lg|xl|2xl|inner)\b|box-shadow:(?!\s*var\(--fl-focus-ring\))|drop-shadow/g,
  'large-radius': /\brounded-(?:[tblr]{1,2}-)?(?:xl|2xl|3xl)\b/g,
  blur: /\bbackdrop-blur|\bblur-(?:sm|md|lg|xl|2xl|3xl)\b/g,
  hex: /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g,
  'arbitrary-value': /-\[(?:#|\d+(?:\.\d+)?(?:px|rem)\])/g,
  'dark-variant': /\bdark:/g,
  'attention-animation': /\banimate-(?:pulse|bounce|ping)\b/g,
};

const STRICT = [
  /^src\/app\/ui\//,
  /^src\/theme\/console\//,
  /^src\/app\/core\/state\//,
  /^src\/app\/layout\/console\//,
  /^src\/app\/features\/[^/]+\/(?:pages|ui|data)\//,
];

const SKIP = [/^src\/app\/core\/api\//, /\.spec\.ts$/];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return walk(full);
      return /\.(?:ts|html|scss|css)$/.test(e.name) ? [full] : [];
    }),
  );
  return files.flat();
}

const files = [...(await walk(path.join(root, 'src/app'))), ...(await walk(path.join(root, 'src/theme/console'))), path.join(root, 'src/styles.scss')]
  .map((f) => path.relative(root, f))
  .filter((f) => !SKIP.some((re) => re.test(f)));

const totals = Object.fromEntries(Object.keys(RULES).map((k) => [k, 0]));
const byFile = new Map();
const strictHits = [];

for (const file of files) {
  const text = await readFile(path.join(root, file), 'utf8');
  let fileCount = 0;
  for (const [rule, re] of Object.entries(RULES)) {
    const hits = text.match(re)?.length ?? 0;
    if (!hits) continue;
    totals[rule] += hits;
    fileCount += hits;
    if (STRICT.some((s) => s.test(file))) strictHits.push(`${file}: ${hits} × ${rule}`);
  }
  if (fileCount) byFile.set(file, fileCount);
}

const baseline = JSON.parse(await readFile(baselinePath, 'utf8').catch(() => '{}'));
const total = Object.values(totals).reduce((a, b) => a + b, 0);

console.log('rule'.padEnd(22), 'now'.padStart(6), 'baseline'.padStart(9));
for (const [rule, count] of Object.entries(totals)) {
  const was = baseline[rule] ?? '-';
  console.log(rule.padEnd(22), String(count).padStart(6), String(was).padStart(9));
}
console.log('total'.padEnd(22), String(total).padStart(6));

if (top) {
  console.log(`\ntop ${top} files`);
  [...byFile.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .forEach(([f, n]) => console.log(String(n).padStart(5), f));
}

let failed = false;
if (strictHits.length) {
  failed = true;
  console.error('\nforbidden in kit and migrated code:');
  strictHits.forEach((h) => console.error(`  ${h}`));
}

const grown = Object.entries(totals).filter(([rule, n]) => baseline[rule] !== undefined && n > baseline[rule]);
if (grown.length && !update) {
  failed = true;
  console.error('\nabove baseline:');
  grown.forEach(([rule, n]) => console.error(`  ${rule}: ${n} > ${baseline[rule]}`));
}

if (update) {
  if (grown.length && !args.includes('--force')) {
    console.error('\nrefusing to raise the baseline; pass --force if that is intended');
    process.exit(1);
  }
  await writeFile(baselinePath, `${JSON.stringify(totals, null, 2)}\n`);
  console.log(`\nbaseline updated`);
}

process.exit(failed ? 1 : 0);
