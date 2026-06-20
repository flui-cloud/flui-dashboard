import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideLayers,
  lucideLoader,
  lucidePlay,
  lucideRotateCcw,
  lucideSearch,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { MeilisearchConsoleService } from '../../service/meilisearch-console.service';
import {
  MeiliIndex,
  MeiliSearchResult,
  MeiliServerInfo,
} from '../../model/meilisearch-console.models';
import {
  AssistFn,
  DbAssistantChatComponent,
} from './db-assistant-chat.component';
import {
  RawConsoleExample,
  RawConsoleSubmit,
  RestConsoleComponent,
} from './rest-console.component';

type ConnState = 'connecting' | 'connected' | 'error';
type View = 'browse' | 'console';

/**
 * Meilisearch console: index list + a `q`/filter search browse, a raw REST Dev
 * Tools shell, and an NL copilot. The backend holds the connection over the
 * port-forward tunnel; writes are gated by the Dev Tools read-only toggle.
 */
@Component({
  selector: 'app-meilisearch-console-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, FormsModule, DbAssistantChatComponent, RestConsoleComponent],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideLayers,
      lucideLoader,
      lucidePlay,
      lucideRotateCcw,
      lucideSearch,
      lucideTriangleAlert,
    }),
  ],
  template: `
    <div class="p-4 md:p-6">
      <div class="mb-4 flex items-center gap-3">
        <button
          type="button"
          (click)="back()"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          title="Back"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
        </button>
        <ng-icon name="lucideSearch" class="h-5 w-5 text-primary" />
        <div class="min-w-0">
          <h1 class="text-base font-semibold text-foreground">
            Meilisearch Console
            @if (server(); as s) {
              <span class="font-normal text-muted-foreground"> · v{{ s.version }}</span>
            }
          </h1>
          <p class="truncate font-mono text-xs text-muted-foreground">{{ applicationId() }}</p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          @if (conn() === 'connected') {
            <div class="inline-flex overflow-hidden rounded-md border border-border">
              <button type="button" (click)="view.set('browse')" class="px-2.5 py-1 text-xs"
                [class.bg-muted]="view() === 'browse'" [class.text-foreground]="view() === 'browse'"
                [class.text-muted-foreground]="view() !== 'browse'">Browse</button>
              <button type="button" (click)="view.set('console')" class="border-l border-border px-2.5 py-1 text-xs"
                [class.bg-muted]="view() === 'console'" [class.text-foreground]="view() === 'console'"
                [class.text-muted-foreground]="view() !== 'console'">Console</button>
            </div>
          }
          <button type="button" (click)="connect()"
            class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted">
            <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      @if (conn() === 'connecting') {
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" /> Connecting…
        </div>
      } @else if (conn() === 'error') {
        <div class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ errorMsg() || 'Failed to connect.' }}</span>
        </div>
      } @else {
        <div class="flex h-[calc(100vh-180px)] gap-4">
          @if (view() === 'console') {
            <section class="flex min-w-0 flex-1 flex-col">
              <app-rest-console
                [submit]="rawSubmit"
                [examples]="consoleExamples"
                engineLabel="Meilisearch"
                title="Meilisearch Dev Tools"
                syntaxHint="METHOD /path  +  JSON body  ·  ⌘/Ctrl+Enter to run"
              />
            </section>
          } @else {
            <aside class="flex w-56 shrink-0 flex-col overflow-hidden rounded-md border border-border">
              <div class="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                <ng-icon name="lucideLayers" class="h-3.5 w-3.5" /> Indexes
              </div>
              <ul class="flex-1 overflow-auto py-1">
                @for (idx of indexes(); track idx.uid) {
                  <li>
                    <button type="button" (click)="selectIndex(idx.uid)"
                      class="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                      [class.bg-muted]="selectedIndex() === idx.uid">
                      <span class="truncate text-foreground">{{ idx.uid }}</span>
                      <span class="shrink-0 font-mono text-xs text-muted-foreground">{{ idx.numberOfDocuments ?? 0 }}</span>
                    </button>
                  </li>
                }
                @if (indexes().length === 0) {
                  <li class="px-3 py-4 text-center text-xs text-muted-foreground">No indexes yet.</li>
                }
              </ul>
            </aside>

            <section class="flex min-w-0 flex-1 flex-col overflow-auto">
              @if (!selectedIndex()) {
                <div class="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  Select an index to search.
                </div>
              } @else {
                <div class="flex flex-col gap-2">
                  <div class="flex items-center gap-2">
                    <input type="text" [(ngModel)]="query" (keydown.enter)="runSearch()"
                      placeholder="Search text (empty = everything)"
                      class="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground" />
                    <button type="button" (click)="runSearch()" [disabled]="loading()"
                      class="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                      <ng-icon name="lucidePlay" class="h-3.5 w-3.5" /> Search
                    </button>
                  </div>
                  <input type="text" [(ngModel)]="filter" (keydown.enter)="runSearch()"
                    placeholder="Filter (optional) — e.g. genre = horror AND rating > 4"
                    class="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground" />
                </div>

                @if (queryError(); as e) {
                  <div class="mt-2 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <ng-icon name="lucideTriangleAlert" class="h-3.5 w-3.5" /> {{ e }}
                  </div>
                }

                @if (result(); as r) {
                  <div class="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span><strong class="text-foreground">{{ r.estimatedTotalHits }}</strong> hits</span>
                    <span>· {{ r.processingTimeMs }} ms</span>
                  </div>
                  <div class="mt-2 space-y-2">
                    @for (h of r.hits; track $index) {
                      <pre class="overflow-auto rounded-md border border-border px-3 py-2 font-mono text-xs text-foreground">{{ pretty(h) }}</pre>
                    }
                    @if (r.hits.length === 0) {
                      <div class="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No documents matched.</div>
                    }
                  </div>
                } @else if (loading()) {
                  <div class="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" /> Searching…
                  </div>
                }
              }
            </section>
          }

          <app-db-assistant-chat
            [appId]="applicationId() ?? ''"
            storagePrefix="flui.meiliconsole"
            identity="Flui search assistant"
            [assist]="chatAssist"
            dataBlindBadge="index names only"
            dataBlindTooltip="The assistant sees index names — never your documents."
            [emptyHint]="
              view() === 'console'
                ? 'Describe what to do — e.g. “create a movies index”, “list all indexes”, or “show the settings of movies”. The assistant writes the REST call into the console; review it, allow writes if needed, then run.'
                : 'Describe what you want to find — e.g. “horror movies rated over 4” or “documents about wireless mice”. The assistant proposes a search (text + filter); you review and run it.'
            "
            [codeNoun]="view() === 'console' ? 'request' : 'search'"
            [showInsert]="true"
            (run)="onChatRun($event)"
            (insert)="onChatInsert($event)"
          />
        </div>
      }
    </div>
  `,
})
export class MeilisearchConsolePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(MeilisearchConsoleService);

  readonly applicationId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('applicationId'))),
    { initialValue: this.route.snapshot.paramMap.get('applicationId') },
  );

  readonly conn = signal<ConnState>('connecting');
  readonly errorMsg = signal('');
  readonly server = signal<MeiliServerInfo | null>(null);
  readonly indexes = signal<MeiliIndex[]>([]);
  readonly selectedIndex = signal<string | null>(null);
  readonly view = signal<View>('browse');
  readonly result = signal<MeiliSearchResult | null>(null);
  readonly loading = signal(false);
  readonly queryError = signal('');

  query = '';
  filter = '';

  @ViewChild(RestConsoleComponent) private readonly shell?: RestConsoleComponent;

  readonly rawSubmit: RawConsoleSubmit = (req) =>
    this.api.runRaw(this.applicationId() ?? '', req);

  readonly consoleExamples: RawConsoleExample[] = [
    { label: 'List indexes', text: 'GET /indexes' },
    { label: 'Stats', text: 'GET /stats' },
    { label: 'Index settings', text: 'GET /indexes/movies/settings' },
    { label: 'Search', text: 'POST /indexes/movies/search\n{\n  "q": "horror",\n  "limit": 5\n}' },
    {
      label: 'Create index',
      write: true,
      text: 'POST /indexes\n{\n  "uid": "movies",\n  "primaryKey": "id"\n}',
    },
    {
      label: 'Add documents',
      write: true,
      text: 'POST /indexes/movies/documents\n[\n  { "id": 1, "title": "Alien", "genre": "horror" }\n]',
    },
    {
      label: 'Set filterable',
      write: true,
      text: 'PATCH /indexes/movies/settings\n{\n  "filterableAttributes": ["genre", "rating"]\n}',
    },
    { label: 'Delete index', write: true, text: 'DELETE /indexes/movies' },
  ];

  // NL→search copilot (browse): code carries { index, q, filter }. Read-only.
  readonly searchAssist: AssistFn = (prompt, conversation, model) =>
    this.api
      .assist(this.applicationId() ?? '', {
        prompt,
        index: this.selectedIndex() ?? undefined,
        conversation,
        model: model?.model,
        provider: model?.provider,
        connectionId: model?.connectionId,
      })
      .pipe(
        map((r) => ({
          text: r.explanation,
          code: JSON.stringify({ index: r.index, q: r.q, filter: r.filter }),
          mutation: false,
        })),
      );

  // NL→raw REST copilot (console): code is "METHOD /path + JSON body".
  readonly rawAssist: AssistFn = (prompt, conversation, model) =>
    this.api
      .assistRaw(this.applicationId() ?? '', {
        prompt,
        conversation,
        model: model?.model,
        provider: model?.provider,
        connectionId: model?.connectionId,
      })
      .pipe(
        map((r) => ({
          text: r.explanation,
          code: r.path ? this.formatRaw(r) : undefined,
          mutation: r.write,
        })),
      );

  readonly chatAssist: AssistFn = (prompt, conversation, model) =>
    this.view() === 'console'
      ? this.rawAssist(prompt, conversation, model)
      : this.searchAssist(prompt, conversation, model);

  private formatRaw(r: {
    method: string;
    path: string;
    body?: Record<string, unknown>;
  }): string {
    const head = `${r.method} ${r.path}`;
    return r.body && Object.keys(r.body).length
      ? `${head}\n${JSON.stringify(r.body, null, 2)}`
      : head;
  }

  onChatRun(ev: { code: string; mutation: boolean }): void {
    if (this.view() === 'console') {
      // Confirmed-in-chat write runs once as a one-off; reads honor the console toggle.
      this.shell?.runText(ev.code, ev.mutation);
      return;
    }
    this.applySearch(ev.code);
  }

  onChatInsert(code: string): void {
    if (this.view() === 'console') {
      this.shell?.setText(code);
      return;
    }
    this.applySearch(code);
  }

  private applySearch(code: string): void {
    let parsed: { index?: string; q?: string; filter?: string };
    try {
      parsed = JSON.parse(code) as { index?: string; q?: string; filter?: string };
    } catch {
      return;
    }
    if (parsed.index && this.indexes().some((i) => i.uid === parsed.index)) {
      this.selectedIndex.set(parsed.index);
    }
    this.query = parsed.q ?? '';
    this.filter = parsed.filter ?? '';
    this.runSearch();
  }

  ngOnInit(): void {
    this.connect();
  }

  connect(): void {
    const id = this.applicationId();
    if (!id) return;
    this.conn.set('connecting');
    this.api.getServerInfo(id).subscribe({
      next: (info) => {
        this.server.set(info);
        this.api.indexes(id).subscribe({
          next: (idx) => {
            this.indexes.set(idx);
            this.conn.set('connected');
            if (!this.selectedIndex() && idx[0]) this.selectIndex(idx[0].uid);
          },
          error: (e) => this.fail(e),
        });
      },
      error: (e) => this.fail(e),
    });
  }

  private fail(e: unknown): void {
    this.errorMsg.set(this.msg(e));
    this.conn.set('error');
  }

  selectIndex(uid: string): void {
    this.selectedIndex.set(uid);
    this.result.set(null);
    this.queryError.set('');
    this.runSearch();
  }

  runSearch(): void {
    const id = this.applicationId();
    const index = this.selectedIndex();
    if (!id || !index) return;
    this.queryError.set('');
    this.loading.set(true);
    this.api
      .search(id, {
        index,
        q: this.query.trim() || undefined,
        filter: this.filter.trim() || undefined,
        limit: 20,
      })
      .subscribe({
        next: (r) => {
          this.result.set(r);
          this.loading.set(false);
        },
        error: (e) => {
          this.result.set(null); // don't leave stale hits under the error
          this.queryError.set(this.msg(e));
          this.loading.set(false);
        },
      });
  }

  pretty(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  back(): void {
    void this.router.navigate(['/apps/applications', this.applicationId()]);
  }

  private msg(e: unknown): string {
    if (e && typeof e === 'object' && 'error' in e) {
      const err = (e as { error?: { message?: string } }).error;
      if (err?.message) return err.message;
    }
    if (e instanceof Error) return e.message;
    return 'Something went wrong.';
  }
}
