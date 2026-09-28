import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldAlert, lucideShieldCheck } from '@ng-icons/lucide';
import { BackupBand, RunState, TONE_TEXT, routeOf, runBusy, runLabel } from './app-recap-view';

@Component({
  selector: 'app-recap-backup-band',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ lucideShieldAlert, lucideShieldCheck })],
  host: { class: 'block' },
  template: `
    @let b = band();
    <div class="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg bg-muted/40 px-4 py-3" data-testid="recap-backup">
      @if (b) {
        <span class="inline-flex items-center gap-1.5 text-sm font-semibold" [class]="text[b.tone]">
          <ng-icon [name]="b.tone === 'ok' ? 'lucideShieldCheck' : 'lucideShieldAlert'" class="h-4 w-4" />
          {{ b.label }}
        </span>
        <div class="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1 text-xs text-foreground">
          @if (b.policy) {
            <span><span class="text-muted-foreground">Policy</span> {{ b.policy }}</span>
          }
          @if (b.last) {
            <span><span class="text-muted-foreground">Last</span> {{ b.last }}</span>
          }
          @if (b.next) {
            <span><span class="text-muted-foreground">Next</span> {{ b.next }}</span>
          }
          @if (b.kept) {
            <span><span class="text-muted-foreground">Kept</span> {{ b.kept }}</span>
          }
          @if (b.detail) {
            <span class="text-muted-foreground">{{ b.detail }}</span>
          }
        </div>
        <div class="flex items-center gap-2">
          @if (b.protectPath) {
            <a
              [routerLink]="route(b.protectPath).path"
              [queryParams]="route(b.protectPath).query"
              class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >Protect</a>
          } @else if (b.runPolicyId) {
            <button
              type="button"
              (click)="backUp.emit(b.runPolicyId)"
              [disabled]="busy(runState()[b.runPolicyId])"
              class="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
              data-testid="recap-backup-now"
            >{{ label(runState()[b.runPolicyId]) }}</button>
          }
          @if (b.holdsData) {
            <a
              [routerLink]="['/apps/applications', appId(), 'snapshots']"
              [queryParams]="{ returnTo: recapPath() }"
              class="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >Restore</a>
          }
        </div>
      } @else {
        <span class="text-sm text-muted-foreground">{{ protectionLoaded() ? 'Backup state unavailable' : 'Reading the backup state…' }}</span>
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

  protected readonly text = TONE_TEXT;
  protected readonly route = routeOf;
  protected readonly busy = runBusy;
  protected readonly label = runLabel;
}
