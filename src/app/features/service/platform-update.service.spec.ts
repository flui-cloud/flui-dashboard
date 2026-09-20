import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  PlatformUpdateOperation,
  PlatformUpdateService,
  PlatformUpdateStatus,
} from './platform-update.service';

const STATUS: PlatformUpdateStatus = {
  installedVersion: '0.13.0-rc.1',
  availableVersion: '0.14.0',
  updateAvailable: true,
  applicable: true,
  requiredCliVersion: '0.14.0',
  publishedAt: '2026-09-02T09:00:00.000Z',
  notes: [],
  migrations: 2,
  components: [
    {
      key: 'fluiApi',
      name: 'Flui API',
      role: 'Control plane API',
      deploymentName: 'flui-api',
      installed: true,
      observed: true,
      installedVersion: '0.13.0-rc.1',
      installedIsRelease: true,
      targetVersion: '0.14.0',
      changed: true,
      restartsControlPlane: true,
    },
  ],
  advisories: [],
  checkedAt: new Date().toISOString(),
  checkError: null,
};

const OPERATION: PlatformUpdateOperation = {
  id: 'op-1',
  status: 'IN_PROGRESS',
  fromVersion: '0.13.0-rc.1',
  targetVersion: '0.14.0',
  components: [
    {
      key: 'fluiApi',
      name: 'Flui API',
      fromVersion: '0.13.0-rc.1',
      targetVersion: '0.14.0',
      status: 'running',
    },
  ],
  migrations: 2,
  progress: 60,
  currentStep: 'platform_update_control_plane',
  awaitingSelfRestart: true,
  startedAt: new Date().toISOString(),
  completedAt: null,
  errorMessage: null,
  userId: 'u-1',
};

describe('PlatformUpdateService', () => {
  let service: PlatformUpdateService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PlatformUpdateService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: '' } },
      ],
    });
    service = TestBed.inject(PlatformUpdateService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.stopPolling();
    http.verify();
  });

  it('reads the status and the running operation together', async () => {
    const done = service.refresh();
    http.expectOne('/api/v1/platform/updates').flush(STATUS);
    http.expectOne('/api/v1/platform/updates/current').flush(OPERATION);
    await done;

    expect(service.updateAvailable()).toBe(true);
    expect(service.availableVersion()).toBe('0.14.0');
    expect(service.running()).toBe(true);
    expect(service.controlPlaneRestarting()).toBe(true);
  });

  it('treats an unreachable API as the middle of an update, not as an error', async () => {
    const done = service.loadCurrent();
    http
      .expectOne('/api/v1/platform/updates/current')
      .error(new ProgressEvent('error'), { status: 0, statusText: '' });
    await done;

    expect(service.apiUnreachable()).toBe(true);
    expect(service.error()).toBeNull();
  });

  it('surfaces a refusal to start rather than pretending the update began', async () => {
    const started = service.start('0.14.0');
    http.expectOne('/api/v1/platform/updates').flush(
      { message: 'This release changes the bootstrap manifests.' },
      { status: 400, statusText: 'Bad Request' },
    );

    await expectAsync(started).toBeRejected();
    expect(service.operation()).toBeNull();
    expect(service.error()).toContain('bootstrap manifests');
  });

  it('reports no update available before anything has been read', () => {
    expect(service.updateAvailable()).toBe(false);
    expect(service.running()).toBe(false);
  });

  it(
    'keeps polling if the status read fails right as the operation finishes',
    fakeAsync(() => {
      // The instant an update's last component completes is also the instant
      // flui-api may still be mid-restart: the /current call can succeed (the
      // new pod is up enough to say "nothing running") while the very next
      // request lands in the gap and fails. That must not be the last attempt.
      service.startPolling();
      const runTick = () =>
        void (service as unknown as { tick(): Promise<void> }).tick();
      const pollTimer = () => (service as unknown as { pollTimer: unknown }).pollTimer;

      runTick();
      flushMicrotasks();
      http.expectOne('/api/v1/platform/updates/current').flush(null);
      flushMicrotasks();
      http
        .expectOne('/api/v1/platform/updates')
        .error(new ProgressEvent('error'), { status: 0, statusText: '' });
      http.expectOne('/api/v1/platform/updates/history?limit=20').flush([]);
      flushMicrotasks();

      expect(pollTimer()).not.toBeNull();
      expect(service.apiUnreachable()).toBe(true);

      runTick();
      flushMicrotasks();
      http.expectOne('/api/v1/platform/updates/current').flush(null);
      flushMicrotasks();
      http
        .expectOne('/api/v1/platform/updates')
        .flush({ ...STATUS, updateAvailable: false, availableVersion: null });
      http.expectOne('/api/v1/platform/updates/history?limit=20').flush([]);
      flushMicrotasks();

      expect(pollTimer()).toBeNull();
      expect(service.apiUnreachable()).toBe(false);
      expect(service.updateAvailable()).toBe(false);
    }),
  );
});
