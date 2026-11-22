import { Component, computed, input } from '@angular/core';

import { FlStatus } from '../../../../ui/primitives/status';
import {
  ArtifactLocationState,
  BackupJobStatus,
  BackupPolicyStatus,
  DestinationHealthStatus,
  RestoreJobStatus,
} from '../../../model/backup.models';
import {
  BadgeStyle,
  healthBadge,
  jobStatusBadge,
  locationStateBadge,
  policyStatusBadge,
  restoreStatusBadge,
} from '../../../model/backup-badges';
import { BackupBadgeKind, backupBadgeTone } from './backup-tones';

@Component({
  selector: 'app-backup-status-badge',
  imports: [FlStatus],
  host: { class: 'inline-flex' },
  template: `<fl-status [tone]="tone()" [label]="style().label" />`,
})
export class BackupStatusBadgeComponent {
  readonly kind = input.required<BackupBadgeKind>();
  readonly value = input.required<string>();

  readonly style = computed<BadgeStyle>(() => {
    switch (this.kind()) {
      case 'health':
        return healthBadge(this.value() as DestinationHealthStatus);
      case 'policy':
        return policyStatusBadge(this.value() as BackupPolicyStatus);
      case 'job':
        return jobStatusBadge(this.value() as BackupJobStatus);
      case 'location':
        return locationStateBadge(this.value() as ArtifactLocationState);
      case 'restore':
        return restoreStatusBadge(this.value() as RestoreJobStatus);
    }
  });

  protected readonly tone = computed(() => backupBadgeTone(this.kind(), this.value()));
}
