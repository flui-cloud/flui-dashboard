import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldAlert, lucideShieldCheck } from '@ng-icons/lucide';
import { ComponentCard, ComponentTrend } from './app-recap-bundle';
import { SparkLineComponent } from '../../../shared/components/charts';
import { accessOf } from '../../model/app-access';
import { AppAvailability } from '../../service/fleet.service';
import {
  RunState,
  TONE_DOT,
  availabilityFact,
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
  imports: [RouterLink, NgIcon, DecimalPipe, SparkLineComponent],
  providers: [provideIcons({ lucideShieldAlert, lucideShieldCheck })],
  host: { class: 'block' },
  template: `
    @let c = card();
    <div class="card-surface flex h-full flex-col gap-3 p-4" [attr.data-testid]="'recap-component-' + c.app.id">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <a
            [routerLink]="['/apps/applications', c.app.id]"
            [queryParams]="recapPath() ? { returnTo: recapPath() } : {}"
            class="block truncate text-[15px] font-semibold text-foreground hover:text-primary hover:underline"
            [title]="'Manage ' + c.role"
            >{{ c.role }}</a
          >
          <p class="truncate text-xs text-muted-foreground">{{ c.badge }}</p>
        </div>
        <span class="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium" [class]="text[c.status.tone]">
          <span class="h-1.5 w-1.5 rounded-full" [class]="dot[c.status.tone]"></span>
          {{ c.status.label }}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-3">
        @for (b of c.bars.slice(0, 2); track b.key) {
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="text-label">{{ b.key === 'MEM' ? 'Memory' : b.key }}</span>
            <span class="text-lg font-semibold tabular-nums text-foreground">{{ b.percent === null ? '—' : (b.percent | number: '1.0-1') + '%' }}</span>
            <app-spark-line [values]="trendOf(b.key)" [color]="b.color" [width]="120" [height]="22" [ariaLabel]="b.key + ' trend'" />
          </div>
        }
      </div>
      @if (c.bars[2]; as disk) {
        <div class="flex items-center gap-2 text-[11px]">
          <span class="w-9 font-semibold text-muted-foreground">DISK</span>
          <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full" [style.background]="disk.color" [style.width.%]="barWidth(disk.percent)"></div>
          </div>
          <span class="w-9 text-right tabular-nums text-foreground">{{ disk.percent === null ? '—' : (disk.percent | number: '1.0-0') + '%' }}</span>
        </div>
      }
      <div class="mt-auto flex flex-col gap-1 border-t border-border pt-2.5 text-xs text-muted-foreground">
        <span class="truncate" [class.font-mono]="!!address()" [title]="address() || c.meta">{{ address() || c.meta }}</span>
        @if (availability(); as a) {
          @let f = availabilityFact(a);
          <span class="truncate" [title]="f.sub" data-testid="recap-component-availability">
            {{ f.key }}: <span class="font-medium" [class]="text[f.tone]">{{ f.value }}</span>
          </span>
        }
      </div>
      @if (!readOnly()) {
      <div class="flex flex-wrap items-center gap-2 text-xs">
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
      }
    </div>
  `,
})
export class AppRecapComponentCardComponent {
  readonly card = input.required<ComponentCard>();
  readonly recapPath = input('');
  readonly protectionLoaded = input.required<boolean>();
  readonly availability = input<AppAvailability | null>(null);
  readonly runState = input.required<Record<string, RunState>>();
  readonly trend = input<ComponentTrend | null>(null);
  /** The public address, on the component that answers at it. */
  readonly address = input('');
  readonly backUp = output<string>();

  /** A reader is shown no backup posture: it is not theirs to act on. */
  protected readonly readOnly = computed(() => !!accessOf(this.card().app)?.readOnly);
  protected readonly text = TONE_TEXT;
  protected readonly dot = TONE_DOT;
  protected readonly pill = TONE_PILL;
  protected readonly route = routeOf;
  protected readonly busy = runBusy;
  protected readonly label = runLabel;
  protected readonly barWidth = barWidth;
  protected readonly backupDetail = componentBackupDetail;
  protected readonly availabilityFact = availabilityFact;

  protected trendOf(key: string): number[] {
    const trend = this.trend();
    if (!trend) return [];
    return key === 'CPU' ? trend.cpu : trend.memory;
  }
}
