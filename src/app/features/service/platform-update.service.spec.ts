import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  PlatformUpdateService,
  WITHOUT_BACKUP_ACKNOWLEDGEMENT,
} from './platform-update.service';

describe('PlatformUpdateService — planned updates', () => {
  let service: PlatformUpdateService;
  let http: HttpTestingController;
  const base = 'http://api/api/v1/platform/updates';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PlatformUpdateService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: 'http://api' } },
      ],
    });
    service = TestBed.inject(PlatformUpdateService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.stopPolling();
    http.verify();
  });

  it('asks the API for the plan of the release on offer', async () => {
    const pending = service.plan('0.20.0');
    const req = http.expectOne(`${base}/plan`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ targetVersion: '0.20.0' });
    req.flush({ planId: 'p1', phases: [], blockers: [] });
    await pending;
    expect(service.plan$()?.planId).toBe('p1');
  });

  it('sends the plan id when starting, and the acknowledgement only when the backup is skipped', async () => {
    const first = service.start('0.20.0', { planId: 'p1' });
    const withBackup = http.expectOne(base);
    expect(withBackup.request.body).toEqual({
      targetVersion: '0.20.0',
      planId: 'p1',
    });
    withBackup.flush({ id: 'op1', status: 'PENDING', components: [] });
    await first;
    service.stopPolling();

    const second = service.start('0.20.0', {
      planId: 'p1',
      withoutBackup: true,
    });
    const without = http.expectOne(base);
    expect(without.request.body).toEqual({
      targetVersion: '0.20.0',
      planId: 'p1',
      withoutBackup: true,
      acknowledgement: WITHOUT_BACKUP_ACKNOWLEDGEMENT,
    });
    without.flush({ id: 'op1', status: 'PENDING', components: [] });
    await second;
  });

  it('still starts an image-only update with the release alone', async () => {
    const pending = service.start('0.20.0');
    const req = http.expectOne(base);
    expect(req.request.body).toEqual({ targetVersion: '0.20.0' });
    req.flush({ id: 'op1', status: 'PENDING', components: [] });
    await pending;
  });

  it('resumes a stopped update by its id', async () => {
    const pending = service.resume('op-9');
    const req = http.expectOne(`${base}/op-9/resume`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'op-9', status: 'IN_PROGRESS', components: [] });
    await pending;
    expect(service.operation()?.id).toBe('op-9');
  });
});
