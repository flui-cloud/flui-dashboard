export type KeyType =
  | 'string'
  | 'list'
  | 'set'
  | 'zset'
  | 'hash'
  | 'stream'
  | 'none';

export interface KeyMeta {
  key: string;
  type: KeyType;
  ttl: number;
}

export interface ScanResult {
  cursor: string;
  keys: KeyMeta[];
}

export interface KeyspaceSummary {
  keyCount: number;
  sampled: number;
  byType: { type: KeyType; count: number }[];
}

export interface KvStringValue {
  kind: 'string';
  value: string;
}
export interface KvHashValue {
  kind: 'hash';
  fields: { field: string; value: string }[];
}
export interface KvListValue {
  kind: 'list';
  items: string[];
}
export interface KvSetValue {
  kind: 'set';
  members: string[];
}
export interface KvZSetValue {
  kind: 'zset';
  entries: { member: string; score: number }[];
}
export interface KvOtherValue {
  kind: 'other';
  note: string;
}
export type KvValue =
  | KvStringValue
  | KvHashValue
  | KvListValue
  | KvSetValue
  | KvZSetValue
  | KvOtherValue;

export interface KeyValueRead {
  key: string;
  type: KeyType;
  ttl: number;
  length?: number;
  truncated: boolean;
  value: KvValue;
}

export interface CommandResult {
  reply: unknown;
  durationMs: number;
}

export interface KvScanRequest {
  cursor: string;
  match?: string;
  count?: number;
}

export interface KvCommandRequest {
  args: (string | number)[];
  readOnly?: boolean;
}

export interface KvAssistTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface KvAssistRequest {
  prompt: string;
  conversation?: KvAssistTurn[];
  model?: string;
  provider?: string;
  connectionId?: string;
}

export interface KvAssistResult {
  command: string;
  explanation: string;
  mutation: boolean;
}
