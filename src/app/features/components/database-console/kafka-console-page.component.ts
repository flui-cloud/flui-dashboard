import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCirclePlay,
  lucideDatabase,
  lucideLayers,
  lucideLoader,
  lucideLock,
  lucideLockOpen,
  lucideRotateCcw,
  lucideServer,
  lucideTriangleAlert,
  lucideUsers,
} from '@ng-icons/lucide';
import { DbAssistantChatComponent } from './db-assistant-chat.component';
import { GateNoticeComponent } from './gate-notice.component';
import { KafkaConsoleStateService } from './kafka-console-state.service';
import { KafkaResultComponent } from './kafka-result.component';

/**
 * Kafka console: a topic/cluster overview on top, a kafka-shell command runner
 * below, and the NL copilot aside. The backend holds the connection over a
 * port-forward tunnel (pinned regardless of advertised address); writes are
 * gated by the read-only toggle.
 */
@Component({
  selector: 'app-kafka-console-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    FormsModule,
    DbAssistantChatComponent,
    GateNoticeComponent,
    KafkaResultComponent,
  ],
  providers: [
    KafkaConsoleStateService,
    provideIcons({
      lucideArrowLeft,
      lucideCirclePlay,
      lucideDatabase,
      lucideLayers,
      lucideLoader,
      lucideLock,
      lucideLockOpen,
      lucideRotateCcw,
      lucideServer,
      lucideTriangleAlert,
      lucideUsers,
    }),
  ],
  template: `
    <div class="p-4 md:p-6">
      <!-- Header -->
      <div class="mb-4 flex items-center gap-3">
        <button
          type="button"
          (click)="state.back()"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          title="Back"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
        </button>
        <ng-icon name="lucideServer" class="h-5 w-5 text-primary" />
        <div class="min-w-0">
          <h1 class="text-base font-semibold text-foreground">
            Kafka Console
            @if (state.cluster(); as c) {
              <span class="font-normal text-muted-foreground">
                · {{ c.brokers.length }} broker{{ c.brokers.length === 1 ? '' : 's' }}
                @if (c.clusterId) { · {{ c.clusterId }} }
              </span>
            }
          </h1>
          <p class="truncate font-mono text-xs text-muted-foreground">
            {{ applicationId() }}
          </p>
        </div>
        <button
          type="button"
          (click)="state.connect()"
          class="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted"
        >
          <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      @if (state.conn() === 'connecting') {
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" /> Connecting…
        </div>
      } @else if (state.conn() === 'error') {
        <div
          class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ state.errorMsg() || 'Failed to connect.' }}</span>
        </div>
      } @else {
        <div class="flex gap-4">
          <div class="flex min-w-0 flex-1 flex-col gap-4">
            <!-- Topic visualization -->
            <section class="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div class="rounded-md border border-border lg:col-span-2">
                <div
                  class="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground"
                >
                  <ng-icon name="lucideLayers" class="h-3.5 w-3.5" /> Topics
                  <span class="ml-auto font-mono">{{ state.topics().length }}</span>
                </div>
                <div class="max-h-56 overflow-auto">
                  <table class="w-full text-sm">
                    <thead
                      class="sticky top-0 bg-muted/60 text-xs text-muted-foreground"
                    >
                      <tr>
                        <th class="px-3 py-1.5 text-left font-medium">Topic</th>
                        <th class="px-3 py-1.5 text-right font-medium">Partitions</th>
                        <th class="px-3 py-1.5 text-right font-medium">Replication</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (t of state.topics(); track t.name) {
                        <tr
                          (click)="state.describeTopic(t.name)"
                          class="cursor-pointer border-t border-border hover:bg-muted"
                          title="Describe this topic"
                        >
                          <td class="px-3 py-1.5">
                            <span class="text-foreground">{{ t.name }}</span>
                            @if (t.internal) {
                              <span
                                class="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground"
                                >internal</span
                              >
                            }
                          </td>
                          <td class="px-3 py-1.5 text-right font-mono text-muted-foreground">{{ t.partitions }}</td>
                          <td class="px-3 py-1.5 text-right font-mono text-muted-foreground">{{ t.replicationFactor }}</td>
                        </tr>
                      }
                      @if (state.topics().length === 0) {
                        <tr>
                          <td colspan="3" class="px-3 py-6 text-center text-xs text-muted-foreground">
                            No topics yet — create one or produce to auto-create.
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="rounded-md border border-border">
                <div
                  class="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground"
                >
                  <ng-icon name="lucideUsers" class="h-3.5 w-3.5" /> Consumer groups
                  <span class="ml-auto font-mono">{{ state.groups().length }}</span>
                </div>
                <ul class="max-h-56 overflow-auto py-1">
                  @for (g of state.groups(); track g.groupId) {
                    <li>
                      <button
                        type="button"
                        (click)="state.groupLag(g.groupId)"
                        class="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                        title="Show lag for this group"
                      >
                        <span class="truncate text-foreground">{{ g.groupId }}</span>
                        <span class="shrink-0 font-mono text-[10px] text-muted-foreground">lag →</span>
                      </button>
                    </li>
                  }
                  @if (state.groups().length === 0) {
                    <li class="px-3 py-6 text-center text-xs text-muted-foreground">No consumer groups.</li>
                  }
                </ul>
              </div>
            </section>

            <!-- Command runner -->
            <section class="flex flex-col rounded-md border border-border">
              <div
                class="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2"
              >
                <ng-icon name="lucideDatabase" class="h-4 w-4 text-primary" />
                <span class="text-sm font-medium text-foreground">kafka-shell</span>
                <button
                  type="button"
                  (click)="state.readOnly.set(!state.readOnly())"
                  class="ml-auto inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                  [class.border-amber-500]="!state.readOnly()"
                  [class.text-amber-600]="!state.readOnly()"
                  [class.border-border]="state.readOnly()"
                  [class.text-muted-foreground]="state.readOnly()"
                  [title]="state.readOnly() ? 'Read-only: writes are blocked' : 'Writes enabled'"
                >
                  <ng-icon [name]="state.readOnly() ? 'lucideLock' : 'lucideLockOpen'" class="h-3.5 w-3.5" />
                  {{ state.readOnly() ? 'Read-only' : 'Writes on' }}
                </button>
              </div>

              <div class="px-3 pt-3">
                <app-gate-notice engine="Kafka" />
              </div>

              <div class="p-3">
                <textarea
                  [(ngModel)]="state.commandText"
                  (keydown.meta.enter)="state.runCommand()"
                  (keydown.control.enter)="state.runCommand()"
                  rows="2"
                  spellcheck="false"
                  placeholder="e.g. topics list   ·   topic describe orders   ·   group lag billing"
                  class="w-full rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground"
                ></textarea>
                <div class="mt-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    (click)="state.runCommand()"
                    [disabled]="state.running()"
                    class="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <ng-icon name="lucideCirclePlay" class="h-3.5 w-3.5" /> Run
                    <span class="opacity-70">⌘↵</span>
                  </button>
                  @for (ex of state.examples; track ex.label) {
                    <button
                      type="button"
                      (click)="state.loadExample(ex)"
                      class="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-muted"
                    >
                      {{ ex.label }}
                      @if (ex.write) {
                        <span class="rounded bg-amber-500/15 px-1 text-[10px] text-amber-600">write</span>
                      }
                    </button>
                  }
                </div>

                @if (state.runError(); as e) {
                  <div
                    class="mt-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                  >
                    <ng-icon name="lucideTriangleAlert" class="h-3.5 w-3.5" />
                    {{ e }}
                  </div>
                }

                <app-kafka-result />
              </div>
            </section>
          </div>

          <app-db-assistant-chat
            [appId]="applicationId() ?? ''"
            storagePrefix="flui.kafkaconsole"
            identity="Flui Kafka assistant"
            [assist]="state.chatAssist"
            dataBlindBadge="metadata only"
            dataBlindTooltip="The assistant sees topic and consumer-group names — never message payloads."
            emptyHint="Describe what to do — e.g. “show lag for the billing group”, “create a 3-partition orders topic”, or “read the last 20 messages from orders”. The assistant writes a kafka-shell command into the runner; review it, allow writes if needed, then run."
            codeNoun="command"
            [showInsert]="true"
            (run)="state.onChatRun($event)"
            (insert)="state.onChatInsert($event)"
          />
        </div>
      }
    </div>
  `,
})
export class KafkaConsolePageComponent implements OnInit {
  protected readonly state = inject(KafkaConsoleStateService);
  private readonly route = inject(ActivatedRoute);

  readonly applicationId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('applicationId'))),
    { initialValue: this.route.snapshot.paramMap.get('applicationId') },
  );

  ngOnInit(): void {
    this.state.appId.set(this.applicationId() ?? null);
    this.state.connect();
  }
}
