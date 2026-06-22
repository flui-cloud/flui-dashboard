import { Component, computed, inject, input, signal } from '@angular/core';
import { ProjectsService } from '../../service/projects.service';
import { ApplicationService } from '../../service/application.service';
import { PermissionService } from '../../../core/services/permission.service';

@Component({
  selector: 'app-project-section',
  standalone: true,
  host: { class: 'block' },
  imports: [],
  template: `
    <div class="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">Project</span>

      @if (busy()) {
        <span class="h-5 w-28 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></span>
      } @else {
        @if (current(); as p) {
          <span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
            [style.borderColor]="p.color || '#9ca3af'"
            [style.color]="p.color || 'inherit'">
            <span class="h-2 w-2 rounded-full" [style.background]="p.color || 'currentColor'"></span>
            {{ p.name }}
          </span>
        } @else {
          <span class="text-gray-400 dark:text-gray-500">Not in a project</span>
        }
      }

      <span class="flex-1"></span>

      @if (canManage()) {
        <select [disabled]="busy()" (change)="onChange($event)"
          class="h-8 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-2 pr-7 text-xs appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          <option value="">No project</option>
          @for (p of allProjects(); track p.id) {
            <option [value]="p.id" [selected]="application().projectId === p.id">{{ p.name }}</option>
          }
        </select>
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
  readonly canManage = computed(() => this.perms.isAdmin());
  readonly busy = signal(false);

  readonly current = computed(() => {
    const pid = this.application().projectId;
    return pid ? (this.allProjects().find((p) => p.id === pid) ?? null) : null;
  });

  constructor() {
    this.projects.loadProjects();
    this.perms.load();
  }

  onChange(e: Event): void {
    const pid = (e.target as HTMLSelectElement).value;
    const app = this.application();
    if (pid === (app.projectId ?? '')) return;
    this.busy.set(true);
    const settled = (): void => {
      void this.appService
        .getApplication(app.id)
        .catch(() => undefined)
        .finally(() => this.busy.set(false));
    };
    if (pid) {
      this.projects.assignApp(pid, app.id, settled);
    } else if (app.projectId) {
      this.projects.unassignApp(app.projectId, app.id, settled);
    } else {
      this.busy.set(false);
    }
  }
}
