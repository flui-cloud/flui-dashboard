import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideDatabase, lucideFileText } from '@ng-icons/lucide';
import { DocumentConsoleService } from '../../service/document-console.service';
import {
  DocumentCollection,
  DocumentDatabase,
  DocumentField,
} from '../../model/document-console.models';
import { DocumentCollectionTreeComponent } from './document-collection-tree.component';
import { DocumentListComponent } from './document-list.component';
import { DocQuery, DocumentQueryBarComponent } from './document-query-bar.component';
import { DocumentShellComponent } from './document-shell.component';
import { AssistFn, DbAssistantChatComponent } from './db-assistant-chat.component';
import { parsePlainFind } from './parse-plain-find';
import { StoreConsoleHeader } from './store-console-header';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

type ConnState = 'connecting' | 'connected' | 'error';
const PAGE_SIZE = 20;
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
  imports: [
    DocumentCollectionTreeComponent,
    DocumentQueryBarComponent,
    DocumentListComponent,
    DocumentShellComponent,
    DbAssistantChatComponent,
    StoreConsoleHeader,
    FlAlert,
    FlPanel,
    FlEmptyState,
    FlButton,
    FlIcon,
  ],
  providers: [provideIcons({ lucideDatabase, lucideFileText })],
  template: `
    <div class="fl-page">
      <app-store-console-header
        title="Document browser"
        [appId]="applicationId()"
        [conn]="conn()"
        (retry)="connect()"
      />

      @if (conn() === 'error' && connError(); as e) {
        <fl-alert tone="error" title="Could not reach the database">
          <span class="whitespace-pre-wrap">{{ e }}</span>
        </fl-alert>
      }

      <div class="flex flex-col gap-5 xl:flex-row xl:items-start">
        @if (!showTree()) {
          <button
            flButton
            [iconOnly]="true"
            type="button"
            (click)="toggleTree()"
            aria-label="Show databases"
            title="Show databases"
          >
            <fl-icon name="lucideDatabase" />
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

        <section class="fl-stack min-w-0 flex-1" aria-label="Query and documents">
          <app-document-query-bar
            [disabled]="!selectedCollection()"
            [running]="loadingDocs()"
            [fields]="fields()"
            (find)="onFind($event)"
          />

          @if (selectedCollection()) {
            <app-document-list
              [title]="selectedDb() + ' / ' + selectedCollection()"
              [durationMs]="durationMs()"
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
            <fl-panel title="Documents">
              @if (docError(); as e) {
                <fl-alert tone="error" title="Could not load collections">
                  <span class="whitespace-pre-wrap">{{ e }}</span>
                </fl-alert>
              } @else {
                <fl-empty-state
                  [compact]="true"
                  icon="lucideFileText"
                  title="No collection selected"
                  body="Select a collection to browse its documents."
                />
              }
            </fl-panel>
          }

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
          dataBlindTooltip="The assistant receives collection names and inferred field types, never document values."
          emptyHint="Describe what you need in plain language, for example “admin users created this year”. The assistant proposes a mongosh statement; you review and run it in the shell."
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

  private readonly shell = viewChild(DocumentShellComponent);
  private readonly queryBar = viewChild(DocumentQueryBarComponent);

  readonly applicationId = toSignal(this.route.paramMap.pipe(map((p) => p.get('applicationId'))), {
    initialValue: this.route.snapshot.paramMap.get('applicationId'),
  });

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
    this.shell()?.insert(statement);
  }

  onChatRun(e: { code: string; mutation: boolean }): void {
    const find = e.mutation ? null : parsePlainFind(e.code);
    if (find && this.selectedDb()) {
      this.routeFindToBar(find);
    } else {
      this.shell()?.runStatement(e.code, e.mutation);
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
    this.queryBar()?.setQuery(find.filterText, find.projectionText, find.sortText);
  }

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
