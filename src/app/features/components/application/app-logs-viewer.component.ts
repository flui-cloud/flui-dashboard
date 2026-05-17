import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideSearch, lucideRefreshCw, lucideChevronDown,
  lucideDownload, lucideX, lucideAlertCircle, lucideActivity, lucideCalendar,
} from '@ng-icons/lucide';

import { ApplicationService } from '../../service/application.service';
import {
  ApplicationLogsService,
  ALL_LOG_LEVELS,
  LOG_TIME_RANGES,
} from '../../service/application-logs.service';
import type { LogTimeRangeValue, LogCustomRange } from '../../service/application-logs.service';
import { LogDateRangePickerComponent } from './log-date-range-picker.component';
import { LogVolumeHistogramComponent } from '../../../shared/components/charts/log-volume-histogram/log-volume-histogram.component';
import { LogTableComponent } from './log-table.component';
import type { LogVolumeRangeSelection } from '../../../shared/components/charts/chart.models';

@Component({
  selector: 'app-logs-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, LogDateRangePickerComponent, LogVolumeHistogramComponent, LogTableComponent],
  providers: [
    provideIcons({
      lucideSearch, lucideRefreshCw, lucideChevronDown,
      lucideDownload, lucideX, lucideAlertCircle, lucideActivity, lucideCalendar,
    }),
  ],
  template: `
    <div class="flex flex-col gap-0 min-h-0">

      <!-- ── Log Volume Distribution ─────────────────────────────────────── -->
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-t-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Log Volume Distribution
          </span>
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ logs.selectedRangeLabel() }}</span>
        </div>

        <!-- Level summary pills -->
        <div class="flex items-center gap-2 flex-wrap mb-3">
          @for (lvl of allLevels; track lvl) {
            <button
              (click)="logs.toggleLevel(lvl)"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
              [class]="logs.levelActive()[lvl]
                ? getLevelPillActive(lvl)
                : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 bg-transparent opacity-40'"
            >
              <span class="w-2 h-2 rounded-full" [class]="getLevelDot(lvl)"></span>
              {{ lvl.toUpperCase() }}
              <span class="font-mono tabular-nums">{{ logs.volumeLevelTotals()[lvl] ?? logs.levelCounts()[lvl] ?? 0 }}</span>
            </button>
          }
        </div>

        <!-- Log Volume Histogram -->
        <app-log-volume-histogram
          [data]="logs.volume()"
          [loading]="logs.volumeLoading()"
          [config]="{ height: '80px', highlightRange: brushHighlight() }"
          (rangeSelected)="onHistogramRangeSelected($event)"
        />
      </div>

      <!-- ── Toolbar ──────────────────────────────────────────────────────── -->
      <div class="bg-white dark:bg-gray-900 border-x border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center gap-3 flex-wrap">

        <!-- Search -->
        <div class="relative flex-[2] min-w-72 flex gap-1.5">
          <div class="relative flex-1">
            <ng-icon name="lucideSearch" class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              [ngModel]="searchInput()"
              (ngModelChange)="searchInput.set($event)"
              (keyup.enter)="onSearchSubmit()"
              placeholder="Search logs…"
              class="w-full pl-8 pr-8 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            @if (searchInput()) {
              <button (click)="clearSearch()" class="absolute right-2 top-1/2 -translate-y-1/2">
                <ng-icon name="lucideX" class="h-3 w-3 text-gray-400 hover:text-gray-600" />
              </button>
            }
          </div>
          <button
            type="button"
            (click)="onSearchSubmit()"
            class="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
          >
            <ng-icon name="lucideSearch" class="h-3 w-3" />
            Search
          </button>
        </div>

        <!-- Time range preset -->
        <div class="flex items-center gap-1.5 bg-muted border border-border rounded px-2 py-1.5">
          <ng-icon name="lucideCalendar" class="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <select
            [ngModel]="logs.selectedRange()"
            (ngModelChange)="onPresetRangeChange($event)"
            class="text-xs bg-card text-foreground focus:outline-none cursor-pointer"
          >
            @for (r of timeRanges; track r.value) {
              <option [value]="r.value" class="bg-card text-foreground">{{ r.label }}</option>
            }
          </select>
        </div>

        <!-- Custom range button + picker -->
        @if (logs.selectedRange() === 'custom') {
          <div class="relative">
            <button
              type="button"
              (click)="customRangeOpen.set(!customRangeOpen())"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition-colors"
              [class]="logs.customRangeLabel()
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'"
            >
              <ng-icon name="lucideCalendar" class="h-3.5 w-3.5" />
              {{ logs.customRangeLabel() || 'Select date range' }}
            </button>

            @if (customRangeOpen()) {
              <div class="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-80">
                <app-log-date-range-picker
                  (rangeSelected)="onCustomRangeSelected($event)"
                  (cancelled)="customRangeOpen.set(false)"
                />
              </div>
            }
          </div>
        }

        <div class="flex-1"></div>

        <!-- Count -->
        <span class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {{ logs.filteredLogs().length }} / {{ logs.logs().length }} entries
        </span>

        <!-- Refresh -->
        <button (click)="logs.refresh()" title="Refresh"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5 text-gray-500"
            [class.animate-spin]="logs.loading()" />
        </button>

        <!-- Download -->
        <button (click)="downloadLogs()" title="Download logs"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ng-icon name="lucideDownload" class="h-3.5 w-3.5 text-gray-500" />
        </button>
      </div>

      <!-- ── Log Table ────────────────────────────────────────────────────── -->
      <app-log-table
        [entries]="logs.filteredLogs()"
        [loading]="logs.loading()"
        [error]="logs.error()"
        class="[&>div]:rounded-t-none [&>div]:border-t-0"
      />
    </div>
  `,
})
export class AppLogsViewerComponent {
  protected logs = inject(ApplicationLogsService);
  private readonly appService = inject(ApplicationService);

  readonly allLevels  = ALL_LOG_LEVELS;
  readonly timeRanges = LOG_TIME_RANGES;

  readonly searchInput     = signal('');
  readonly customRangeOpen = signal(false);

  private readonly _brushHighlight = signal<{ start: Date; end: Date } | null>(null);
  readonly brushHighlight = this._brushHighlight.asReadonly();

  // ── Actions ───────────────────────────────────────────────────────────────

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
      end:   range.end.toISOString(),
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
    const lines = this.logs.filteredLogs().map(
      l => `${l.timestamp} [${(l.level ?? 'unknown').toUpperCase()}] ${l.pod ?? ''} - ${l.message}`
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `logs-${this.appService.selectedApplication()?.slug ?? 'app'}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Level styling helpers ─────────────────────────────────────────────────

  getLevelDot(level: string): string {
    switch (level.toLowerCase()) {
      case 'error': return 'bg-red-500';
      case 'warn':  return 'bg-amber-400';
      case 'info':  return 'bg-blue-500';
      case 'debug': return 'bg-gray-400';
      case 'trace': return 'bg-purple-400';
      default:      return 'bg-gray-300';
    }
  }

  getLevelPillActive(level: string): string {
    switch (level.toLowerCase()) {
      case 'error': return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400';
      case 'warn':  return 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400';
      case 'info':  return 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400';
      case 'debug': return 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
      case 'trace': return 'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400';
      default:      return 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500';
    }
  }
}
