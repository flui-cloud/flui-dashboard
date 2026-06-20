import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideLoader,
  lucideRotateCcw,
  lucideSearch,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { DbAssistantChatComponent } from './db-assistant-chat.component';
import { RestConsoleComponent } from './rest-console.component';
import { SearchConsoleStateService } from './search-console-state.service';
import { SearchConsoleResultsComponent } from './search-console-results.component';

/**
 * Read-only search console (OpenSearch / ES-wire): index list, a simple
 * full-text search box and a raw query-DSL editor, with hits rendered as JSON.
 * Mirrors the document console; the backend holds the connection over the
 * port-forward and only ever reads.
 */
@Component({
  selector: 'app-search-console-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    DbAssistantChatComponent,
    RestConsoleComponent,
    SearchConsoleResultsComponent,
  ],
  providers: [
    SearchConsoleStateService,
    provideIcons({
      lucideArrowLeft,
      lucideLoader,
      lucideRotateCcw,
      lucideSearch,
      lucideTriangleAlert,
    }),
  ],
  template: `
    <div class="p-4 md:p-6">
      <!-- Header -->
      <div class="mb-4 flex items-center gap-3">
        <button
          type="button"
          (click)="s.back()"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          title="Back"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
        </button>
        <ng-icon name="lucideSearch" class="h-5 w-5 text-primary" />
        <div class="min-w-0">
          <h1 class="text-base font-semibold text-foreground">
            Search Console
            @if (s.cluster(); as c) {
              <span class="font-normal text-muted-foreground">
                · {{ c.distribution || 'opensearch' }} {{ c.version }}
              </span>
            }
          </h1>
          <p class="truncate font-mono text-xs text-muted-foreground">
            {{ applicationId() }}
          </p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          @if (s.conn() === 'connected') {
            <div
              class="inline-flex overflow-hidden rounded-md border border-border"
            >
              <button
                type="button"
                (click)="s.view.set('browse')"
                class="px-2.5 py-1 text-xs"
                [class.bg-muted]="s.view() === 'browse'"
                [class.text-foreground]="s.view() === 'browse'"
                [class.text-muted-foreground]="s.view() !== 'browse'"
              >
                Browse
              </button>
              <button
                type="button"
                (click)="s.view.set('console')"
                class="border-l border-border px-2.5 py-1 text-xs"
                [class.bg-muted]="s.view() === 'console'"
                [class.text-foreground]="s.view() === 'console'"
                [class.text-muted-foreground]="s.view() !== 'console'"
              >
                Console
              </button>
            </div>
          }
          <button
            type="button"
            (click)="s.connect()"
            class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      @if (s.conn() === 'connecting') {
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Connecting…
        </div>
      } @else if (s.conn() === 'error') {
        <div
          class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ s.errorMsg() || 'Failed to connect.' }}</span>
        </div>
      } @else {
        <div class="flex h-[calc(100vh-180px)] gap-4">
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
            dataBlindTooltip="The assistant sees index names and field types — never your documents."
            [emptyHint]="
              s.view() === 'console'
                ? 'Describe what to do — e.g. “create a products index with a title and price” or “add a tags field”. The assistant writes the REST call into the console; review it, allow writes if needed, then run.'
                : 'Describe what you want to find — e.g. “active users created this week” or “top categories by count”. The assistant proposes a query-DSL request; you review and run it.'
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

  readonly applicationId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('applicationId'))),
    { initialValue: this.route.snapshot.paramMap.get('applicationId') },
  );

  @ViewChild(RestConsoleComponent) private readonly shell?: RestConsoleComponent;

  ngOnInit(): void {
    this.s.appId.set(this.applicationId() ?? null);
    this.s.connect();
  }

  // Chat "Run": browse → apply to the DSL editor + run; console → drop into the shell
  // editor and run it THROUGH the console (honors the console's read-only toggle).
  onChatRun(ev: { code: string; mutation: boolean }): void {
    if (this.s.view() === 'console') {
      // Confirmed-in-chat write runs once as a one-off; reads honor the console toggle.
      this.shell?.runText(ev.code, ev.mutation);
      return;
    }
    this.s.onAssistApply(ev.code);
  }

  // Chat "Insert": console → only populate the shell editor (no run); browse → apply.
  onChatInsert(code: string): void {
    if (this.s.view() === 'console') {
      this.shell?.setText(code);
      return;
    }
    this.s.onAssistApply(code);
  }
}
