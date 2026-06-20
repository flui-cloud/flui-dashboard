// Mirrors the backend full-text (Meilisearch) console contracts.

export interface MeiliConnectionInfo {
  engine: string;
  label: string;
  namespace: string;
  podLabelSelector: string;
  clusterId: string;
  remotePort: number;
}

export interface MeiliServerInfo {
  version: string;
  databaseSize?: number;
  indexCount: number;
}

export interface MeiliIndex {
  uid: string;
  primaryKey?: string;
  numberOfDocuments?: number;
}

export interface MeiliSearchResult {
  query: string;
  hits: Record<string, unknown>[];
  estimatedTotalHits: number;
  processingTimeMs: number;
  limit: number;
  offset: number;
}

export interface MeiliSearchSuggestion {
  index?: string;
  q: string;
  filter?: string;
  explanation: string;
}

export interface MeiliRawSuggestion {
  method: string;
  path: string;
  body?: Record<string, unknown>;
  explanation: string;
  write: boolean;
}
