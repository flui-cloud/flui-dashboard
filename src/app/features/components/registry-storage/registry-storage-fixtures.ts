import { signal } from '@angular/core';
import {
  RegistryBucket,
  RegistryModeStatus,
  RegistryStorageStatus,
  RegistryTraffic,
  RegistryTrafficWindow,
} from '../../model/registry-storage.models';
import { RegistryConnecting, RegistrySwitching } from '../../service/registry-storage.service';

export const GIB = 1024 ** 3;

export function status(over: Partial<RegistryStorageStatus> = {}): RegistryStorageStatus {
  return {
    backend: 'filesystem',
    connected: false,
    usage: {
      measuredAt: new Date().toISOString(),
      totalBytes: 6 * GIB,
      alertBytes: 16 * GIB,
      capacityBytes: 20 * GIB,
      alerting: false,
      applications: [
        { applicationId: 'app-1', name: 'shop-api', bytes: 3 * GIB },
        { applicationId: 'app-2', name: 'shop-web', bytes: 512 * 1024 * 1024 },
      ],
      unreadable: 0,
    },
    ...over,
  };
}

export class FakeRegistry {
  readonly status = signal<RegistryStorageStatus | null>(null);
  readonly loading = signal(false);
  readonly measuring = signal(false);
  readonly connecting = signal<RegistryConnecting>(null);
  readonly refused = signal(false);
  readonly refusalMessage = signal<string | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly connectError = signal<string | null>(null);
  readonly load = jasmine.createSpy('load').and.resolveTo();
  readonly connectScaleway = jasmine.createSpy('connectScaleway').and.resolveTo(true);
  readonly connectOwn = jasmine.createSpy('connectOwn').and.resolveTo(true);
  readonly clearConnectError = jasmine.createSpy('clearConnectError');
  readonly buckets = signal<RegistryBucket[]>([]);
  readonly removing = signal<string | null>(null);
  readonly removeError = signal<string | null>(null);
  readonly loadBuckets = jasmine.createSpy('loadBuckets').and.resolveTo();
  readonly removeBucket = jasmine.createSpy('removeBucket');
  readonly clearRemoveError = jasmine.createSpy('clearRemoveError');
  readonly traffic = signal<RegistryTraffic | null>(null);
  readonly trafficWindow = signal<RegistryTrafficWindow>('24h');
  readonly trafficLoading = signal(false);
  readonly trafficHidden = signal(false);
  readonly trafficFailed = signal(false);
  readonly loadTraffic = jasmine.createSpy('loadTraffic').and.resolveTo();
  readonly mode = signal<RegistryModeStatus | null>(null);
  readonly switching = signal<RegistrySwitching>(null);
  readonly switchError = signal<string | null>(null);
  readonly loadMode = jasmine.createSpy('loadMode').and.resolveTo();
  readonly enable = jasmine.createSpy('enable').and.resolveTo(true);
  readonly disable = jasmine.createSpy('disable').and.resolveTo(true);
  readonly stopFollowing = jasmine.createSpy('stopFollowing');
  readonly stillNotReady = signal(false);
  readonly checkReadyAgain = jasmine.createSpy('checkReadyAgain').and.resolveTo();
  readonly clearSwitchError = jasmine.createSpy('clearSwitchError');
}

export function mode(over: Partial<RegistryModeStatus> = {}): RegistryModeStatus {
  return {
    mode: 'ghcr',
    source: 'install',
    storage: null,
    host: 'api.example.test',
    ready: null,
    detail: null,
    bucketConnected: false,
    applicationsOnRegistry: 0,
    ...over,
  };
}

export function traffic(over: Partial<RegistryTraffic> = {}): RegistryTraffic {
  return {
    window: '24h',
    requests: { pulls: 120, pushes: 8, deletes: 1 },
    outcomes: { ok: 125, refused: 0, notFound: 1, failed: 0 },
    bytesIn: 2 * GIB,
    bytesOut: 9 * GIB,
    peakBytesPerSecondIn: 1_000_000,
    peakBytesPerSecondOut: 12_500_000,
    readFromBucketBytes: null,
    ...over,
  };
}

export function bucket(over: Partial<RegistryBucket> = {}): RegistryBucket {
  return {
    id: 'b-old',
    provider: 'scaleway_object_storage',
    region: 'fr-par',
    bucket: 'flui-registry-old',
    active: false,
    createdByFlui: true,
    connectedAt: '2026-09-01T08:00:00.000Z',
    ...over,
  };
}
