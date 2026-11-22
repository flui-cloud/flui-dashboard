import { Component, input, output } from '@angular/core';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { runText, runTone, shortStamp } from './backup-protection-state';
import { describeCron } from './cron-text';

export interface ProtectionPolicy {
  policyId: string;
  name: string;
  engineClass: string;
  engine?: string | null;
  schedule: string | null;
  enabled: boolean;
  status: string;
  destination: { id: string; name: string; provider: string } | null;
  lastRun: { status: string; at: string | null; error: string | null } | null;
  nextRunAt: string | null;
}

function kindLabel(engineClass: string, engine?: string | null): string {
  if (engineClass === 'database') {
    return engine?.endsWith('-dump') ? 'Scheduled dumps' : 'Continuous backup';
  }
  if (engineClass === 'volume_copy') return 'Volume copies to backup storage';
  return 'Backup';
}

@Component({
  selector: 'app-backup-policy-facts',
  imports: [FlKeyValue, FlKvItem, FlAlert, FlStatus, FlButton],
  host: { class: 'flex flex-col gap-3' },
  template: `
    @let pol = policy();
    <fl-key-value class="fl-kv--compact">
      <fl-kv-item key="Policy">{{ kind(pol.engineClass, pol.engine) }}</fl-kv-item>
      <fl-kv-item key="Schedule">
        @if (!pol.enabled) {
          <fl-status tone="warning" label="Stopped" />
        } @else if (pol.schedule) {
          <span [title]="pol.schedule">{{ describe(pol.schedule) }}</span>
        } @else {
          On
        }
      </fl-kv-item>
      <fl-kv-item key="Destination">{{ pol.destination?.name ?? 'Unknown' }}</fl-kv-item>
      <fl-kv-item key="Last run">
        @if (pol.lastRun; as r) {
          <span class="flex flex-col gap-0.5">
            <fl-status [tone]="tone(r.status)" [label]="text(r.status)" />
            @if (r.at) {
              <span class="text-fl-caption text-fl-ink-muted">{{ stamp(r.at) }}</span>
            }
          </span>
        } @else {
          No run yet
        }
      </fl-kv-item>
      <fl-kv-item key="Next run">{{ stamp(pol.nextRunAt) }}</fl-kv-item>
    </fl-key-value>
    @if (pol.lastRun?.error) {
      <fl-alert tone="error" title="Last run failed">{{ pol.lastRun?.error }}</fl-alert>
    }
    @if (backUpOffered()) {
      <div class="fl-row">
        <button flButton size="sm" type="button" [disabled]="busy()" (click)="backUp.emit(pol)">
          Back up to {{ pol.destination?.name }}
        </button>
      </div>
    }
  `,
})
export class BackupPolicyFacts {
  readonly policy = input.required<ProtectionPolicy>();
  readonly backUpOffered = input(false);
  readonly busy = input(false);
  readonly backUp = output<ProtectionPolicy>();

  protected readonly kind = kindLabel;
  protected readonly describe = describeCron;
  protected readonly tone = runTone;
  protected readonly text = runText;
  protected readonly stamp = shortStamp;
}
