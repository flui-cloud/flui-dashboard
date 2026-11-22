import {
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucidePlus,
  lucideRefreshCw,
  lucideSearch,
} from '@ng-icons/lucide';
import { Application, ApplicationKind, getKindLabel } from '../../model/application.models';
import { Project } from '../../model/project.model';
import { ApplicationService } from '../../service/application.service';
import { ClusterService } from '../../service/cluster.service';
import { ProjectsService } from '../../service/projects.service';
import { PermissionService } from '../../../core/services/permission.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { ProjectFormComponent } from './project-form.component';
import { ProjectFormDialog } from './project-form-dialog';
import { ProjectWorkloadRowComponent } from './project-workload-row';
import {
  ProjectSection,
  SELECTABLE_KINDS,
  buildSections,
  clusterNamesOf,
  filterGroups,
  sectionKey,
  sectionSummary,
  workloadRows,
} from './project-workloads-sections';
import {
  ProjectWorkloadsSurfaceInput,
  ProjectWorkloadsSurfaceRevision,
  buildProjectWorkloadsSurface,
  presentedContent as projectWorkloadsPresentedContent,
} from './project-workloads-surface';

function projectActions(hasWorkloads: boolean): MenuAction[] {
  return [
    { id: 'edit', label: 'Edit project' },
    {
      id: 'delete',
      label: 'Delete project',
      danger: true,
      separatorBefore: true,
      disabled: hasWorkloads,
    },
  ];
}

@Component({
  selector: 'app-project-workloads',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    FlPageHeader,
    FlPanel,
    FlTable,
    FlKeyValue,
    FlKvItem,
    FlCopyId,
    FlEmptyState,
    FlLoadingState,
    FlActionsMenu,
    FlButton,
    FlIcon,
    ProjectFormComponent,
    ProjectWorkloadRowComponent,
  ],
  providers: [
    ProjectFormDialog,
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucidePlus,
      lucideRefreshCw,
      lucideSearch,
    }),
  ],
  templateUrl: './project-workloads.component.html',
})
export class ProjectWorkloadsComponent implements OnInit, OnDestroy {
  private readonly appService = inject(ApplicationService);
  private readonly clusterService = inject(ClusterService);
  private readonly projectsService = inject(ProjectsService);
  private readonly perms = inject(PermissionService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly form = inject(ProjectFormDialog);

  private readonly formTemplate = viewChild.required<TemplateRef<unknown>>('projectForm');

  protected readonly selectableKinds = SELECTABLE_KINDS;

  protected readonly projects = this.projectsService.projects;
  protected readonly isLoading = this.appService.loading;
  protected readonly isRefreshing = this.appService.backgroundRefreshing;

  protected readonly canManage = computed(() => this.perms.hasSection('projects'));

  protected readonly search = signal('');
  protected readonly kindFilter = signal('');
  protected readonly includeSystem = signal(false);
  protected readonly hideEmpty = signal(false);
  protected readonly pendingProjectDelete = signal<Project | null>(null);
  protected readonly pendingAppDelete = signal<Application | null>(null);

  private readonly collapsed = signal<ReadonlySet<string>>(new Set());

  protected readonly focusId = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('project'))),
    { initialValue: this.route.snapshot.queryParamMap.get('project') },
  );

  protected readonly focused = computed(() => {
    const id = this.focusId();
    return id ? (this.projects().find((p) => p.id === id) ?? null) : null;
  });

  protected readonly focusMissing = computed(
    () => !!this.focusId() && !this.focused() && (this.projects().length > 0 || !this.isLoading()),
  );

  private readonly clusterNames = computed(
    () => new Map(this.clusterService.clusters().map((c) => [c.id, c.name ?? ''])),
  );

  private readonly clusterName = (id: string): string => this.clusterNames().get(id) ?? '';

  private readonly workloadCount = computed(() => {
    const counts = new Map<string, number>();
    for (const g of this.appService.applicationGroups()) {
      if (g.projectId) counts.set(g.projectId, (counts.get(g.projectId) ?? 0) + 1);
    }
    return counts;
  });

  protected readonly sections = computed<ProjectSection[]>(() => {
    const groups = filterGroups(this.appService.applicationGroups(), {
      term: this.search(),
      kind: this.kindFilter(),
      includeSystem: this.includeSystem(),
    });
    if (!this.focusId()) return buildSections(groups, this.projects(), this.hideEmpty());
    const project = this.focused();
    if (!project) return [];
    return buildSections(
      groups.filter((g) => g.projectId === project.id),
      [project],
      false,
    );
  });

  protected readonly tableSections = computed(() =>
    this.sections().map((section) => {
      const key = sectionKey(section);
      const project = section.project;
      return {
        key,
        project,
        summary: sectionSummary(section),
        collapsed: this.collapsed().has(key),
        rows: workloadRows(section.groups, project, this.clusterName),
        actions: project ? projectActions((this.workloadCount().get(project.id) ?? 0) > 0) : [],
      };
    }),
  );

  protected readonly resultCount = computed(() =>
    this.sections().reduce((n, s) => n + s.groups.length, 0),
  );

  protected readonly isInitialLoading = computed(
    () => this.isLoading() && this.appService.applicationGroups().length === 0,
  );

  protected readonly focusFacts = computed(() => {
    const project = this.focused();
    if (!project) return null;
    const groups = this.appService.applicationGroups().filter((g) => g.projectId === project.id);
    const [section] = buildSections(groups, [project], false);
    return {
      summary: sectionSummary(section),
      clusters: clusterNamesOf(groups, this.clusterName).join(', ') || '—',
      actions: projectActions(groups.length > 0),
    };
  });

  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new ProjectWorkloadsSurfaceRevision();

  private readonly surfaceInput = computed<ProjectWorkloadsSurfaceInput>(() => {
    const editing = this.form.editing();
    const appDelete = this.pendingAppDelete();
    const projectDelete = this.pendingProjectDelete();
    return {
      sections: this.sections().map((s) => ({
        projectId: s.project?.id ?? null,
        name: s.project?.name ?? 'Unassigned',
        slug: s.project?.slug,
        summary: sectionSummary(s),
        collapsed: this.isCollapsed(sectionKey(s)),
        groups: s.groups,
      })),
      projectCount: this.projects().length,
      isLoading: this.isLoading(),
      isRefreshing: this.isRefreshing(),
      canManage: this.canManage(),
      hasSearch: this.search().trim().length > 0,
      kindFilter: this.kindFilter(),
      includeSystem: this.includeSystem(),
      hideEmpty: this.hideEmpty(),
      createOpen: this.form.creating(),
      editing: editing ? { id: editing.id, name: editing.name } : null,
      pendingProjectDelete: projectDelete
        ? { id: projectDelete.id, name: projectDelete.name }
        : null,
      pendingAppDelete: appDelete ? { id: appDelete.id, name: appDelete.name } : null,
    };
  });

  protected readonly surface = computed(() => {
    const input = this.surfaceInput();
    return buildProjectWorkloadsSurface(input, {
      revision: this.surfaceRevision.next(projectWorkloadsPresentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  ngOnInit(): void {
    this.perms.load();
    this.projectsService.loadProjects();
    if (this.clusterService.clusters().length === 0) {
      this.clusterService.loadClusters().catch(() => undefined);
    }
    void this.appService.loadApplications();
  }

  protected refresh(): void {
    this.projectsService.loadProjects();
    void this.appService.loadApplications(true);
  }

  protected inputValue(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected checkedValue(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  protected kindLabel(kind: ApplicationKind): string {
    return getKindLabel(kind);
  }

  protected isCollapsed(key: string): boolean {
    return this.collapsed().has(key);
  }

  protected toggle(key: string): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  protected toggleCreate(): void {
    this.form.open(this.formTemplate());
  }

  protected startEdit(project: Project): void {
    this.form.open(this.formTemplate(), project);
  }

  protected onProjectAction(project: Project, action: string): void {
    if (action === 'edit') this.startEdit(project);
    else if (action === 'delete') void this.askDeleteProject(project);
  }

  protected openRecap(groupId: string): void {
    void this.router.navigate(['/apps/recap', groupId], {
      queryParams: { from: 'projects' },
    });
  }

  protected async askDeleteProject(project: Project): Promise<void> {
    this.pendingProjectDelete.set(project);
    const ok = await this.confirm.confirm({
      title: `Delete ${project.name}`,
      body: 'The project has no workloads and is removed. This cannot be undone.',
      confirmLabel: 'Delete project',
      destructive: true,
    });
    this.pendingProjectDelete.set(null);
    if (!ok) return;
    this.projectsService.remove(project.id);
    if (this.focusId() === project.id) void this.router.navigate(['/apps/projects']);
  }

  protected async askDeleteApp(app: Application): Promise<void> {
    if (app.systemProtected) return;
    this.pendingAppDelete.set(app);
    const ok = await this.confirm.confirm({
      title: `Delete ${app.name}`,
      body: 'This permanently removes the workload and its resources. This cannot be undone.',
      confirmLabel: 'Delete workload',
      destructive: true,
      typeToConfirm: app.name,
    });
    this.pendingAppDelete.set(null);
    if (ok) void this.appService.deleteApplication(app.id);
  }
}
