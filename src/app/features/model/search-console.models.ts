export type SearchEngine = 'opensearch';

export interface SearchClusterInfo {
  clusterName: string;
  version: string;
  distribution?: string;
}

export interface SearchIndex {
  name: string;
  health?: string;
  status?: string;
  docsCount?: number;
  storeSize?: string;
  uuid?: string;
}

export interface SearchHit {
  id: string;
  index: string;
  score: number | null;
  source: Record<string, unknown>;
}

export interface SearchResponse {
  total: number;
  totalRelation: 'eq' | 'gte';
  maxScore: number | null;
  tookMs: number;
  timedOut: boolean;
  hits: SearchHit[];
}

export interface SearchConnectionInfo {
  engine: SearchEngine;
  label: string;
  namespace: string;
  podLabelSelector: string;
  clusterId: string;
  remotePort: number;
  useTls: boolean;
}

export interface SearchQueryRequest {
  index: string;
  body?: Record<string, unknown>;
  from?: number;
  size?: number;
}

export interface SearchAssistTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface SearchAssistRequest {
  prompt: string;
  index?: string;
  conversation?: SearchAssistTurn[];
  model?: string;
  provider?: string;
  connectionId?: string;
}

export interface SearchAssistResult {
  index: string;
  body: Record<string, unknown>;
  explanation: string;
}

export interface SearchRawRequest {
  method: string;
  path: string;
  body?: unknown;
  /** Defaults to true server-side — mutating requests rejected unless false. */
  readOnly?: boolean;
}

/** Dev Tools copilot result: one raw REST request the console editor receives. */
export interface SearchRawAssistResult {
  method: string;
  path: string;
  body?: Record<string, unknown>;
  explanation: string;
  /** True when the generated call mutates (per the engine classifier). */
  write: boolean;
}

export interface SearchRawResponse {
  status: number;
  durationMs: number;
  body: unknown;
}
