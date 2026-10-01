import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '../../core/services/app-config.service';
import { VolumeBackupsService } from './volume-backups.service';

describe('VolumeBackupsService', () => {
  let service: VolumeBackupsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        VolumeBackupsService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: '' } },
      ],
    });
    service = TestBed.inject(VolumeBackupsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('browses a directory with the path as a query parameter', async () => {
    const pending = service.browse('app 1', 'b1', 'db/x');
    const req = http.expectOne(
      (r) =>
        r.url === '/api/v1/applications/app%201/volume-backups/b1/files' &&
        r.params.get('path') === 'db/x',
    );
    req.flush({ backupId: 'b1', path: 'db/x', isFile: false, entries: [] });
    expect((await pending).path).toBe('db/x');
  });

  it('browses the root without a path parameter', async () => {
    const pending = service.browse('a', 'b1');
    const req = http.expectOne('/api/v1/applications/a/volume-backups/b1/files');
    expect(req.request.params.has('path')).toBeFalse();
    req.flush({ backupId: 'b1', path: '', isFile: false, entries: [] });
    await pending;
  });

  it('restores selected files into another application', async () => {
    const pending = service.restoreFiles('a', 'b1', {
      paths: ['uploads'],
      targetApplicationId: 'other',
    });
    const req = http.expectOne(
      '/api/v1/applications/a/volume-backups/b1/restore-files',
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      paths: ['uploads'],
      targetApplicationId: 'other',
    });
    req.flush({ operationId: 'op1' });
    expect((await pending).operationId).toBe('op1');
  });

  it('reads the API message of a refusal', () => {
    expect(
      service.errorMessage({ error: { message: 'nope' } }, 'fallback'),
    ).toBe('nope');
    expect(service.errorMessage({}, 'fallback')).toBe('fallback');
  });
});
