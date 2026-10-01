import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { BackupService } from '../../service/backup.service';
import { FleetCoverage, FleetReadState, FleetService } from '../../service/fleet.service';
import { BackupStatus } from '../../model/backup-status.models';
import { DashboardBackupsComponent } from './dashboard-backups.component';

const status = (over: Partial<BackupStatus['summary']> = {}, last?: string): BackupStatus => ({
  overall: 'ok',
  summary: {
    clustersTotal: 4,
    clustersWithBackups: 3,
    clustersWithoutBackups: 1,
    activePolicies: 5,
    degradedPolicies: 0,
    failedDestinations: 0,
    healthyDestinations: 1,
    totalArtifactsLast30d: 42,
    failedJobsLast24h: 0,
    ...over,
  },
  lastSuccessfulBackupAt: last,
  alerts: [],
  generatedAt: '2026-09-27T12:00:00.000Z',
});

const coverage = (holdingData: number, protectedApps: number): FleetCoverage => ({
  generatedAt: '',
  summary: { applications: 6, holdingData, protected: protectedApps + 2, pending: 0, toVerify: 0, unprotected: holdingData - protectedApps, alarms: 0 },
  applications: [
    ...Array.from({ length: holdingData }, (_, i) => ({
      holdsData: true,
      coverage: i < protectedApps ? 'protected' : 'unprotected',
    })),
    { holdsData: false, coverage: 'protected' },
    { holdsData: false, coverage: 'protected' },
  ] as unknown as FleetCoverage['applications'],
});

describe('DashboardBackupsComponent', () => {
  let fixture: ComponentFixture<DashboardBackupsComponent>;
  const backupStatus = signal<BackupStatus | null>(null);
  const coverageData = signal<FleetCoverage | null>(null);
  const coverageState = signal<FleetReadState>('idle');

  const q = (id: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);

  beforeEach(async () => {
    backupStatus.set(status({}, '2026-09-27T03:00:00.000Z'));
    coverageData.set(null);
    coverageState.set('idle');
    await TestBed.configureTestingModule({
      imports: [DashboardBackupsComponent],
      providers: [
        provideRouter([]),
        {
          provide: BackupService,
          useValue: { status: backupStatus, statusLoading: signal(false), loadStatus: () => Promise.resolve(null) },
        },
        { provide: FleetService, useValue: { coverage: coverageData, coverageState } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardBackupsComponent);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('shows the posture figures and the last backup', () => {
    const text = q('backups-card')!.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('3/4');
    expect(text).toContain('Policies');
    expect(text).toContain('42');
    expect(text).toContain('Last backup');
    expect(text).toContain('Open backups');
  });

  it('adds how many apps with data are protected when the fleet read answers', () => {
    coverageData.set(coverage(4, 3));
    coverageState.set('ready');
    fixture.detectChanges();
    expect(q('backups-coverage')!.textContent).toContain('3 of 4 apps with data protected');
  });

  it('leaves the coverage line out for a guest the read refuses', () => {
    coverageState.set('forbidden');
    fixture.detectChanges();
    expect(q('backups-coverage')).toBeNull();
    expect(q('backups-card')).not.toBeNull();
  });

  it('says there are no backups yet and offers to set up a policy', () => {
    backupStatus.set(status({ activePolicies: 0, totalArtifactsLast30d: 0, clustersWithBackups: 0 }));
    fixture.detectChanges();
    expect(q('backups-empty')!.textContent).toContain('No backups yet.');
    expect(q('backups-card')!.textContent).toContain('Set up a backup policy');
  });

  it('names the policies whose cluster is gone, each linking to its page', () => {
    backupStatus.set({
      ...status(),
      overall: 'warning',
      alerts: [
        {
          severity: 'warning',
          code: 'ORPHAN_POLICIES',
          message: 'Backup policy prod-daily points at a cluster that no longer exists.',
          items: [{ id: 'p1', name: 'prod-daily', path: '/management/backup/policies/p1' }],
        },
      ],
    });
    fixture.detectChanges();
    const link = q('backups-alert-items')!.querySelector('a') as HTMLAnchorElement;
    expect(link.textContent).toContain('prod-daily');
    expect(link.getAttribute('href')).toBe('/management/backup/policies/p1');
  });

  it('renders nothing when the status could not be read', () => {
    backupStatus.set(null);
    fixture.detectChanges();
    expect(q('backups-card')).toBeNull();
  });
});
