import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AppConfigService } from '../../core/services/app-config.service';
import { REGISTRY_REFUSED_MESSAGE, RegistryStorageService } from './registry-storage.service';

describe('RegistryStorageService', () => {
  let service: RegistryStorageService;
  let http: HttpTestingController;
  const base = 'http://api/api/v1/registry/storage';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RegistryStorageService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: 'http://api' } },
      ],
    });
    service = TestBed.inject(RegistryStorageService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the status, and asks for a fresh measurement only when told to', async () => {
    const first = service.load();
    http.expectOne(base).flush({ backend: 'filesystem', connected: false });
    await first;
    expect(service.status()?.backend).toBe('filesystem');

    const second = service.load(true);
    expect(service.measuring()).toBe(true);
    http.expectOne(`${base}?measure=true`).flush({ backend: 'filesystem', connected: false });
    await second;
    expect(service.measuring()).toBe(false);
  });

  it('treats a 403 as a refusal, not as a failure', async () => {
    const pending = service.load();
    http.expectOne(base).flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await pending;
    expect(service.refused()).toBe(true);
    expect(service.refusalMessage()).toBe(REGISTRY_REFUSED_MESSAGE);
    expect(service.loadError()).toBeNull();
  });

  it('creates the Scaleway bucket in the chosen region', async () => {
    const pending = service.connectScaleway('nl-ams');
    expect(service.connecting()).toBe('scaleway');
    const req = http.expectOne(`${base}/scaleway`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ region: 'nl-ams' });
    req.flush({ backend: 'filesystem', connected: true, provider: 'scaleway_object_storage', bucket: 'b' });
    expect(await pending).toBe(true);
    expect(service.connecting()).toBeNull();
    expect(service.status()?.connected).toBe(true);
  });

  it('keeps the last measurement when the connect answer carries none', async () => {
    const load = service.load();
    const usage = { measuredAt: 'x', totalBytes: 5, alertBytes: null, capacityBytes: 10, alerting: false, applications: [], unreadable: 0 };
    http.expectOne(base).flush({ backend: 'filesystem', connected: false, usage });
    await load;

    const pending = service.connectOwn({
      provider: 'ovh_object_storage',
      endpoint: 'https://s3.gra.io.cloud.ovh.net',
      region: 'gra',
      bucket: 'images',
      accessKey: 'AK',
      secretKey: 'SK',
    });
    http.expectOne(base).flush({ backend: 'filesystem', connected: true, bucket: 'images' });
    await pending;
    expect(service.status()?.usage).toEqual(usage);
    expect(service.status()?.bucket).toBe('images');
  });

  it('surfaces the API message of a refused connection, joining validation lists', async () => {
    const pending = service.connectOwn({
      provider: 'minio',
      endpoint: 'http://minio:9000',
      region: 'us-east-1',
      bucket: 'images',
      accessKey: 'AK',
      secretKey: 'SK',
    });
    http.expectOne(base).flush(
      { message: ['bucket must match', 'endpoint must be a URL'] },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(await pending).toBe(false);
    expect(service.connectError()).toBe('bucket must match. endpoint must be a URL');
    expect(service.refused()).toBe(false);
  });

  it('lists the buckets and removes one, with the answer the API gives', async () => {
    const list = service.loadBuckets();
    http.expectOne(`${base}/buckets`).flush([
      { id: 'b1', provider: 'scaleway_object_storage', region: 'fr-par', bucket: 'new', active: true, createdByFlui: true, connectedAt: 'x' },
      { id: 'b2', provider: 'minio', region: 'us-east-1', bucket: 'old', active: false, createdByFlui: false, connectedAt: 'y' },
    ]);
    await list;
    expect(service.buckets()).toHaveSize(2);

    const removal = service.removeBucket('b2');
    expect(service.removing()).toBe('b2');
    const req = http.expectOne(`${base}/buckets/b2`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ bucket: 'old', bucketDeleted: false });
    expect(await removal).toEqual({ bucket: 'old', bucketDeleted: false });
    expect(service.removing()).toBeNull();
    expect(service.buckets().map((b) => b.id)).toEqual(['b1']);
  });

  it('shows the conflict message when the bucket is the one in use', async () => {
    const removal = service.removeBucket('b1');
    http.expectOne(`${base}/buckets/b1`).flush(
      { message: 'The registry keeps its images in this bucket: connect another one first' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(await removal).toBeNull();
    expect(service.removeError()).toBe('The registry keeps its images in this bucket: connect another one first');
    expect(service.refused()).toBe(false);
  });

  it('reads the traffic for the chosen window, 24h by default', async () => {
    const first = service.loadTraffic();
    const req = http.expectOne('http://api/api/v1/registry/traffic?window=24h');
    req.flush({ window: '24h', requests: { pulls: 1, pushes: 0, deletes: 0 }, outcomes: { ok: 1, refused: 0, notFound: 0, failed: 0 }, bytesIn: 0, bytesOut: 10, peakBytesPerSecondIn: 0, peakBytesPerSecondOut: 1, readFromBucketBytes: null });
    await first;
    expect(service.traffic()?.requests.pulls).toBe(1);

    const second = service.loadTraffic('7d');
    expect(service.trafficWindow()).toBe('7d');
    http.expectOne('http://api/api/v1/registry/traffic?window=7d').flush({ ...service.traffic(), window: '7d' });
    await second;
    expect(service.trafficLoading()).toBe(false);
  });

  it('hides the traffic on a 403 without refusing the page', async () => {
    const pending = service.loadTraffic();
    http.expectOne('http://api/api/v1/registry/traffic?window=24h').flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await pending;
    expect(service.trafficHidden()).toBe(true);
    expect(service.refused()).toBe(false);
    expect(service.traffic()).toBeNull();
  });

  it('marks a failed traffic read without hiding the card', async () => {
    const pending = service.loadTraffic();
    http.expectOne('http://api/api/v1/registry/traffic?window=24h').flush({}, { status: 500, statusText: 'Error' });
    await pending;
    expect(service.trafficFailed()).toBe(true);
    expect(service.trafficHidden()).toBe(false);
  });
});
