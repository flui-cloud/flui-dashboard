import { DocShellResult } from '../../model/document-console.models';

export interface ShellEntry {
  input: string;
  db: string;
  status: 'ok' | 'error' | 'note';
  error?: string;
  note?: string;
  header?: string;
  durationMs?: number;
  mutation?: boolean;
  scalar?: string;
  docs?: unknown[];
  value?: unknown;
  hasValue?: boolean;
}

export function toShellEntry(input: string, res: DocShellResult): ShellEntry {
  const base: ShellEntry = {
    input,
    db: res.database,
    status: 'ok',
    durationMs: res.durationMs,
    mutation: res.mutation,
  };
  const reply = res.reply as Record<string, unknown> | null;
  switch (res.shape) {
    case 'cursor': {
      const docs = firstBatch(reply);
      return { ...base, header: plural(docs.length, 'document'), docs };
    }
    case 'firstDoc': {
      const doc = firstBatch(reply)[0];
      return doc === undefined
        ? { ...base, scalar: 'null' }
        : { ...base, value: doc, hasValue: true };
    }
    case 'count':
      return { ...base, scalar: String(num(reply?.['n'])) };
    case 'distinct': {
      const values = (reply?.['values'] as unknown[]) ?? [];
      return { ...base, header: plural(values.length, 'value'), docs: values };
    }
    case 'databases': {
      const dbs = (reply?.['databases'] as unknown[]) ?? [];
      return { ...base, header: plural(dbs.length, 'database'), value: dbs, hasValue: true };
    }
    case 'collectionNames': {
      const names = firstBatch(reply).map((c) =>
        c && typeof c === 'object' ? (c as { name?: string }).name : c,
      );
      return {
        ...base,
        header: plural(names.length, 'collection'),
        value: names,
        hasValue: true,
      };
    }
    case 'insert':
      return {
        ...base,
        value: { acknowledged: true, insertedCount: num(reply?.['n']) },
        hasValue: true,
      };
    case 'update':
      return {
        ...base,
        value: {
          acknowledged: true,
          matchedCount: num(reply?.['n']),
          modifiedCount: num(reply?.['nModified']),
          upsertedId: (reply?.['upserted'] as { _id?: unknown }[] | undefined)?.[0]?._id,
        },
        hasValue: true,
      };
    case 'delete':
      return {
        ...base,
        value: { acknowledged: true, deletedCount: num(reply?.['n']) },
        hasValue: true,
      };
    default:
      return { ...base, value: reply, hasValue: true };
  }
}

function firstBatch(reply: Record<string, unknown> | null): unknown[] {
  const cursor = reply?.['cursor'] as { firstBatch?: unknown[] } | undefined;
  return cursor?.firstBatch ?? [];
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object') {
    const o = v as Record<string, string>;
    const raw = o['$numberInt'] ?? o['$numberLong'] ?? o['$numberDouble'] ?? o['$numberDecimal'];
    if (raw !== undefined) return Number(raw);
  }
  return 0;
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
