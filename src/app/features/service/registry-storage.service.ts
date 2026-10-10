import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, timeout } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import { isSandboxRefusal } from '../../core/services/sandbox.service';
import {
  ConnectRegistryBucket,
  RegistryBucket,
  RegistryBucketRemoval,
  RegistryStorageStatus,
  RegistryTraffic,
  RegistryTrafficWindow,
  ScalewayRegistryRegion,
} from '../model/registry-storage.models';

export const REGISTRY_REFUSED_MESSAGE =
  'Managing the image registry needs the permission to manage integrations.';

const SCALEWAY_CONNECT_TIMEOUT_MS = 8 * 60_000;
const OWN_BUCKET_CONNECT_TIMEOUT_MS = 3 * 60_000;
const BUCKET_REMOVE_TIMEOUT_MS = 10 * 60_000;

export type RegistryConnecting = 'scaleway' | 'own' | null;

interface ApiErrorShape {
  status?: number;
  name?: string;
  message?: string;
  error?: { message?: string | string[] } | string | null;
}

@Injectable({ providedIn: 'root' })
export class RegistryStorageService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly statusData = signal<RegistryStorageStatus | null>(null);
  private readonly loadingData = signal(false);
  private readonly measuringData = signal(false);
  private readonly connectingData = signal<RegistryConnecting>(null);
  private readonly refusedData = signal(false);
  private readonly refusalMessageData = signal<string | null>(null);
  private readonly loadErrorData = signal<string | null>(null);
  private readonly connectErrorData = signal<string | null>(null);
  private readonly bucketsData = signal<RegistryBucket[]>([]);
  private readonly removingData = signal<string | null>(null);
  private readonly removeErrorData = signal<string | null>(null);
  private readonly trafficData = signal<RegistryTraffic | null>(null);
  private readonly trafficWindowData = signal<RegistryTrafficWindow>('24h');
  private readonly trafficLoadingData = signal(false);
  private readonly trafficHiddenData = signal(false);
  private readonly trafficFailedData = signal(false);

  readonly status = this.statusData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly measuring = this.measuringData.asReadonly();
  readonly connecting = this.connectingData.asReadonly();
  readonly refused = this.refusedData.asReadonly();
  readonly refusalMessage = this.refusalMessageData.asReadonly();
  readonly loadError = this.loadErrorData.asReadonly();
  readonly connectError = this.connectErrorData.asReadonly();
  readonly buckets = this.bucketsData.asReadonly();
  readonly removing = this.removingData.asReadonly();
  readonly removeError = this.removeErrorData.asReadonly();
  readonly traffic = this.trafficData.asReadonly();
  readonly trafficWindow = this.trafficWindowData.asReadonly();
  readonly trafficLoading = this.trafficLoadingData.asReadonly();
  readonly trafficHidden = this.trafficHiddenData.asReadonly();
  readonly trafficFailed = this.trafficFailedData.asReadonly();

  private url(path = ''): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/registry/storage${path}`;
  }

  async load(measure = false): Promise<void> {
    (measure ? this.measuringData : this.loadingData).set(true);
    this.loadErrorData.set(null);
    try {
      const params = measure ? new HttpParams().set('measure', 'true') : undefined;
      const status = await firstValueFrom(
        this.http.get<RegistryStorageStatus>(this.url(), { params }),
      );
      this.statusData.set(status);
      this.clearRefusal();
    } catch (err) {
      if (!this.noteRefusal(err)) {
        this.loadErrorData.set(
          messageOf(err, measure ? 'Could not measure the space now' : 'Could not read the image registry'),
        );
      }
    } finally {
      (measure ? this.measuringData : this.loadingData).set(false);
    }
  }

  async connectScaleway(region: ScalewayRegistryRegion): Promise<boolean> {
    return this.connect(
      'scaleway',
      this.http
        .post<RegistryStorageStatus>(this.url('/scaleway'), { region })
        .pipe(timeout(SCALEWAY_CONNECT_TIMEOUT_MS)),
      'Could not create the bucket on Scaleway',
    );
  }

  async connectOwn(body: ConnectRegistryBucket): Promise<boolean> {
    return this.connect(
      'own',
      this.http
        .post<RegistryStorageStatus>(this.url(), body)
        .pipe(timeout(OWN_BUCKET_CONNECT_TIMEOUT_MS)),
      'Could not connect the bucket',
    );
  }

  async loadTraffic(window: RegistryTrafficWindow = this.trafficWindowData()): Promise<void> {
    this.trafficWindowData.set(window);
    this.trafficLoadingData.set(true);
    this.trafficFailedData.set(false);
    try {
      const traffic = await firstValueFrom(
        this.http.get<RegistryTraffic>(
          `${this.appConfig.apiBaseUrl}/api/v1/registry/traffic`,
          { params: new HttpParams().set('window', window) },
        ),
      );
      if (this.trafficWindowData() !== window) return;
      this.trafficData.set(traffic);
      this.trafficHiddenData.set(false);
    } catch (err) {
      if (this.trafficWindowData() !== window) return;
      const status = (err as ApiErrorShape | null)?.status;
      if (status === 403 || isSandboxRefusal(err)) {
        this.trafficHiddenData.set(true);
      } else {
        this.trafficFailedData.set(true);
      }
      this.trafficData.set(null);
    } finally {
      if (this.trafficWindowData() === window) this.trafficLoadingData.set(false);
    }
  }

  async loadBuckets(): Promise<void> {
    try {
      const buckets = await firstValueFrom(
        this.http.get<RegistryBucket[]>(this.url('/buckets')),
      );
      this.bucketsData.set(buckets);
    } catch (err) {
      this.noteRefusal(err);
    }
  }

  async removeBucket(id: string): Promise<RegistryBucketRemoval | null> {
    this.removingData.set(id);
    this.removeErrorData.set(null);
    try {
      const removal = await firstValueFrom(
        this.http
          .delete<RegistryBucketRemoval>(this.url(`/buckets/${encodeURIComponent(id)}`))
          .pipe(timeout(BUCKET_REMOVE_TIMEOUT_MS)),
      );
      this.bucketsData.update((buckets) => buckets.filter((b) => b.id !== id));
      return removal;
    } catch (err) {
      if (!this.noteRefusal(err)) this.removeErrorData.set(messageOf(err, 'Could not remove the bucket'));
      return null;
    } finally {
      this.removingData.set(null);
    }
  }

  clearRemoveError(): void {
    this.removeErrorData.set(null);
  }

  clearConnectError(): void {
    this.connectErrorData.set(null);
  }

  private async connect(
    kind: Exclude<RegistryConnecting, null>,
    request: Observable<RegistryStorageStatus>,
    fallback: string,
  ): Promise<boolean> {
    this.connectingData.set(kind);
    this.connectErrorData.set(null);
    try {
      const status = await firstValueFrom(request);
      this.statusData.update((current) => ({
        ...status,
        ...(status.usage || !current?.usage ? {} : { usage: current.usage }),
      }));
      return true;
    } catch (err) {
      if (!this.noteRefusal(err)) this.connectErrorData.set(messageOf(err, fallback));
      return false;
    } finally {
      this.connectingData.set(null);
    }
  }

  private noteRefusal(err: unknown): boolean {
    const refused = (err as ApiErrorShape | null)?.status === 403 || isSandboxRefusal(err);
    if (!refused) return false;
    this.refusedData.set(true);
    this.refusalMessageData.set(
      isSandboxRefusal(err) ? (bodyMessage(err) ?? REGISTRY_REFUSED_MESSAGE) : REGISTRY_REFUSED_MESSAGE,
    );
    return true;
  }

  private clearRefusal(): void {
    this.refusedData.set(false);
    this.refusalMessageData.set(null);
  }
}

function bodyMessage(err: unknown): string | null {
  const body = (err as ApiErrorShape | null)?.error;
  if (!body || typeof body === 'string') return typeof body === 'string' && body ? body : null;
  const message = body.message;
  if (Array.isArray(message)) return message.join('. ');
  return message || null;
}

function messageOf(err: unknown, fallback: string): string {
  const shape = err as ApiErrorShape | null;
  if (shape?.name === 'TimeoutError') {
    return `${fallback}: no answer in time. Reload the page in a minute to see whether it finished.`;
  }
  if (shape?.status === 0) return `${fallback}: the API did not answer.`;
  return bodyMessage(err) ?? fallback;
}
