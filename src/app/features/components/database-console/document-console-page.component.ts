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
import { map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideDatabase,
  lucideLoader,
  lucideRotateCcw,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { DocumentConsoleService } from '../../service/document-console.service';
import {
  DocumentCollection,
  DocumentDatabase,
  DocumentField,
} from '../../model/document-console.models';
import { DocumentCollectionTreeComponent } from './document-collection-tree.component';
import { DocumentListComponent } from './document-list.component';
import {
  DocQuery,
  DocumentQueryBarComponent,
} from './document-query-bar.component';
import { DocumentShellComponent } from './document-shell.component';
import {
  AssistFn,
  DbAssistantChatComponent,
} from './db-assistant-chat.component';
import { parsePlainFind } from './parse-plain-find';

type ConnState = 'connecting' | 'connected' | 'error';
const PAGE_SIZE = 20;
// Databases we don't auto-select (FerretDB/Mongo housekeeping).
const SYSTEM_DBS = new Set(['admin', 'local', 'config']);
const EMPTY_QUERY: DocQuery = {
  filterText: '',
  projectionText: '',
  sortText: '',
};

/**
 * Document Browser (Compass model): databases→collections tree, a find-only
 * query bar, and a read-only result list. Writes/admin live in the (Phase 2)
 * mongo shell — never here. Orchestrates the children; backend holds the
 * connection over the port-forward.
 */
@Component({
  selector: 'app-document-console-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    DocumentCollectionTreeComponent,
    DocumentQueryBarComponent,
    DocumentListComponent,
    DocumentShellComponent,
    DbAssistantChatComponent,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideDatabase,
      lucideLoader,
      lucideRotateCcw,
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
        <ng-icon name="lucideDatabase" class="h-5 w-5 text-primary" />
        <div class="min-w-0">
          <h1 class="text-base font-semibold text-foreground">Document Browser</h1>
          <p class="truncate font-mono text-xs text-muted-foreground">{{ applicationId() }}</p>
        </div>
        <div class="ml-auto flex items-center gap-2 text-xs">
          @switch (conn()) {
            @case ('connecting') {
              <span class="inline-flex items-center gap-1 text-muted-foreground">
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" /> Connecting…
              </span>
            }
            @case ('connected') {
              <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                Connected
              </span>
            }
            @case ('error') {
              <button
                type="button"
                (click)="connect()"
                class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted"
              >
                <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" /> Retry
              </button>
            }
          }
        </div>
      </div>

      @if (conn() === 'error' && connError(); as e) {
        <div
          class="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div class="font-medium">Couldn't reach the database.</div>
            <div class="mt-0.5 whitespace-pre-wrap text-xs">{{ e }}</div>
          </div>
        </div>
      }

      <div class="flex h-[calc(100vh-180px)] gap-4">
        @if (!showTree()) {
          <button
            type="button"
            (click)="toggleTree()"
            title="Show databases"
            class="flex h-8 w-8 shrink-0 self-start items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ng-icon name="lucideDatabase" class="h-4 w-4" />
          </button>
        } @else {
          <app-document-collection-tree
            [databases]="databases()"
            [selectedDb]="selectedDb()"
            [collections]="collections()"
            [loadingCollections]="loadingCollections()"
            [selectedCollection]="selectedCollection()"
            [loading]="conn() === 'connecting'"
            (selectDb)="selectDb($event)"
            (selectCollection)="selectCollection($event)"
            (refresh)="connect()"
            (collapse)="toggleTree()"
          />
        }

        <section class="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
          <app-document-query-bar
            [disabled]="!selectedCollection()"
            [running]="loadingDocs()"
            [fields]="fields()"
            (find)="onFind($event)"
          />

          <div class="min-h-0 flex-1 overflow-y-auto">
            @if (selectedCollection()) {
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <span class="break-all font-mono text-sm font-medium">{{ selectedDb() }} / {{ selectedCollection() }}</span>
                @if (durationMs() !== null) {
                  <span class="ml-auto text-xs text-muted-foreground">{{ durationMs() }}ms</span>
                }
              </div>
              <app-document-list
                [documents]="documents()"
                [loading]="loadingDocs()"
                [error]="docError()"
                [page]="page()"
                [pageSize]="pageSize"
                [hasNext]="hasNext()"
                (prevPage)="prevPage()"
                (nextPage)="nextPage()"
              />
            } @else {
              <p class="text-sm text-muted-foreground">Select a collection to browse documents.</p>
            }
          </div>

          <app-document-shell
            [appId]="applicationId() ?? ''"
            [database]="selectedDb()"
            (changed)="onShellChanged()"
          />
        </section>

        <app-db-assistant-chat
          [appId]="applicationId() ?? ''"
          storagePrefix="flui.docconsole"
          identity="Flui Document Assistant"
          [assist]="docAssist"
          [showInsert]="true"
          dataBlindBadge="structure only"
          dataBlindTooltip="The assistant receives collection names and inferred field types — never document values."
          emptyHint="Describe what you need in plain language — e.g. “admin users created this year”. The assistant proposes a mongosh statement; you review and run it in the shell."
          codeNoun="statement"
          (insert)="onChatInsert($event)"
          (run)="onChatRun($event)"
        />
      </div>
    </div>
  `,
})
export class DocumentConsolePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly docs = inject(DocumentConsoleService);

  @ViewChild(DocumentShellComponent) private readonly shell?: DocumentShellComponent;
  @ViewChild(DocumentQueryBarComponent) private readonly queryBar?: DocumentQueryBarComponent;

  readonly applicationId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('applicationId'))),
    { initialValue: this.route.snapshot.paramMap.get('applicationId') },
  );

  readonly conn = signal<ConnState>('connecting');
  readonly connError = signal<string | null>(null);
  readonly databases = signal<DocumentDatabase[]>([]);

  readonly selectedDb = signal<string | null>(null);
  readonly collections = signal<DocumentCollection[]>([]);
  readonly loadingCollections = signal(false);

  readonly selectedCollection = signal<string | null>(null);
  readonly fields = signal<DocumentField[]>([]);
  readonly documents = signal<unknown[]>([]);
  readonly hasNext = signal(false);
  readonly loadingDocs = signal(false);
  readonly docError = signal<string | null>(null);
  readonly durationMs = signal<number | null>(null);
  readonly showTree = signal(true);
  readonly page = signal(0);
  protected readonly pageSize = PAGE_SIZE;

  private query: DocQuery = { ...EMPTY_QUERY };

  // NL→mongosh copilot: same chat shell as the SQL/KV consoles, document KB. Data-blind —
  // sends the active database/collection (names + inferred field types) plus the question.
  readonly docAssist: AssistFn = (prompt, conversation, model) => {
    const id = this.applicationId() ?? '';
    return this.docs
      .assist(id, {
        prompt,
        conversation,
        database: this.selectedDb() ?? undefined,
        collection: this.selectedCollection() ?? undefined,
        ...model,
      })
      .pipe(
        map((r) => ({
          text: r.explanation,
          code: r.shell || undefined,
          mutation: r.mutation,
        })),
      );
  };

  ngOnInit(): void {
    this.connect();
  }

  onChatInsert(statement: string): void {
    this.shell?.insert(statement);
  }

  // Smart routing: a plain find on an available collection lands in the top query bar (main
  // paged grid); aggregate / count / writes / admin — anything else — runs in the shell.
  onChatRun(e: { code: string; mutation: boolean }): void {
    const find = e.mutation ? null : parsePlainFind(e.code);
    // A plain find lands in the top query bar (main paged grid) as long as a database is
    // selected to run it against; routeFindToBar selects the collection if needed. Everything
    // else — aggregate / count / writes / admin / no db context — runs in the shell.
    if (find && this.selectedDb()) {
      this.routeFindToBar(find);
    } else {
      // Writes/aggregate/admin run in the shell. A confirmed-in-chat write runs once as a
      // one-off (forceWrite) without arming the shell toggle; reads/aggregates honor it.
      this.shell?.runStatement(e.code, e.mutation);
    }
  }

  private routeFindToBar(find: {
    collection: string;
    filterText: string;
    projectionText: string;
    sortText: string;
  }): void {
    if (this.selectedCollection() !== find.collection) {
      this.selectedCollection.set(find.collection);
      this.loadFields(find.collection);
    }
    this.queryBar?.setQuery(find.filterText, find.projectionText, find.sortText);
  }

  // A shell write may have changed data or structure — refresh the browse pane.
  onShellChanged(): void {
    const id = this.applicationId();
    const database = this.selectedDb();
    if (!id || !database) return;
    this.docs.getCollections(id, database).subscribe({
      next: (cols) => this.collections.set(cols),
      error: () => undefined,
    });
    const collection = this.selectedCollection();
    if (collection) {
      this.loadFields(collection);
      this.loadPage();
    }
  }

  back(): void {
    void this.router.navigate(['/apps/applications', this.applicationId()]);
  }

  toggleTree(): void {
    this.showTree.update((v) => !v);
  }

  connect(): void {
    const id = this.applicationId();
    if (!id) return;
    this.conn.set('connecting');
    this.connError.set(null);
    this.databases.set([]);
    this.docs.getDatabases(id).subscribe({
      next: (dbs) => {
        this.databases.set(dbs);
        this.conn.set('connected');
        // Auto-select the first user database so there's always a browse context: the
        // grid + the assistant's find-routing need a selected collection, and the shell
        // gets a real db (not the 'test' default). System dbs are skipped.
        if (!this.selectedDb()) {
          const firstUser = dbs.find((d) => !SYSTEM_DBS.has(d.name));
          if (firstUser) this.selectDb(firstUser.name);
        }
      },
      error: (err) => {
        this.conn.set('error');
        this.connError.set(this.messageFrom(err));
      },
    });
  }

  selectDb(name: string): void {
    // Re-clicking the active database is a no-op — don't silently blank the
    // browse pane (it reads as a selection, not a toggle).
    if (this.selectedDb() === name) return;
    this.selectedDb.set(name);
    this.collections.set([]);
    this.selectedCollection.set(null);
    this.fields.set([]);
    this.documents.set([]);
    this.docError.set(null);
    const id = this.applicationId();
    if (!id) return;
    this.loadingCollections.set(true);
    this.docs.getCollections(id, name).subscribe({
      next: (cols) => {
        this.collections.set(cols);
        this.loadingCollections.set(false);
      },
      error: (err) => {
        this.loadingCollections.set(false);
        this.docError.set(this.messageFrom(err));
      },
    });
  }

  selectCollection(name: string): void {
    this.selectedCollection.set(name);
    this.query = { ...EMPTY_QUERY };
    this.loadFields(name);
    this.onFind(this.query);
  }

  // Sampled field structure for the query-bar autocomplete (best-effort; a failure
  // just means no suggestions, never a broken browse).
  private loadFields(collection: string): void {
    const id = this.applicationId();
    const database = this.selectedDb();
    this.fields.set([]);
    if (!id || !database) return;
    this.docs.getFields(id, database, collection).subscribe({
      next: (f) => this.fields.set(f),
      error: () => this.fields.set([]),
    });
  }

  onFind(q: DocQuery): void {
    this.query = q;
    this.page.set(0);
    this.durationMs.set(null);
    this.loadPage();
  }

  nextPage(): void {
    if (!this.hasNext() || this.loadingDocs()) return;
    this.page.update((p) => p + 1);
    this.loadPage();
  }

  prevPage(): void {
    if (this.page() === 0 || this.loadingDocs()) return;
    this.page.update((p) => Math.max(0, p - 1));
    this.loadPage();
  }

  // One fixed page of PAGE_SIZE; the result replaces the previous page (no infinite
  // scroll). `truncated` (server fetches pageSize+1) tells us a next page exists.
  private loadPage(): void {
    const id = this.applicationId();
    const database = this.selectedDb();
    const collection = this.selectedCollection();
    if (!id || !database || !collection || this.loadingDocs()) return;

    this.docError.set(null);
    this.loadingDocs.set(true);
    this.docs
      .findDocuments(id, {
        database,
        collection,
        filterText: this.query.filterText || undefined,
        projectionText: this.query.projectionText || undefined,
        sortText: this.query.sortText || undefined,
        limit: this.pageSize,
        skip: this.page() * this.pageSize,
      })
      .subscribe({
        next: (page) => {
          this.documents.set(page.documents);
          this.hasNext.set(page.truncated);
          this.durationMs.set(page.durationMs);
          this.loadingDocs.set(false);
        },
        error: (err) => {
          this.loadingDocs.set(false);
          this.docError.set(this.messageFrom(err));
        },
      });
  }

  private messageFrom(err: unknown): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? 'Request failed';
  }
}
