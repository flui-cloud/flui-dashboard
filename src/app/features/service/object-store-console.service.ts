import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  BucketPolicy,
  ListObjectsRequest,
  ObjectStoreConnectionInfo,
  S3Bucket,
  S3Listing,
  S3ObjectMeta,
  ShareLink,
  ShareRecord,
} from '../model/object-store-console.models';

@Injectable({ providedIn: 'root' })
export class ObjectStoreConsoleService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/object-store`;
  }

  getConnectionInfo(appId: string): Observable<ObjectStoreConnectionInfo> {
    return this.http.get<ObjectStoreConnectionInfo>(
      `${this.base(appId)}/connection-info`,
    );
  }

  listBuckets(appId: string): Observable<S3Bucket[]> {
    return this.http.get<S3Bucket[]>(`${this.base(appId)}/buckets`);
  }

  // The storage browser performs writes as explicit user actions; it opts into
  // them with readOnly:false. The backend gate (default read-only) protects
  // API/agent callers that omit the flag.
  createBucket(appId: string, bucket: string): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(`${this.base(appId)}/buckets`, {
      bucket,
      readOnly: false,
    });
  }

  deleteBucket(appId: string, bucket: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(
      `${this.base(appId)}/buckets/${encodeURIComponent(bucket)}?readOnly=false`,
    );
  }

  getBucketPolicy(appId: string, bucket: string): Observable<BucketPolicy> {
    return this.http.get<BucketPolicy>(
      `${this.base(appId)}/buckets/${encodeURIComponent(bucket)}/policy`,
    );
  }

  setBucketPolicy(
    appId: string,
    bucket: string,
    isPublic: boolean,
  ): Observable<BucketPolicy> {
    return this.http.post<BucketPolicy>(`${this.base(appId)}/buckets/policy`, {
      bucket,
      public: isPublic,
      readOnly: false,
    });
  }

  listObjects(appId: string, req: ListObjectsRequest): Observable<S3Listing> {
    return this.http.post<S3Listing>(`${this.base(appId)}/objects`, req);
  }

  headObject(
    appId: string,
    bucket: string,
    key: string,
  ): Observable<S3ObjectMeta> {
    return this.http.post<S3ObjectMeta>(`${this.base(appId)}/object/head`, {
      bucket,
      key,
    });
  }

  /** Stream an object down as a Blob (auth header added by the interceptor). */
  download(appId: string, bucket: string, key: string): Observable<Blob> {
    return this.http.post(
      `${this.base(appId)}/download`,
      { bucket, key },
      { responseType: 'blob' },
    );
  }

  /** Upload one object — the File is the raw request body. */
  upload(
    appId: string,
    bucket: string,
    key: string,
    file: File,
  ): Observable<{ ok: true; key: string }> {
    const params = new HttpParams()
      .set('bucket', bucket)
      .set('key', key)
      .set('readOnly', 'false');
    return this.http.post<{ ok: true; key: string }>(
      `${this.base(appId)}/upload`,
      file,
      {
        params,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      },
    );
  }

  deleteObject(
    appId: string,
    bucket: string,
    key: string,
  ): Observable<{ ok: true; deleted: number }> {
    return this.http.post<{ ok: true; deleted: number }>(
      `${this.base(appId)}/delete`,
      { bucket, key, readOnly: false },
    );
  }

  deletePrefix(
    appId: string,
    bucket: string,
    prefix: string,
  ): Observable<{ ok: true; deleted: number }> {
    return this.http.post<{ ok: true; deleted: number }>(
      `${this.base(appId)}/delete`,
      { bucket, prefix, readOnly: false },
    );
  }

  share(
    appId: string,
    bucket: string,
    key: string,
    ttlSeconds?: number,
  ): Observable<ShareLink> {
    return this.http.post<ShareLink>(`${this.base(appId)}/share`, {
      bucket,
      key,
      ttlSeconds,
    });
  }

  /** Absolute URL a recipient opens — share path is relative to the API base. */
  shareUrl(path: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1${path}`;
  }

  listShares(appId: string): Observable<ShareRecord[]> {
    return this.http.get<ShareRecord[]>(`${this.base(appId)}/shares`);
  }

  revokeShare(appId: string, shareId: string): Observable<ShareRecord> {
    return this.http.post<ShareRecord>(
      `${this.base(appId)}/shares/${shareId}/revoke`,
      {},
    );
  }
}
