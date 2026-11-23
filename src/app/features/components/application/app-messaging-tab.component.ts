import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApplicationService } from '../../service/application.service';
import { AppMessaging, AppMessagingService, QueueView } from '../../service/app-messaging.service';
import { consoleError } from '../database-console/search-format';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';

@Component({
  selector: 'app-messaging-tab',
  imports: [
    FormsModule,
    FlPanel,
    FlTable,
    FlAlert,
    FlField,
    FlCopyId,
    FlKeyValue,
    FlKvItem,
    FlEmptyState,
    FlStatus,
    FlButton,
    FlActionsMenu,
  ],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Messaging" data-testid="messaging">
      @if (state()?.connected) {
        <button
          panelActions
          flButton
          size="sm"
          type="button"
          [disabled]="busy()"
          (click)="disconnect()"
        >
          Disconnect
        </button>
      }
      <div class="flex flex-col gap-4">
        @if (error()) {
          <fl-alert tone="error" title="Request failed">{{ error() }}</fl-alert>
        }
        @if (state(); as s) {
          @if (s.connected) {
            <fl-status tone="success" label="Connected" />
            <fl-key-value>
              <fl-kv-item key="Address">
                @if (s.url) {
                  <fl-copy-id [value]="s.url" label="address" />
                } @else {
                  —
                }
              </fl-kv-item>
              <fl-kv-item key="Variables" [mono]="true">NATS_URL, NATS_CREDS</fl-kv-item>
            </fl-key-value>
          } @else {
            <fl-status tone="neutral" label="Not connected" />
            <p class="text-fl-body-sm text-fl-ink-muted">
              Give this app its own account on the cluster's NATS, with queues and streams no other
              app can see. It receives NATS_URL and NATS_CREDS and is redeployed.
            </p>
            <div>
              <button flButton="primary" type="button" [disabled]="busy()" (click)="connect()">
                Connect
              </button>
            </div>
          }
        }
      </div>
    </fl-panel>

    @if (state()?.connected) {
      <fl-panel title="Queues" [count]="queues().length" [flush]="true" data-testid="queues">
        @if (queues().length === 0) {
          <fl-empty-state [compact]="true" title="No queues yet" />
        } @else {
          <div class="fl-table-wrap relative">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col" class="is-num">Waiting</th>
                  <th scope="col" class="is-num">In flight</th>
                  <th scope="col" class="is-num">Given up</th>
                  <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (q of queues(); track q.name) {
                  <tr>
                    <td class="fl-mono">{{ q.name }}</td>
                    <td class="is-num">{{ q.waiting }}</td>
                    <td class="is-num">{{ q.inFlight }}</td>
                    <td class="is-num">{{ q.deadLetters ?? '—' }}</td>
                    <td class="is-fit">
                      <fl-actions-menu
                        label="Queue actions"
                        [compact]="true"
                        [items]="queueActions()"
                        (action)="deleteQueue(q.name)"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        <form class="flex flex-col gap-2 border-t border-fl-border p-4" (ngSubmit)="createQueue()">
          <div class="flex flex-wrap items-end gap-3">
            <fl-field label="New queue" for="messaging-queue-name">
              <div class="fl-input fl-input--lg">
                <input
                  id="messaging-queue-name"
                  class="fl-mono"
                  name="qname"
                  placeholder="ORDERS"
                  [(ngModel)]="queueName"
                  required
                />
              </div>
            </fl-field>
            <button flButton="primary" type="submit" [disabled]="busy() || !queueName">
              Add queue
            </button>
          </div>
          <p class="text-fl-caption text-fl-ink-muted">
            Kept 7 days, 5 deliveries, failed messages kept apart.
          </p>
        </form>
      </fl-panel>

      <fl-panel title="Scale on a queue" data-testid="queue-scaling">
        @if (state()?.queueScaling) {
          <button
            panelActions
            flButton
            size="sm"
            type="button"
            [disabled]="busy()"
            (click)="stopScaling()"
          >
            Stop scaling
          </button>
        }
        @if (state()?.queueScaling; as qs) {
          <div class="flex flex-col gap-4">
            <fl-status tone="success" label="Scaling on the queue" />
            <fl-key-value>
              <fl-kv-item key="Queue" [mono]="true">{{ qs.stream }}</fl-kv-item>
              <fl-kv-item key="Per replica">{{ qs.lagThreshold }} messages waiting</fl-kv-item>
              <fl-kv-item key="Replicas">{{ qs.min }} to {{ qs.max }}</fl-kv-item>
            </fl-key-value>
            @if (qs.min === 0) {
              <p class="text-fl-body-sm text-fl-ink-muted">
                The app stops while the queue is empty.
              </p>
            }
          </div>
        } @else if (queues().length === 0) {
          <p class="text-fl-body-sm text-fl-ink-muted">Add a queue first.</p>
        } @else {
          <form class="flex flex-col gap-4" (ngSubmit)="scale()">
            <div class="grid gap-3 sm:grid-cols-4">
              <fl-field label="Queue" for="messaging-scale-queue">
                <span class="fl-select-wrap">
                  <select
                    id="messaging-scale-queue"
                    class="fl-select fl-mono"
                    name="sq"
                    [(ngModel)]="scaleQueue"
                    required
                  >
                    @for (q of queues(); track q.name) {
                      <option [value]="q.name">{{ q.name }}</option>
                    }
                  </select>
                </span>
              </fl-field>
              <fl-field label="Per replica" for="messaging-scale-lag">
                <div class="fl-input fl-input--lg">
                  <input
                    id="messaging-scale-lag"
                    name="lag"
                    type="number"
                    min="1"
                    [(ngModel)]="scaleLag"
                  />
                </div>
              </fl-field>
              <fl-field label="Min" for="messaging-scale-min">
                <div class="fl-input fl-input--lg">
                  <input
                    id="messaging-scale-min"
                    name="min"
                    type="number"
                    min="0"
                    [(ngModel)]="scaleMin"
                  />
                </div>
              </fl-field>
              <fl-field label="Max" for="messaging-scale-max">
                <div class="fl-input fl-input--lg">
                  <input
                    id="messaging-scale-max"
                    name="max"
                    type="number"
                    min="1"
                    [(ngModel)]="scaleMax"
                  />
                </div>
              </fl-field>
            </div>
            <p class="text-fl-body-sm text-fl-ink-muted">
              With Min at 0 the app stops while the queue is empty and starts when a message
              arrives.
            </p>
            <div>
              <button flButton size="sm" type="submit" [disabled]="busy() || !scaleQueue">
                Scale
              </button>
            </div>
          </form>
        }
      </fl-panel>
    }
  `,
})
export class AppMessagingTabComponent {
  private readonly appService = inject(ApplicationService);
  private readonly messaging = inject(AppMessagingService);
  private readonly app = computed(() => this.appService.selectedApplication());

  readonly state = signal<AppMessaging | null>(null);
  readonly queues = signal<QueueView[]>([]);
  queueName = '';
  scaleQueue = '';
  scaleLag = 10;
  scaleMin = 0;
  scaleMax = 5;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly queueActions = computed<MenuAction[]>(() => [
    { id: 'delete', label: 'Delete queue', danger: true, disabled: this.busy() },
  ]);

  constructor() {
    effect(() => {
      const app = this.app();
      if (app)
        void this.run(async () => {
          const state = await firstValueFrom(this.messaging.get(app.id));
          this.state.set(state);
          if (state.connected) this.setQueues(await firstValueFrom(this.messaging.queues(app.id)));
        });
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (e) {
      this.error.set(consoleError(e));
    } finally {
      this.busy.set(false);
    }
  }

  connect(): Promise<void> {
    const app = this.app();
    return app
      ? this.run(async () => this.state.set(await firstValueFrom(this.messaging.connect(app.id))))
      : Promise.resolve();
  }

  createQueue(): Promise<void> {
    const app = this.app();
    const name = this.queueName.trim();
    if (!app || !name) return Promise.resolve();
    return this.run(async () => {
      this.setQueues(
        await firstValueFrom(
          this.messaging.createQueue(app.id, {
            name,
            maxAgeHours: 168,
            maxDeliver: 5,
            deadLetter: true,
          }),
        ),
      );
      this.queueName = '';
    });
  }

  private setQueues(queues: QueueView[]): void {
    this.queues.set(queues);
    if (!queues.some((q) => q.name === this.scaleQueue)) this.scaleQueue = queues[0]?.name ?? '';
  }

  deleteQueue(name: string): Promise<void> {
    const app = this.app();
    if (!app || !confirm(`Delete the queue ${name} and every message in it?`))
      return Promise.resolve();
    return this.run(async () =>
      this.setQueues(await firstValueFrom(this.messaging.deleteQueue(app.id, name))),
    );
  }

  scale(): Promise<void> {
    const app = this.app();
    if (!app || !this.scaleQueue) return Promise.resolve();
    return this.run(async () =>
      this.state.set(
        await firstValueFrom(
          this.messaging.scale(app.id, {
            stream: this.scaleQueue,
            consumer: this.scaleQueue,
            lagThreshold: Number(this.scaleLag),
            min: Number(this.scaleMin),
            max: Number(this.scaleMax),
          }),
        ),
      ),
    );
  }

  stopScaling(): Promise<void> {
    const app = this.app();
    return app
      ? this.run(async () =>
          this.state.set(await firstValueFrom(this.messaging.stopScaling(app.id))),
        )
      : Promise.resolve();
  }

  disconnect(): Promise<void> {
    const app = this.app();
    return app
      ? this.run(async () => {
          await firstValueFrom(this.messaging.disconnect(app.id));
          this.state.set(await firstValueFrom(this.messaging.get(app.id)));
        })
      : Promise.resolve();
  }
}
