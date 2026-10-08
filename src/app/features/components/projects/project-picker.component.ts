import { Component, computed, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import { ProjectsService } from '../../service/projects.service';
import { Project } from '../../model/project.model';

/**
 * Where a new application will live. Hidden when there is nothing to choose:
 * a person with no shared project gets their personal one without being asked.
 */
export function selectableProjects(projects: Project[]): Project[] {
  return projects.filter((p) => !p.ownerUserId);
}

@Component({
  selector: 'app-project-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (choices().length > 0) {
      <label class="block space-y-1.5" data-testid="project-picker">
        <span class="text-sm font-medium">Project</span>
        <select
          class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          (change)="pick($event)"
        >
          <option value="" [selected]="!value()">Personal</option>
          @for (p of choices(); track p.id) {
            <option [value]="p.id" [selected]="value() === p.id">{{ p.name }}</option>
          }
        </select>
        <span class="block text-xs text-muted-foreground">
          The app runs with the other apps of its project and stays there.
        </span>
      </label>
    }
  `,
})
export class ProjectPickerComponent {
  private readonly projects = inject(ProjectsService);

  readonly value = input<string | null>(null);
  readonly valueChange = output<string | null>();

  protected readonly choices = computed(() =>
    selectableProjects(this.projects.projects()),
  );

  constructor() {
    this.projects.loadProjects();
  }

  protected pick(e: Event): void {
    const id = (e.target as HTMLSelectElement).value;
    this.valueChange.emit(id || null);
  }
}
