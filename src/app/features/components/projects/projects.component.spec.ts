import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AppGroupView, Application } from '../../model/application.models';
import { Project } from '../../model/project.model';
import { ApplicationService } from '../../service/application.service';
import { ClusterService } from '../../service/cluster.service';
import { ProjectsService } from '../../service/projects.service';
import { ProjectsComponent } from './projects.component';

const PROJECT: Project = { id: 'p-1', name: 'Billing', slug: 'billing' };
const EMPTY: Project = { id: 'p-2', name: 'Growth', slug: 'growth' };

const component = (id: string, kind: string, over: Partial<Application> = {}): Application =>
  ({ id, name: id, kind, clusterId: 'c1', projectId: 'p-1', ...over }) as unknown as Application;

const group = (id: string, kind: string, over: Partial<AppGroupView> = {}): AppGroupView =>
  ({
    id,
    type: 'single',
    name: id,
    status: 'running',
    category: 'user',
    clusterId: 'c1',
    projectId: 'p-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    components: [component(id, kind)],
    ...over,
  }) as AppGroupView;

describe('ProjectsComponent workload counts', () => {
  let fixture: ComponentFixture<ProjectsComponent>;
  let groups: ReturnType<typeof signal<AppGroupView[]>>;
  let projects: ReturnType<typeof signal<Project[]>>;

  const build = (initial: AppGroupView[], list: Project[] = [PROJECT]) => {
    groups = signal(initial);
    projects = signal(list);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ApplicationService,
          useValue: {
            applicationGroups: groups,
            loadApplications: jasmine.createSpy('loadApplications').and.resolveTo(),
          },
        },
        {
          provide: ClusterService,
          useValue: {
            clusters: signal([{ id: 'c1', name: 'wc-1' }]),
            loadClusters: jasmine.createSpy('loadClusters').and.resolveTo(),
          },
        },
        {
          provide: ProjectsService,
          useValue: { projects, loadProjects: jasmine.createSpy('loadProjects') },
        },
        {
          provide: PermissionService,
          useValue: { hasSection: () => true, load: () => undefined },
        },
        { provide: CurrentSurfaceService, useValue: { set: () => undefined } },
      ],
    });
    fixture = TestBed.createComponent(ProjectsComponent);
    fixture.detectChanges();
  };

  const row = (id: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(
      `[data-testid="project-row-${id}"]`,
    ) as HTMLElement;

  const workloads = (id: string) => row(id).querySelector('td.is-num')?.textContent?.trim();

  it('counts application groups, not every component of a composed app', () => {
    build([
      group('solo', 'APPLICATION'),
      group('bundle', 'APPLICATION', {
        type: 'composed',
        components: [
          component('web', 'APPLICATION'),
          component('worker', 'APPLICATION'),
          component('db', 'DATABASE'),
        ],
      }),
    ]);
    expect(workloads('p-1')).toBe('2');
  });

  it('leaves system workloads out of the count', () => {
    build([group('api', 'APPLICATION'), group('ingress', 'SYSTEM'), group('metrics', 'SYSTEM')]);
    expect(workloads('p-1')).toBe('1');
  });

  it('lists the clusters of the counted workloads', () => {
    build([group('api', 'APPLICATION')]);
    expect(row('p-1').textContent).toContain('wc-1');
  });

  it('shows zero for a project holding only system workloads', () => {
    build([group('ingress', 'SYSTEM')]);
    expect(workloads('p-1')).toBe('0');
  });

  it('follows the groups as they change', () => {
    build([group('api', 'APPLICATION')], [PROJECT, EMPTY]);
    expect(workloads('p-2')).toBe('0');
    groups.set([group('api', 'APPLICATION'), group('site', 'APPLICATION', { projectId: 'p-2' })]);
    fixture.detectChanges();
    expect(workloads('p-2')).toBe('1');
  });
});
