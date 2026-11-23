import { RawConsoleExample } from './rest-console.component';

export const MEILI_CONSOLE_EXAMPLES: RawConsoleExample[] = [
  { label: 'List indexes', text: 'GET /indexes' },
  { label: 'Stats', text: 'GET /stats' },
  { label: 'Index settings', text: 'GET /indexes/movies/settings' },
  { label: 'Search', text: 'POST /indexes/movies/search\n{\n  "q": "horror",\n  "limit": 5\n}' },
  {
    label: 'Create index',
    write: true,
    text: 'POST /indexes\n{\n  "uid": "movies",\n  "primaryKey": "id"\n}',
  },
  {
    label: 'Add documents',
    write: true,
    text: 'POST /indexes/movies/documents\n[\n  { "id": 1, "title": "Alien", "genre": "horror" }\n]',
  },
  {
    label: 'Set filterable',
    write: true,
    text: 'PATCH /indexes/movies/settings\n{\n  "filterableAttributes": ["genre", "rating"]\n}',
  },
  { label: 'Delete index', write: true, text: 'DELETE /indexes/movies' },
];

export function formatMeiliRaw(r: {
  method: string;
  path: string;
  body?: Record<string, unknown>;
}): string {
  const head = `${r.method} ${r.path}`;
  return r.body && Object.keys(r.body).length
    ? `${head}\n${JSON.stringify(r.body, null, 2)}`
    : head;
}

export function meiliError(e: unknown): string {
  if (e && typeof e === 'object' && 'error' in e) {
    const err = (e as { error?: { message?: string } }).error;
    if (err?.message) return err.message;
  }
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
