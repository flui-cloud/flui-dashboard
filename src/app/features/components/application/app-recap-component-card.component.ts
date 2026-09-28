import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldAlert, lucideShieldCheck } from '@ng-icons/lucide';
import { ComponentCard } from './app-recap-bundle';
import {
  RunState,
  TONE_DOT,
  TONE_PILL,
  TONE_TEXT,
  barWidth,
  componentBackupDetail,
  routeOf,
  runBusy,
  runLabel,
} from './app-recap-view';

@Component({
  selector: 'app-recap-component-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIcon, DecimalPipe],
  providers: [provideIcons({ lucideShieldAlert, lucideShieldCheck })],
  host: { class: 'block' },
  template: `
    @let c = card();
    <div class="space-y-2.5 rounded-lg border border-border p-4" [attr.data-testid]="'recap-component-' + c.app.id">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-foreground">{{ c.role }}</p>
          <p class="text-xs text-muted-foreground">{{ c.badge }}</p>
        </div>
        <span class="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium" [class]="text[c.status.tone]">
          <span class="h-1.5 w-1.5 rounded-full" [class]="dot[c.status.tone]"></span>
          {{ c.status.label }}
        </span>
      </div>
      <p class="text-xs text-muted-foreground">{{ c.meta }}</p>
      @for (b of c.bars; track b.key) {
        <div class="flex items-center gap-2 text-[11px]">
          <span class="w-9 font-semibold text-muted-foreground">{{ b.key }}</span>
          <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full" [style.background]="b.color" [style.width.%]="barWidth(b.percent)"></div>
          </div>
          <span class="w-9 text-right tabular-nums text-foreground">{{ b.percent === null ? '—' : (b.percent | number: '1.0-0') + '%' }}</span>
        </div>
      }
      <div class="flex flex-wrap items-center gap-2 border-t border-border pt-2.5 text-xs">
        @if (c.backup; as band) {
          <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold" [class]="pill[band.tone]">
            <ng-icon [name]="band.tone === 'ok' ? 'lucideShieldCheck' : 'lucideShieldAlert'" class="h-3 w-3" />
            {{ band.label }}
          </span>
          <span class="min-w-0 flex-1 truncate text-muted-foreground">{{ backupDetail(band) }}</span>
          @if (band.protectPath) {
            <a [routerLink]="route(band.protectPath).path" [queryParams]="route(band.protectPath).query" class="font-semibold text-primary hover:underline">Protect</a>
          } @else if (band.runPolicyId && band.holdsData) {
            <button
              type="button"
              (click)="backUp.emit(band.runPolicyId)"
              [disabled]="busy(runState()[band.runPolicyId])"
              class="font-semibold text-primary hover:underline disabled:opacity-60 disabled:no-underline"
            >{{ label(runState()[band.runPolicyId]) }}</button>
          }
        } @else {
          <span class="text-muted-foreground">{{ protectionLoaded() ? 'Backup state unavailable' : 'Reading the backup state…' }}</span>
        }
      </div>
    </div>
  `,
})
export class AppRecapComponentCardComponent {
  readonly card = input.required<ComponentCard>();
  readonly protectionLoaded = input.required<boolean>();
  readonly runState = input.required<Record<string, RunState>>();
  readonly backUp = output<string>();

  protected readonly text = TONE_TEXT;
  protected readonly dot = TONE_DOT;
  protected readonly pill = TONE_PILL;
  protected readonly route = routeOf;
  protected readonly busy = runBusy;
  protected readonly label = runLabel;
  protected readonly barWidth = barWidth;
  protected readonly backupDetail = componentBackupDetail;
}
