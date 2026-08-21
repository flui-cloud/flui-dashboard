import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AppConfigService } from './app-config.service';
import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  let perms: PermissionService;
  let http: HttpTestingController;
  const config = { apiBaseUrl: '' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PermissionService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: config },
      ],
    });
    perms = TestBed.inject(PermissionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const load = (body: {
    permissions?: string[];
    sections?: string[];
    readOnlySections?: string[];
    isAdmin: boolean;
  }) => {
    perms.load();
    http.expectOne('/api/v1/me/permissions').flush({
      permissions: body.permissions ?? [],
      isAdmin: body.isAdmin,
    });
    http.expectOne('/api/v1/me/sections').flush({
      sections: body.sections ?? [],
      readOnlySections: body.readOnlySections ?? [],
      isAdmin: body.isAdmin,
    });
  };

  it('opens the sections the API named, for an owner who carries no flag', () => {
    load({
      isAdmin: false,
      permissions: ['iam:assign-role', 'iam:manage-users', 'cluster:manage'],
      sections: ['home', 'settings', 'access', 'infrastructure'],
    });
    expect(perms.hasSection('access')).toBeTrue();
    expect(perms.hasSection('infrastructure')).toBeTrue();
    expect(perms.can('iam:manage-users')).toBeTrue();
  });

  it('does not open a section the API left out, flag or no flag', () => {
    load({ isAdmin: true, sections: ['home', 'settings'] });
    expect(perms.hasSection('home')).toBeTrue();
    expect(perms.hasSection('access')).toBeFalse();
  });

  it('reports a read-only section as read-only, whoever holds it', () => {
    load({
      isAdmin: false,
      sections: ['home', 'settings', 'backup'],
      readOnlySections: ['backup'],
    });
    expect(perms.isSectionReadOnly('backup')).toBeTrue();
    expect(perms.isSectionReadOnly('home')).toBeFalse();
  });

  it('still carries the legacy platform-admin flag', () => {
    load({ isAdmin: true, sections: ['home'] });
    expect(perms.isAdmin()).toBeTrue();
  });
});
