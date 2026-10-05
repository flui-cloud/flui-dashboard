import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight } from '@ng-icons/lucide';
import type { AppMetricsDto } from '../../../core/api/model/appMetricsDto';
import { TONE_DOT, TONE_TEXT } from './app-recap-view';
import { formatCores, formatUsageBytes, limitPercent, loadTone, runStateOf } from './app-overview-view';

@Component({
  selector: 'app-overview-status-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ lucideArrowRight })],
  host: { class: 'block' },
  template: `
    @let s = state();
    <a
      [routerLink]="['../monitoring']"
      class="card-surface flex items-center gap-4 overflow-hidden px-4 py-2.5 text-sm transition-colors hover:border-primary/30 sm:gap-6"
      data-testid="overview-status"
    >
      <span class="flex shrink-0 items-center gap-1.5 font-semibold" [class]="text[s.tone]">
        <span class="h-2 w-2 rounded-full" [class]="dot[s.tone]"></span>
        {{ s.label }}
      </span>
      @for (bar of bars(); track bar.key) {
        <span class="hidden items-center gap-2 sm:flex">
          <span class="text-label">{{ bar.key }}</span>
          <span class="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <span class="block h-full rounded-full transition-all" [class]="dot[bar.tone]" [style.width.%]="bar.percent"></span>
          </span>
          <span class="font-medium tabular-nums" [class]="text[bar.tone]">{{ bar.percent.toFixed(0) }}%</span>
        </span>
      }
      <span class="hidden truncate text-xs text-muted-foreground lg:inline">{{ usage() }}</span>
      <span class="ml-auto flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
        <span class="hidden sm:inline">Monitoring</span>
        <ng-icon name="lucideArrowRight" class="h-3 w-3" />
      </span>
    </a>
  `,
})
export class AppOverviewStatusStripComponent {
  readonly metrics = input.required<AppMetricsDto>();
  readonly appStatus = input<string | null | undefined>(null);

  protected readonly text = TONE_TEXT;
  protected readonly dot = TONE_DOT;

  protected readonly state = computed(() => runStateOf(this.metrics(), this.appStatus()));

  protected readonly bars = computed(() => {
    const m = this.metrics();
    const cpu = limitPercent(m.cpu.usage_cores, m.cpu.limits_cores);
    const mem = limitPercent(m.memory.usage_bytes, m.memory.limits_bytes);
    return [
      { key: 'CPU', percent: cpu, tone: loadTone(cpu, 70, 90) },
      { key: 'Memory', percent: mem, tone: loadTone(mem, 75, 90) },
    ];
  });

  protected readonly usage = computed(() => {
    const m = this.metrics();
    return `${formatCores(m.cpu.usage_cores ?? 0)} · ${formatUsageBytes(m.memory.usage_bytes ?? 0)}`;
  });
}
