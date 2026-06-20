export type ObjectStoreEngine = 'garage';

export interface S3Bucket {
  name: string;
  creationDate?: string;
}

export interface BucketPolicy {
  public: boolean;
}

export interface S3ObjectEntry {
  key: string;
  size: number;
  lastModified?: string;
  etag?: string;
}

export interface S3Listing {
  prefix: string;
  delimiter: string;
  prefixes: string[];
  objects: S3ObjectEntry[];
  isTruncated: boolean;
  continuationToken?: string;
  keyCount: number;
}

export interface S3ObjectMeta {
  key: string;
  size: number;
  contentType?: string;
  lastModified?: string;
  etag?: string;
  metadata?: Record<string, string>;
}

export interface ObjectStoreConnectionInfo {
  engine: ObjectStoreEngine;
  label: string;
  region: string;
  namespace: string;
  podLabelSelector: string;
  clusterId: string;
  remotePort: number;
  defaultBucket?: string;
}

export interface ListObjectsRequest {
  bucket: string;
  prefix?: string;
  delimiter?: string;
  continuationToken?: string;
  maxKeys?: number;
}

export interface ShareLink {
  token: string;
  /** Relative path under the API base, e.g. /object-store/share/<token>. */
  path: string;
  expiresAt: string;
}

export interface ShareRecord {
  id: string;
  bucket: string;
  key: string;
  expiresAt: string;
  revokedAt: string | null;
  lastAccessedAt: string | null;
  createdAt: string;
  status: 'active' | 'expired' | 'revoked';
}
