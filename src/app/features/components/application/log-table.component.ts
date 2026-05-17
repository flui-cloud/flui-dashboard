import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideRefreshCw, lucideChevronDown, lucideChevronRight,
  lucideAlertCircle, lucideActivity, lucideCopy, lucideCheck,
} from '@ng-icons/lucide';

import type { AppLogEntryDto } from '../../service/application-logs.service';

const PAGE_SIZE = 50;

/**
 * Reusable paginated log table.
 * Accepts an array of log entries via `entries` input and renders them
 * with expand-on-click detail rows and client-side pagination.
 *
 * Does NOT include any filtering, search, time-range or histogram UI.
 * Use AppLogsViewerComponent for the full-featured experience.
 */
@Component({
  selector: 'app-log-table',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideRefreshCw, lucideChevronDown, lucideChevronRight,
      lucideAlertCircle, lucideActivity, lucideCopy, lucideCheck,
    }),
  ],
  template: `
    <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">

      <!-- Header -->
      <div class="grid grid-cols-[130px_64px_1fr_90px_80px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2">
        <span class="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timestamp</span>
        <span class="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Level</span>
        <span class="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Message</span>
        <span class="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pod</span>
        <span class="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stream</span>
      </div>

      <!-- Loading state -->
      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <ng-icon name="lucideRefreshCw" class="h-5 w-5 animate-spin text-blue-500" />
        </div>

      <!-- Error state -->
      } @else if (error()) {
        <div class="flex flex-col items-center justify-center py-12 gap-2 text-red-500">
          <ng-icon name="lucideAlertCircle" class="h-7 w-7" />
          <span class="text-sm">{{ error() }}</span>
        </div>

      <!-- Empty state -->
      } @else if (pagedEntries().length === 0) {
        <div class="flex flex-col items-center justify-center py-14 gap-2 text-gray-400 dark:text-gray-500">
          <ng-icon name="lucideActivity" class="h-7 w-7" />
          <span class="text-sm">No log entries</span>
        </div>

      <!-- Rows -->
      } @else {
        @for (entry of pagedEntries(); track entry.timestamp + entry.message) {
          <div
            class="group border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
            (click)="toggleExpand(entry)"
          >
            <!-- Main row -->
            <div class="grid grid-cols-[130px_64px_1fr_90px_80px] items-start px-3 py-1.5">
              <span class="text-[11px] font-mono text-gray-500 dark:text-gray-400 leading-5 truncate"
                [title]="entry.timestamp">
                {{ formatTimestamp(entry.timestamp) }}
              </span>
              <span>
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                  [class]="getLevelBadge(entry.level)">
                  {{ (entry.level ?? 'UNK').toUpperCase() }}
                </span>
              </span>
              <span class="text-[11px] text-gray-800 dark:text-gray-200 font-mono leading-5 flex items-start gap-1.5 min-w-0">
                <ng-icon
                  [name]="isExpanded(entry) ? 'lucideChevronDown' : 'lucideChevronRight'"
                  class="h-3.5 w-3.5 mt-px flex-shrink-0 text-gray-400"
                />
                <span class="truncate flex-1 min-w-0">{{ entry.message }}</span>
                <button
                  class="flex-shrink-0 ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                  [title]="isCopied(entry) ? 'Copied!' : 'Copy message'"
                  (click)="copyMessage($event, entry)"
                >
                  <ng-icon
                    [name]="isCopied(entry) ? 'lucideCheck' : 'lucideCopy'"
                    [class]="isCopied(entry) ? 'h-3 w-3 text-green-500' : 'h-3 w-3 text-gray-400'"
                  />
                </button>
              </span>
              <span class="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate leading-5 pl-2">
                {{ shortPodName(entry.pod) }}
              </span>
              <span class="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate leading-5 pl-2">
                {{ entry.stream ?? '-' }}
              </span>
            </div>

            <!-- Expanded detail -->
            @if (isExpanded(entry)) {
              <div class="mx-3 mb-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-xs font-mono">
                <div class="grid grid-cols-[140px_1fr] gap-y-1.5 gap-x-3">
                  <span class="text-gray-400 dark:text-gray-500">timestamp</span>
                  <span class="text-gray-800 dark:text-gray-200">{{ entry.timestamp }}</span>

                  <span class="text-gray-400 dark:text-gray-500">level</span>
                  <span [class]="getLevelText(entry.level)">{{ entry.level ?? 'unknown' }}</span>

                  <span class="text-gray-400 dark:text-gray-500">message</span>
                  <span class="flex items-start gap-1.5 group/msg">
                    <span class="text-gray-800 dark:text-gray-200 break-all whitespace-pre-wrap flex-1">{{ entry.message }}</span>
                    <button
                      class="flex-shrink-0 mt-0.5 p-0.5 rounded opacity-0 group-hover/msg:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                      [title]="isCopied(entry) ? 'Copied!' : 'Copy message'"
                      (click)="copyMessage($event, entry)"
                    >
                      <ng-icon
                        [name]="isCopied(entry) ? 'lucideCheck' : 'lucideCopy'"
                        [class]="isCopied(entry) ? 'h-3 w-3 text-green-500' : 'h-3 w-3 text-gray-400'"
                      />
                    </button>
                  </span>

                  @if (entry.namespace) {
                    <span class="text-gray-400 dark:text-gray-500">namespace</span>
                    <span class="text-gray-800 dark:text-gray-200">{{ entry.namespace }}</span>
                  }
                  @if (entry.pod) {
                    <span class="text-gray-400 dark:text-gray-500">pod</span>
                    <span class="text-gray-800 dark:text-gray-200">{{ entry.pod }}</span>
                  }
                  @if (entry.container) {
                    <span class="text-gray-400 dark:text-gray-500">container</span>
                    <span class="text-gray-800 dark:text-gray-200">{{ entry.container }}</span>
                  }
                  @if (entry.hostname) {
                    <span class="text-gray-400 dark:text-gray-500">hostname</span>
                    <span class="text-gray-800 dark:text-gray-200">{{ entry.hostname }}</span>
                  }
                  @if (entry.server_type) {
                    <span class="text-gray-400 dark:text-gray-500">server_type</span>
                    <span class="text-gray-800 dark:text-gray-200">{{ entry.server_type }}</span>
                  }
                  @if (entry.server_id) {
                    <span class="text-gray-400 dark:text-gray-500">server_id</span>
                    <span class="text-blue-600 dark:text-blue-400">{{ entry.server_id }}</span>
                  }
                  @if (entry.stream) {
                    <span class="text-gray-400 dark:text-gray-500">stream</span>
                    <span class="text-gray-800 dark:text-gray-200">{{ entry.stream }}</span>
                  }
                  @if (entry.metadata) {
                    <span class="text-gray-400 dark:text-gray-500 col-span-2 mt-1 border-t border-gray-200 dark:border-gray-700 pt-1.5">metadata</span>
                    @for (kv of metaEntries(entry.metadata); track kv[0]) {
                      @if (kv[1] !== null && kv[1] !== '') {
                        <span class="text-gray-400 dark:text-gray-500 pl-2">{{ kv[0] }}</span>
                        <span class="text-gray-700 dark:text-gray-300">{{ kv[1] }}</span>
                      }
                    }
                  }
                </div>
              </div>
            }
          </div>
        }
      }

      <!-- Pagination -->
      @if (totalPages() > 1) {
        <div class="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <span class="text-xs text-gray-500 dark:text-gray-400">
            Page {{ currentPage() }} of {{ totalPages() }}
            &nbsp;·&nbsp; {{ entries().length }} entries
          </span>
          <div class="flex items-center gap-1">
            <button (click)="goToPage(currentPage() - 1)" [disabled]="currentPage() === 1"
              class="px-2.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              Previous
            </button>
            @for (p of visiblePages(); track p) {
              <button (click)="goToPage(p)"
                class="px-2.5 py-1 text-xs rounded border transition-colors"
                [class]="p === currentPage()
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'">
                {{ p }}
              </button>
            }
            <button (click)="goToPage(currentPage() + 1)" [disabled]="currentPage() === totalPages()"
              class="px-2.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              Next
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class LogTableComponent {
  /** Log entries to display. Changing this resets to page 1. */
  readonly entries = input.required<AppLogEntryDto[]>();
  /** Show a loading spinner instead of rows. */
  readonly loading = input(false);
  /** Show an error message instead of rows. */
  readonly error   = input<string | null>(null);

  private readonly _currentPage  = signal(1);
  private readonly _expandedKeys = signal<Set<string>>(new Set());
  private readonly _copiedKeys   = signal<Set<string>>(new Set());

  readonly currentPage = this._currentPage.asReadonly();

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.entries().length / PAGE_SIZE))
  );

  readonly pagedEntries = computed(() => {
    const page  = Math.min(this._currentPage(), this.totalPages());
    const start = (page - 1) * PAGE_SIZE;
    return this.entries().slice(start, start + PAGE_SIZE);
  });

  readonly visiblePages = computed(() => {
    const total = this.totalPages();
    const cur   = this._currentPage();
    const pages: number[] = [];
    for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) pages.push(i);
    return pages;
  });

  goToPage(page: number) {
    this._currentPage.set(Math.max(1, Math.min(page, this.totalPages())));
  }

  toggleExpand(entry: AppLogEntryDto) {
    const key = entry.timestamp + entry.message;
    this._expandedKeys.update(s => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  isExpanded(entry: AppLogEntryDto): boolean {
    return this._expandedKeys().has(entry.timestamp + entry.message);
  }

  isCopied(entry: AppLogEntryDto): boolean {
    return this._copiedKeys().has(entry.timestamp + entry.message);
  }

  extractMessage(raw: string | undefined): string {
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.message === 'string') return parsed.message;
    } catch { /* not JSON */ }
    return raw;
  }

  copyMessage(event: MouseEvent, entry: AppLogEntryDto): void {
    event.stopPropagation();
    navigator.clipboard.writeText(this.extractMessage(entry.message));
    const key = entry.timestamp + entry.message;
    this._copiedKeys.update(s => { const n = new Set(s); n.add(key); return n; });
    setTimeout(() => {
      this._copiedKeys.update(s => { const n = new Set(s); n.delete(key); return n; });
    }, 1500);
  }

  formatTimestamp(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString('en-US', {
        month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      });
    } catch { return iso; }
  }

  shortPodName(pod: string | undefined): string {
    if (!pod) return '-';
    return pod.length > 16 ? '…' + pod.slice(-13) : pod;
  }

  metaEntries(meta: object): [string, unknown][] {
    return Object.entries(meta as Record<string, unknown>);
  }

  getLevelBadge(level: string | undefined): string {
    switch ((level ?? '').toLowerCase()) {
      case 'error': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
      case 'warn':  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400';
      case 'info':  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
      case 'debug': return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
      case 'trace': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400';
      default:      return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
    }
  }

  getLevelText(level: string | undefined): string {
    switch ((level ?? '').toLowerCase()) {
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'warn':  return 'text-amber-600 dark:text-amber-400';
      case 'info':  return 'text-blue-600 dark:text-blue-400';
      case 'debug': return 'text-gray-600 dark:text-gray-400';
      case 'trace': return 'text-purple-600 dark:text-purple-400';
      default:      return 'text-gray-600 dark:text-gray-400';
    }
  }
}
