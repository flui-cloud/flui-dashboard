import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { backupHealthBadge } from '../../../model/backup-badges';
import { BackupHealthState } from '../../../model/backup-run.models';

@Component({
  selector: 'app-backup-health-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <span
      class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      [class]="style().classes"
      [attr.title]="detail() || null"
      [attr.data-state]="state()"
    >
      <span class="sr-only">Backup health: </span>{{ style().label }}@if (detail()) {<span class="sr-only">. {{ detail() }}</span>}
    </span>
  `,
})
export class BackupHealthBadgeComponent {
  readonly state = input.required<BackupHealthState>();
  readonly detail = input<string | null>(null);

  readonly style = computed(() => backupHealthBadge(this.state()));
}
