import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { AppRecapComponent } from './app-recap.component';
import { ApplicationService } from '../../service/application.service';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { ClusterService } from '../../service/cluster.service';
import { DbConsoleService } from '../../service/db-console.service';
import { BackupService } from '../../service/backup.service';
import { AppProtection, FleetService } from '../../service/fleet.service';
import { CatalogService } from '../../service/catalog.service';
import { ApplicationMetricsService } from '../../../core/api/api/applicationMetrics.service';
import { ApplicationsService } from '../../../core/api/api/applications.service';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AppGroupView, Application } from '../../model/application.models';

const app = (id: string, over: Partial<Application> = {}): Application =>
  ({
    id,
    name: id,
    slug: `${id}-4wn132`,
    kind: 'APPLICATION',
    category: 'user',
    sourceType: 'docker_image',
    clusterId: 'c1',
    k8sNamespace: 'user-someone',
    status: 'running',
    exposure: 'public',
    replicas: 1,
    labels: {},
    imageRef: 'traefik/whoami:v1.10',
    createdAt: '2026-09-26T16:47:00Z',
    ...over,
  }) as Application;

const metrics = (id: string, extra: Record<string, unknown> = {}) => ({
  app_id: id,
  metrics: {
    app_id: id,
    cpu: { utilization_percent: 6, limits_cores: 0.5, usage_cores: 0.03 },
    memory: { utilization_percent: 22, limits_bytes: 1, usage_bytes: 1 },
    status: { replicas_ready: 1, replicas_desired: 1, restart_rate_1h: 0 },
    ...extra,
  },
});

const protection = (id: string, over: Record<string, unknown> = {}): AppProtection => ({
  applicationId: id,
  protectedOffCluster: true,
  policies: [],
  lastBackupSizeBytes: 2 * 1024 ** 2,
  coverage: {
    applicationId: id,
    name: id,
    slug: id,
    kind: 'APPLICATION',
    category: 'user',
    clusterId: 'c1',
    clusterName: 'wc-1',
    holdsData: true,
    dataReasons: ['volume'],
    coverage: 'protected',
    reason: 'recent_backup',
    alarm: false,
    policy: {
      id: `policy-${id}`,
      name: 'nightly',
      scope: 'applications',
      engineClass: 'volume_copy',
      schedule: '0 3 * * *',
      retentionDays: 30,
      nextRunAt: null,
    },
    coveringPolicies: 1,
    lastSuccessAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
    protectedUntil: null,
    protectPath: null,
    ...over,
  },
});

describe('AppRecapComponent', () => {
  let fixture: ComponentFixture<AppRecapComponent>;
  let runOnDemand: jasmine.Spy;

  async function build(group: AppGroupView, protections: Record<string, AppProtection>) {
    runOnDemand = jasmine.createSpy('runOnDemand').and.resolveTo({ job: { id: 'j1' } });
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AppRecapComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: group.id })),
            queryParamMap: of(convertToParamMap({})),
            snapshot: { paramMap: convertToParamMap({ id: group.id }), queryParamMap: convertToParamMap({}) },
          },
        },
        {
          provide: ApplicationService,
          useValue: {
            applications: signal(group.components),
            applicationGroups: signal([group]),
            loadApplications: jasmine.createSpy('loadApplications').and.resolveTo(),
            getRemovalPreview: jasmine.createSpy('getRemovalPreview'),
          },
        },
        {
          provide: AppEndpointsService,
          useValue: { endpoints: signal([{ fqdn: 'whoami.example.com', tlsEnabled: true }]), loadEndpoints: () => Promise.resolve() },
        },
        {
          provide: ClusterService,
          useValue: { clusters: signal([{ id: 'c1', name: 'ovh-scaling-test', status: 'active' }]), loadClusters: () => Promise.resolve() },
        },
        {
          provide: DbConsoleService,
          useValue: { getConnectionInfo: () => of({ engine: 'postgres', database: 'umami', user: 'umami', namespace: 'ns', remotePort: 5432 }) },
        },
        { provide: BackupService, useValue: { runOnDemand } },
        { provide: FleetService, useValue: { appProtection: (id: string) => Promise.resolve(protections[id]) } },
        {
          provide: ApplicationMetricsService,
          useValue: {
            applicationMetricsControllerGetAppMetrics: (id: string) =>
              of(metrics(id, id === 'db' ? { volume: { used_bytes: 300 * 1024 ** 2, capacity_bytes: 5 * 1024 ** 3, utilization_percent: 6 } } : {})),
          },
        },
        {
          provide: ApplicationsService,
          useValue: {
            applicationReleasesControllerGetCurrentRelease: () =>
              of({ status: 'SUCCEEDED', imageRef: 'traefik/whoami:v1.10', startedAt: '2026-09-26T16:47:00', completedAt: '2026-09-26T16:47:00' }),
            applicationsControllerGetAuditEvents: (id: string) =>
              of({
                events: [{ id: `e-${id}`, eventType: 'created', changeMetadata: {}, createdAt: '2026-09-16T00:44:00Z' }],
                total: 1,
              }),
          },
        },
        { provide: MaskModeService, useValue: { enabled: signal(false) } },
        { provide: CurrentSurfaceService, useValue: { set: () => undefined } },
        { provide: CatalogService, useValue: {} },
        { provide: NotificationService, useValue: { add: () => undefined } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AppRecapComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const q = (sel: string): HTMLElement => fixture.nativeElement.querySelector(sel);

  describe('a single application', () => {
    const whoami = app('whoami', {
      url: 'https://whoami.example.com',
      endpointStatus: 'IN_SYNC',
      endpointCertificateStatus: 'valid',
    });
    const group: AppGroupView = {
      id: 'g1',
      type: 'standalone' as AppGroupView['type'],
      name: 'whoami',
      status: 'running' as AppGroupView['status'],
      category: 'user' as AppGroupView['category'],
      clusterId: 'c1',
      url: 'https://whoami.example.com',
      createdAt: '2026-09-26T16:47:00Z',
      primaryComponentId: 'whoami',
      components: [whoami],
    };

    beforeEach(() => build(group, { whoami: protection('whoami') }));

    it('heads the page with the image, the cluster and Open app', () => {
      expect(q('[data-testid="recap-meta"]').textContent).toContain('traefik/whoami:v1.10');
      expect(q('[data-testid="recap-meta"]').textContent).toContain('ovh-scaling-test');
      expect(q('[data-testid="recap-open"]').getAttribute('href')).toBe('https://whoami.example.com');
    });

    it('shows the endpoint with its health and the three facts', () => {
      expect(q('[data-testid="recap-endpoint-health"]').textContent).toContain('DNS and certificate ok');
      const facts = q('[data-testid="recap-facts"]').textContent ?? '';
      expect(facts).toContain('1 / 1 ready');
      expect(facts).toContain('0 restarts in the last hour');
      expect(facts).toContain('CPU 6% · MEM 22%');
      expect(facts).toContain('Succeeded');
      expect(facts).toContain('v1.10');
    });

    it('shows the backup band and backs up now through the covering policy', async () => {
      const band = q('[data-testid="recap-backup"]').textContent ?? '';
      expect(band).toContain('Backed up');
      expect(band).toContain('nightly · daily 03:00 UTC');
      expect(band).toContain('3h ago · 2 MB');
      expect(band).toContain('30 days');
      expect(band).toContain('Restore');
      q('[data-testid="recap-backup-now"]').click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(runOnDemand).toHaveBeenCalledWith('policy-whoami');
      expect(q('[data-testid="recap-backup-now"]').textContent).toContain('Backup started');
    });

    it('reduces the danger zone to one line', () => {
      expect(q('[data-testid="danger-line"]').textContent).toContain('Delete application');
      expect(q('[data-testid="danger-line"]').textContent).toContain('user-someone');
    });
  });

  describe('a bundle', () => {
    const web = app('umami', { labels: { 'flui.cloud/composed-component': 'umami' }, catalogSlug: 'umami' });
    const db = app('db', {
      kind: 'DATABASE',
      exposure: 'cluster',
      labels: { 'flui.cloud/composed-component': 'db', 'flui.cloud/db-engine': 'postgres' },
      catalogSlug: 'umami',
    });
    const group: AppGroupView = {
      id: 'g2',
      type: 'composed' as AppGroupView['type'],
      name: 'Umami',
      status: 'running' as AppGroupView['status'],
      category: 'user' as AppGroupView['category'],
      clusterId: 'c1',
      catalogSlug: 'umami',
      createdAt: '2026-09-16T00:44:00Z',
      primaryComponentId: 'umami',
      components: [web, db],
    };

    beforeEach(() =>
      build(group, {
        umami: protection('umami', { holdsData: false, coverage: 'unprotected', policy: null, lastSuccessAt: null }),
        db: protection('db', {
          coverage: 'unprotected',
          reason: 'no_policy',
          alarm: true,
          policy: null,
          lastSuccessAt: null,
          protectPath: '/management/backup/policies/new?clusterId=c1&applicationId=db&engineClass=database',
        }),
      }),
    );

    it('raises the backup alarm on top with a Protect link prefilled for the database', () => {
      const alarm = q('[data-testid="recap-backup-alarm"]');
      expect(alarm.textContent).toContain('The database has no backup');
      expect(alarm.textContent).toContain('5.0 GB volume');
      expect(alarm.getAttribute('href')).toContain('engineClass=database');
    });

    it('draws each component with its readings and backup state', () => {
      const topology = q('[data-testid="recap-topology"]').textContent ?? '';
      expect(topology).toContain('2 of 2 components running');
      const dbCard = q('[data-testid="recap-component-db"]').textContent ?? '';
      expect(dbCard).toContain('PostgreSQL · cluster');
      expect(dbCard).toContain('DISK');
      expect(dbCard).toContain('Not backed up');
      expect(dbCard).toContain('Protect');
      expect(q('[data-testid="recap-component-umami"]').textContent).toContain('Nothing to back up');
      expect(topology).toContain('db is reachable inside the cluster only.');
    });

    it('replaces the connect card with a Database block and lists recent activity', () => {
      const block = q('[data-testid="recap-database-db"]').textContent ?? '';
      expect(block).toContain('300 MB');
      expect(block).toContain('None');
      expect(block).toContain('External client');
      expect(block).toContain('Use from another app');
      expect(q('[data-testid="recap-activity"]').textContent).toContain('db: Application created');
      expect(q('[data-testid="danger-line"]').textContent).toContain('Delete bundle');
    });
  });
});
