import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { InstanceWithLabels } from '../../model/instance.models';

const ACTIONS: readonly MenuAction[] = [{ id: 'details', label: 'View details' }];

@Component({
  selector: 'app-instance-actions',
  imports: [FlActionsMenu],
  host: { class: 'inline-flex' },
  template: `
    @if (isManaged()) {
      <fl-actions-menu
        label="Instance actions"
        [compact]="true"
        [items]="actions"
        (action)="onViewDetails()"
      />
    }
  `,
})
export class InstanceActionsComponent {
  private readonly router = inject(Router);

  readonly instance = input.required<InstanceWithLabels>();
  readonly isManaged = input.required<boolean>();

  protected readonly actions = ACTIONS;

  onViewDetails() {
    this.router.navigate([
      '/infrastructure/compute',
      this.instance().provider,
      this.instance().providerId,
    ]);
  }
}
