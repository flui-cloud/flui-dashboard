import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Application } from '../../model/application.models';
import { Tone } from '../dashboard/home-state';
import { AppRecapBackupBandComponent } from './app-recap-backup-band.component';
import { BackupBand, RecapFact, RunState, TONE_DOT, TONE_PILL, TONE_TEXT } from './app-recap-view';

@Component({
  selector: 'app-recap-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppRecapBackupBandComponent],
  host: { class: 'block' },
  template: `
    @let p = app();
    @let h = health();
    <section class="card-surface space-y-5 p-6" data-testid="recap-summary">
      @if (endpointHost()) {
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-label">{{ p.exposure === 'public' ? 'Public endpoint' : 'Endpoint' }}</p>
            <a
              [href]="openUrl()"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-0.5 block truncate font-mono text-base font-medium text-primary hover:underline"
              data-testid="recap-endpoint"
            >{{ endpointHost() }}</a>
          </div>
          @if (h.label) {
            <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" [class]="pill[h.tone]" data-testid="recap-endpoint-health">
              <span class="h-1.5 w-1.5 rounded-full" [class]="dot[h.tone]"></span>
              {{ h.label }}
            </span>
          }
        </div>
      } @else {
        <p class="text-sm text-muted-foreground">Not published outside the cluster.</p>
      }

      <div class="grid gap-4 border-t border-border pt-5 sm:grid-cols-3" data-testid="recap-facts">
        @for (f of facts(); track f.key) {
          <div class="min-w-0">
            <p class="text-label">{{ f.key }}</p>
            <p class="mt-1 truncate text-base font-semibold" [class]="text[f.tone]" [title]="f.value">{{ f.value }}</p>
            <p class="truncate text-xs text-muted-foreground">{{ f.sub }}</p>
          </div>
        }
      </div>

      <app-recap-backup-band
        [band]="band()"
        [protectionLoaded]="protectionLoaded()"
        [runState]="runState()"
        [appId]="p.id"
        [recapPath]="recapPath()"
        (backUp)="backUp.emit($event)"
      />
    </section>
  `,
})
export class AppRecapSummaryComponent {
  readonly app = input.required<Application>();
  readonly endpointHost = input('');
  readonly openUrl = input('');
  readonly health = input.required<{ label: string; tone: Tone }>();
  readonly facts = input.required<RecapFact[]>();
  readonly band = input.required<BackupBand | null>();
  readonly protectionLoaded = input.required<boolean>();
  readonly runState = input.required<Record<string, RunState>>();
  readonly recapPath = input.required<string>();
  readonly backUp = output<string>();

  protected readonly text = TONE_TEXT;
  protected readonly dot = TONE_DOT;
  protected readonly pill = TONE_PILL;
}
