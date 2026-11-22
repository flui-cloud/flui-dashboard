import { Component, computed, inject, input } from '@angular/core';
import { FlPanel } from '../../../ui/patterns/panel';
import { ProjectsService } from '../../service/projects.service';

@Component({
  selector: 'app-project-section',
  host: { class: 'block' },
  imports: [FlPanel],
  template: `
    @if (!hidden()) {
      <fl-panel [flush]="true" data-testid="overview-project">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-fl-body-sm">
          <span class="text-fl-ink-muted">Project</span>
          @if (current(); as p) {
            <span class="inline-flex min-w-0 items-center gap-2 text-fl-ink">
              @if (p.color) {
                <span
                  class="h-2 w-2 shrink-0 rounded-fl-sm"
                  [style.background-color]="p.color"
                  aria-hidden="true"
                ></span>
              }
              <span class="truncate">{{ p.name }}</span>
            </span>
          } @else {
            <span class="text-fl-ink-muted">Not in a project</span>
          }
          <span class="flex-1"></span>
          <span
            class="text-fl-caption text-fl-ink-muted"
            title="The project is where the application runs. Moving it to another project means moving its data, which is not available yet."
          >
            Set when the app was created
          </span>
        </div>
      </fl-panel>
    }
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
    return pid ? (this.projects.projects().find((p) => p.id === pid) ?? null) : null;
  });

  /** In a project the caller cannot see, as a showcase application is: say nothing rather than "Not in a project". */
  readonly hidden = computed(() => !!this.application().projectId && this.current() === null);

  constructor() {
    this.projects.loadProjects();
  }
}
