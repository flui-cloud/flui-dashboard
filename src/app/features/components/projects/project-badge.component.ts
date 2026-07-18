import { Component, input } from '@angular/core';
import { PROJECT_FALLBACK_COLOR, Project } from '../../model/project.model';

@Component({
  selector: 'app-project-badge',
  standalone: true,
  imports: [],
  host: { class: 'inline-flex' },
  template: `
    @let p = project();
    @if (p) {
      <span
        class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
        [style.borderColor]="p.color || fallback"
        [style.color]="p.color || 'inherit'"
      >
        <span class="h-2 w-2 rounded-full" [style.background]="p.color || 'currentColor'"></span>
        {{ p.name }}
      </span>
    } @else {
      <span class="text-xs text-muted-foreground">Not in a project</span>
    }
  `,
})
export class ProjectBadgeComponent {
  readonly project = input<Project | null>(null);
  protected readonly fallback = PROJECT_FALLBACK_COLOR;
}
