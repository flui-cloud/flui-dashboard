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
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideRefreshCw, lucideSearch } from '@ng-icons/lucide';
import { ProjectsService } from '../../service/projects.service';
import { PermissionService } from '../../../core/services/permission.service';
import { Project } from '../../model/project.model';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlTag } from '../../../ui/primitives/tag';
import { ProjectFormComponent } from './project-form.component';
import { ProjectFormDialog } from './project-form-dialog';
import {
  ProjectsSurfaceInput,
  ProjectsSurfaceRevision,
  buildProjectsSurface,
  presentedContent,
} from './projects-surface';

const EDIT: MenuAction = { id: 'edit', label: 'Edit project' };
const DELETE: MenuAction = {
  id: 'delete',
  label: 'Delete project',
  danger: true,
  separatorBefore: true,
};
const EMPTY_ACTIONS: readonly MenuAction[] = [EDIT, DELETE];
const BUSY_ACTIONS: readonly MenuAction[] = [EDIT, { ...DELETE, disabled: true }];

interface ProjectRow {
  project: Project;
  workloads: number;
  clusters: string;
  actions: readonly MenuAction[];
}

@Component({
  selector: 'app-projects',
  imports: [
    RouterLink,
    FlPageHeader,
    FlPanel,
    FlTable,
    FlEmptyState,
    FlActionsMenu,
    FlButton,
    FlIcon,
    FlTag,
    ProjectFormComponent,
  ],
  providers: [ProjectFormDialog, provideIcons({ lucidePlus, lucideRefreshCw, lucideSearch })],
  template: `
    <div class="fl-page">
      <fl-page-header [title]="'Projects (' + projects.projects().length + ')'">
        <span headerMeta
          >Where applications live. An app shares building blocks with its project and stays
          there.</span
        >
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            title="Refresh"
            (click)="projects.refresh()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
          @if (canManage()) {
            <button flButton="primary" type="button" (click)="openCreate()">
              <fl-icon name="lucidePlus" />
              Create project
            </button>
          }
        </ng-container>
      </fl-page-header>

      <fl-panel [flush]="true">
        <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
          <div class="fl-toolbar__group">
            <label class="fl-input">
              <fl-icon name="lucideSearch" [size]="14" />
              <span class="fl-sr">Search</span>
              <input
                type="search"
                placeholder="Search by name or slug"
                aria-label="Search projects"
                [value]="search()"
                (input)="search.set(value($event))"
              />
            </label>
          </div>
          <div class="fl-toolbar__group">
            <span class="fl-toolbar__info"
              >{{ rows().length }} {{ rows().length === 1 ? 'project' : 'projects' }}</span
            >
          </div>
        </div>

        @if (rows().length === 0) {
          @if (search().trim()) {
            <fl-empty-state title="No matching projects" body="Nothing matches this search.">
              <button flButton size="sm" type="button" (click)="search.set('')">
                Clear search
              </button>
            </fl-empty-state>
          } @else {
            <fl-empty-state
              title="No projects yet"
              body="Your first application creates your personal one."
            />
          }
        } @else {
          <div class="fl-table-wrap relative">
            <table flTable density="dense" data-testid="projects-table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Slug</th>
                  <th scope="col">Description</th>
                  <th scope="col" class="is-num">Workloads</th>
                  <th scope="col">Clusters</th>
                  @if (canManage()) {
                    <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.project.id) {
                  @let p = row.project;
                  <tr [attr.data-testid]="'project-row-' + p.id">
                    <td class="fl-cell-name">
                      <a
                        class="fl-link"
                        routerLink="/apps/projects"
                        [queryParams]="{ project: p.id }"
                        >{{ p.name }}</a
                      >
                      @if (p.ownerUserId) {
                        <fl-tag class="ml-2">personal</fl-tag>
                      }
                    </td>
                    <td class="fl-mono">{{ p.slug }}</td>
                    <td class="is-wrap text-fl-ink-secondary">{{ p.description || '—' }}</td>
                    <td class="is-num">{{ row.workloads }}</td>
                    <td [title]="row.clusters">
                      <span class="fl-cell-clip">{{ row.clusters || '—' }}</span>
                    </td>
                    @if (canManage()) {
                      <td class="is-fit">
                        <fl-actions-menu
                          [label]="'Actions for ' + p.name"
                          [compact]="true"
                          [items]="row.actions"
                          (action)="onAction(row, $event)"
                        />
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </fl-panel>
    </div>

    <ng-template #projectForm>
      <app-project-form
        [project]="form.editing()"
        [withDescription]="true"
        [busy]="form.busy()"
        [submitLabel]="form.submitLabel()"
        (saved)="form.save($event)"
        (cancelled)="form.close()"
      />
    </ng-template>
  `,
})
export class ProjectsComponent implements OnInit, OnDestroy {
  protected readonly projects = inject(ProjectsService);
  private readonly perms = inject(PermissionService);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly confirm = inject(ConfirmService);
  protected readonly form = inject(ProjectFormDialog);

  private readonly formTemplate = viewChild.required<TemplateRef<unknown>>('projectForm');

  readonly canManage = computed(() => this.perms.hasSection('projects'));
  readonly search = signal('');

  private readonly allRows = computed<ProjectRow[]>(() => {
    const apps = this.projects.apps();
    return this.projects.projects().map((project) => {
      const inProject = apps.filter((a) => a.project === project.slug);
      const clusters = [...new Set(inProject.map((a) => a.clusterName).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      );
      return {
        project,
        workloads: inProject.length,
        clusters: clusters.join(', '),
        actions: inProject.length === 0 ? EMPTY_ACTIONS : BUSY_ACTIONS,
      };
    });
  });

  protected readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.allRows();
    return this.allRows().filter(
      ({ project }) =>
        project.name.toLowerCase().includes(term) ||
        project.slug.toLowerCase().includes(term) ||
        (project.description?.toLowerCase().includes(term) ?? false),
    );
  });

  private readonly surfaceRevision = new ProjectsSurfaceRevision();

  readonly surface = computed(() => {
    const input: ProjectsSurfaceInput = {
      projects: this.projects.projects(),
      apps: this.projects.apps(),
    };
    const content = presentedContent(input);
    return buildProjectsSurface(input, {
      revision: this.surfaceRevision.next(content),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnInit(): void {
    this.perms.load();
    this.projects.refresh();
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  openCreate(): void {
    this.form.open(this.formTemplate());
  }

  protected onAction(row: ProjectRow, action: string): void {
    if (action === 'edit') this.form.open(this.formTemplate(), row.project);
    else if (action === 'delete' && row.workloads === 0) void this.askDelete(row.project);
  }

  async askDelete(p: Project): Promise<void> {
    const ok = await this.confirm.confirm({
      title: `Delete ${p.name}`,
      body: 'The project has no workloads and is removed. This cannot be undone.',
      confirmLabel: 'Delete project',
      destructive: true,
    });
    if (ok) this.projects.remove(p.id);
  }
}
