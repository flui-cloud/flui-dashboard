import { Component, input } from '@angular/core';
import { Project } from '../../model/project.model';
import { FlTag } from '../../../ui/primitives/tag';

@Component({
  selector: 'app-project-badge',
  imports: [FlTag],
  host: { class: 'inline-flex' },
  template: `
    @let p = project();
    @if (p) {
      <fl-tag [attr.title]="'Project ' + p.name">{{ p.name }}</fl-tag>
    } @else {
      <span class="text-fl-caption text-fl-ink-muted">Not in a project</span>
    }
  `,
})
export class ProjectBadgeComponent {
  readonly project = input<Project | null>(null);
}
