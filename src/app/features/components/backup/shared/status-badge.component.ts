import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ArtifactLocationState,
  BackupJobStatus,
  BackupPolicyStatus,
  BadgeStyle,
  DestinationHealthStatus,
  RestoreJobStatus,
  healthBadge,
  jobStatusBadge,
  locationStateBadge,
  policyStatusBadge,
  restoreStatusBadge,
} from '../../../model/backup.models';

type Kind = 'health' | 'policy' | 'job' | 'location' | 'restore';

@Component({
  selector: 'app-backup-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
      [class]="style().classes"
    >
      {{ style().label }}
    </span>
  `,
})
export class BackupStatusBadgeComponent {
  readonly kind = input.required<Kind>();
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
}
