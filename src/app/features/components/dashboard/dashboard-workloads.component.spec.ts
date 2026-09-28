import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ApplicationService } from '../../service/application.service';
import { AppGroupView } from '../../model/application.models';
import { DashboardWorkloadsComponent } from './dashboard-workloads.component';

const group = (id: string, kind: string, status: string): AppGroupView =>
  ({
    id,
    status,
    category: kind === 'SYSTEM' ? 'system' : 'user',
    clusterId: 'c-1',
    primaryComponentId: id,
    components: [{ id, kind }],
  }) as unknown as AppGroupView;

describe('DashboardWorkloadsComponent', () => {
  let fixture: ComponentFixture<DashboardWorkloadsComponent>;
  const groups = signal<AppGroupView[]>([]);

  const q = (id: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardWorkloadsComponent],
      providers: [provideRouter([]), { provide: ApplicationService, useValue: { applicationGroups: groups } }],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardWorkloadsComponent);
  });

  it('counts the user workloads running and failed, by kind, leaving system apps out', () => {
    groups.set([
      group('a', 'APPLICATION', 'running'),
      group('b', 'APPLICATION', 'failed'),
      group('d', 'DATABASE', 'running'),
      group('s', 'SYSTEM', 'running'),
    ]);
    fixture.detectChanges();
    expect(q('workloads-running')!.textContent!.trim()).toBe('2');
    expect(q('workloads-failed')!.textContent!.trim()).toBe('1 failed');
    expect(q('workloads-apps')!.textContent!.trim()).toBe('2 apps');
    expect(q('workloads-databases')!.textContent!.trim()).toBe('1 database');
    expect(q('workloads-tools')!.textContent!.trim()).toBe('0 tools');
  });

  it('invites a first deploy when there is nothing yet', () => {
    groups.set([group('s', 'SYSTEM', 'running')]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No applications yet');
    expect(q('workloads-running')).toBeNull();
  });
});
