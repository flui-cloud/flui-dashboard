import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AppConfigService } from '../../core/services/app-config.service';
import { NotificationService } from '../../core/services/notification.service';
import { IamService } from './iam.service';
import { RoleDef } from '../model/iam.model';

const ROLES: RoleDef[] = [
  {
    key: 'viewer',
    name: 'Viewer',
    description: '',
    permissions: [],
    assignable: true,
    grantable: true,
    revocable: true,
  },
  {
    key: 'maintainer',
    name: 'Maintainer',
    description: '',
    permissions: [],
    assignable: true,
    grantable: true,
    revocable: true,
  },
  {
    key: 'owner',
    name: 'Owner',
    description: '',
    permissions: [],
    assignable: true,
    grantable: false,
    revocable: false,
  },
  {
    key: 'sandbox' as RoleDef['key'],
    name: 'Sandbox guest',
    description: '',
    permissions: [],
    assignable: false,
    grantable: false,
    revocable: true,
  },
];

describe('IamService role pickers', () => {
  let iam: IamService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        IamService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: '' } },
        { provide: NotificationService, useValue: { add: () => undefined } },
      ],
    });
    iam = TestBed.inject(IamService);
    http = TestBed.inject(HttpTestingController);
  });

  it('starts with nothing rather than a hand-written copy of the catalog', () => {
    expect(iam.roles()).toHaveSize(0);
    expect(iam.grantableRoles()).toHaveSize(0);
  });

  it('offers only what this person may confer, and keeps the bins that work', () => {
    iam.roles.set(ROLES);
    expect(iam.grantableRoles().map((r) => r.key)).toEqual([
      'viewer',
      'maintainer',
    ]);
    expect(iam.isGrantable('owner')).toBeFalse();
    expect(iam.isRevocable('sandbox')).toBeTrue();
    expect(iam.isRevocable('owner')).toBeFalse();
  });

  it('leaves a control alone when the catalog does not describe its role', () => {
    iam.roles.set(ROLES);
    expect(iam.isRevocable('some-future-role')).toBeTrue();
    expect(iam.isGrantable('some-future-role')).toBeFalse();
  });

  afterEach(() => {
    http.match(() => true).forEach((r) => r.flush([]));
  });
});
