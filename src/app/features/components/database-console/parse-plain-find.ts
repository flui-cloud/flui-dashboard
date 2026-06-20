/** A plain `find` recognized in a mongosh statement, as raw argument text (re-parsed server-side). */
export interface PlainFind {
  collection: string;
  filterText: string;
  projectionText: string;
  sortText: string;
}

const ALLOWED_MODS = new Set(['sort', 'limit', 'skip', 'project', 'projection', 'pretty', 'toArray']);

/** Read a balanced (…) block starting at `s[start] === '('`; tolerant of quoted strings. */
function readParens(s: string, start: number): { inner: string; end: number } | null {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return { inner: s.slice(start + 1, i), end: i };
  }
  return null;
}

/** Split on TOP-LEVEL commas only (respecting nesting and strings). */
function splitArgs(s: string): string[] {
  const t = s.trim();
  if (!t) return [];
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let last = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      out.push(t.slice(last, i).trim());
      last = i + 1;
    }
  }
  out.push(t.slice(last).trim());
  return out;
}

/**
 * Recognize ONLY a plain `db.<collection>.find(<filter>?, <projection>?)` optionally chained with
 * `.sort()/.limit()/.skip()/.projection()/.pretty()/.toArray()`, and return its argument text so it
 * can populate the Compass-style find bar (which re-parses mongosh server-side). Anything else —
 * findOne, aggregate, count, writes, getCollection()/index access, multiple statements, unknown
 * cursor methods — returns null so the caller falls back to the shell. limit/skip are dropped (the
 * grid paginates), so a routed find always lands in the main paged browse view.
 */
export function parsePlainFind(statement: string): PlainFind | null {
  let stmt = statement.trim();
  while (stmt.endsWith(';')) stmt = stmt.slice(0, -1);
  const head = /^db\.([A-Za-z_$][\w$]*)\.find\s*\(/.exec(stmt);
  if (!head) return null;
  const collection = head[1];

  const open = stmt.indexOf('(', head.index);
  const find = readParens(stmt, open);
  if (!find) return null;

  const args = splitArgs(find.inner);
  let filterText = args[0] ?? '';
  let projectionText = args[1] ?? '';
  let sortText = '';

  // Walk the trailing cursor chain: each segment must be `.name(<balanced>)`.
  let rest = stmt.slice(find.end + 1).trim();
  while (rest.length > 0) {
    const seg = /^\.\s*([A-Za-z_$][\w$]*)\s*\(/.exec(rest);
    if (!seg) return null; // trailing junk / unsupported syntax → not a plain find
    const name = seg[1];
    if (!ALLOWED_MODS.has(name)) return null; // count/explain/etc. → shell
    const modOpen = rest.indexOf('(', seg.index);
    const block = readParens(rest, modOpen);
    if (!block) return null;
    if (name === 'sort') sortText = block.inner.trim();
    else if (name === 'project' || name === 'projection') projectionText = block.inner.trim();
    rest = rest.slice(block.end + 1).trim();
  }

  if (filterText === '{}') filterText = '';
  return { collection, filterText, projectionText, sortText };
}
