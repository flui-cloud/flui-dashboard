import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  RegistryBucket,
  RegistryModeStatus,
  RegistryStorageStatus,
  RegistryTraffic,
  RegistryTrafficWindow,
} from '../../model/registry-storage.models';
import { ToastService } from '../../../shared/services/toast.service';
import {
  RegistryConnecting,
  RegistryStorageService,
  RegistrySwitching,
} from '../../service/registry-storage.service';
import { RegistryStorageComponent } from './registry-storage.component';

const GIB = 1024 ** 3;

function status(over: Partial<RegistryStorageStatus> = {}): RegistryStorageStatus {
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

class FakeRegistry {
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

function mode(over: Partial<RegistryModeStatus> = {}): RegistryModeStatus {
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

function traffic(over: Partial<RegistryTraffic> = {}): RegistryTraffic {
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

function bucket(over: Partial<RegistryBucket> = {}): RegistryBucket {
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

describe('image registry page', () => {
  let fixture: ComponentFixture<RegistryStorageComponent>;
  let registry: FakeRegistry;
  let surface: jasmine.SpyObj<CurrentSurfaceService>;
  let toast: jasmine.SpyObj<ToastService>;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (testid: string): HTMLElement | null => el().querySelector(`[data-testid="${testid}"]`);
  const render = async (value: RegistryStorageStatus | null): Promise<void> => {
    registry.status.set(value);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    registry = new FakeRegistry();
    surface = jasmine.createSpyObj<CurrentSurfaceService>('CurrentSurfaceService', ['set']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['showSuccess']);
    await TestBed.configureTestingModule({
      imports: [RegistryStorageComponent],
      providers: [
        { provide: RegistryStorageService, useValue: registry },
        { provide: CurrentSurfaceService, useValue: surface },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RegistryStorageComponent);
  });

  it('loads the status on open and publishes its surface', async () => {
    await render(status());
    expect(registry.load).toHaveBeenCalledWith();
    expect(surface.set).toHaveBeenCalled();
    expect(surface.set.calls.mostRecent().args[0]!.surface.route).toBe('management/registry');
  });

  it('shows where images are kept, the space in use against the volume, and the largest applications', async () => {
    await render(status());
    expect(q('registry-location')!.textContent).toContain('A volume on the control cluster');
    expect(q('registry-used')!.textContent).toContain('6.0 GiB');
    expect(q('registry-limit')!.textContent).toContain('of 20.0 GiB volume');
    expect((q('registry-bar') as HTMLElement).style.width).toBe('30%');
    expect(q('registry-alerting')).toBeNull();
    expect(q('registry-apps')!.textContent).toContain('shop-api');
    expect(q('registry-apps')!.textContent).toContain('512 MiB');
  });

  it('highlights the alert and measures again on request', async () => {
    await render(status({ usage: { ...status().usage!, alerting: true } }));
    expect(q('registry-alerting')).not.toBeNull();
    q('registry-measure')!.click();
    expect(registry.load).toHaveBeenCalledWith(true);
  });

  it('measures a bucket against its alert threshold', async () => {
    await render(
      status({
        backend: 's3',
        connected: true,
        provider: 'ovh_object_storage',
        region: 'gra',
        bucket: 'images',
        usage: { ...status().usage!, capacityBytes: null, alertBytes: 12 * GIB },
      }),
    );
    expect(q('registry-location')!.textContent).toContain('Bucket images on OVH');
    expect(q('registry-limit')!.textContent).toContain('alert at 12.0 GiB');
    expect((q('registry-bar') as HTMLElement).style.width).toBe('50%');
    expect(q('registry-not-in-use')).toBeNull();
  });

  it('says nothing is kept here when images live on GitHub', async () => {
    await render(status({ usage: undefined }));
    expect(q('registry-ghcr')).not.toBeNull();
    expect(q('registry-usage')).toBeNull();
    expect(q('registry-bucket')).toBeNull();
  });

  describe('switching to the Flui registry', () => {
    it('offers the Flui registry on a volume when builds go to GitHub', async () => {
      registry.mode.set(mode());
      await render(status({ usage: undefined, mode: 'ghcr' }));
      expect(q('registry-enable')).not.toBeNull();
      expect(q('registry-ghcr')).toBeNull();
      expect(q('registry-bucket')).toBeNull();
      q('registry-enable-submit')!.click();
      expect(registry.enable).toHaveBeenCalledWith('volume');
      await fixture.whenStable();
      expect(toast.showSuccess).toHaveBeenCalled();
    });

    it('asks for a bucket before using one, and shows where to connect it', async () => {
      registry.mode.set(mode());
      await render(status({ usage: undefined, mode: 'ghcr' }));
      q('registry-enable-s3')!.click();
      fixture.detectChanges();
      expect(q('registry-enable-needs-bucket')).not.toBeNull();
      expect(q('registry-bucket')).not.toBeNull();
      expect(q('registry-not-in-use')).toBeNull();
      expect((q('registry-enable-submit') as HTMLButtonElement).disabled).toBeTrue();
    });

    it('uses the connected bucket', async () => {
      registry.mode.set(mode({ bucketConnected: true }));
      await render(status({ usage: undefined, mode: 'ghcr', connected: true, bucket: 'b' }));
      q('registry-enable-s3')!.click();
      fixture.detectChanges();
      expect(q('registry-enable-needs-bucket')).toBeNull();
      q('registry-enable-submit')!.click();
      expect(registry.enable).toHaveBeenCalledWith('s3');
    });

    it('shows why the switch was refused', async () => {
      registry.mode.set(mode());
      registry.switchError.set('No bucket is connected for the registry.');
      await render(status({ usage: undefined, mode: 'ghcr' }));
      expect(q('registry-switch-error')!.textContent).toContain('No bucket is connected');
    });

    it('shows progress until the registry is ready', async () => {
      registry.mode.set(mode({ mode: 'flui', storage: 'volume', ready: false }));
      await render(status({ mode: 'flui' }));
      expect(q('registry-starting')).not.toBeNull();
      expect(q('registry-enable')).toBeNull();

      registry.mode.set(mode({ mode: 'flui', storage: 'volume', ready: true }));
      fixture.detectChanges();
      expect(q('registry-starting')).toBeNull();
    });

    it('says so when the registry is still not ready, and checks again on request', async () => {
      registry.mode.set(mode({ mode: 'flui', storage: 'volume', ready: false }));
      registry.stillNotReady.set(true);
      await render(status({ mode: 'flui' }));
      expect(q('registry-starting')).toBeNull();
      expect(q('registry-not-ready')!.textContent).toContain('still not ready');

      q('registry-check-ready')!.click();
      expect(registry.checkReadyAgain).toHaveBeenCalled();
    });

    it('offers to go back to GitHub only while no application uses the registry', async () => {
      registry.mode.set(mode({ mode: 'flui', storage: 'volume', ready: true, applicationsOnRegistry: 2 }));
      await render(status({ mode: 'flui' }));
      expect(q('registry-disable')).toBeNull();

      registry.mode.set(mode({ mode: 'flui', storage: 'volume', ready: true }));
      fixture.detectChanges();
      q('registry-disable')!.click();
      fixture.detectChanges();
      q('registry-disable-submit')!.click();
      expect(registry.disable).toHaveBeenCalled();
    });
  });

  it('draws a refusal calmly, without the error box', async () => {
    registry.refused.set(true);
    registry.refusalMessage.set('Managing the image registry needs the permission to manage integrations.');
    await render(null);
    expect(q('registry-refused')!.textContent).toContain('permission to manage integrations');
    expect(q('registry-error')).toBeNull();
  });

  it('notes a connected bucket that is not in use yet', async () => {
    await render(status({ connected: true, provider: 'scaleway_object_storage', region: 'fr-par', bucket: 'b1' }));
    expect(q('registry-connected')!.textContent).toContain('Scaleway');
    expect(q('registry-not-in-use')).not.toBeNull();
    expect(q('registry-connect')).toBeNull();
  });

  it('creates a Scaleway bucket straight away when none is connected', async () => {
    await render(status());
    q('registry-scaleway-submit')!.click();
    await fixture.whenStable();
    expect(registry.connectScaleway).toHaveBeenCalledWith('fr-par');
    expect(q('registry-confirm')).toBeNull();
  });

  it('asks before replacing a connected bucket', async () => {
    await render(status({ connected: true, provider: 'scaleway_object_storage', region: 'fr-par', bucket: 'b1' }));
    q('registry-replace')!.click();
    fixture.detectChanges();
    q('registry-scaleway-submit')!.click();
    fixture.detectChanges();
    expect(registry.connectScaleway).not.toHaveBeenCalled();
    expect(q('registry-confirm')).not.toBeNull();
    expect(q('registry-confirm-images')!.textContent).toContain('not copied to the new bucket');

    q('registry-confirm-submit')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(registry.connectScaleway).toHaveBeenCalledWith('fr-par');
  });

  it('shows the busy state while Scaleway creates the bucket', async () => {
    registry.connecting.set('scaleway');
    await render(status());
    expect(q('registry-scaleway-busy')).not.toBeNull();
    expect((q('registry-scaleway-submit') as HTMLButtonElement).disabled).toBe(true);
  });

  it('connects a bucket of your own and clears the secret key after submitting', async () => {
    registry.connectOwn.and.resolveTo(false);
    await render(status());
    q('registry-option-own')!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const form = q('registry-own-form') as HTMLFormElement;
    const set = (name: string, value: string) => {
      const input = form.querySelector(`[name="${name}"]`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    set('endpoint', 'https://s3.gra.io.cloud.ovh.net');
    set('region', 'gra');
    set('bucket', 'flui-images');
    set('accessKey', 'AK');
    set('secretKey', 'SK');
    fixture.detectChanges();
    await fixture.whenStable();

    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(registry.connectOwn).toHaveBeenCalledWith({
      provider: 'ovh_object_storage',
      endpoint: 'https://s3.gra.io.cloud.ovh.net',
      region: 'gra',
      bucket: 'flui-images',
      accessKey: 'AK',
      secretKey: 'SK',
    });
    expect((q('registry-secret') as HTMLInputElement).value).toBe('');
    expect((form.querySelector('[name="bucket"]') as HTMLInputElement).value).toBe('flui-images');
  });

  it('loads the buckets on open and lists only the replaced ones', async () => {
    registry.buckets.set([
      bucket({ id: 'b-new', bucket: 'flui-registry-new', active: true }),
      bucket(),
      bucket({ id: 'b-own', bucket: 'my-images', provider: 'ovh_object_storage', region: 'gra', createdByFlui: false }),
    ]);
    await render(status({ connected: true, provider: 'scaleway_object_storage', region: 'fr-par', bucket: 'flui-registry-new' }));
    expect(registry.loadBuckets).toHaveBeenCalled();
    const list = q('registry-replaced')!;
    expect(list.querySelectorAll('li')).toHaveSize(2);
    expect(list.textContent).toContain('created by Flui');
    expect(list.textContent).toContain('your own');
    expect(list.textContent).not.toContain('flui-registry-new');
  });

  it('hides the replaced list when every bucket is in use', async () => {
    registry.buckets.set([bucket({ active: true })]);
    await render(status({ connected: true, bucket: 'flui-registry-old' }));
    expect(q('registry-replaced')).toBeNull();
  });

  it('asks before deleting a bucket Flui created, then says it was deleted and reloads', async () => {
    registry.buckets.set([bucket()]);
    registry.removeBucket.and.resolveTo({ bucket: 'flui-registry-old', bucketDeleted: true });
    await render(status({ connected: true, bucket: 'flui-registry-new' }));
    q('registry-remove-b-old')!.click();
    fixture.detectChanges();
    expect(q('registry-remove-message')!.textContent).toContain(
      'Delete flui-registry-old with every image in it, and the project and key Flui made for it?',
    );
    expect(registry.removeBucket).not.toHaveBeenCalled();

    registry.loadBuckets.calls.reset();
    q('registry-remove-submit')!.click();
    await fixture.whenStable();
    expect(registry.removeBucket).toHaveBeenCalledWith('b-old');
    expect(toast.showSuccess).toHaveBeenCalledWith('Deleted flui-registry-old');
    expect(registry.loadBuckets).toHaveBeenCalled();
  });

  it('forgets a bucket of your own and says so', async () => {
    registry.buckets.set([bucket({ id: 'b-own', bucket: 'my-images', createdByFlui: false })]);
    registry.removeBucket.and.resolveTo({ bucket: 'my-images', bucketDeleted: false });
    await render(status({ connected: true, bucket: 'flui-registry-new' }));
    q('registry-remove-b-own')!.click();
    fixture.detectChanges();
    expect(q('registry-remove-message')!.textContent).toContain('Forget my-images? What it holds stays in your account.');
    q('registry-remove-submit')!.click();
    await fixture.whenStable();
    expect(toast.showSuccess).toHaveBeenCalledWith('Forgot my-images');
  });

  it('shows the API message when a removal is refused', async () => {
    registry.buckets.set([bucket()]);
    registry.removeError.set('The registry keeps its images in this bucket: connect another one first');
    await render(status({ connected: true, bucket: 'flui-registry-new' }));
    expect(q('registry-remove-error')!.textContent).toContain('connect another one first');
  });

  it('shows the traffic card with its figures, peak and outcomes', async () => {
    registry.traffic.set(traffic());
    await render(status());
    expect(registry.loadTraffic).toHaveBeenCalledWith();
    expect(q('registry-traffic-pulls')!.textContent).toContain('120');
    expect(q('registry-traffic-pushes')!.textContent).toContain('8');
    expect(q('registry-traffic-out')!.textContent).toContain('9.0 GiB');
    expect(q('registry-traffic-in')!.textContent).toContain('2.0 GiB');
    expect(q('registry-traffic-peak')!.textContent).toContain('100 Mbit/s out · 8.0 Mbit/s in');
    expect(q('registry-traffic-refused')!.classList).not.toContain('text-amber-600');
    expect(q('registry-traffic-failed')!.classList).not.toContain('text-destructive');
    expect(q('registry-traffic-bucket')).toBeNull();
    const cards = Array.from(el().querySelectorAll('section')).map((s) => s.getAttribute('data-testid'));
    expect(cards.indexOf('registry-traffic')).toBe(cards.indexOf('registry-usage') + 1);
    expect(cards.indexOf('registry-apps')).toBe(cards.indexOf('registry-traffic') + 1);
  });

  it('highlights refused and failed requests, and the bucket read when there is one', async () => {
    registry.traffic.set(traffic({ outcomes: { ok: 1, refused: 2, notFound: 0, failed: 1 }, readFromBucketBytes: 3 * GIB }));
    await render(status({ backend: 's3', connected: true, bucket: 'images' }));
    expect(q('registry-traffic-refused')!.classList).toContain('text-amber-600');
    expect(q('registry-traffic-refused')!.getAttribute('title')).toContain('over an application quota');
    expect(q('registry-traffic-failed')!.classList).toContain('text-destructive');
    expect(q('registry-traffic-bucket')!.textContent).toContain('3.0 GiB read from the bucket to serve pulls');
  });

  it('switches the traffic window', async () => {
    registry.traffic.set(traffic());
    await render(status());
    q('registry-traffic-7d')!.click();
    expect(registry.loadTraffic).toHaveBeenCalledWith('7d');
  });

  it('hides the traffic card quietly when it is not readable, and on GitHub images', async () => {
    registry.trafficHidden.set(true);
    await render(status());
    expect(q('registry-traffic')).toBeNull();
    expect(q('registry-refused')).toBeNull();

    registry.trafficHidden.set(false);
    registry.traffic.set(traffic());
    await render(status({ usage: undefined }));
    expect(q('registry-traffic')).toBeNull();
  });
});
