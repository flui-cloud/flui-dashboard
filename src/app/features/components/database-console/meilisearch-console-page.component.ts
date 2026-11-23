import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucidePlay, lucideRefreshCw, lucideSearch } from '@ng-icons/lucide';
import { MeilisearchConsoleService } from '../../service/meilisearch-console.service';
import {
  MeiliIndex,
  MeiliSearchResult,
  MeiliServerInfo,
} from '../../model/meilisearch-console.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { AssistFn, DbAssistantChatComponent } from './db-assistant-chat.component';
import { MEILI_CONSOLE_EXAMPLES, formatMeiliRaw, meiliError } from './meilisearch-examples';
import { RawConsoleSubmit, RestConsoleComponent } from './rest-console.component';
import { StoreConsoleHeader } from './store-console-header';

type ConnState = 'connecting' | 'connected' | 'error';
type View = 'browse' | 'console';

/**
 * Meilisearch console: index list + a `q`/filter search browse, a raw REST Dev
 * Tools shell, and an NL copilot. The backend holds the connection over the
 * port-forward tunnel; writes are gated by the Dev Tools read-only toggle.
 */
@Component({
  selector: 'app-meilisearch-console-page',
  imports: [
    FormsModule,
    FlAlert,
    FlButton,
    FlEmptyState,
    FlField,
    FlIcon,
    FlLoadingState,
    StoreConsoleHeader,
    FlPanel,
    DbAssistantChatComponent,
    RestConsoleComponent,
  ],
  providers: [provideIcons({ lucidePlay, lucideRefreshCw, lucideSearch })],
  template: `
    <div class="fl-page">
      <app-store-console-header
        title="Meilisearch console"
        [appId]="applicationId()"
        [conn]="conn()"
        (retry)="connect()"
      >
        <ng-container consoleMeta>
          @if (server(); as s) {
            <span>Version {{ s.version }}</span>
          }
        </ng-container>
        <ng-container consoleActions>
          @if (conn() === 'connected') {
            <div class="fl-segmented" role="group" aria-label="View">
              <button
                type="button"
                [attr.aria-pressed]="view() === 'browse'"
                (click)="view.set('browse')"
              >
                Browse
              </button>
              <button
                type="button"
                [attr.aria-pressed]="view() === 'console'"
                (click)="view.set('console')"
              >
                Console
              </button>
            </div>
          }
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            title="Refresh"
            (click)="connect()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
        </ng-container>
      </app-store-console-header>

      @if (conn() === 'connecting') {
        <fl-panel><fl-loading-state [rows]="4" /></fl-panel>
      } @else if (conn() === 'error') {
        <fl-alert tone="error" title="Could not connect">
          {{ errorMsg() || 'Failed to connect.' }}
        </fl-alert>
      } @else {
        <div class="flex min-h-96 gap-5" [class.items-start]="view() === 'browse'">
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
            <fl-panel
              class="w-60 shrink-0"
              title="Indexes"
              [count]="indexes().length"
              [flush]="true"
            >
              @if (indexes().length === 0) {
                <fl-empty-state [compact]="true" title="No indexes yet" />
              } @else {
                <ul class="max-h-96 overflow-auto py-1">
                  @for (idx of indexes(); track idx.uid) {
                    <li>
                      <button
                        type="button"
                        class="flex w-full items-center gap-2 px-4 py-2 text-left text-fl-body-sm hover:bg-fl-surface-hover"
                        [class.bg-fl-accent-soft]="selectedIndex() === idx.uid"
                        [attr.aria-current]="selectedIndex() === idx.uid ? 'true' : null"
                        (click)="selectIndex(idx.uid)"
                      >
                        <span class="fl-mono min-w-0 flex-1 truncate">{{ idx.uid }}</span>
                        <span class="fl-num text-fl-caption text-fl-ink-muted">{{
                          idx.numberOfDocuments ?? 0
                        }}</span>
                      </button>
                    </li>
                  }
                </ul>
              }
            </fl-panel>

            <div class="flex min-w-0 flex-1 flex-col gap-5">
              @if (!selectedIndex()) {
                <fl-panel>
                  <fl-empty-state
                    [compact]="true"
                    icon="lucideSearch"
                    title="Select an index to search"
                  />
                </fl-panel>
              } @else {
                <fl-panel [title]="'Search ' + selectedIndex()">
                  <div class="flex flex-col gap-4">
                    <div class="flex items-end gap-2">
                      <fl-field class="min-w-0 flex-1" label="Search text" for="meili-q">
                        <div class="fl-input fl-input--lg">
                          <input
                            id="meili-q"
                            type="text"
                            placeholder="Empty matches everything"
                            [(ngModel)]="query"
                            (keydown.enter)="runSearch()"
                          />
                        </div>
                      </fl-field>
                      <button
                        flButton="primary"
                        type="button"
                        [disabled]="loading()"
                        (click)="runSearch()"
                      >
                        <fl-icon name="lucidePlay" [size]="14" />
                        Search
                      </button>
                    </div>
                    <fl-field
                      label="Filter"
                      for="meili-filter"
                      hint="Optional, for example genre = horror AND rating > 4"
                    >
                      <div class="fl-input fl-input--lg font-mono">
                        <input
                          id="meili-filter"
                          type="text"
                          [(ngModel)]="filter"
                          (keydown.enter)="runSearch()"
                        />
                      </div>
                    </fl-field>
                    @if (queryError(); as e) {
                      <fl-alert tone="error" title="Search failed">{{ e }}</fl-alert>
                    }
                  </div>
                </fl-panel>

                @if (result(); as r) {
                  <fl-panel title="Hits" [count]="r.estimatedTotalHits" [flush]="true">
                    <span panelActions class="fl-num text-fl-caption text-fl-ink-muted"
                      >{{ r.processingTimeMs }} ms</span
                    >
                    @if (r.hits.length === 0) {
                      <fl-empty-state [compact]="true" title="No documents matched" />
                    } @else {
                      <ul class="flex flex-col">
                        @for (h of r.hits; track $index) {
                          <li class="border-b border-fl-border-subtle last:border-b-0">
                            <pre class="fl-mono m-0 overflow-auto px-4 py-3">{{ pretty(h) }}</pre>
                          </li>
                        }
                      </ul>
                    }
                  </fl-panel>
                } @else if (loading()) {
                  <fl-panel title="Hits"><fl-loading-state [rows]="3" /></fl-panel>
                }
              }
            </div>
          }

          <app-db-assistant-chat
            [appId]="applicationId() ?? ''"
            storagePrefix="flui.meiliconsole"
            identity="Flui search assistant"
            [assist]="chatAssist"
            dataBlindBadge="index names only"
            dataBlindTooltip="The assistant sees index names, never your documents."
            [emptyHint]="
              view() === 'console'
                ? 'Describe what to do, for example “create a movies index”, “list all indexes” or “show the settings of movies”. The assistant writes the REST call into the console; review it, allow writes if needed, then run.'
                : 'Describe what you want to find, for example “horror movies rated over 4” or “documents about wireless mice”. The assistant proposes a search (text and filter); you review and run it.'
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

  readonly applicationId = toSignal(this.route.paramMap.pipe(map((p) => p.get('applicationId'))), {
    initialValue: this.route.snapshot.paramMap.get('applicationId'),
  });

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

  private readonly shell = viewChild(RestConsoleComponent);

  readonly rawSubmit: RawConsoleSubmit = (req) => this.api.runRaw(this.applicationId() ?? '', req);

  readonly consoleExamples = MEILI_CONSOLE_EXAMPLES;

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
          code: r.path ? formatMeiliRaw(r) : undefined,
          mutation: r.write,
        })),
      );

  readonly chatAssist: AssistFn = (prompt, conversation, model) =>
    this.view() === 'console'
      ? this.rawAssist(prompt, conversation, model)
      : this.searchAssist(prompt, conversation, model);

  onChatRun(ev: { code: string; mutation: boolean }): void {
    if (this.view() === 'console') {
      this.shell()?.runText(ev.code, ev.mutation);
      return;
    }
    this.applySearch(ev.code);
  }

  onChatInsert(code: string): void {
    if (this.view() === 'console') {
      this.shell()?.setText(code);
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
    this.errorMsg.set(meiliError(e));
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
          this.result.set(null);
          this.queryError.set(meiliError(e));
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
}
