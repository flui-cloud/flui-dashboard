import { Component, computed, inject, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideX } from '@ng-icons/lucide';
import { ProjectsService } from '../../service/projects.service';
import { ApplicationService } from '../../service/application.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ProjectBadgeComponent } from '../projects/project-badge.component';
import {
  ProjectFormComponent,
  ProjectFormValue,
} from '../projects/project-form.component';

@Component({
  selector: 'app-project-section',
  standalone: true,
  host: { class: 'block' },
  imports: [NgIcon, ProjectBadgeComponent, ProjectFormComponent],
  providers: [provideIcons({ lucidePlus, lucideX })],
  template: `
    <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
      <div class="flex items-center gap-3 px-4 py-2.5">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">Project</span>

        @if (busy()) {
          <span class="h-5 w-28 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></span>
        } @else {
          <app-project-badge [project]="current()" />
        }

        <span class="flex-1"></span>

        @if (canManage()) {
          <select
            [disabled]="busy() || creating()"
            (change)="onChange($event)"
            class="h-8 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-2 pr-7 text-xs appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">No project</option>
            @for (p of allProjects(); track p.id) {
              <option [value]="p.id" [selected]="application().projectId === p.id">{{ p.name }}</option>
            }
          </select>
          <button
            type="button"
            (click)="toggleCreate()"
            [disabled]="busy()"
            class="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 px-2 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
            [title]="creating() ? 'Cancel' : 'Create a project and move this workload into it'"
          >
            <ng-icon [name]="creating() ? 'lucideX' : 'lucidePlus'" class="h-3.5 w-3.5" />
            {{ creating() ? 'Cancel' : 'New' }}
          </button>
        }
      </div>

      @if (creating() && canManage()) {
        <div class="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
          <app-project-form
            [busy]="busy()"
            submitLabel="Create and assign"
            (saved)="onCreate($event)"
            (cancelled)="creating.set(false)"
          />
        </div>
      }
    </div>
  `,
})
export class AppProjectSectionComponent {
  private readonly projects = inject(ProjectsService);
  private readonly appService = inject(ApplicationService);
  private readonly perms = inject(PermissionService);

  readonly application = input.required<{
    id: string;
    projectId?: string | null;
  }>();

  protected readonly allProjects = this.projects.projects;
  readonly canManage = computed(() => this.perms.hasSection('projects'));
  readonly busy = signal(false);
  readonly creating = signal(false);

  readonly current = computed(() => {
    const pid = this.application().projectId;
    return pid ? (this.allProjects().find((p) => p.id === pid) ?? null) : null;
  });

  constructor() {
    this.projects.loadProjects();
    this.perms.load();
  }

  toggleCreate(): void {
    this.creating.update((v) => !v);
  }

  onCreate(value: ProjectFormValue): void {
    this.busy.set(true);
    this.projects.create(value, (project) => {
      this.creating.set(false);
      this.assign(project.id);
    });
  }

  onChange(e: Event): void {
    const pid = (e.target as HTMLSelectElement).value;
    const app = this.application();
    if (pid === (app.projectId ?? '')) return;
    this.busy.set(true);
    if (pid) {
      this.assign(pid);
    } else if (app.projectId) {
      this.projects.unassignApp(app.projectId, app.id, this.settled);
    } else {
      this.busy.set(false);
    }
  }

  private assign(projectId: string): void {
    const app = this.application();
    this.appService.patchApplicationProject([app.id], projectId);
    this.projects.assignApp(projectId, app.id, this.settled);
  }

  private readonly settled = (): void => {
    void this.appService
      .getApplication(this.application().id)
      .catch(() => undefined)
      .finally(() => this.busy.set(false));
  };
}
