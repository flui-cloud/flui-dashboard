import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SandboxSignInService } from './sandbox-sign-in.service';
import { AppConfigService } from '../../core/services/app-config.service';

describe('SandboxSignInService visitor stats', () => {
  it('reads the visitors overview', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: 'http://api' } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    let now = -1;
    TestBed.inject(SandboxSignInService)
      .visitorStats()
      .subscribe((s) => (now = s.visitorsNow));
    http.expectOne({ method: 'GET', url: 'http://api/api/v1/sandbox/visitors/stats' }).flush({
      entranceOpen: true,
      visitorsNow: 3,
      poolReady: 1,
      poolMin: 2,
      upgraded: 0,
      merged: 0,
      last24h: { created: 0, refused: 0, refusedByReason: [] },
    });
    expect(now).toBe(3);
    http.verify();
  });
});
