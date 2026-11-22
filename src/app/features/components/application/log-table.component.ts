import { Component, input, signal, computed } from '@angular/core';

import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronRight, lucideCopy, lucideCheck } from '@ng-icons/lucide';

import type { AppLogEntryDto } from '../../service/application-logs.service';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

const PAGE_SIZE = 50;

const LEVEL_CLASSES: Record<string, string> = {
  error: 'fl-level fl-level--error',
  warn: 'fl-level fl-level--warn',
  warning: 'fl-level fl-level--warn',
  info: 'fl-level fl-level--info',
  debug: 'fl-level fl-level--debug',
  trace: 'fl-level fl-level--trace',
};

const ROW_BUTTON =
  'inline-flex flex-none rounded-fl-sm text-fl-ink-muted hover:text-fl-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-fl-accent';

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
  imports: [FlTable, FlEmptyState, FlLoadingState, FlAlert, FlKeyValue, FlKvItem, FlButton, FlIcon],
  providers: [provideIcons({ lucideChevronDown, lucideChevronRight, lucideCopy, lucideCheck })],
  host: { class: 'block' },
  template: `
    @if (loading()) {
      <fl-loading-state [rows]="6" />
    } @else if (error()) {
      <div class="p-4">
        <fl-alert tone="error" title="Could not load logs">{{ error() }}</fl-alert>
      </div>
    } @else if (pagedEntries().length === 0) {
      <fl-empty-state title="No log entries" />
    } @else {
      <div class="fl-table-wrap">
        <table flTable density="log">
          <thead>
            <tr>
              <th scope="col" class="is-fit">Time</th>
              <th scope="col" class="is-fit">Level</th>
              <th scope="col">Message</th>
              <th scope="col" class="is-fit">Pod</th>
              <th scope="col" class="is-fit">Stream</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of pagedEntries(); track entry.timestamp + entry.message) {
              <tr class="group cursor-pointer" (click)="toggleExpand(entry)">
                <td class="text-fl-ink-muted" [title]="entry.timestamp">
                  {{ formatTimestamp(entry.timestamp) }}
                </td>
                <td>
                  <span [class]="levelClass(entry.level)">{{
                    (entry.level ?? 'unk').toUpperCase()
                  }}</span>
                </td>
                <td class="w-full max-w-0">
                  <div class="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      [class]="rowButton"
                      aria-label="Expand entry"
                      [attr.aria-expanded]="isExpanded(entry)"
                      (click)="onExpandClick($event, entry)"
                    >
                      <fl-icon
                        [name]="isExpanded(entry) ? 'lucideChevronDown' : 'lucideChevronRight'"
                        [size]="14"
                      />
                    </button>
                    <span class="min-w-0 flex-1 truncate text-fl-ink">{{ entry.message }}</span>
                    <button
                      type="button"
                      [class]="
                        rowButton + ' opacity-0 focus-visible:opacity-100 group-hover:opacity-100'
                      "
                      [attr.aria-label]="isCopied(entry) ? 'Copied' : 'Copy message'"
                      [title]="isCopied(entry) ? 'Copied' : 'Copy message'"
                      (click)="copyMessage($event, entry)"
                    >
                      <fl-icon
                        [name]="isCopied(entry) ? 'lucideCheck' : 'lucideCopy'"
                        [size]="13"
                      />
                    </button>
                  </div>
                </td>
                <td class="text-fl-ink-muted" [title]="entry.pod ?? ''">
                  <span class="fl-cell-clip">{{ shortPodName(entry.pod) }}</span>
                </td>
                <td class="text-fl-ink-muted">{{ entry.stream ?? '-' }}</td>
              </tr>
              @if (isExpanded(entry)) {
                <tr class="bg-fl-surface-subtle">
                  <td colspan="5" class="cursor-text select-text whitespace-normal">
                    <div class="flex flex-col gap-3 py-1">
                      <div class="flex items-start gap-2">
                        <pre class="m-0 min-w-0 flex-1 whitespace-pre-wrap break-all text-fl-ink">{{
                          entry.message
                        }}</pre>
                        <button
                          type="button"
                          [class]="rowButton"
                          [attr.aria-label]="isCopied(entry) ? 'Copied' : 'Copy message'"
                          [title]="isCopied(entry) ? 'Copied' : 'Copy message'"
                          (click)="copyMessage($event, entry)"
                        >
                          <fl-icon
                            [name]="isCopied(entry) ? 'lucideCheck' : 'lucideCopy'"
                            [size]="13"
                          />
                        </button>
                      </div>
                      <fl-key-value class="fl-kv--compact">
                        <fl-kv-item key="Timestamp" [mono]="true">{{ entry.timestamp }}</fl-kv-item>
                        <fl-kv-item key="Level">
                          <span [class]="levelClass(entry.level)">{{
                            entry.level ?? 'unknown'
                          }}</span>
                        </fl-kv-item>
                        @if (entry.namespace) {
                          <fl-kv-item key="Namespace" [mono]="true">{{
                            entry.namespace
                          }}</fl-kv-item>
                        }
                        @if (entry.pod) {
                          <fl-kv-item key="Pod" [mono]="true">{{ entry.pod }}</fl-kv-item>
                        }
                        @if (entry.container) {
                          <fl-kv-item key="Container" [mono]="true">{{
                            entry.container
                          }}</fl-kv-item>
                        }
                        @if (entry.hostname) {
                          <fl-kv-item key="Hostname" [mono]="true">{{ entry.hostname }}</fl-kv-item>
                        }
                        @if (entry.server_type) {
                          <fl-kv-item key="Server type" [mono]="true">{{
                            entry.server_type
                          }}</fl-kv-item>
                        }
                        @if (entry.server_id) {
                          <fl-kv-item key="Server ID" [mono]="true">{{
                            entry.server_id
                          }}</fl-kv-item>
                        }
                        @if (entry.stream) {
                          <fl-kv-item key="Stream" [mono]="true">{{ entry.stream }}</fl-kv-item>
                        }
                      </fl-key-value>
                      @if (entry.metadata) {
                        <div class="flex flex-col gap-2 border-t border-fl-border-subtle pt-3">
                          <span class="text-fl-caption text-fl-ink-muted">Metadata</span>
                          <fl-key-value class="fl-kv--compact">
                            @for (kv of metaEntries(entry.metadata); track kv[0]) {
                              @if (kv[1] !== null && kv[1] !== '') {
                                <fl-kv-item [key]="kv[0]" [mono]="true">{{ kv[1] }}</fl-kv-item>
                              }
                            }
                          </fl-key-value>
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    }

    @if (totalPages() > 1) {
      <nav
        class="flex flex-wrap items-center justify-between gap-3 border-t border-fl-border px-4 py-2"
        aria-label="Pagination"
      >
        <span class="fl-toolbar__info"
          >Page {{ currentPage() }} of {{ totalPages() }} · {{ entries().length }} entries</span
        >
        <div class="fl-row">
          <button
            flButton
            size="sm"
            type="button"
            (click)="goToPage(currentPage() - 1)"
            [disabled]="currentPage() === 1"
          >
            Previous
          </button>
          @for (p of visiblePages(); track p) {
            <button
              [flButton]="p === currentPage() ? 'primary' : 'ghost'"
              size="sm"
              type="button"
              [attr.aria-current]="p === currentPage() ? 'page' : null"
              (click)="goToPage(p)"
            >
              {{ p }}
            </button>
          }
          <button
            flButton
            size="sm"
            type="button"
            (click)="goToPage(currentPage() + 1)"
            [disabled]="currentPage() === totalPages()"
          >
            Next
          </button>
        </div>
      </nav>
    }
  `,
})
export class LogTableComponent {
  /** Log entries to display. Changing this resets to page 1. */
  readonly entries = input.required<AppLogEntryDto[]>();
  readonly loading = input(false);
  /** Show an error message instead of rows. */
  readonly error = input<string | null>(null);

  protected readonly rowButton = ROW_BUTTON;

  private readonly _currentPage = signal(1);
  private readonly _expandedKeys = signal<Set<string>>(new Set());
  private readonly _copiedKeys = signal<Set<string>>(new Set());

  readonly currentPage = this._currentPage.asReadonly();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.entries().length / PAGE_SIZE)));

  readonly pagedEntries = computed(() => {
    const page = Math.min(this._currentPage(), this.totalPages());
    const start = (page - 1) * PAGE_SIZE;
    return this.entries().slice(start, start + PAGE_SIZE);
  });

  readonly visiblePages = computed(() => {
    const total = this.totalPages();
    const cur = this._currentPage();
    const pages: number[] = [];
    for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) pages.push(i);
    return pages;
  });

  goToPage(page: number) {
    this._currentPage.set(Math.max(1, Math.min(page, this.totalPages())));
  }

  toggleExpand(entry: AppLogEntryDto) {
    if ((globalThis.getSelection()?.toString().length ?? 0) > 0) return;
    const key = entry.timestamp + entry.message;
    this._expandedKeys.update((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  protected onExpandClick(event: MouseEvent, entry: AppLogEntryDto): void {
    event.stopPropagation();
    this.toggleExpand(entry);
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
    } catch {
      return raw;
    }
    return raw;
  }

  copyMessage(event: MouseEvent, entry: AppLogEntryDto): void {
    event.stopPropagation();
    navigator.clipboard.writeText(this.extractMessage(entry.message));
    const key = entry.timestamp + entry.message;
    this._copiedKeys.update((s) => {
      const n = new Set(s);
      n.add(key);
      return n;
    });
    setTimeout(() => {
      this._copiedKeys.update((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }, 1500);
  }

  formatTimestamp(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const time = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return `${day} ${time}`;
  }

  shortPodName(pod: string | undefined): string {
    if (!pod) return '-';
    return pod.length > 16 ? '…' + pod.slice(-13) : pod;
  }

  metaEntries(meta: object): [string, unknown][] {
    return Object.entries(meta as Record<string, unknown>);
  }

  protected levelClass(level: string | undefined): string {
    return LEVEL_CLASSES[(level ?? '').toLowerCase()] ?? 'fl-level fl-level--debug';
  }
}
