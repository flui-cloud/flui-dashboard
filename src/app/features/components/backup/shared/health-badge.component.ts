import { Component, computed, input } from '@angular/core';

import { FlStatus } from '../../../../ui/primitives/status';
import { backupHealthBadge } from '../../../model/backup-badges';
import { BackupHealthState } from '../../../model/backup-run.models';
import { backupHealthTone } from './backup-tones';

@Component({
  selector: 'app-backup-health-badge',
  imports: [FlStatus],
  host: {
    class: 'inline-flex',
    '[attr.title]': 'detail() || null',
    '[attr.data-state]': 'state()',
  },
  template: `
    <span class="fl-sr">Backup health: </span>
    <fl-status [tone]="tone()" [label]="style().label" />
    @if (detail()) {
      <span class="fl-sr">. {{ detail() }}</span>
    }
  `,
})
export class BackupHealthBadgeComponent {
  readonly state = input.required<BackupHealthState>();
  readonly detail = input<string | null>(null);

  readonly style = computed(() => backupHealthBadge(this.state()));
  protected readonly tone = computed(() => backupHealthTone(this.state()));
}
