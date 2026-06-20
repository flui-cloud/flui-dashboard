import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { SearchConsoleService } from '../../service/search-console.service';
import {
  SearchClusterInfo,
  SearchIndex,
  SearchResponse,
} from '../../model/search-console.models';
import { AssistFn } from './db-assistant-chat.component';
import { RawConsoleExample, RawConsoleSubmit } from './rest-console.component';
import { consoleError, formatRaw } from './search-format';

type ConnState = 'connecting' | 'connected' | 'error';
type Mode = 'simple' | 'dsl';
type View = 'browse' | 'console';

@Injectable()
export class SearchConsoleStateService {
  private readonly api = inject(SearchConsoleService);
  private readonly router = inject(Router);

  readonly appId = signal<string | null>(null);

  readonly conn = signal<ConnState>('connecting');
  readonly errorMsg = signal('');
  readonly cluster = signal<SearchClusterInfo | null>(null);
  readonly indices = signal<SearchIndex[]>([]);
  readonly selectedIndex = signal<string | null>(null);
  readonly mode = signal<Mode>('simple');
  readonly view = signal<View>('browse');

  readonly result = signal<SearchResponse | null>(null);
  readonly loading = signal(false);
  readonly queryError = signal('');

  simpleQuery = '';
  dslText = '{\n  "query": {\n    "match_all": {}\n  }\n}';

  readonly hasIndex = computed(() => !!this.selectedIndex());

  readonly rawSubmit: RawConsoleSubmit = (req) =>
    this.api.runRaw(this.appId() ?? '', req);

  readonly consoleExamples: RawConsoleExample[] = [
    { label: 'List indices', text: 'GET /_cat/indices?v' },
    { label: 'Cluster health', text: 'GET /_cluster/health' },
    { label: 'Get mapping', text: 'GET /my-index/_mapping' },
    {
      label: 'Create index',
      write: true,
      text: 'PUT /my-index\n{\n  "mappings": {\n    "properties": {\n      "title": { "type": "text" },\n      "created_at": { "type": "date" }\n    }\n  }\n}',
    },
    {
      label: 'Index a doc',
      write: true,
      text: 'POST /my-index/_doc\n{\n  "title": "hello world",\n  "created_at": "2026-06-17"\n}',
    },
    {
      label: 'Search',
      text: 'POST /my-index/_search\n{\n  "query": { "match_all": {} }\n}',
    },
    { label: 'Delete index', write: true, text: 'DELETE /my-index' },
  ];

  // NL→query-DSL copilot. The "code" carries the full { index, body } request so
  // applying it sets both the target index and the DSL editor. Read-only: never a mutation.
  readonly searchAssist: AssistFn = (prompt, conversation, model) => {
    const id = this.appId() ?? '';
    return this.api
      .assist(id, {
        prompt,
        index: this.selectedIndex() ?? undefined,
        conversation,
        ...model,
      })
      .pipe(
        map((r) => ({
          text: r.explanation,
          code:
            r.body && Object.keys(r.body).length
              ? JSON.stringify({ index: r.index, body: r.body }, null, 2)
              : undefined,
          mutation: false,
        })),
      );
  };

  // Dev Tools copilot. The "code" is the full raw request text (METHOD /path + JSON
  // body) the shell editor receives; mutation = the call writes (per the engine classifier).
  readonly rawAssist: AssistFn = (prompt, conversation, model) => {
    const id = this.appId() ?? '';
    return this.api
      .assistRaw(id, {
        prompt,
        index: this.selectedIndex() ?? undefined,
        conversation,
        ...model,
      })
      .pipe(
        map((r) => ({
          text: r.explanation,
          code: r.method && r.path ? formatRaw(r) : undefined,
          mutation: r.write,
        })),
      );
  };

  // One chat, two targets: the search box (browse) vs the Dev Tools shell (console).
  readonly chatAssist: AssistFn = (prompt, conversation, model) =>
    this.view() === 'console'
      ? this.rawAssist(prompt, conversation, model)
      : this.searchAssist(prompt, conversation, model);

  connect(): void {
    const id = this.appId();
    if (!id) return;
    this.conn.set('connecting');
    this.api.getClusterInfo(id).subscribe({
      next: (info) => {
        this.cluster.set(info);
        this.api.listIndices(id).subscribe({
          next: (idx) => {
            this.indices.set(idx);
            this.conn.set('connected');
            if (!this.selectedIndex() && idx[0]) this.selectIndex(idx[0].name);
          },
          error: (e) => this.fail(e),
        });
      },
      error: (e) => this.fail(e),
    });
  }

  private fail(e: unknown): void {
    this.errorMsg.set(consoleError(e));
    this.conn.set('error');
  }

  selectIndex(name: string): void {
    this.selectedIndex.set(name);
    this.result.set(null);
    this.queryError.set('');
    this.run();
  }

  run(): void {
    const id = this.appId();
    const index = this.selectedIndex();
    if (!id || !index) return;
    this.queryError.set('');

    let body: Record<string, unknown>;
    if (this.mode() === 'dsl') {
      try {
        body = JSON.parse(this.dslText) as Record<string, unknown>;
      } catch (e) {
        this.queryError.set(
          `Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}`,
        );
        return;
      }
    } else {
      const q = this.simpleQuery.trim();
      body = q
        ? { query: { query_string: { query: q, default_operator: 'AND' } } }
        : { query: { match_all: {} } };
    }

    this.loading.set(true);
    this.api.query(id, { index, body, from: 0, size: 20 }).subscribe({
      next: (r) => {
        this.result.set(r);
        this.loading.set(false);
      },
      error: (e) => {
        this.result.set(null); // don't leave stale hits under the error
        this.queryError.set(consoleError(e));
        this.loading.set(false);
      },
    });
  }

  // Apply a copilot suggestion: parse { index, body }, point the editor at that index
  // in DSL mode, and run it.
  onAssistApply(code: string): void {
    let parsed: { index?: string; body?: Record<string, unknown> };
    try {
      parsed = JSON.parse(code) as {
        index?: string;
        body?: Record<string, unknown>;
      };
    } catch {
      return;
    }
    const body = parsed.body ?? (parsed as Record<string, unknown>);
    if (parsed.index && this.indices().some((i) => i.name === parsed.index)) {
      this.selectedIndex.set(parsed.index);
    }
    this.mode.set('dsl');
    this.dslText = JSON.stringify(body, null, 2);
    this.run();
  }

  back(): void {
    void this.router.navigate(['/apps/applications', this.appId()]);
  }
}
