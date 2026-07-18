import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideFolders,
  lucidePencil,
  lucidePlus,
  lucideRefreshCw,
  lucideSearch,
  lucideSettings2,
  lucideTrash2,
} from '@ng-icons/lucide';
import { ApplicationGroupRowComponent } from '../application/application-group-row.component';
import {
  Application,
  ApplicationKind,
  ApplicationKindEnum,
  AppGroupView,
  getGroupKind,
  getKindLabel,
} from '../../model/application.models';
import { Project } from '../../model/project.model';
import { ApplicationService } from '../../service/application.service';
import { ProjectsService } from '../../service/projects.service';
import { PermissionService } from '../../../core/services/permission.service';
import {
  DeleteConfirmationDialogComponent,
} from '../../../shared/components/delete-confirmation-dialog.component';
import { ProjectFormComponent, ProjectFormValue } from './project-form.component';

interface ProjectSection {
  project: Project | null;
  groups: AppGroupView[];
  counts: { kind: ApplicationKind; count: number }[];
}

const SELECT =
  'h-9 rounded-md border border-border bg-background px-2 pr-7 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

@Component({
  selector: 'app-project-workloads',
  standalone: true,
  imports: [
    NgIcon,
    ApplicationGroupRowComponent,
    ProjectFormComponent,
    DeleteConfirmationDialogComponent,
  ],
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideFolders,
      lucidePencil,
      lucidePlus,
      lucideRefreshCw,
      lucideSearch,
      lucideSettings2,
      lucideTrash2,
    }),
  ],
  template: `
    <div class="space-y-6 p-6">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground shrink-0">
            <ng-icon name="lucideFolders" class="h-5 w-5" />
          </div>
          <div>
            <h1 class="text-2xl font-bold text-foreground">Projects</h1>
            <p class="mt-0.5 text-sm text-muted-foreground">
              Every workload grouped by project, across kinds and clusters.
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            (click)="refresh()"
            [disabled]="isLoading()"
            class="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
          >
            <ng-icon name="lucideRefreshCw" class="h-4 w-4" [class.animate-spin]="isLoading()" />
            Refresh
          </button>
          @if (canManage()) {
            <button
              (click)="toggleCreate()"
              class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <ng-icon name="lucidePlus" class="h-4 w-4" />
              New project
            </button>
          }
        </div>
      </div>

      @if (showCreate()) {
        <div class="rounded-lg border border-border bg-card p-4">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold text-foreground">New project</h2>
            <a
              href="/management/projects"
              class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ng-icon name="lucideSettings2" class="h-3.5 w-3.5" />
              Manage all projects
            </a>
          </div>
          <app-project-form
            submitLabel="Create project"
            (saved)="onCreate($event)"
            (cancelled)="showCreate.set(false)"
          />
        </div>
      }

      <div class="flex flex-col gap-3 md:flex-row md:items-center">
        <div class="relative flex-1">
          <ng-icon
            name="lucideSearch"
            class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            [value]="search()"
            (input)="search.set(inputValue($event))"
            placeholder="Search workloads..."
            class="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select [class]="selectClass" [value]="kindFilter()" (change)="kindFilter.set(inputValue($event))">
          <option value="">All kinds</option>
          @for (k of selectableKinds; track k) {
            <option [value]="k">{{ kindLabel(k) }}</option>
          }
        </select>
        <label class="inline-flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
          <input
            type="checkbox"
            [checked]="includeSystem()"
            (change)="includeSystem.set(checkedValue($event))"
            class="h-4 w-4 rounded border-border"
          />
          Include system
        </label>
        <label class="inline-flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
          <input
            type="checkbox"
            [checked]="hideEmpty()"
            (change)="hideEmpty.set(checkedValue($event))"
            class="h-4 w-4 rounded border-border"
          />
          Hide empty projects
        </label>
      </div>

      @if (sections().length === 0) {
        <div class="rounded-lg border border-dashed border-border p-10 text-center">
          <p class="text-sm text-muted-foreground">No projects yet.</p>
          @if (canManage()) {
            <button
              (click)="toggleCreate()"
              class="mt-3 text-sm text-primary hover:underline"
            >
              Create your first project
            </button>
          }
        </div>
      }

      <div class="space-y-4">
        @for (section of sections(); track section.project?.id ?? '__unassigned') {
          @let project = section.project;
          @let key = project?.id ?? '__unassigned';
          <div
            class="overflow-hidden rounded-lg border border-border bg-card"
            [style.borderLeftWidth.px]="4"
            [style.borderLeftColor]="project?.color || 'transparent'"
          >
            <div class="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                (click)="toggle(key)"
                class="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <ng-icon
                  [name]="isCollapsed(key) ? 'lucideChevronRight' : 'lucideChevronDown'"
                  class="h-4 w-4 shrink-0 text-muted-foreground"
                />
                @if (project) {
                  <span
                    class="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                    [style.background]="project.color || 'transparent'"
                  ></span>
                }
                <span class="truncate text-sm font-semibold text-foreground">
                  {{ project?.name ?? 'Unassigned' }}
                </span>
                @if (project) {
                  <span class="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {{ project.slug }}
                  </span>
                }
                <span class="truncate text-xs text-muted-foreground">
                  {{ summary(section) }}
                </span>
              </button>

              @if (project && canManage()) {
                <button
                  type="button"
                  (click)="startEdit(project)"
                  class="shrink-0 text-muted-foreground hover:text-foreground"
                  title="Edit project"
                >
                  <ng-icon name="lucidePencil" class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  (click)="askDeleteProject(project)"
                  class="shrink-0 text-muted-foreground hover:text-destructive"
                  title="Delete project"
                >
                  <ng-icon name="lucideTrash2" class="h-4 w-4" />
                </button>
              }
            </div>

            @if (editingId() === project?.id && project) {
              <div class="border-t border-border bg-muted/30 px-4 py-4">
                <app-project-form
                  [project]="project"
                  [withDescription]="true"
                  [busy]="busyProjectId() === project.id"
                  submitLabel="Save changes"
                  (saved)="onUpdate(project.id, $event)"
                  (cancelled)="editingId.set(null)"
                />
              </div>
            }

            @if (!isCollapsed(key)) {
              <div class="space-y-2 border-t border-border p-3">
                @for (group of section.groups; track group.id) {
                  <div class="flex items-center gap-2">
                    <div class="min-w-0 flex-1">
                      <app-application-group-row
                        [group]="group"
                        [refreshing]="isRefreshing()"
                        [showProject]="false"
                        (open)="openRecap($event)"
                        (delete)="askDeleteApp($event)"
                      />
                    </div>
                    @if (canManage()) {
                      <select
                        [class]="selectClass + ' shrink-0'"
                        [disabled]="movingGroupId() === group.id"
                        (change)="onMove(group, $event)"
                      >
                        <option value="">Move to…</option>
                        @if (group.projectId) {
                          <option value="__none">No project</option>
                        }
                        @for (p of projects(); track p.id) {
                          @if (p.id !== group.projectId) {
                            <option [value]="p.id">{{ p.name }}</option>
                          }
                        }
                      </select>
                    }
                  </div>
                } @empty {
                  <p class="px-2 py-4 text-center text-sm text-muted-foreground">
                    No workloads here.
                  </p>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>

    <app-delete-confirmation-dialog
      #projectDeleteDialog
      (confirmed)="confirmDeleteProject()"
      (cancelled)="pendingProjectDelete.set(null)"
    />
    <app-delete-confirmation-dialog
      #appDeleteDialog
      (confirmed)="confirmDeleteApp()"
      (cancelled)="pendingAppDelete.set(null)"
    />
  `,
})
export class ProjectWorkloadsComponent implements OnInit {
  private readonly appService = inject(ApplicationService);
  private readonly projectsService = inject(ProjectsService);
  private readonly perms = inject(PermissionService);
  private readonly router = inject(Router);

  private readonly projectDeleteDialog = viewChild.required<DeleteConfirmationDialogComponent>(
    'projectDeleteDialog',
  );
  private readonly appDeleteDialog = viewChild.required<DeleteConfirmationDialogComponent>(
    'appDeleteDialog',
  );

  protected readonly selectClass = SELECT;
  protected readonly selectableKinds: ApplicationKind[] = [
    ApplicationKindEnum.Application,
    ApplicationKindEnum.Database,
    ApplicationKindEnum.Tool,
  ];

  protected readonly projects = this.projectsService.projects;
  protected readonly isLoading = this.appService.loading;
  protected readonly isRefreshing = this.appService.backgroundRefreshing;

  protected readonly canManage = computed(() => this.perms.isAdmin());

  protected readonly search = signal('');
  protected readonly kindFilter = signal('');
  protected readonly includeSystem = signal(false);
  protected readonly hideEmpty = signal(false);
  protected readonly showCreate = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly busyProjectId = signal<string | null>(null);
  protected readonly movingGroupId = signal<string | null>(null);
  protected readonly pendingProjectDelete = signal<Project | null>(null);
  protected readonly pendingAppDelete = signal<Application | null>(null);

  private readonly collapsed = signal<ReadonlySet<string>>(new Set());

  private readonly matchingGroups = computed(() => {
    const term = this.search().trim().toLowerCase();
    const kind = this.kindFilter();
    const withSystem = this.includeSystem();
    return this.appService.applicationGroups().filter((g) => {
      const groupKind = getGroupKind(g);
      if (!withSystem && groupKind === ApplicationKindEnum.System) return false;
      if (kind && groupKind !== kind) return false;
      if (term && !this.matchesTerm(g, term)) return false;
      return true;
    });
  });

  protected readonly sections = computed<ProjectSection[]>(() => {
    const byProject = new Map<string, AppGroupView[]>();
    const unassigned: AppGroupView[] = [];
    for (const group of this.matchingGroups()) {
      if (group.projectId) {
        const bucket = byProject.get(group.projectId) ?? [];
        bucket.push(group);
        byProject.set(group.projectId, bucket);
      } else {
        unassigned.push(group);
      }
    }

    const sections: ProjectSection[] = [];
    for (const project of this.projects()) {
      const groups = byProject.get(project.id) ?? [];
      if (this.hideEmpty() && groups.length === 0) continue;
      sections.push({ project, groups, counts: this.countByKind(groups) });
    }
    if (unassigned.length > 0) {
      sections.push({
        project: null,
        groups: unassigned,
        counts: this.countByKind(unassigned),
      });
    }
    return sections;
  });

  ngOnInit(): void {
    this.perms.load();
    this.projectsService.loadProjects();
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

  protected summary(section: ProjectSection): string {
    if (section.groups.length === 0) return 'No workloads';
    return section.counts
      .map(({ kind, count }) => `${count} ${getKindLabel(kind).toLowerCase()}`)
      .join(' · ');
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
    this.editingId.set(null);
    this.showCreate.update((v) => !v);
  }

  protected startEdit(project: Project): void {
    this.showCreate.set(false);
    this.editingId.update((id) => (id === project.id ? null : project.id));
  }

  protected openRecap(groupId: string): void {
    void this.router.navigate(['/apps/recap', groupId], {
      queryParams: { from: 'projects' },
    });
  }

  protected onCreate(value: ProjectFormValue): void {
    this.projectsService.create(value);
    this.showCreate.set(false);
  }

  protected onUpdate(projectId: string, value: ProjectFormValue): void {
    this.busyProjectId.set(projectId);
    this.projectsService.update(
      projectId,
      {
        name: value.name,
        description: value.description ?? null,
        color: value.color ?? null,
      },
      () => {
        this.busyProjectId.set(null);
        this.editingId.set(null);
      },
    );
  }

  protected onMove(group: AppGroupView, e: Event): void {
    const select = e.target as HTMLSelectElement;
    const choice = select.value;
    select.value = '';
    if (!choice) return;

    const target = choice === '__none' ? null : choice;
    const appIds = group.components.map((c) => c.id);
    const previous = group.projectId ?? null;
    if (target === previous) return;

    this.movingGroupId.set(group.id);
    this.appService.patchApplicationProject(appIds, target);

    let pending = appIds.length;
    const settled = (): void => {
      if (--pending === 0) this.movingGroupId.set(null);
    };
    for (const appId of appIds) {
      if (target) {
        this.projectsService.assignApp(target, appId, settled);
      } else if (previous) {
        this.projectsService.unassignApp(previous, appId, settled);
      } else {
        settled();
      }
    }
  }

  protected askDeleteProject(project: Project): void {
    this.pendingProjectDelete.set(project);
    this.projectDeleteDialog().open({
      title: 'Delete project',
      description:
        'The project is removed, but its workloads keep running and become unassigned.',
      itemName: project.name,
      itemDescription: project.slug,
      confirmButtonText: 'Delete project',
    });
  }

  protected confirmDeleteProject(): void {
    const project = this.pendingProjectDelete();
    if (project) this.projectsService.remove(project.id);
    this.pendingProjectDelete.set(null);
    this.projectDeleteDialog().close();
  }

  protected askDeleteApp(app: Application): void {
    if (app.systemProtected) return;
    this.pendingAppDelete.set(app);
    this.appDeleteDialog().open({
      title: 'Delete workload',
      description: 'This permanently removes the workload and its resources.',
      itemName: app.name,
      itemDescription: app.slug,
      warningMessage: 'This action cannot be undone.',
    });
  }

  protected confirmDeleteApp(): void {
    const app = this.pendingAppDelete();
    if (app) void this.appService.deleteApplication(app.id);
    this.pendingAppDelete.set(null);
    this.appDeleteDialog().close();
  }

  private matchesTerm(group: AppGroupView, term: string): boolean {
    if (group.name.toLowerCase().includes(term)) return true;
    return group.components.some(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.slug?.toLowerCase().includes(term) ?? false),
    );
  }

  private countByKind(groups: AppGroupView[]): ProjectSection['counts'] {
    const counts = new Map<ApplicationKind, number>();
    for (const group of groups) {
      const kind = getGroupKind(group);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    return [...counts.entries()].map(([kind, count]) => ({ kind, count }));
  }
}
