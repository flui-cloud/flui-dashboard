export interface DocumentDatabase {
  name: string;
  sizeOnDisk?: number;
  empty?: boolean;
}

export interface DocumentCollection {
  name: string;
  type: 'collection' | 'view';
  estimatedCount?: number;
}

/** An inferred field of a collection (dotted path + observed types) for autocomplete. */
export interface DocumentField {
  path: string;
  types: string[];
}

export interface DocumentStoreSummary {
  databaseCount: number;
  databases: { name: string; collectionCount: number }[];
}

export interface DocumentPage {
  documents: unknown[];
  count: number;
  truncated: boolean;
  durationMs: number;
}

export interface DocCollectionsRequest {
  database: string;
}

export interface DocFindRequest {
  database: string;
  collection: string;
  /** Raw mongosh-syntax filter (e.g. { _id: ObjectId("…") }); parsed server-side. */
  filterText?: string;
  /** Raw mongosh-syntax sort (e.g. { createdAt: -1 }). */
  sortText?: string;
  /** Raw mongosh-syntax projection (e.g. { name: 1, _id: 0 }). */
  projectionText?: string;
  limit?: number;
  skip?: number;
}

export interface DocCommandRequest {
  database: string;
  command: Record<string, unknown>;
  readOnly?: boolean;
}

export interface CommandResult {
  reply: unknown;
  durationMs: number;
}

/** A mongosh statement to evaluate (translated to a command server-side). */
export interface DocShellRequest {
  database: string;
  input: string;
  readOnly?: boolean;
}

/** How the dashboard should render a shell reply. */
export type DocShellShape =
  | 'cursor'
  | 'firstDoc'
  | 'count'
  | 'distinct'
  | 'databases'
  | 'collectionNames'
  | 'insert'
  | 'update'
  | 'delete'
  | 'raw';

export interface DocShellResult {
  database: string;
  method: string;
  shape: DocShellShape;
  mutation: boolean;
  /** Canonical Extended JSON reply (same as find documents). */
  reply: unknown;
  durationMs: number;
}

export interface DocAssistRequest {
  prompt: string;
  conversation?: { role: 'user' | 'assistant'; content: string }[];
  /** Active database/collection — scopes the data-blind structure context. */
  database?: string;
  collection?: string;
  model?: string;
  provider?: string;
  connectionId?: string;
}

export interface DocAssistResult {
  /** A runnable mongosh statement. */
  shell: string;
  explanation: string;
  mutation: boolean;
}
