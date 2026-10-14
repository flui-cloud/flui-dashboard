import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { IamService } from './iam.service';
import { AppConfigService } from '../../core/services/app-config.service';
import { NotificationService } from '../../core/services/notification.service';
import { MaskModeService } from '../../core/services/mask-mode.service';

const USERS = 'http://api/api/v1/auth/users';

describe('IamService listing people by kind', () => {
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
  });

  afterEach(() => http.verify());

  it('asks for everyone when no kind is chosen', () => {
    service.loadUsers();
    const req = http.expectOne((r) => r.url === USERS);
    expect(req.request.params.has('kind')).toBeFalse();
    req.flush([{ id: 'v1', email: 'v@x.io', role: 'user', kind: 'visitor' }]);
    expect(service.users()[0].kind).toBe('visitor');
  });

  it('passes the chosen kind to the API', () => {
    service.userKind.set('visitor');
    service.loadUsers();
    const req = http.expectOne((r) => r.url === USERS);
    expect(req.request.params.get('kind')).toBe('visitor');
    req.flush([]);
  });
});
