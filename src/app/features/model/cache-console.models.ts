export type CacheEngine = 'memcached';

export interface CacheConnectionInfo {
  engine: CacheEngine;
  label: string;
  namespace: string;
  podLabelSelector: string;
  clusterId: string;
  remotePort: number;
}

export interface CacheServerInfo {
  version: string;
  uptimeSeconds: number;
  currItems: number;
  totalItems: number;
  bytes: number;
  limitMaxBytes: number;
  getHits: number;
  getMisses: number;
  evictions: number;
  currConnections: number;
  totalConnections: number;
  cmdGet: number;
  cmdSet: number;
  bytesRead: number;
  bytesWritten: number;
}

export interface CacheEntry {
  key: string;
  value: string;
  encoding: 'utf8' | 'base64';
  flags: number;
  sizeBytes: number;
}

export interface CacheGetResult {
  found: boolean;
  entry: CacheEntry | null;
}

export interface CacheSetRequest {
  key: string;
  value: string;
  ttlSeconds?: number;
  flags?: number;
  readOnly?: boolean;
}

export interface CacheDeleteRequest {
  key: string;
  readOnly?: boolean;
}
