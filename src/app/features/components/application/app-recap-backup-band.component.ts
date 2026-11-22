import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { Tone, statusToneOf } from '../dashboard/home-state';
import { BackupBand, RunState, routeOf, runBusy, runLabel } from './app-recap-view';

@Component({
  selector: 'app-recap-backup-band',
  imports: [RouterLink, FlStatus, FlKeyValue, FlKvItem, FlButton],
  host: { class: 'block' },
  template: `
    @let b = band();
    <div class="flex flex-col gap-3" data-testid="recap-backup">
      @if (b) {
        <fl-status [tone]="tone(b.tone)" [label]="b.label" />
        @if (b.policy || b.last || b.next || b.kept) {
          <fl-key-value class="fl-kv--compact">
            @if (b.policy) {
              <fl-kv-item key="Policy">{{ b.policy }}</fl-kv-item>
            }
            @if (b.last) {
              <fl-kv-item key="Last backup">{{ b.last }}</fl-kv-item>
            }
            @if (b.next) {
              <fl-kv-item key="Next">{{ b.next }}</fl-kv-item>
            }
            @if (b.kept) {
              <fl-kv-item key="Kept">{{ b.kept }}</fl-kv-item>
            }
          </fl-key-value>
        }
        @if (b.detail) {
          <p class="text-fl-body-sm text-fl-ink-muted">{{ b.detail }}</p>
        }
        <div class="fl-row">
          @if (b.protectPath) {
            <a
              flButton
              size="sm"
              [routerLink]="route(b.protectPath).path"
              [queryParams]="route(b.protectPath).query"
              >Protect</a
            >
          } @else if (b.runPolicyId) {
            <button
              flButton
              size="sm"
              type="button"
              [disabled]="busy(runState()[b.runPolicyId])"
              data-testid="recap-backup-now"
              (click)="backUp.emit(b.runPolicyId)"
            >
              {{ label(runState()[b.runPolicyId]) }}
            </button>
          }
          @if (b.holdsData) {
            <a
              flButton
              size="sm"
              [routerLink]="['/apps/applications', appId(), 'snapshots']"
              [queryParams]="recapPath() ? { returnTo: recapPath() } : {}"
              >Restore</a
            >
          }
        </div>
      } @else {
        <span class="text-fl-body-sm text-fl-ink-muted">{{
          protectionLoaded() ? 'Backup state unavailable' : 'Reading the backup state…'
        }}</span>
      }
    </div>
  `,
})
export class AppRecapBackupBandComponent {
  readonly band = input.required<BackupBand | null>();
  readonly protectionLoaded = input.required<boolean>();
  readonly runState = input.required<Record<string, RunState>>();
  readonly appId = input.required<string>();
  readonly recapPath = input.required<string>();
  readonly backUp = output<string>();

  protected tone(tone: Tone): StatusTone {
    return statusToneOf(tone);
  }
  protected readonly route = routeOf;
  protected readonly busy = runBusy;
  protected readonly label = runLabel;
}
