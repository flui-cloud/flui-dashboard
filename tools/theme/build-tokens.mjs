import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.join(root, 'src/theme/tokens.json');
const target = path.join(root, 'src/theme/tokens.css');

const tokens = JSON.parse(await readFile(source, 'utf8'));
const { primitives, themes } = tokens;

function fail(message) {
  console.error(`tokens: ${message}`);
  process.exit(1);
}

function primitiveHex(name) {
  const hex = primitives[name];
  if (!hex) fail(`unknown primitive "${name}"`);
  return hex;
}

function roleValue(spec) {
  if (typeof spec === 'string') return `var(--fl-${spec})`;
  primitiveHex(spec.ref);
  return `color-mix(in srgb, var(--fl-${spec.ref}) ${spec.alpha}%, transparent)`;
}

function roleHex(theme, role) {
  const spec = theme[role];
  if (spec === undefined) fail(`unknown role "${role}"`);
  if (typeof spec !== 'string') fail(`legacy role "${role}" must not be translucent`);
  return primitiveHex(spec);
}

function hexToHslTriplet(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const round = (v) => Math.round(v * 10) / 10;
  return `${round(h)} ${round(s * 100)}% ${round(l * 100)}%`;
}

const lines = [];

lines.push(':root {');
for (const [name, hex] of Object.entries(primitives)) lines.push(`  --fl-${name}: ${hex};`);
for (const [k, v] of Object.entries(tokens.space)) lines.push(`  --fl-space-${k}: ${v};`);
for (const [k, v] of Object.entries(tokens.radius)) lines.push(`  --fl-radius-${k}: ${v};`);
for (const [k, v] of Object.entries(tokens.size)) lines.push(`  --fl-${k}: ${v};`);
for (const [k, v] of Object.entries(tokens.font)) lines.push(`  --fl-font-${k}: ${v};`);
for (const [k, t] of Object.entries(tokens.text)) {
  lines.push(
    `  --fl-text-${k}: ${t.weight} ${t.size}/${t.line} var(--fl-font-${t.family ?? 'sans'});`,
  );
  if (t.tracking) lines.push(`  --fl-text-${k}-tracking: ${t.tracking};`);
}
const light = themes.light;
for (const [legacy, role] of Object.entries(tokens.legacy)) {
  lines.push(`  --${legacy}: ${hexToHslTriplet(roleHex(light, role))};`);
}
lines.push(`  --radius: ${tokens.radius.lg};`);
lines.push('  --font-sans: var(--fl-font-sans);');
lines.push('  --font-mono: var(--fl-font-mono);');
lines.push('}', '');

for (const [id, theme] of Object.entries(themes)) {
  const selector = id === 'light' ? ':root, [data-theme="light"]' : `[data-theme="${id}"]`;
  lines.push(`${selector} {`);
  for (const [role, spec] of Object.entries(theme))
    lines.push(`  --fl-${role}: ${roleValue(spec)};`);
  lines.push('  --fl-focus-ring: 0 0 0 2px var(--fl-surface), 0 0 0 4px var(--fl-accent);');
  lines.push('}', '');
}

const css = lines.join('\n');

if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8').catch(() => '');
  if (current !== css) fail('src/theme/tokens.css is out of date, run pnpm tokens');
  process.exit(0);
}

await writeFile(target, css);
console.log(`tokens: wrote ${path.relative(root, target)}`);
