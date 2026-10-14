import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { SandboxService } from './sandbox.service';
import { AppConfigService } from './app-config.service';

describe('SandboxService and the guest area', () => {
  let http: HttpTestingController;
  let service: SandboxService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: 'http://api' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(SandboxService);
  });

  const answer = (body: object | null, status = 200) => {
    service.refresh();
    const req = http.expectOne('http://api/api/v1/sandbox/session');
    if (status === 200) req.flush(body);
    else req.flush({}, { status, statusText: 'Not Found' });
    http.match(() => true).forEach((r) => r.flush({ areas: [] }));
  };

  it('treats a guest who has only looked around as a guest with no deadline', () => {
    answer({
      hasArea: false,
      expiresAt: null,
      secondsRemaining: 0,
      ttlHours: 168,
      workloadTtlHours: 24,
      loginUrl: 'https://demo.flui.cloud',
    });

    expect(service.inSandbox()).toBeTrue();
    expect(service.hasArea()).toBeFalse();
    expect(service.expired()).toBeFalse();
    expect(service.urgent()).toBeFalse();
  });

  it('knows a visitor who has not signed in, and a guest who has', () => {
    answer({
      hasArea: false,
      visitor: true,
      expiresAt: null,
      secondsRemaining: 0,
      ttlHours: 168,
      loginUrl: 'https://demo.flui.cloud',
    });
    expect(service.visitor()).toBeTrue();

    answer({
      hasArea: false,
      expiresAt: null,
      secondsRemaining: 0,
      ttlHours: 168,
      loginUrl: 'https://demo.flui.cloud',
    });
    expect(service.visitor()).toBeFalse();
  });

  it('asks a visitor to sign in for a write not marked for visitors', () => {
    service.refresh();
    http.expectOne('http://api/api/v1/sandbox/session').flush({
      hasArea: false,
      visitor: true,
      expiresAt: null,
      secondsRemaining: 0,
      ttlHours: 168,
      loginUrl: 'https://demo.flui.cloud',
    });

    http.expectOne('http://api/api/v1/sandbox/limits').flush({
      areas: [],
      allowed: [
        { routes: ['GET /catalog/**', 'POST /catalog/install'], visitor: false },
        { routes: ['POST /catalog/validate'], visitor: true },
      ],
    });

    expect(service.needsSignIn('GET', '/catalog/apps')).toBeFalse();
    expect(service.needsSignIn('POST', '/catalog/validate')).toBeFalse();
    expect(service.needsSignIn('POST', '/catalog/install')).toBeTrue();
  });

  it('counts down for a guest who holds an area', () => {
    answer({
      hasArea: true,
      expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
      secondsRemaining: 1800,
      ttlHours: 168,
      loginUrl: 'https://demo.flui.cloud',
    });

    expect(service.hasArea()).toBeTrue();
    expect(service.urgent()).toBeTrue();
    expect(service.expired()).toBeFalse();
  });

  it('is not a guest when the instance says so', () => {
    answer(null, 404);

    expect(service.inSandbox()).toBeFalse();
  });
});
