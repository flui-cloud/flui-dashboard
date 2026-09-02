import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApplicationsService } from '../../core/api/api/applications.service';
import { AppConfigService } from '../../core/services/app-config.service';
import { ApplicationSnapshotsService } from './application-snapshots.service';

describe('ApplicationSnapshotsService', () => {
  let service: ApplicationSnapshotsService;
  let applicationsApi: {
    applicationSnapshotsControllerListSnapshotsForApp: jasmine.Spy;
  };

  beforeEach(() => {
    applicationsApi = {
      applicationSnapshotsControllerListSnapshotsForApp: jasmine.createSpy(),
    };
    TestBed.configureTestingModule({
      providers: [
        ApplicationSnapshotsService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: ApplicationsService, useValue: applicationsApi },
        { provide: AppConfigService, useValue: { apiBaseUrl: '' } },
      ],
    });
    service = TestBed.inject(ApplicationSnapshotsService);
  });

  afterEach(() => service.reset());

  it('exposes the unavailable reason without inventing an empty snapshot state', async () => {
    applicationsApi.applicationSnapshotsControllerListSnapshotsForApp.and.returnValue(
      of({
        supported: false,
        reason:
          "Snapshots are not available because this cluster's storage class does not use a CSI driver.",
        items: [],
      }),
    );

    await service.loadForApp('app-1');

    expect(service.capability()).toEqual({
      supported: false,
      reason:
        "Snapshots are not available because this cluster's storage class does not use a CSI driver.",
    });
    expect(service.error()).toBeNull();
    expect(service.snapshots()).toEqual([]);
  });
});
