import { Component, computed, effect, input, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCopy, lucideDownload, lucideSearch, lucideZap } from '@ng-icons/lucide';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { LogSourcesResult } from '../../service/assistant.service';

interface LogEntry {
  timestamp: string;
  level?: string;
  message: string;
  pod?: string;
  container?: string;
  stream?: string;
  namespace?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface AppLogsResult {
  cluster_id: string;
  namespace?: string;
  app?: string;
  count: number;
  queried_at: string;
  logs: LogEntry[];
}

type LevelFilter = 'all' | 'error' | 'warn' | 'info';

const TIME_WINDOWS = ['15m', '1h', '6h', '24h'] as const;

@Component({
  selector: 'app-assistant-log-viewer',
  imports: [FlPanel, FlTable, FlButton, FlIcon],
  providers: [provideIcons({ lucideCopy, lucideDownload, lucideSearch, lucideZap })],
  host: { class: 'block' },
  template: `
    @if (isEmpty()) {
      <div
        class="flex flex-col gap-2 rounded-fl-lg border border-fl-border bg-fl-surface p-3 text-fl-body-sm"
      >
        <p class="text-fl-ink-secondary">
          No logs matched
          @if (result().app) {
            for <span class="fl-mono text-fl-ink">{{ result().app }}</span>
          }
          @if (result().namespace) {
            in <span class="fl-mono text-fl-ink">{{ result().namespace }}</span>
          }
        </p>
        @if (availableSources().length > 0) {
          <div class="fl-row">
            <span class="text-fl-caption text-fl-ink-muted">Available</span>
            @for (app of availableSources(); track app) {
              <button
                flButton
                size="sm"
                type="button"
                class="font-mono"
                (click)="sendMessage.emit('Show recent logs for ' + app)"
              >
                {{ app }}
              </button>
            }
          </div>
        }
      </div>
    } @else {
      <fl-panel [title]="result().app ?? 'Logs'" [count]="result().count" [flush]="true">
        <div panelActions class="fl-row">
          <button flButton="ghost" size="sm" type="button" (click)="copyAll()">
            <fl-icon name="lucideCopy" />
            Copy
          </button>
          <button flButton="ghost" size="sm" type="button" (click)="download()">
            <fl-icon name="lucideDownload" />
            Download
          </button>
        </div>

        <div panelToolbar class="fl-toolbar">
          <div class="fl-segmented" role="group" aria-label="Level">
            @for (lv of levelOptions; track lv) {
              <button
                type="button"
                [attr.aria-pressed]="levelFilter() === lv"
                (click)="levelFilter.set(lv)"
              >
                {{ lv === 'all' ? 'All' : lv[0].toUpperCase() + lv.slice(1) }}
              </button>
            }
          </div>
          <label class="fl-input min-w-0 flex-1">
            <fl-icon name="lucideSearch" [size]="14" />
            <input
              type="text"
              placeholder="Search messages"
              aria-label="Search messages"
              [value]="search()"
              (input)="onSearchInput($event)"
            />
          </label>
        </div>

        @if (result().app) {
          <div panelToolbar class="fl-toolbar">
            <div class="fl-toolbar__group">
              <span class="fl-toolbar__info">Since</span>
              @for (tw of timeWindows; track tw) {
                <button type="button" class="fl-chip" (click)="reQueryWindow(tw)">
                  {{ tw }}
                </button>
              }
              <label class="fl-input w-24">
                <input
                  type="text"
                  placeholder="Custom"
                  aria-label="Custom time window"
                  [value]="customWindow()"
                  (input)="onCustomWindowInput($event)"
                  (keydown.enter)="reQueryCustomWindow()"
                />
              </label>
            </div>
          </div>
        }

        <div class="fl-table-wrap max-h-64 overflow-y-auto">
          <table flTable density="log">
            <thead>
              <tr>
                <th scope="col" class="is-fit"><span class="fl-sr">Select</span></th>
                <th scope="col">Time</th>
                <th scope="col">Level</th>
                <th scope="col">Source</th>
                <th scope="col">Message</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of filteredLogs(); track $index) {
                <tr [class.is-selected]="selectedLines().has(entry)">
                  <td class="is-fit">
                    <input
                      type="checkbox"
                      class="cursor-pointer"
                      aria-label="Select line"
                      [checked]="selectedLines().has(entry)"
                      (change)="toggleLine(entry, $event)"
                    />
                  </td>
                  <td class="text-fl-ink-muted">{{ formatTime(entry.timestamp) }}</td>
                  <td>
                    @if (entry.level) {
                      <span [class]="levelClass(entry.level)">{{ entry.level }}</span>
                    }
                  </td>
                  <td>
                    <span class="fl-cell-clip text-fl-ink-muted">{{
                      entry.pod ?? entry.container ?? ''
                    }}</span>
                  </td>
                  <td class="is-wrap break-all">{{ entry.message }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="text-center text-fl-ink-muted">
                    No entries match the current filters.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="fl-toolbar border-b-0 border-t border-fl-border">
          <span class="fl-toolbar__info inline-flex items-center gap-1">
            <fl-icon name="lucideZap" [size]="14" />
            @if (selectedLines().size > 0) {
              {{ selectedLines().size }} line{{ selectedLines().size === 1 ? '' : 's' }} selected
            } @else {
              Select 1 to 5 lines to analyze
            }
          </span>
          <div class="fl-toolbar__group">
            @if (!canAnalyze() || hasErrorsSelected()) {
              <button
                flButton
                size="sm"
                type="button"
                [disabled]="!canAnalyze()"
                (click)="explainSelected()"
              >
                Explain errors
              </button>
            }
            <button
              flButton
              size="sm"
              type="button"
              [disabled]="!canAnalyze()"
              (click)="summarizeSelected()"
            >
              Summarize
            </button>
            @if (!canAnalyze() || hasProblemsSelected()) {
              <button
                flButton
                size="sm"
                type="button"
                [disabled]="!canAnalyze()"
                (click)="diagnoseSelected()"
              >
                Why is it failing?
              </button>
            }
          </div>
        </div>
      </fl-panel>
    }
  `,
})
export class AssistantLogViewerComponent {
  readonly result = input.required<AppLogsResult>();
  readonly logSources = input<LogSourcesResult | null>(null);
  readonly sendMessage = output<string>();

  protected readonly levelOptions: LevelFilter[] = ['all', 'error', 'warn', 'info'];
  protected readonly timeWindows = TIME_WINDOWS;
  protected readonly levelFilter = signal<LevelFilter>('all');
  protected readonly search = signal('');
  protected readonly selectedLines = signal<Set<LogEntry>>(new Set<LogEntry>());
  protected readonly customWindow = signal('');

  protected readonly isEmpty = computed(() => this.result().count === 0);
  protected readonly availableSources = computed(() => this.logSources()?.apps ?? []);
  protected readonly canAnalyze = computed(() => {
    const n = this.selectedLines().size;
    return n >= 1 && n <= 5;
  });

  protected readonly hasErrorsSelected = computed(() =>
    [...this.selectedLines()].some((e) => e.level?.toLowerCase() === 'error'),
  );

  protected readonly hasProblemsSelected = computed(() =>
    [...this.selectedLines()].some((e) => {
      const lv = e.level?.toLowerCase() ?? '';
      return lv === 'error' || lv === 'warn' || lv === 'warning';
    }),
  );

  constructor() {
    effect(() => {
      this.result();
      this.selectedLines.set(new Set<LogEntry>());
    });
  }

  protected readonly filteredLogs = computed(() => {
    const lv = this.levelFilter();
    const q = this.search().toLowerCase();
    return this.result().logs.filter((e) => {
      if (lv !== 'all' && this.normalizeLevel(e.level) !== lv) return false;
      if (q && !e.message.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  protected onSearchInput(e: Event): void {
    this.search.set((e.target as HTMLInputElement).value);
  }

  protected onCustomWindowInput(e: Event): void {
    this.customWindow.set((e.target as HTMLInputElement).value);
  }

  protected toggleLine(entry: LogEntry, event: Event): void {
    const s = this.selectedLines();
    if (!s.has(entry) && s.size >= 5) {
      (event.target as HTMLInputElement).checked = false;
      return;
    }
    this.selectedLines.update((prev) => {
      const next = new Set(prev);
      if (next.has(entry)) next.delete(entry);
      else next.add(entry);
      return next;
    });
  }

  private normalizeLevel(level?: string): string {
    const lv = level?.toLowerCase() ?? '';
    return lv === 'warning' ? 'warn' : lv;
  }

  private formatSelectedLines(): string {
    return [...this.selectedLines()]
      .map((e) => {
        const pod = e.pod ? ' (' + e.pod + ')' : '';
        return `${e.timestamp} [${e.level ?? '-'}]${pod} ${e.message}`;
      })
      .join('\n');
  }

  protected explainSelected(): void {
    if (!this.canAnalyze()) return;
    const app = this.result().app ?? 'app';
    this.sendMessage.emit(
      `Explain these ${app} log lines:\n\`\`\`\n${this.formatSelectedLines()}\n\`\`\``,
    );
  }

  protected summarizeSelected(): void {
    if (!this.canAnalyze()) return;
    const app = this.result().app ?? 'app';
    this.sendMessage.emit(
      `Summarize what's happening in these ${app} log lines:\n\`\`\`\n${this.formatSelectedLines()}\n\`\`\``,
    );
  }

  protected diagnoseSelected(): void {
    if (!this.canAnalyze()) return;
    const app = this.result().app ?? 'app';
    this.sendMessage.emit(
      `Diagnose why ${app} is failing based on these log lines:\n\`\`\`\n${this.formatSelectedLines()}\n\`\`\``,
    );
  }

  protected reQueryWindow(window: string): void {
    const { app, cluster_id, namespace } = this.result();
    if (!app) return;
    const ns = namespace ? ` in namespace \`${namespace}\`` : '';
    this.sendMessage.emit(
      `Show logs for \`${app}\` on cluster \`${cluster_id}\`${ns} for the last ${window}`,
    );
  }

  protected reQueryCustomWindow(): void {
    const w = this.customWindow().trim();
    if (w) this.reQueryWindow(w);
  }

  protected formatTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(11, 23);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
  }

  protected levelClass(level: string): string {
    const lv = this.normalizeLevel(level);
    const known = ['error', 'warn', 'info', 'debug', 'trace'];
    return known.includes(lv) ? `fl-level fl-level--${lv}` : 'fl-level';
  }

  private toTsv(entries: LogEntry[]): string {
    return entries
      .map((e) => `${e.timestamp}\t${e.level ?? '-'}\t${e.pod ?? ''}\t${e.message}`)
      .join('\n');
  }

  protected copyAll(): void {
    navigator.clipboard?.writeText(this.toTsv(this.filteredLogs()));
  }

  protected download(): void {
    const text = this.toTsv(this.result().logs);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.result().app ?? 'logs'}.log`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}
