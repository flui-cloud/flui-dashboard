import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InferenceSettingsService } from './inference-settings.service';
import { InferenceService } from '../../core/api/api/inference.service';
import { AssistantService } from '../../core/api/api/assistant.service';
import { AppConfigService } from '../../core/services/app-config.service';

describe('InferenceSettingsService usage', () => {
  it('asks for the usage of the last N days', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: InferenceService, useValue: {} },
        { provide: AssistantService, useValue: {} },
        { provide: AppConfigService, useValue: { apiBaseUrl: 'http://api' } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    let kinds = 0;
    TestBed.inject(InferenceSettingsService)
      .usage(7)
      .subscribe((u) => (kinds = u.byKind.length));
    const req = http.expectOne((r) => r.url === 'http://api/api/v1/inference/usage');
    expect(req.request.params.get('days')).toBe('7');
    req.flush({ since: null, byKind: [{ kind: 'visitor', people: 1, calls: 1, tokens: 10 }] });
    expect(kinds).toBe(1);
    http.verify();
  });
});
