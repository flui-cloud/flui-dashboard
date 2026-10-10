import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, computed, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NgIconComponent } from '@ng-icons/core';
import { of } from 'rxjs';
import { StatTileComponent } from '../../../shared/components/charts';
import { UserEventsService } from '../../../core/services/user-events.service';
import { ApplicationMetricsService } from '../../../core/api/api/applicationMetrics.service';
import { ApplicationMonitoringService } from '../../service/application-monitoring.service';
import type { AppHistoryPoint } from '../../model/application.models';
import { AppHealthChecks, AppHealthChecksService } from '../../service/app-health-checks.service';
import { AppCapacityAdvice, AppCapacityAdviceService } from '../../service/app-capacity-advice.service';
import { AppRuntimeService } from '../../service/app-runtime.service';
import { AppMonitoringTabComponent } from './app-monitoring-tab.component';

type Status = { replicas_ready: number | null; replicas_desired: number | null; replicas_unavailable: number | null };

class FakeMonitoring {
  readonly current = signal<Record<string, unknown> | null>(null);
  readonly metrics = this.current.asReadonly();
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pollingPaused = signal(false);
  readonly canRetry = signal(true);
  readonly statusMetrics = computed(() => (this.current()?.['status'] as Status | undefined) ?? null);
  readonly podPhases = signal([]);
  startPolling = jasmine.createSpy('startPolling');
  stopPolling = jasmine.createSpy('stopPolling');
  refreshMetrics = jasmine.createSpy('refreshMetrics').and.resolveTo();
}

function metrics(status: Partial<Status> | null) {
  return {
    cpu: { usage_cores: 0.25, limits_cores: 0.5 },
    memory: { usage_bytes: 100, limits_bytes: 1000 },
    network: { receive_bytes_rate: 1, transmit_bytes_rate: 1 },
    replicas: [],
    status: status === null ? null : { replicas_ready: 2, replicas_desired: 2, replicas_unavailable: 0, ...status },
  };
}

const minute = (m: number): string => new Date(Date.UTC(2026, 9, 9, 10, m)).toISOString();

describe('application monitoring tab', () => {
  let fixture: ComponentFixture<AppMonitoringTabComponent>;
  let monitoring: FakeMonitoring;
  let points: AppHistoryPoint[];
  let health: { checks: ReturnType<typeof signal<AppHealthChecks | null>>; start: jasmine.Spy; stop: jasmine.Spy };
  let capacity: {
    advice: ReturnType<typeof signal<AppCapacityAdvice | null>>;
    start: jasmine.Spy;
    stop: jasmine.Spy;
    load: jasmine.Spy;
  };
  let runtime: { savingReplicas: ReturnType<typeof signal<boolean>>; updateReplicas: jasmine.Spy };

  const tile = (label: string): HTMLElement =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-stat-tile')).find((t) =>
      t.textContent!.includes(label),
    ) as HTMLElement;

  const build = async (
    status: Partial<Status> | null,
    history: AppHistoryPoint[],
    checks: AppHealthChecks | null = null,
    advice: AppCapacityAdvice | null = null,
  ): Promise<void> => {
    points = history;
    capacity = {
      advice: signal(advice),
      start: jasmine.createSpy('start'),
      stop: jasmine.createSpy('stop'),
      load: jasmine.createSpy('load').and.resolveTo(),
    };
    runtime = { savingReplicas: signal(false), updateReplicas: jasmine.createSpy('updateReplicas').and.resolveTo(true) };
    health = { checks: signal(checks), start: jasmine.createSpy('start'), stop: jasmine.createSpy('stop') };
    monitoring = new FakeMonitoring();
    monitoring.current.set(metrics(status));
    await TestBed.configureTestingModule({
      imports: [AppMonitoringTabComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { parent: { snapshot: { paramMap: convertToParamMap({ id: 'app-1' }) } } } },
        { provide: UserEventsService, useValue: { onAlert: () => () => undefined } },
        { provide: ApplicationMonitoringService, useValue: monitoring },
        { provide: AppHealthChecksService, useValue: health },
        { provide: AppCapacityAdviceService, useValue: capacity },
        { provide: AppRuntimeService, useValue: runtime },
        {
          provide: ApplicationMetricsService,
          useValue: { applicationMetricsControllerGetAppMetricsHistory: () => of({ data_points: points }) },
        },
      ],
    })
      .overrideComponent(AppMonitoringTabComponent, {
        set: { imports: [NgIconComponent, StatTileComponent], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(AppMonitoringTabComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('plots Used and Throttled on the CPU chart', async () => {
    await build({}, [
      { timestamp: 1, datetime: minute(0), cpu_utilization_percent: 40, cpu_throttled_percent: 10 },
      { timestamp: 2, datetime: minute(1), cpu_utilization_percent: 60, cpu_throttled_percent: 30 },
    ]);
    const series = fixture.componentInstance.cpuHistory()!.series;
    expect(series.map((s) => s.name)).toEqual(['Used', 'Throttled']);
    expect(series[1].data.map((p) => p.value)).toEqual([10, 30]);
  });

  it('keeps a single Used series when no throttling is reported', async () => {
    await build({}, [{ timestamp: 1, datetime: minute(0), cpu_utilization_percent: 40 }]);
    expect(fixture.componentInstance.cpuHistory()!.series.map((s) => s.name)).toEqual(['Used']);
  });

  it('says the CPU was held back when the last 15 minutes reach 25%', async () => {
    await build({}, [
      { timestamp: 1, datetime: minute(0), cpu_throttled_percent: 5 },
      { timestamp: 2, datetime: minute(20), cpu_throttled_percent: 41.6 },
      { timestamp: 3, datetime: minute(25), cpu_throttled_percent: 3 },
    ]);
    const note = tile('CPU').querySelector('[data-testid="stat-tile-note"]')!;
    expect(note.textContent).toContain('Held back by its limit 42% of the time');
    expect(note.querySelector('[title]')!.getAttribute('title')).toContain('More replicas spread the load');
  });

  it('stays quiet when throttling is low', async () => {
    await build({}, [{ timestamp: 1, datetime: minute(0), cpu_throttled_percent: 20 }]);
    expect(tile('CPU').querySelector('[data-testid="stat-tile-note"]')).toBeNull();
  });

  it('shows no data instead of all ready when the replica counts are missing', async () => {
    await build({ replicas_ready: null, replicas_desired: null }, []);
    const replicas = tile('Replicas');
    expect(replicas.textContent).toContain('—');
    expect(replicas.textContent).toContain('no data');
    expect(replicas.textContent).not.toContain('all ready');
  });

  it('shows no data when the status itself is missing', async () => {
    await build(null, []);
    expect(tile('Replicas').textContent).toContain('no data');
  });

  it('says all ready only with counts that are all ready', async () => {
    await build({}, [{ timestamp: 1, datetime: minute(0), replicas_ready: 2, replicas_desired: 2 }]);
    expect(tile('Replicas').textContent).toContain('2/2');
    expect(tile('Replicas').textContent).toContain('all ready');
    expect(tile('Replicas').querySelector('[data-testid="stat-tile-note"]')).toBeNull();
  });

  it('flags replicas that were not ready at times, with the last dip on hover', async () => {
    await build({}, [
      { timestamp: 1, datetime: minute(0), replicas_ready: 2, replicas_desired: 2 },
      { timestamp: 2, datetime: minute(5), replicas_ready: 1, replicas_desired: 2 },
      { timestamp: 3, datetime: minute(10), replicas_ready: 2, replicas_desired: 2 },
    ]);
    const chip = tile('Replicas').querySelector('[data-testid="stat-tile-note"]')!;
    expect(chip.textContent).toContain('Not ready at times');
    expect(chip.getAttribute('title')).toMatch(/^Last at /);
  });

  describe('health checks tile', () => {
    const checks = (over: Partial<AppHealthChecks> = {}): AppHealthChecks => ({
      app_id: 'app-1',
      readiness: 0,
      liveness: 0,
      startup: 0,
      restarts_by_liveness: 0,
      last_failure_at: null,
      read: true,
      ...over,
    });
    const notes = (label: string) =>
      Array.from(tile(label).querySelectorAll('[data-testid="stat-tile-note"]')) as HTMLElement[];

    it('starts its own refresh for this application and stops it on leave', async () => {
      await build({}, [], checks());
      expect(health.start).toHaveBeenCalledWith('app-1');
      fixture.destroy();
      expect(health.stop).toHaveBeenCalled();
    });

    it('shows zero failures calmly, with the explanation behind the info icon', async () => {
      await build({}, [], checks());
      expect(tile('Health checks').textContent).toContain('0');
      expect(notes('Health checks')).toHaveSize(0);
      expect(tile('Health checks').querySelector('[data-testid="stat-tile-hint"]')!.getAttribute('title')).toContain(
        'More replicas keep the route open.',
      );
    });

    it('shows a dash, never zero, when the cluster could not be asked', async () => {
      await build({}, [], checks({ read: false }));
      expect(tile('Health checks').textContent).toContain('—');
      expect(tile('Health checks').textContent).toContain('not read');
    });

    it('says how often the app was too busy to answer, marked amber', async () => {
      await build({}, [], checks({ readiness: 3, readiness_busy: 3, last_failure_at: '2026-10-09T10:20:00.000Z' }));
      const [line] = notes('Health checks');
      expect(line.textContent).toMatch(/Too busy to answer 3 times · last at \d{2}:\d{2}/);
      expect(line.querySelector('[data-testid="stat-tile-note-dot"]')!.className).toContain('bg-amber-500');
    });

    it('does not count a copy starting or stopping as a busy one', async () => {
      await build({}, [], checks({ readiness: 84, readiness_busy: 0 }));
      expect(tile('Health checks').textContent).toContain('0');
      expect(notes('Health checks')).toHaveSize(0);
      expect(tile('Health checks').querySelector('[data-testid="stat-tile-footnote"]')!.textContent).toContain(
        '84 while starting',
      );
    });

    it('says the liveness check restarted it, marked red', async () => {
      await build({}, [], checks({ readiness: 1, readiness_busy: 1, restarts_by_liveness: 2 }));
      const lines = notes('Health checks');
      expect(lines).toHaveSize(2);
      expect(lines[0].textContent).toContain('Too busy to answer 1 time');
      expect(lines[1].textContent).toContain('Restarted 2 times by its liveness check');
      expect(lines[1].querySelector('[data-testid="stat-tile-note-dot"]')!.className).toContain('bg-destructive');
    });
  });

  describe('capacity advice', () => {
    const advice = (over: Partial<AppCapacityAdvice> = {}): AppCapacityAdvice => ({
      app_id: 'app-1',
      advice: 'add_replicas',
      sentence: 'Run 2 copies: there is room for another one.',
      reasons: ['held back by its CPU limit 91% of the time'],
      desired: 1,
      ready: 1,
      next_copy: { verdict: 'fits', sentence: 'Fits.' },
      thresholds: { window_minutes: 15 },
      ...over,
    });
    const banner = () => (fixture.nativeElement as HTMLElement).querySelector('[data-testid="capacity-advice"]');

    it('says what to do in one line, with the reasons behind Why', async () => {
      await build({}, [], null, advice());
      expect(capacity.start).toHaveBeenCalledWith('app-1');
      expect(banner()!.textContent).toContain('Add a replica');
      expect(banner()!.textContent).toContain('Run 2 copies');
      expect(banner()!.querySelector('[data-testid="capacity-advice-reasons"]')).toBeNull();
      (banner()!.querySelector('[data-testid="capacity-advice-why"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(banner()!.querySelector('[data-testid="capacity-advice-reasons"]')!.textContent).toContain('91%');
    });

    it('runs one more copy when asked, then reads the advice again', async () => {
      await build({}, [], null, advice());
      const apply = banner()!.querySelector('[data-testid="capacity-advice-apply"]') as HTMLButtonElement;
      expect(apply.textContent).toContain('Run 2 copies');
      apply.click();
      await fixture.whenStable();
      expect(runtime.updateReplicas).toHaveBeenCalledWith('app-1', { replicas: 2 });
      expect(capacity.load).toHaveBeenCalled();
    });

    it('offers no button when the advice is not more copies', async () => {
      await build({}, [], null, advice({ advice: 'add_node', sentence: 'Another copy has nowhere to run: add a node first.' }));
      expect(banner()!.querySelector('[data-testid="capacity-advice-apply"]')).toBeNull();
    });

    it('stays out of the way when nothing was measured', async () => {
      await build({}, [], null, advice({ advice: 'unknown', reasons: [] }));
      expect(banner()).toBeNull();
    });
  });
});
