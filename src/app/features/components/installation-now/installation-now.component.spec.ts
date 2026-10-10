import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { InstallationNow } from '../../model/installation-now.models';
import { InstallationNowService } from '../../service/installation-now.service';
import { InstallationNowComponent, NOW_REFRESH_MS } from './installation-now.component';

function now(over: Partial<InstallationNow> = {}): InstallationNow {
  return {
    measuredAt: '2026-10-09T09:59:30.000Z',
    nodes: [
      { clusterId: 'c-1', clusterName: 'control', node: 'busy', cpuPercent: 92, memoryPercent: 81, mbpsOut: 420, mbpsIn: 30, monthPaceBytes: 18.4e12, includedTb: 20 },
      { clusterId: 'c-1', clusterName: 'control', node: 'calm', cpuPercent: 10, memoryPercent: 20, mbpsOut: 1, mbpsIn: 1, monthPaceBytes: 0.1e12, includedTb: null },
    ],
    edges: [
      { clusterId: 'c-1', clusterName: 'control', rpsNow: 40, rpsBefore: 4, rateLimited10m: 120, requests10m: 1000, serverErrors10m: 80 },
      { clusterId: 'c-2', clusterName: 'workload', rpsNow: 2, rpsBefore: 0, rateLimited10m: 0, requests10m: 0, serverErrors10m: 0 },
    ],
    platform: [
      { name: 'API', cpuPercent: 40, memoryPercent: 85, restartsLastHour: 1 },
      { name: 'Dashboard', cpuPercent: null, memoryPercent: null, restartsLastHour: 0 },
    ],
    registry: {
      requests: { pulls: 30, pushes: 2, deletes: 0 },
      outcomes: { ok: 31, refused: 1, notFound: 0, failed: 2 },
      bytesIn: 100,
      bytesOut: 200 * 1024 * 1024,
      peakBytesPerSecondIn: 0,
      peakBytesPerSecondOut: 5_000_000,
      readFromBucketBytes: null,
    },
    sandbox: { live: 18, warm: 2, ceiling: 24, waiting: 3, fullRefusals: 0 },
    alerts: { firing: 2, critical: 1, names: ['FluiTrafficSurge', 'FluiNodeCpuHigh'] },
    thresholds: { nodeMbps: 400, monthlyTrafficPercent: 80, spikeFactor: 3, spikeMinRps: 5, rateLimitedPer10m: 100, edgeErrorPercent: 5 },
    ...over,
  };
}

class FakeNow {
  readonly now = signal<InstallationNow | null>(null);
  readonly loading = signal(false);
  readonly refused = signal(false);
  readonly refusalMessage = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly load = jasmine.createSpy('load').and.resolveTo();
}

describe('the Now page', () => {
  let fixture: ComponentFixture<InstallationNowComponent>;
  let service: FakeNow;
  let surface: jasmine.SpyObj<CurrentSurfaceService>;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (testid: string, root: ParentNode = el()): HTMLElement | null =>
    root.querySelector(`[data-testid="${testid}"]`);
  const render = (value: InstallationNow | null): void => {
    service.now.set(value);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    service = new FakeNow();
    surface = jasmine.createSpyObj<CurrentSurfaceService>('CurrentSurfaceService', ['set']);
    await TestBed.configureTestingModule({
      imports: [InstallationNowComponent],
      providers: [
        { provide: InstallationNowService, useValue: service },
        { provide: CurrentSurfaceService, useValue: surface },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(InstallationNowComponent);
  });

  afterEach(() => fixture.destroy());

  it('reads on open and publishes its surface', () => {
    render(now());
    expect(service.load).toHaveBeenCalled();
    expect(surface.set.calls.mostRecent().args[0]!.surface.route).toBe('management/now');
  });

  it('shows the firing alerts with their names, or a green all-clear', () => {
    render(now());
    expect(q('now-alerts')!.textContent).toContain('2 firing · 1 critical');
    expect(el().querySelectorAll('[data-testid="now-alert-name"]')).toHaveSize(2);

    render(now({ alerts: { firing: 0, critical: 0, names: [] } }));
    expect(q('now-alerts')!.textContent).toContain('No alert firing');
  });

  it('shows the demo spaces, and waiting in amber', () => {
    render(now());
    expect(q('now-demo-live')!.textContent).toContain('18 / 24');
    expect(q('now-demo-waiting')!.className).toContain('text-amber-600');
    expect(q('now-demo-turned-away')!.className).not.toContain('text-amber-600');

    render(now({ sandbox: null }));
    expect(q('now-demo')).toBeNull();
  });

  it('marks a surge, rate limiting and server errors at the door', () => {
    render(now());
    const busy = q('now-edge-c-1')!;
    expect(q('now-surge', busy)).not.toBeNull();
    expect(q('now-edge-limited', busy)!.className).toContain('text-amber-600');
    expect(q('now-edge-errors', busy)!.textContent).toContain('8%');
    expect(q('now-edge-errors', busy)!.className).toContain('text-destructive');

    const quiet = q('now-edge-c-2')!;
    expect(q('now-surge', quiet)).toBeNull();
    expect(q('now-edge-errors', quiet)!.textContent).toContain('–');
  });

  it('colours node CPU, memory, link and month against the thresholds', () => {
    render(now());
    const busy = q('now-node-busy')!;
    expect(q('now-node-cpu', busy)!.querySelector('span')!.className).toContain('text-destructive');
    expect(q('now-node-memory', busy)!.querySelector('span')!.className).toContain('text-amber-600');
    expect(q('now-node-link', busy)!.className).toContain('text-amber-600');
    expect(q('now-node-month', busy)!.textContent).toContain('18.4 of 20 TB');
    expect(q('now-node-month', busy)!.className).toContain('text-amber-600');

    const calm = q('now-node-calm')!;
    expect(q('now-node-cpu', calm)!.querySelector('span')!.className).not.toContain('text-amber-600');
    expect(q('now-node-month', calm)!.textContent).toContain('not metered');
  });

  it('shows platform components with a dash when unmeasured and restarts in amber', () => {
    render(now());
    const api = q('now-platform-API')!;
    expect(q('now-platform-memory', api)!.className).toContain('text-amber-600');
    expect(q('now-platform-restarts', api)!.className).toContain('text-amber-600');
    expect(q('now-platform-memory', q('now-platform-Dashboard')!)!.textContent).toContain('–');
  });

  it('shows the registry hour only when there is one', () => {
    render(now());
    expect(q('now-registry-out')!.textContent).toContain('200 MiB');
    expect(q('now-registry-peak')!.textContent).toContain('40.0 Mbit/s');
    expect(q('now-registry-refused')!.className).toContain('text-amber-600');
    expect(q('now-registry-failed')!.className).toContain('text-destructive');

    render(now({ registry: null }));
    expect(q('now-registry')).toBeNull();
  });

  it('shows a calm refusal instead of the figures', () => {
    service.refused.set(true);
    service.refusalMessage.set('Seeing this page needs the permission to read clusters.');
    render(now());
    expect(q('now-refused')!.textContent).toContain('permission to read clusters');
    expect(q('now-alerts')).toBeNull();
    expect(q('now-error')).toBeNull();
  });

  it('refreshes every 30 seconds until paused, and reads again on resume', fakeAsync(() => {
    render(now());
    expect(service.load).toHaveBeenCalledTimes(1);
    tick(NOW_REFRESH_MS);
    expect(service.load).toHaveBeenCalledTimes(2);

    q('now-pause')!.click();
    fixture.detectChanges();
    expect(q('now-pause')!.textContent).toContain('Resume');
    tick(NOW_REFRESH_MS * 2);
    expect(service.load).toHaveBeenCalledTimes(2);

    q('now-pause')!.click();
    fixture.detectChanges();
    expect(service.load).toHaveBeenCalledTimes(3);
    tick(NOW_REFRESH_MS);
    expect(service.load).toHaveBeenCalledTimes(4);
    fixture.destroy();
    discardPeriodicTasks();
  }));
});
