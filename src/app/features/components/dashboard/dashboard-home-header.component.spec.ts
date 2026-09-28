import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { FleetReadState, FleetService } from '../../service/fleet.service';
import { DashboardService } from '../../service/dashboard.service';
import { PermissionService } from '../../../core/services/permission.service';
import { DashboardHomeHeaderComponent } from './dashboard-home-header.component';

describe('DashboardHomeHeaderComponent', () => {
  let fixture: ComponentFixture<DashboardHomeHeaderComponent>;
  const state = signal<FleetReadState>('ready');
  const pulse = signal({ backendOnline: true, activeOperations: 1, providersConnected: 3, totalClusters: 4, runningApps: 17 });
  const setWindow = jasmine.createSpy('setWindow').and.returnValue(Promise.resolve());

  const q = (id: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);

  const build = async (fresh = false) => {
    await TestBed.configureTestingModule({
      imports: [DashboardHomeHeaderComponent],
      providers: [
        provideRouter([]),
        { provide: FleetService, useValue: { metricsState: state, window: signal('3h'), setWindow } },
        { provide: DashboardService, useValue: { pulseSummary: pulse, lastRefreshedAt: signal(new Date()) } },
        { provide: PermissionService, useValue: { hasSection: (s: string) => s === 'deploy' } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardHomeHeaderComponent);
    fixture.componentRef.setInput('fresh', fresh);
    fixture.detectChanges();
  };

  beforeEach(() => state.set('ready'));

  it('states the platform at a glance', async () => {
    await build();
    const line = q('home-status-line')!.textContent!.replace(/\s+/g, ' ');
    expect(line).toContain('Online');
    expect(line).toContain('3 providers');
    expect(line).toContain('4 clusters');
    expect(line).toContain('17 running');
    expect(q('home-operations')!.textContent).toContain('1 operation');
    expect(fixture.nativeElement.textContent).toContain('Deploy');
  });

  it('switches the metrics window', async () => {
    await build();
    const buttons = q('home-window')!.querySelectorAll('button');
    expect(Array.from(buttons).map((b) => b.textContent!.trim())).toEqual(['1h', '3h', '24h']);
    (buttons[2] as HTMLButtonElement).click();
    expect(setWindow).toHaveBeenCalledWith('24h');
  });

  it('hides the window for a guest the metrics refuse', async () => {
    state.set('forbidden');
    await build();
    expect(q('home-window')).toBeNull();
  });

  it('speaks of system apps and drops the window on a fresh install', async () => {
    await build(true);
    expect(q('home-status-line')!.textContent).toContain('17 system apps running');
    expect(q('home-window')).toBeNull();
  });
});
