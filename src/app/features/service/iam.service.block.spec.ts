import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { IamService } from './iam.service';
import { AppConfigService } from '../../core/services/app-config.service';
import { NotificationService } from '../../core/services/notification.service';
import { MaskModeService } from '../../core/services/mask-mode.service';
import { UserRecord } from '../model/iam.model';

describe('IamService disabling a person', () => {
  let http: HttpTestingController;
  let service: IamService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: 'http://api' } },
        { provide: NotificationService, useValue: { add: () => undefined } },
        { provide: MaskModeService, useValue: { active: () => false, enabled: () => false } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(IamService);
    (service as unknown as { _users: { set: (u: UserRecord[]) => void } })._users.set([
      {
        id: 'idp-1',
        email: 'mario@example.com',
        displayName: 'Mario',
        role: 'viewer',
        isAdmin: false,
        status: 'active',
      },
    ]);
  });

  it('blocks the person when disabling, and shows them disabled', () => {
    service.setUserStatus('idp-1', 'disabled');
    http.expectOne({ method: 'POST', url: 'http://api/api/v1/auth/users/idp-1/block' }).flush({});
    expect(service.users()[0].status).toBe('disabled');
  });

  it('unblocks the person when enabling', () => {
    service.setUserStatus('idp-1', 'active');
    http.expectOne({ method: 'POST', url: 'http://api/api/v1/auth/users/idp-1/unblock' }).flush({});
    expect(service.users()[0].status).toBe('active');
  });
});
