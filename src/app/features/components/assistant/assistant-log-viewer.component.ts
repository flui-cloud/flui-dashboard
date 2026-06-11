import { Component, computed, effect, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCopy, lucideDownload, lucideZap } from '@ng-icons/lucide';
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
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideCopy, lucideDownload, lucideZap })],
  template: `
    @if (isEmpty()) {
      <div class="mt-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 text-xs space-y-1.5">
        <p class="text-muted-foreground">
          No logs matched
          @if (result().app) {
            for <span class="font-mono font-medium text-foreground/80">{{ result().app }}</span>
          }
          @if (result().namespace) {
            in <span class="font-mono text-foreground/80">{{ result().namespace }}</span>
          }
        </p>
        @if (availableSources().length > 0) {
          <div class="flex flex-wrap items-center gap-1">
            <span class="text-[10px] text-muted-foreground/70 shrink-0">Available:</span>
            @for (app of availableSources(); track app) {
              <button type="button" (click)="sendMessage.emit('Show recent logs for ' + app)"
                class="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors">
                {{ app }}
              </button>
            }
          </div>
        }
      </div>
    } @else {
      <div class="mt-2 rounded-xl border border-border/50 overflow-hidden text-xs bg-background">

        <div class="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/30 flex-wrap">
          <span class="font-semibold text-foreground truncate max-w-[160px]">{{ result().app ?? 'Logs' }}</span>
          <span class="text-muted-foreground shrink-0">{{ result().count }} lines</span>
          <div class="flex-1"></div>
          <button type="button" (click)="copyAll()"
            class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <ng-icon name="lucideCopy" class="h-3 w-3" />
            Copy
          </button>
          <button type="button" (click)="download()"
            class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <ng-icon name="lucideDownload" class="h-3 w-3" />
            Download
          </button>
        </div>

        <div class="flex items-center gap-1 px-3 py-1.5 border-b border-border/50 bg-muted/20 flex-wrap">
          @for (lv of levelOptions; track lv) {
            <button type="button" (click)="levelFilter.set(lv)"
              class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors shrink-0"
              [class]="levelFilter() === lv ? activeChipClass(lv) : 'bg-muted text-muted-foreground hover:bg-muted/80'">
              {{ lv === 'all' ? 'All' : lv[0].toUpperCase() + lv.slice(1) }}
            </button>
          }
          <input type="text" placeholder="Search messages…" [value]="search()"
            (input)="onSearchInput($event)"
            class="ml-1 flex-1 min-w-[80px] rounded-md bg-muted/50 border border-input/50 px-2 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>

        @if (result().app) {
          <div class="flex items-center gap-1 px-3 py-1.5 border-b border-border/50 bg-muted/10 flex-wrap">
            <span class="text-[10px] text-muted-foreground/70 shrink-0">Since:</span>
            @for (tw of timeWindows; track tw) {
              <button type="button" (click)="reQueryWindow(tw)"
                class="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors shrink-0">
                {{ tw }}
              </button>
            }
            <input type="text" [value]="customWindow()" (input)="onCustomWindowInput($event)"
              (keydown.enter)="reQueryCustomWindow()"
              placeholder="custom…"
              class="w-16 rounded-md bg-muted/50 border border-input/50 px-2 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        }

        <div class="overflow-y-auto max-h-[260px] divide-y divide-border/20">
          @if (filteredLogs().length === 0) {
            <p class="text-center text-muted-foreground py-4 px-3">No entries match the current filters.</p>
          }
          @for (entry of filteredLogs(); track $index) {
            <div [class]="rowClass(entry)">
              <input type="checkbox" class="mt-1 h-3 w-3 shrink-0 accent-blue-500 cursor-pointer"
                [checked]="selectedLines().has(entry)"
                (change)="toggleLine(entry, $event)" />
              <span class="shrink-0 font-mono text-muted-foreground text-[10px] w-[86px] leading-relaxed pt-px">
                {{ formatTime(entry.timestamp) }}
              </span>
              @if (entry.level) {
                <span class="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide leading-none mt-[3px]"
                  [class]="levelBadgeClass(entry.level)">
                  {{ entry.level }}
                </span>
              }
              @if (entry.pod || entry.container) {
                <span class="shrink-0 text-muted-foreground/60 text-[10px] leading-relaxed truncate max-w-[72px]">
                  {{ entry.pod ?? entry.container }}
                </span>
              }
              <span class="font-mono break-all leading-relaxed text-foreground/90 flex-1 text-[11px]">{{ entry.message }}</span>
            </div>
          }
        </div>

        <div class="flex items-center gap-1.5 px-3 py-2 border-t border-border/50 bg-muted/10 flex-wrap">
          <ng-icon name="lucideZap" class="h-3 w-3 text-muted-foreground/60 shrink-0" />
          @if (selectedLines().size > 0) {
            <span class="text-[10px] text-muted-foreground/70 shrink-0">
              {{ selectedLines().size }} line{{ selectedLines().size === 1 ? '' : 's' }} selected
            </span>
          } @else {
            <span class="text-[10px] text-muted-foreground/70 shrink-0">Select 1–5 lines to analyze</span>
          }
          <div class="flex-1"></div>
          @if (!canAnalyze() || hasErrorsSelected()) {
            <button type="button" (click)="explainSelected()" [disabled]="!canAnalyze()"
              class="rounded-lg border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Explain errors
            </button>
          }
          <button type="button" (click)="summarizeSelected()" [disabled]="!canAnalyze()"
            class="rounded-lg border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Summarize
          </button>
          @if (!canAnalyze() || hasProblemsSelected()) {
            <button type="button" (click)="diagnoseSelected()" [disabled]="!canAnalyze()"
              class="rounded-lg border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Why is it failing?
            </button>
          }
        </div>

      </div>
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
    [...this.selectedLines()].some((e) => e.level?.toLowerCase() === 'error')
  );

  protected readonly hasProblemsSelected = computed(() =>
    [...this.selectedLines()].some((e) => {
      const lv = e.level?.toLowerCase() ?? '';
      return lv === 'error' || lv === 'warn' || lv === 'warning';
    })
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

  protected rowClass(entry: LogEntry): string {
    const base = 'flex items-start gap-2 px-3 py-1 hover:bg-muted/20 transition-colors';
    return this.selectedLines().has(entry) ? base + ' bg-blue-500/5' : base;
  }

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
    this.sendMessage.emit(`Explain these ${app} log lines:\n\`\`\`\n${this.formatSelectedLines()}\n\`\`\``);
  }

  protected summarizeSelected(): void {
    if (!this.canAnalyze()) return;
    const app = this.result().app ?? 'app';
    this.sendMessage.emit(`Summarize what's happening in these ${app} log lines:\n\`\`\`\n${this.formatSelectedLines()}\n\`\`\``);
  }

  protected diagnoseSelected(): void {
    if (!this.canAnalyze()) return;
    const app = this.result().app ?? 'app';
    this.sendMessage.emit(`Diagnose why ${app} is failing based on these log lines:\n\`\`\`\n${this.formatSelectedLines()}\n\`\`\``);
  }

  protected reQueryWindow(window: string): void {
    const { app, cluster_id, namespace } = this.result();
    if (!app) return;
    const ns = namespace ? ` in namespace \`${namespace}\`` : '';
    this.sendMessage.emit(`Show logs for \`${app}\` on cluster \`${cluster_id}\`${ns} for the last ${window}`);
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

  protected levelBadgeClass(level: string): string {
    switch (level.toLowerCase()) {
      case 'error': return 'bg-destructive/15 text-destructive';
      case 'warn': case 'warning': return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
      case 'info': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400';
      default: return 'bg-muted text-muted-foreground';
    }
  }

  protected activeChipClass(level: LevelFilter): string {
    switch (level) {
      case 'error': return 'bg-destructive text-white';
      case 'warn': return 'bg-amber-500 text-white';
      case 'info': return 'bg-blue-500 text-white';
      default: return 'bg-foreground text-background';
    }
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
