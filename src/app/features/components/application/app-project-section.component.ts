import { Component, computed, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { ProjectsService } from '../../service/projects.service';
import { ProjectBadgeComponent } from '../projects/project-badge.component';

@Component({
  selector: 'app-project-section',
  standalone: true,
  host: { class: 'block' },
  imports: [ProjectBadgeComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="card-surface text-sm" data-testid="overview-project">
      <div class="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <span class="text-label shrink-0">Project</span>
        <app-project-badge [project]="current()" />
        <span class="flex-1"></span>
        <span
          class="text-xs text-muted-foreground"
          title="The project is where the application runs. Moving it to another project means moving its data, which is not available yet."
        >
          Set when the app was created
        </span>
      </div>
    </div>
  `,
})
export class AppProjectSectionComponent {
  private readonly projects = inject(ProjectsService);

  readonly application = input.required<{
    id: string;
    projectId?: string | null;
  }>();

  readonly current = computed(() => {
    const pid = this.application().projectId;
    return pid
      ? (this.projects.projects().find((p) => p.id === pid) ?? null)
      : null;
  });

  constructor() {
    this.projects.loadProjects();
  }
}
