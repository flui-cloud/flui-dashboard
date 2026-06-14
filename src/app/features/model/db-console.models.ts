import { DbEngine } from './db-engine';

export type { DbEngine, DbEngineFamily, DbEngineDescriptor } from './db-engine';
export {
  DB_ENGINES,
  engineDescriptor,
  databaseEngineOf,
  isQueryableDatabase,
} from './db-engine';

export interface SqlColumn {
  name: string;
  dataType: string;
}

export interface SqlQueryResult {
  command: string;
  columns: SqlColumn[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  durationMs: number;
}

export interface SchemaColumnRef {
  schema: string;
  table: string;
  column: string;
}

export interface SchemaColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey?: boolean;
  references?: SchemaColumnRef;
}

export interface SchemaTable {
  name: string;
  type: 'table' | 'view';
  columns: SchemaColumn[];
  rowEstimate?: number;
}

export interface SchemaNamespace {
  name: string;
  tables: SchemaTable[];
}

export interface SchemaTree {
  engine: DbEngine;
  schemas: SchemaNamespace[];
  serverVersion?: string;
}

export interface RunQueryRequest {
  sql: string;
  readOnly?: boolean;
  limit?: number;
}

export interface AssistTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistRequest {
  prompt: string;
  conversation?: AssistTurn[];
  model?: string;
  provider?: string;
  connectionId?: string;
}

export interface AssistResult {
  sql: string;
  explanation: string;
  mutation: boolean;
}

export interface DbConnectionInfo {
  engine: DbEngine;
  database: string;
  user: string;
  namespace: string;
  podLabelSelector: string;
  clusterId: string;
  remotePort: number;
}
