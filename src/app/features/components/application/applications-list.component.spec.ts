import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ApplicationsListComponent } from './applications-list.component';
import { ApplicationService } from '../../service/application.service';
import { ClusterService } from '../../service/cluster.service';
import { ProvidersService } from '../../service/providers.service';
import { ProjectsService } from '../../service/projects.service';
import { FleetCoverage, FleetReadState, FleetService } from '../../service/fleet.service';
import { ApplicationMetricsService } from '../../../core/api/api/applicationMetrics.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { AppGroupView, Application } from '../../model/application.models';

const app = (id: string, over: Partial<Application> = {}): Application =>
  ({
    id,
    name: id,
    slug: `${id}-x1`,
    kind: 'APPLICATION',
    category: 'user',
    sourceType: 'docker_image',
    clusterId: 'c1',
    status: 'running',
    sourceConfig: {},
    replicas: 1,
    labels: {},
    createdAt: '2026-09-20T10:00:00Z',
    ...over,
  }) as Application;

const group = (a: Application, over: Partial<AppGroupView> = {}): AppGroupView => ({
  id: `g-${a.id}`,
  type: 'standalone' as AppGroupView['type'],
  name: a.name,
  status: a.status,
  category: a.category,
  clusterId: a.clusterId,
  createdAt: a.createdAt,
  components: [a],
  ...over,
});

const composedLabels = { 'flui.cloud/composed-component': 'db' };

describe('ApplicationsListComponent', () => {
  let fixture: ComponentFixture<ApplicationsListComponent>;
  let routeData: { list: string };
  let routeQuery: Record<string, string>;
  let navigate: jasmine.Spy;
  const coverageState = signal<FleetReadState>('ready');
  const coverage = signal<FleetCoverage | null>(null);

  const healthy = app('web', { url: 'https://web.example.com' });
  const failed = app('broken', { status: 'failed', reconciliationError: 'image not found' });
  const db = app('store', { volumes: [] } as Partial<Application>);
  const kuma = app('kuma', { kind: 'TOOL' as Application['kind'] });
  const umami = app('umami');
  const umamiDb = app('umami-db', { imageRef: 'postgres:16', labels: composedLabels });
  const bundle = group(umami, {
    id: 'g-umami',
    type: 'composed' as AppGroupView['type'],
    primaryComponentId: umami.id,
    components: [umami, umamiDb],
  });

  async function render(list: string, query: Record<string, string> = {}) {
    routeData.list = list;
    routeQuery = query;
    fixture = TestBed.createComponent(ApplicationsListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    routeData = { list: 'applications' };
    routeQuery = {};
    navigate = jasmine.createSpy('navigate');
    coverage.set({
      generatedAt: '',
      summary: { applications: 3, holdingData: 1, protected: 0, pending: 0, toVerify: 0, unprotected: 1, alarms: 1 },
      applications: [
        {
          applicationId: 'store',
          name: 'store',
          slug: 'store',
          kind: 'APPLICATION',
          category: 'user',
          clusterId: 'c1',
          clusterName: 'wc-1',
          holdsData: true,
          dataReasons: ['volume'],
          coverage: 'unprotected',
          reason: 'no_policy',
          alarm: true,
          policy: null,
          coveringPolicies: 0,
          lastSuccessAt: null,
          protectedUntil: null,
          protectPath: '/management/backup/policies/new?clusterId=c1&applicationId=store',
        },
      ],
    });
    const groups = [group(healthy), group(failed), group(db), group(kuma), bundle];
    await TestBed.configureTestingModule({
      imports: [ApplicationsListComponent],
      providers: [
        {
          provide: ApplicationService,
          useValue: {
            applications: signal([healthy, failed, db, kuma, umami, umamiDb]),
            applicationGroups: signal(groups),
            loading: signal(false),
            backgroundRefreshing: signal(false),
            errorMessage: signal(null),
            loadApplications: jasmine.createSpy('loadApplications').and.resolveTo(),
          },
        },
        {
          provide: ClusterService,
          useValue: {
            clusters: signal([{ id: 'c1', name: 'wc-1', status: 'active', provider: 'hetzner' }]),
            loadClusters: jasmine.createSpy('loadClusters').and.resolveTo(),
          },
        },
        { provide: ProvidersService, useValue: { getProviderById: () => ({ displayName: 'Hetzner' }) } },
        { provide: ProjectsService, useValue: { projects: signal([]), loadProjects: jasmine.createSpy('loadProjects') } },
        {
          provide: FleetService,
          useValue: { coverage, coverageState, loadCoverage: jasmine.createSpy('loadCoverage').and.resolveTo() },
        },
        {
          provide: ApplicationMetricsService,
          useValue: {
            applicationMetricsControllerGetClusterAppsMetrics: () =>
              of({
                cluster_id: 'c1',
                queried_at: '',
                applications: [
                  {
                    app_id: 'web',
                    cpu: { utilization_percent: 12 },
                    memory: { utilization_percent: 40 },
                    status: { replicas_ready: 1, replicas_desired: 1 },
                  },
                ],
              }),
          },
        },
        { provide: CurrentSurfaceService, useValue: { set: () => undefined } },
        {
          provide: SandboxService,
          useValue: { whyFor: () => '', visitor: signal(false), inSandbox: signal(false), hasArea: signal(false) },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get data() {
                return routeData;
              },
              get queryParamMap() {
                return convertToParamMap(routeQuery);
              },
            },
          },
        },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();

    await render('applications');
  });

  const rowIds = () =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-testid^="app-row-g-"]')).map((el) =>
      (el as HTMLElement).getAttribute('data-testid'),
    );
  const text = () => (fixture.nativeElement.textContent ?? '') as string;

  it('lists the failed app first with its reason, and says how many apps on how many clusters', () => {
    expect(rowIds()[0]).toBe('app-row-g-broken');
    expect(text()).toContain('Failed · image not found');
    expect(fixture.nativeElement.querySelector('[data-testid="apps-summary"]').textContent).toContain(
      '5 applications on 1 cluster',
    );
  });

  it('shows ready replicas from the readings and the endpoint as a link', () => {
    const web = fixture.nativeElement.querySelector('[data-testid="app-row-g-web"]');
    expect(web.querySelector('[data-testid="app-row-ready"]').textContent.trim()).toBe('1 / 1');
    expect(web.querySelector('[data-testid="app-row-endpoint"]').getAttribute('href')).toBe('https://web.example.com');
    expect(web.querySelector('[data-testid="app-row-origin"]').textContent.trim()).toBe('Image');
  });

  it('cuts the list to what needs attention and to apps without backup', () => {
    fixture.nativeElement.querySelector('[data-testid="apps-view-attention"]').click();
    fixture.detectChanges();
    expect(rowIds()).toEqual(['app-row-g-broken']);

    const noBackup = fixture.nativeElement.querySelector('[data-testid="apps-view-no_backup"]');
    expect(noBackup.textContent).toContain('1');
    noBackup.click();
    fixture.detectChanges();
    expect(rowIds()).toEqual(['app-row-g-store']);
    expect(text()).toContain('No backup');
  });

  it('leaves the backup column at a dash when the backup read did not answer', () => {
    coverageState.set('error');
    fixture.detectChanges();
    const cells = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="app-row-backup"]')).map((el) =>
      (el as HTMLElement).textContent?.trim(),
    );
    expect(cells.every((c) => c === '—')).toBeTrue();
    coverageState.set('ready');
  });

  it('marks tools and narrows to them from the Tools chip or the old tools address', async () => {
    expect(fixture.nativeElement.querySelector('[data-testid="app-row-g-kuma"] [data-testid="app-row-tool"]')).not.toBeNull();
    fixture.nativeElement.querySelector('[data-testid="apps-type-tool"]').click();
    fixture.detectChanges();
    expect(rowIds()).toEqual(['app-row-g-kuma']);

    await render('applications', { type: 'tool' });
    expect(rowIds()).toEqual(['app-row-g-kuma']);
  });

  it('keeps the bundle in Applications and lists its data store in Data, linked to the bundle', async () => {
    expect(rowIds()).toContain('app-row-g-umami');

    await render('data');
    const row = fixture.nativeElement.querySelector('[data-testid="app-row-umami-db"]');
    expect(row).not.toBeNull();
    expect(rowIds()).toEqual([]);
    expect(row.querySelector('[data-testid="app-row-part-of"]').textContent).toContain('umami');
    expect(fixture.nativeElement.querySelector('[data-testid="apps-summary"]').textContent).toContain('1 data store on 1 cluster');

    row.click();
    expect(navigate).toHaveBeenCalledWith(['/apps/applications', 'umami-db']);
    row.querySelector('[data-testid="app-row-part-of"] button').click();
    expect(navigate).toHaveBeenCalledWith(['/apps/recap', 'g-umami'], { queryParams: { from: 'data' } });
  });

  it('offers the same Add menu on every list but System', async () => {
    expect(fixture.nativeElement.querySelector('[data-testid="add-workload"]')).not.toBeNull();
    await render('system');
    expect(fixture.nativeElement.querySelector('[data-testid="add-workload"]')).toBeNull();
  });
});
