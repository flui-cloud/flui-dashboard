import { Component, computed, inject, input, output } from '@angular/core';
import { ProjectsService } from '../../service/projects.service';
import { Project } from '../../model/project.model';
import { FlField } from '../../../ui/patterns/field';

let nextId = 0;

/**
 * Where a new application will live. Hidden when there is nothing to choose:
 * a person with no shared project gets their personal one without being asked.
 */
export function selectableProjects(projects: Project[]): Project[] {
  return projects.filter((p) => !p.ownerUserId);
}

@Component({
  selector: 'app-project-picker',
  imports: [FlField],
  template: `
    @if (choices().length > 0) {
      <fl-field
        label="Project"
        [for]="uid"
        hint="The app runs with the other apps of its project and stays there."
        data-testid="project-picker"
      >
        <span class="fl-select-wrap">
          <select class="fl-select" [id]="uid" (change)="pick($event)">
            <option value="" [selected]="!value()">Personal</option>
            @for (p of choices(); track p.id) {
              <option [value]="p.id" [selected]="value() === p.id">{{ p.name }}</option>
            }
          </select>
        </span>
      </fl-field>
    }
  `,
})
export class ProjectPickerComponent {
  private readonly projects = inject(ProjectsService);

  readonly value = input<string | null>(null);
  readonly valueChange = output<string | null>();

  protected readonly uid = `project-picker-${nextId++}`;
  protected readonly choices = computed(() => selectableProjects(this.projects.projects()));

  constructor() {
    this.projects.loadProjects();
  }

  protected pick(e: Event): void {
    const id = (e.target as HTMLSelectElement).value;
    this.valueChange.emit(id || null);
  }
}
