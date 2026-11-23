import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideLock, lucideLockOpen, lucidePlay, lucideRefreshCw } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlField } from '../../../ui/patterns/field';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { DbAssistantChatComponent } from './db-assistant-chat.component';
import { GateNoticeComponent } from './gate-notice.component';
import { KafkaConsoleStateService } from './kafka-console-state.service';
import { KafkaResultComponent } from './kafka-result.component';
import { StoreConsoleHeader } from './store-console-header';

/**
 * Kafka console: a topic/cluster overview on top, a kafka-shell command runner
 * below, and the NL copilot aside. The backend holds the connection over a
 * port-forward tunnel (pinned regardless of advertised address); writes are
 * gated by the read-only toggle.
 */
@Component({
  selector: 'app-kafka-console-page',
  imports: [
    FormsModule,
    FlAlert,
    FlButton,
    FlCopyId,
    FlEmptyState,
    FlField,
    FlIcon,
    FlLoadingState,
    StoreConsoleHeader,
    FlPanel,
    FlStatus,
    FlTag,
    DbAssistantChatComponent,
    GateNoticeComponent,
    KafkaResultComponent,
  ],
  providers: [
    KafkaConsoleStateService,
    provideIcons({ lucideLock, lucideLockOpen, lucidePlay, lucideRefreshCw }),
  ],
  template: `
    <div class="fl-page">
      <app-store-console-header
        title="Kafka console"
        [appId]="applicationId()"
        [conn]="state.conn()"
        (retry)="state.connect()"
      >
        <ng-container consoleMeta>
          @if (state.conn() === 'connected') {
            <fl-status
              [tone]="state.readOnly() ? 'neutral' : 'warning'"
              [label]="state.readOnly() ? 'Read-only' : 'Writes on'"
            />
          }
          @if (state.cluster(); as c) {
            <span>{{ c.brokers.length }} broker{{ c.brokers.length === 1 ? '' : 's' }}</span>
            @if (c.clusterId) {
              <fl-copy-id [value]="c.clusterId" label="cluster ID" />
            }
          }
        </ng-container>
        <ng-container consoleActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            title="Refresh"
            (click)="state.connect()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
        </ng-container>
      </app-store-console-header>

      @if (state.conn() === 'connecting') {
        <fl-panel><fl-loading-state [rows]="4" /></fl-panel>
      } @else if (state.conn() === 'error') {
        <fl-alert tone="error" title="Could not connect">
          {{ state.errorMsg() || 'Failed to connect.' }}
        </fl-alert>
      } @else {
        <div class="flex flex-col gap-5 xl:flex-row xl:items-start">
          <div class="flex w-full shrink-0 flex-col gap-5 xl:w-64">
            <fl-panel title="Topics" [count]="state.topics().length" [flush]="true">
              @if (state.topics().length === 0) {
                <fl-empty-state
                  [compact]="true"
                  title="No topics yet"
                  body="Create one, or produce to a topic to create it."
                />
              } @else {
                <ul class="max-h-80 overflow-auto py-1">
                  @for (t of state.topics(); track t.name) {
                    <li>
                      <button
                        type="button"
                        class="flex w-full items-center gap-2 px-4 py-2 text-left text-fl-body-sm hover:bg-fl-surface-hover"
                        [class.bg-fl-accent-soft]="selectedTopic() === t.name"
                        [attr.aria-current]="selectedTopic() === t.name ? 'true' : null"
                        [title]="t.partitions + ' partitions, replication ' + t.replicationFactor"
                        (click)="describe(t.name)"
                      >
                        <span class="fl-mono min-w-0 flex-1 truncate">{{ t.name }}</span>
                        @if (t.internal) {
                          <fl-tag>internal</fl-tag>
                        }
                        <span class="fl-num text-fl-caption text-fl-ink-muted"
                          >{{ t.partitions }} × {{ t.replicationFactor }}</span
                        >
                      </button>
                    </li>
                  }
                </ul>
              }
            </fl-panel>

            <fl-panel title="Consumer groups" [count]="state.groups().length" [flush]="true">
              @if (state.groups().length === 0) {
                <fl-empty-state [compact]="true" title="No consumer groups" />
              } @else {
                <ul class="max-h-64 overflow-auto py-1">
                  @for (g of state.groups(); track g.groupId) {
                    <li>
                      <button
                        type="button"
                        class="flex w-full items-center gap-2 px-4 py-2 text-left text-fl-body-sm hover:bg-fl-surface-hover"
                        [class.bg-fl-accent-soft]="selectedGroup() === g.groupId"
                        [attr.aria-current]="selectedGroup() === g.groupId ? 'true' : null"
                        title="Show lag for this group"
                        (click)="lag(g.groupId)"
                      >
                        <span class="fl-mono min-w-0 flex-1 truncate">{{ g.groupId }}</span>
                        <span class="text-fl-caption text-fl-ink-muted">Lag</span>
                      </button>
                    </li>
                  }
                </ul>
              }
            </fl-panel>
          </div>

          <div class="flex min-w-0 flex-1 flex-col gap-5">
            <fl-panel title="kafka-shell">
              <button
                panelActions
                flButton="ghost"
                size="sm"
                type="button"
                [attr.aria-pressed]="!state.readOnly()"
                [title]="state.readOnly() ? 'Read-only: writes are blocked' : 'Writes enabled'"
                (click)="state.readOnly.set(!state.readOnly())"
              >
                <fl-icon [name]="state.readOnly() ? 'lucideLock' : 'lucideLockOpen'" [size]="14" />
                {{ state.readOnly() ? 'Allow writes' : 'Block writes' }}
              </button>

              <div class="flex flex-col gap-4">
                <app-gate-notice engine="Kafka" />

                <fl-field
                  label="Command"
                  for="kafka-command"
                  hint="Cmd or Ctrl + Enter runs the command."
                >
                  <textarea
                    id="kafka-command"
                    class="fl-textarea font-mono"
                    rows="2"
                    spellcheck="false"
                    placeholder="topics list, topic describe orders, group lag billing"
                    [(ngModel)]="state.commandText"
                    (keydown.meta.enter)="state.runCommand()"
                    (keydown.control.enter)="state.runCommand()"
                  ></textarea>
                </fl-field>

                <div class="fl-row">
                  <button
                    flButton="primary"
                    type="button"
                    [disabled]="state.running()"
                    (click)="state.runCommand()"
                  >
                    <fl-icon name="lucidePlay" [size]="14" />
                    Run
                  </button>
                  @for (ex of state.examples; track ex.label) {
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      (click)="state.loadExample(ex)"
                    >
                      <span class="fl-mono">{{ ex.label }}</span>
                      @if (ex.write) {
                        <fl-tag>write</fl-tag>
                      }
                    </button>
                  }
                </div>

                @if (state.runError(); as e) {
                  <fl-alert tone="error" title="Command failed">{{ e }}</fl-alert>
                }
              </div>
            </fl-panel>

            <app-kafka-result />
          </div>

          <app-db-assistant-chat
            [appId]="applicationId() ?? ''"
            storagePrefix="flui.kafkaconsole"
            identity="Flui Kafka assistant"
            [assist]="state.chatAssist"
            dataBlindBadge="metadata only"
            dataBlindTooltip="The assistant sees topic and consumer-group names, never message payloads."
            emptyHint="Describe what to do, for example “show lag for the billing group”, “create a 3-partition orders topic” or “read the last 20 messages from orders”. The assistant writes a kafka-shell command into the runner; review it, allow writes if needed, then run."
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

  readonly applicationId = toSignal(this.route.paramMap.pipe(map((p) => p.get('applicationId'))), {
    initialValue: this.route.snapshot.paramMap.get('applicationId'),
  });

  protected readonly selectedTopic = signal<string | null>(null);
  protected readonly selectedGroup = signal<string | null>(null);

  ngOnInit(): void {
    this.state.appId.set(this.applicationId() ?? null);
    this.state.connect();
  }

  protected describe(topic: string): void {
    this.selectedTopic.set(topic);
    this.selectedGroup.set(null);
    this.state.describeTopic(topic);
  }

  protected lag(groupId: string): void {
    this.selectedGroup.set(groupId);
    this.selectedTopic.set(null);
    this.state.groupLag(groupId);
  }
}
