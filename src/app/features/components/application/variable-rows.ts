export interface VarRow {
  key: string;
  value: string;
  originalValue: string;
  isNew: boolean;
  isSensitive: boolean;
  /** Declared but never delivered — no value to mask, only a name to fill in. */
  isPending: boolean;
  editingPlain: boolean;
  newPlainValue: string;
  editingSecret: boolean;
  newSecretValue: string;
}

export const HIDDEN_VALUE = '****';

export function varRow(
  key: string,
  value: string,
  flags: Partial<Pick<VarRow, 'isNew' | 'isSensitive' | 'isPending'>> = {},
): VarRow {
  return {
    key,
    value,
    originalValue: flags.isNew ? '' : value,
    isNew: flags.isNew ?? false,
    isSensitive: flags.isSensitive ?? false,
    isPending: flags.isPending ?? false,
    editingPlain: false,
    newPlainValue: '',
    editingSecret: false,
    newSecretValue: '',
  };
}

export function buildVarRows(
  data: Record<string, string>,
  sensitiveKeys: string[],
  pendingKeys: string[],
): VarRow[] {
  const sensitive = new Set(sensitiveKeys);
  const configured = Object.entries(data).map(([key, value]) =>
    sensitive.has(key)
      ? varRow(key, HIDDEN_VALUE, { isSensitive: true })
      : varRow(key, value, { isSensitive: false }),
  );
  const pending = pendingKeys.map((key) =>
    varRow(key, HIDDEN_VALUE, { isSensitive: true, isPending: true }),
  );
  return [...configured, ...pending];
}

export function isDirtyRow(row: VarRow): boolean {
  if (row.isNew) return true;
  if (row.isSensitive) return row.value !== HIDDEN_VALUE;
  return row.value !== row.originalValue;
}

function parsesAsJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Detects if a string looks like JSON, YAML, or is long enough to need a big editor. */
function detectValueType(value: string): 'json' | 'yaml' | 'long' | 'plain' {
  const trimmed = value.trim();
  if (!trimmed) return 'plain';
  if (
    ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) &&
    parsesAsJson(trimmed)
  ) {
    return 'json';
  }
  if (trimmed.includes('\n') || trimmed.startsWith('---') || /^[a-zA-Z_]\w*:\s/.test(trimmed)) {
    return 'yaml';
  }
  if (value.length > 80) return 'long';
  return 'plain';
}

const TYPE_LABEL: Record<ReturnType<typeof detectValueType>, string> = {
  json: 'JSON',
  yaml: 'YAML',
  long: 'Long',
  plain: '',
};

export function valueTypeLabel(value: string): string {
  return TYPE_LABEL[detectValueType(value)];
}

export type JsonVariables =
  { ok: true; data: Record<string, string> | null } | { ok: false; error: string };

export function parseJsonVariables(text: string): JsonVariables {
  if (!text.trim()) return { ok: true, data: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
    return { ok: false, error: 'Must be a flat JSON object: { "KEY": "value" }' };
  }
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v !== 'string') return { ok: false, error: `Value for "${k}" must be a string` };
  }
  return { ok: true, data: parsed as Record<string, string> };
}
