export interface KvRow {
  key: string;
  value: string;
}

export function consoleError(e: unknown): string {
  if (e && typeof e === 'object' && 'error' in e) {
    const err = (e as { error?: { message?: string } }).error;
    if (err?.message) return err.message;
  }
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}

export function joinPath(a: string, b: string): string {
  const strip = (s: string) => {
    let i = 0;
    let j = s.length;
    while (i < j && s[i] === '/') i++;
    while (j > i && s[j - 1] === '/') j--;
    return s.slice(i, j);
  };
  return [a, b].map(strip).filter(Boolean).join('/');
}

export function rowsToData(rows: KvRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) if (r.key.trim()) out[r.key.trim()] = r.value;
  return out;
}

export function dataToRows(data?: Record<string, string>): KvRow[] {
  return data ? Object.entries(data).map(([key, value]) => ({ key, value })) : [];
}

export function toEnv(data: Record<string, string>): string {
  return Object.entries(data)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}

export function toJson(data: Record<string, string>): string {
  return JSON.stringify(data, null, 2);
}

export function parseEnv(text: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) return null;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return Object.keys(out).length ? out : null;
}

export function parseBulk(text: string): Record<string, string> | null {
  const trimmed = text.trim();
  let parsed: Record<string, string> | null = null;
  try {
    const j = JSON.parse(trimmed);
    if (j && typeof j === 'object' && !Array.isArray(j)) {
      parsed = {};
      for (const [k, v] of Object.entries(j)) {
        parsed[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
    }
  } catch {
    parsed = parseEnv(trimmed);
  }
  if (!parsed || Object.keys(parsed).length === 0) return null;
  return parsed;
}
