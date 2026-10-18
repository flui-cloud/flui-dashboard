import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TopologyDashboardService } from './topology.service';
import { TopologyService as TopologyApiService } from '../../core/api/api/topology.service';
import { AppConfigService } from '../../core/services/app-config.service';
import { AuthService } from '../../core/services/auth.service';
import { MaskModeService } from '../../core/services/mask-mode.service';
import { SandboxService } from '../../core/services/sandbox.service';

describe('TopologyDashboardService stream', () => {
  const masked = signal(false);
  let allowed: boolean;
  let fetchSpy: jasmine.Spy;
  let service: TopologyDashboardService;

  beforeEach(() => {
    masked.set(false);
    allowed = true;
    TestBed.configureTestingModule({
      providers: [
        { provide: TopologyApiService, useValue: {} },
        { provide: AppConfigService, useValue: { apiBaseUrl: 'http://api.test' } },
        { provide: AuthService, useValue: { getToken: () => 'token' } },
        { provide: MaskModeService, useValue: { enabled: masked } },
        {
          provide: SandboxService,
          useValue: { allows: () => allowed, needsSignIn: () => false },
        },
      ],
    });
    service = TestBed.inject(TopologyDashboardService);
    fetchSpy = spyOn(window, 'fetch').and.returnValue(new Promise<Response>(() => undefined));
  });

  afterEach(() => service.stopStream());

  function sentHeaders(): Record<string, string> {
    const [, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    return init.headers as Record<string, string>;
  }

  it('reads the stream without the mask header while mask mode is off', () => {
    service.startStream();
    expect(fetchSpy).toHaveBeenCalledWith('http://api.test/api/v1/topology/stream', jasmine.any(Object));
    expect(sentHeaders()['x-mask-mode']).toBeUndefined();
  });

  it('asks the API to mask the stream while mask mode is on', () => {
    masked.set(true);
    service.startStream();
    expect(sentHeaders()['x-mask-mode']).toBe('on');
    expect(sentHeaders()['Authorization']).toBe('Bearer token');
  });

  it('backs off when the stream keeps closing before it delivers anything', fakeAsync(() => {
    const closedAtOnce = {
      ok: true,
      status: 200,
      body: { getReader: () => ({ read: () => Promise.resolve({ done: true, value: undefined }) }) },
    };
    fetchSpy.and.callFake(() => Promise.resolve(closedAtOnce as unknown as Response));
    spyOn(service, 'load').and.returnValue(Promise.resolve({} as never));
    service.startStream();
    flushMicrotasks();
    tick(1000);
    flushMicrotasks();
    tick(2000);
    flushMicrotasks();
    expect(fetchSpy.calls.count()).toBe(3);
    tick(3999);
    flushMicrotasks();
    expect(fetchSpy.calls.count()).toBe(3);
    tick(1);
    flushMicrotasks();
    expect(fetchSpy.calls.count()).toBe(4);
    service.stopStream();
  }));

  it('does not open the stream when the sandbox fence refuses it', () => {
    allowed = false;
    service.startStream();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(service.connected()).toBeFalse();
  });
});
