import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideMessagesSquare } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { ApplicationService } from '../../service/application.service';
import { AppMessaging, AppMessagingService, QueueView } from '../../service/app-messaging.service';
import { consoleError } from '../database-console/search-format';

@Component({
  selector: 'app-messaging-tab',
  standalone: true,
  imports: [NgIconComponent, FormsModule],
  providers: [provideIcons({ lucideMessagesSquare })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-xl border border-border bg-card p-5" data-testid="messaging">
      <h2 class="flex items-center gap-2 text-base font-semibold text-foreground">
        <ng-icon name="lucideMessagesSquare" class="h-4 w-4" /> Messaging
      </h2>
      @if (error()) {
        <p class="mt-2 text-sm text-destructive">{{ error() }}</p>
      }
      @if (state(); as s) {
        @if (s.connected) {
          <dl class="mt-3 grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
            <dt class="text-muted-foreground">Address</dt>
            <dd class="font-mono text-foreground">{{ s.url }}</dd>
            <dt class="text-muted-foreground">Variables</dt>
            <dd class="font-mono text-foreground">NATS_URL, NATS_CREDS</dd>
          </dl>
          <div class="mt-5" data-testid="queues">
            <h3 class="text-sm font-semibold text-foreground">Queues</h3>
            @if (queues().length === 0) {
              <p class="mt-1 text-sm text-muted-foreground">No queues yet.</p>
            } @else {
              <table class="mt-2 w-full text-sm">
                <thead class="text-left text-xs text-muted-foreground">
                  <tr>
                    <th class="py-1">Name</th>
                    <th>Waiting</th>
                    <th>In flight</th>
                    <th>Given up</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (q of queues(); track q.name) {
                    <tr class="border-t border-border">
                      <td class="py-1 font-mono">{{ q.name }}</td>
                      <td>{{ q.waiting }}</td>
                      <td>{{ q.inFlight }}</td>
                      <td>{{ q.deadLetters ?? '—' }}</td>
                      <td class="text-right">
                        <button
                          type="button"
                          class="text-xs font-medium text-destructive underline underline-offset-2 disabled:opacity-50"
                          [disabled]="busy()"
                          (click)="deleteQueue(q.name)"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
            <form class="mt-3 flex flex-wrap items-center gap-2" (ngSubmit)="createQueue()">
              <input
                class="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                name="qname"
                placeholder="ORDERS"
                [(ngModel)]="queueName"
                required
              />
              <button
                type="submit"
                class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                [disabled]="busy() || !queueName"
              >
                Add queue
              </button>
              <span class="text-xs text-muted-foreground"
                >Kept 7 days, 5 deliveries, failed messages kept apart.</span
              >
            </form>
          </div>
          <div class="mt-5" data-testid="queue-scaling">
            <h3 class="text-sm font-semibold text-foreground">Scale on a queue</h3>
            @if (s.queueScaling; as qs) {
              <p class="mt-1 text-sm text-foreground">
                One replica for every {{ qs.lagThreshold }} messages waiting in
                <span class="font-mono">{{ qs.stream }}</span>, between {{ qs.min }} and
                {{ qs.max }}.{{ qs.min === 0 ? ' The app stops while the queue is empty.' : '' }}
              </p>
              <button
                type="button"
                class="mt-2 rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
                [disabled]="busy()"
                (click)="stopScaling()"
              >
                Stop scaling on the queue
              </button>
            } @else if (queues().length === 0) {
              <p class="mt-1 text-sm text-muted-foreground">Add a queue first.</p>
            } @else {
              <form
                class="mt-2 grid gap-2 sm:grid-cols-[1fr_6rem_5rem_5rem_auto] sm:items-end"
                (ngSubmit)="scale()"
              >
                <label class="text-xs text-muted-foreground"
                  >Queue
                  <select
                    class="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                    name="sq"
                    [(ngModel)]="scaleQueue"
                    required
                  >
                    @for (q of queues(); track q.name) {
                      <option [value]="q.name">{{ q.name }}</option>
                    }
                  </select>
                </label>
                <label class="text-xs text-muted-foreground"
                  >Per replica
                  <input
                    class="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    name="lag"
                    type="number"
                    min="1"
                    [(ngModel)]="scaleLag"
                  />
                </label>
                <label class="text-xs text-muted-foreground"
                  >Min
                  <input
                    class="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    name="min"
                    type="number"
                    min="0"
                    [(ngModel)]="scaleMin"
                  />
                </label>
                <label class="text-xs text-muted-foreground"
                  >Max
                  <input
                    class="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    name="max"
                    type="number"
                    min="1"
                    [(ngModel)]="scaleMax"
                  />
                </label>
                <button
                  type="submit"
                  class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  [disabled]="busy() || !scaleQueue"
                >
                  Scale
                </button>
              </form>
              <p class="mt-1 text-xs text-muted-foreground">
                With Min at 0 the app stops while the queue is empty and starts when a message
                arrives.
              </p>
            }
          </div>
          <button
            type="button"
            class="mt-5 rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
            [disabled]="busy()"
            (click)="disconnect()"
          >
            Disconnect
          </button>
        } @else {
          <p class="mt-1 text-sm text-muted-foreground">
            Give this app its own account on the cluster's NATS, with queues and streams no other
            app can see. It receives NATS_URL and NATS_CREDS and is redeployed.
          </p>
          <button
            type="button"
            class="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            [disabled]="busy()"
            (click)="connect()"
          >
            Connect
          </button>
        }
      }
    </section>
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
