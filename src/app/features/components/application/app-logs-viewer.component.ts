import { Component, computed, signal, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideRefreshCw,
  lucideDownload,
  lucideX,
  lucideCalendar,
} from '@ng-icons/lucide';

import { ApplicationService } from '../../service/application.service';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import {
  ApplicationLogsService,
  ALL_LOG_LEVELS,
  LOG_TIME_RANGES,
} from '../../service/application-logs.service';
import type { LogTimeRangeValue, LogCustomRange } from '../../service/application-logs.service';
import { LogDateRangePickerComponent } from './log-date-range-picker.component';
import { LogVolumeBarsComponent } from './log-volume-bars';
import { LogTableComponent } from './log-table.component';
import type { LogVolumeRangeSelection } from '../../../shared/components/charts/chart.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

const LEVEL_MARKERS: Record<string, string> = {
  error: 'var(--fl-danger)',
  warn: 'var(--fl-warning-fill)',
  info: 'var(--fl-accent)',
  debug: 'var(--fl-level-debug)',
  trace: 'var(--fl-level-trace)',
};

const LEVEL_LABELS: Record<string, string> = {
  error: 'Error',
  warn: 'Warn',
  info: 'Info',
  debug: 'Debug',
  trace: 'Trace',
};

@Component({
  selector: 'app-logs-viewer',
  standalone: true,
  imports: [
    FormsModule,
    FlPanel,
    FlAlert,
    FlButton,
    FlIcon,
    LogDateRangePickerComponent,
    LogVolumeBarsComponent,
    LogTableComponent,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucideRefreshCw,
      lucideDownload,
      lucideX,
      lucideCalendar,
    }),
  ],
  host: { class: 'fl-stack' },
  template: `
    @if (maskMode.enabled()) {
      <fl-alert
        tone="warning"
        title="Mask mode cannot protect log content"
        data-testid="mask-mode-log-banner"
        >Do not share this screen.</fl-alert
      >
    }

    <fl-panel [flush]="true">
      <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Log filters">
        <div class="fl-toolbar__group">
          <div class="fl-input">
            <fl-icon name="lucideSearch" [size]="14" />
            <label class="fl-sr" for="app-logs-search">Search logs</label>
            <input
              id="app-logs-search"
              type="text"
              [ngModel]="searchInput()"
              (ngModelChange)="searchInput.set($event)"
              (keyup.enter)="onSearchSubmit()"
              placeholder="Search logs"
            />
            @if (searchInput()) {
              <button
                type="button"
                class="inline-flex rounded-fl-sm text-fl-ink-muted hover:text-fl-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-fl-accent"
                aria-label="Clear search"
                (click)="clearSearch()"
              >
                <fl-icon name="lucideX" [size]="14" />
              </button>
            }
          </div>
          <button flButton size="sm" type="button" (click)="onSearchSubmit()">Search</button>

          <div class="fl-row" role="group" aria-label="Levels">
            @for (lvl of allLevels; track lvl) {
              <button
                type="button"
                class="fl-chip"
                [attr.aria-pressed]="!!logs.levelActive()[lvl]"
                (click)="logs.toggleLevel(lvl)"
              >
                <span class="fl-chip__marker" [style.background]="levelMarkers[lvl]"></span>
                {{ levelLabels[lvl] }}
                <span class="fl-chip__count">{{ levelCount(lvl) }}</span>
              </button>
            }
          </div>

          <span class="fl-select-wrap">
            <select
              class="fl-select fl-select--sm"
              aria-label="Time range"
              [ngModel]="logs.selectedRange()"
              (ngModelChange)="onPresetRangeChange($event)"
            >
              @for (r of timeRanges; track r.value) {
                <option [value]="r.value">{{ r.label }}</option>
              }
            </select>
          </span>

          @if (logs.selectedRange() === 'custom') {
            <div class="relative">
              <button
                flButton
                size="sm"
                type="button"
                [attr.aria-expanded]="customRangeOpen()"
                (click)="customRangeOpen.set(!customRangeOpen())"
              >
                <fl-icon name="lucideCalendar" [size]="14" />
                {{ logs.customRangeLabel() || 'Select dates' }}
              </button>
              @if (customRangeOpen()) {
                <div
                  class="absolute left-0 top-full z-50 mt-1 w-80 rounded-fl-lg border border-fl-border bg-fl-surface"
                >
                  <app-log-date-range-picker
                    (rangeSelected)="onCustomRangeSelected($event)"
                    (cancelled)="customRangeOpen.set(false)"
                  />
                </div>
              }
            </div>
          }
        </div>

        <div class="fl-toolbar__group">
          <span class="fl-toolbar__info">{{ entriesLabel() }}</span>
          <button
            flButton
            size="sm"
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            [attr.aria-busy]="logs.loading()"
            (click)="logs.refresh()"
          >
            <fl-icon name="lucideRefreshCw" [size]="14" [class.animate-spin]="logs.loading()" />
          </button>
          <button
            flButton
            size="sm"
            type="button"
            [iconOnly]="true"
            aria-label="Download"
            (click)="downloadLogs()"
          >
            <fl-icon name="lucideDownload" [size]="14" />
          </button>
        </div>
      </div>

      <div class="border-b border-fl-border px-4 pb-2 pt-3">
        <app-log-volume-bars
          [data]="logs.volume()"
          [loading]="logs.volumeLoading()"
          [highlightRange]="brushHighlight()"
          (rangeSelected)="onHistogramRangeSelected($event)"
        />
      </div>

      <app-log-table
        [entries]="logs.filteredLogs()"
        [loading]="logs.loading()"
        [error]="logs.error()"
      />
    </fl-panel>
  `,
})
export class AppLogsViewerComponent {
  protected logs = inject(ApplicationLogsService);
  protected readonly maskMode = inject(MaskModeService);
  private readonly appService = inject(ApplicationService);

  readonly allLevels = ALL_LOG_LEVELS;
  readonly timeRanges = LOG_TIME_RANGES;
  protected readonly levelMarkers = LEVEL_MARKERS;
  protected readonly levelLabels = LEVEL_LABELS;

  readonly searchInput = signal('');
  readonly customRangeOpen = signal(false);

  private readonly _brushHighlight = signal<{ start: Date; end: Date } | null>(null);
  readonly brushHighlight = this._brushHighlight.asReadonly();

  protected readonly entriesLabel = computed(() => {
    const shown = this.logs.filteredLogs().length;
    const total = this.logs.logs().length;
    const noun = total === 1 ? 'entry' : 'entries';
    return shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`;
  });

  protected levelCount(level: string): number {
    return this.logs.volumeLevelTotals()[level] ?? this.logs.levelCounts()[level] ?? 0;
  }

  onPresetRangeChange(value: LogTimeRangeValue) {
    if (value === 'custom') {
      this.customRangeOpen.set(true);
    } else {
      this._brushHighlight.set(null);
      this.logs.setPresetRange(value);
    }
  }

  onCustomRangeSelected(range: LogCustomRange) {
    this.customRangeOpen.set(false);
    this._brushHighlight.set(null);
    this.logs.setCustomRange(range);
  }

  onHistogramRangeSelected(range: LogVolumeRangeSelection) {
    this._brushHighlight.set({ start: range.start, end: range.end });
    this.logs.setBrushRange({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    });
  }

  onSearchSubmit() {
    this.logs.setSearch(this.searchInput().trim());
  }

  clearSearch() {
    this.searchInput.set('');
    this.logs.setSearch('');
  }

  downloadLogs() {
    const lines = this.logs
      .filteredLogs()
      .map(
        (l) =>
          `${l.timestamp} [${(l.level ?? 'unknown').toUpperCase()}] ${l.pod ?? ''} - ${l.message}`,
      );
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${this.appService.selectedApplication()?.slug ?? 'app'}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
