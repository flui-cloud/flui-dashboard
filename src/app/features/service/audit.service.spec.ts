import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AppConfigService } from '../../core/services/app-config.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let audit: AuditService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuditService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: 'http://api' } },
      ],
    });
    audit = TestBed.inject(AuditService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('queries the audit record with the filters as parameters', () => {
    let rows: unknown[] = [];
    audit
      .list({ email: 'bob@acme.com', refusedOnly: true, limit: 20 })
      .subscribe((r) => (rows = r));
    const req = http.expectOne(
      (r) => r.url === 'http://api/api/v1/audit/events',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('email')).toBe('bob@acme.com');
    expect(req.request.params.get('outcome')).toBe('refused');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.has('dataAccess')).toBeFalse();
    req.flush([
      {
        id: 'e1',
        at: '2026-09-28T10:00:00.000Z',
        userId: 'u1',
        email: 'bob@acme.com',
        actorKind: 'user',
        actorKeyId: null,
        action: 'GET /applications/:id/env',
        target: { id: 'a1' },
        status: 403,
        outcome: 'refused',
        permission: 'data:access',
        dataAccess: true,
      },
    ]);
    expect(rows).toHaveSize(1);
  });
});
