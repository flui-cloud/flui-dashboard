import { Component, OnInit, inject, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { DbAssistantChatComponent } from './db-assistant-chat.component';
import { RestConsoleComponent } from './rest-console.component';
import { SearchConsoleStateService } from './search-console-state.service';
import { SearchConsoleResultsComponent } from './search-console-results.component';
import { StoreConsoleHeader } from './store-console-header';

/**
 * Read-only search console (OpenSearch / ES-wire): index list, a simple
 * full-text search box and a raw query-DSL editor, with hits rendered as JSON.
 * Mirrors the document console; the backend holds the connection over the
 * port-forward and only ever reads.
 */
@Component({
  selector: 'app-search-console-page',
  imports: [
    FlAlert,
    FlButton,
    FlIcon,
    FlLoadingState,
    StoreConsoleHeader,
    FlPanel,
    DbAssistantChatComponent,
    RestConsoleComponent,
    SearchConsoleResultsComponent,
  ],
  providers: [SearchConsoleStateService, provideIcons({ lucideRefreshCw })],
  template: `
    <div class="fl-page">
      <app-store-console-header
        title="Search console"
        [appId]="applicationId()"
        [conn]="s.conn()"
        (retry)="s.connect()"
      >
        <ng-container consoleMeta>
          @if (s.cluster(); as c) {
            <span>{{ c.distribution || 'opensearch' }} {{ c.version }}</span>
          }
        </ng-container>
        <ng-container consoleActions>
          @if (s.conn() === 'connected') {
            <div class="fl-segmented" role="group" aria-label="View">
              <button
                type="button"
                [attr.aria-pressed]="s.view() === 'browse'"
                (click)="s.view.set('browse')"
              >
                Browse
              </button>
              <button
                type="button"
                [attr.aria-pressed]="s.view() === 'console'"
                (click)="s.view.set('console')"
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
            (click)="s.connect()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
        </ng-container>
      </app-store-console-header>

      @if (s.conn() === 'connecting') {
        <fl-panel><fl-loading-state [rows]="4" /></fl-panel>
      } @else if (s.conn() === 'error') {
        <fl-alert tone="error" title="Could not connect">
          {{ s.errorMsg() || 'Failed to connect.' }}
        </fl-alert>
      } @else {
        <div class="flex min-h-96 gap-5" [class.items-start]="s.view() === 'browse'">
          @if (s.view() === 'console') {
            <section class="flex min-w-0 flex-1 flex-col">
              <app-rest-console
                [submit]="s.rawSubmit"
                [examples]="s.consoleExamples"
                engineLabel="OpenSearch"
                title="OpenSearch Dev Tools"
                syntaxHint="METHOD /path  +  JSON body  ·  ⌘/Ctrl+Enter to run"
              />
            </section>
          } @else {
            <app-search-console-results />
          }

          <app-db-assistant-chat
            [appId]="applicationId() ?? ''"
            storagePrefix="flui.searchconsole"
            identity="Flui search assistant"
            [assist]="s.chatAssist"
            dataBlindBadge="mappings only"
            dataBlindTooltip="The assistant sees index names and field types, never your documents."
            [emptyHint]="
              s.view() === 'console'
                ? 'Describe what to do, for example “create a products index with a title and price” or “add a tags field”. The assistant writes the REST call into the console; review it, allow writes if needed, then run.'
                : 'Describe what you want to find, for example “active users created this week” or “top categories by count”. The assistant proposes a query-DSL request; you review and run it.'
            "
            [codeNoun]="s.view() === 'console' ? 'request' : 'query'"
            [showInsert]="true"
            (run)="onChatRun($event)"
            (insert)="onChatInsert($event)"
          />
        </div>
      }
    </div>
  `,
})
export class SearchConsolePageComponent implements OnInit {
  protected readonly s = inject(SearchConsoleStateService);
  private readonly route = inject(ActivatedRoute);

  readonly applicationId = toSignal(this.route.paramMap.pipe(map((p) => p.get('applicationId'))), {
    initialValue: this.route.snapshot.paramMap.get('applicationId'),
  });

  private readonly shell = viewChild(RestConsoleComponent);

  ngOnInit(): void {
    this.s.appId.set(this.applicationId() ?? null);
    this.s.connect();
  }

  onChatRun(ev: { code: string; mutation: boolean }): void {
    if (this.s.view() === 'console') {
      this.shell()?.runText(ev.code, ev.mutation);
      return;
    }
    this.s.onAssistApply(ev.code);
  }

  onChatInsert(code: string): void {
    if (this.s.view() === 'console') {
      this.shell()?.setText(code);
      return;
    }
    this.s.onAssistApply(code);
  }
}
