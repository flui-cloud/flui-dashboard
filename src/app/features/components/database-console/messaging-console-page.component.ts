import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideArrowLeft,
  lucideLoader,
  lucideRotateCcw,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { MessagingConsoleStateService } from './messaging-console-state.service';
import { MessagingProducePanelComponent } from './messaging-produce-panel.component';
import { MessagingPeekPanelComponent } from './messaging-peek-panel.component';
import { MessagingStreamListComponent } from './messaging-stream-list.component';
import { bytes } from './messaging-format';

/**
 * Messaging console (NATS / JetStream). Server stats + JetStream streams with
 * expandable consumer detail (monitoring API), plus produce (publish) and a
 * non-destructive peek of stored messages over the client port. Built to
 * generalize across queue engines.
 */
@Component({
  selector: 'app-messaging-console-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    MessagingProducePanelComponent,
    MessagingPeekPanelComponent,
    MessagingStreamListComponent,
  ],
  providers: [
    MessagingConsoleStateService,
    provideIcons({
      lucideActivity,
      lucideArrowLeft,
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
          (click)="s.back()"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          title="Back"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
        </button>
        <ng-icon name="lucideActivity" class="h-5 w-5 text-primary" />
        <div class="min-w-0">
          <h1 class="text-base font-semibold text-foreground">
            Messaging Monitor
            @if (s.server(); as info) {
              <span class="font-normal text-muted-foreground"
                >· {{ s.engineLabel() }} {{ info.version }}</span
              >
            }
          </h1>
          <p class="truncate font-mono text-xs text-muted-foreground">
            {{ applicationId() }}
          </p>
        </div>
        <button
          type="button"
          (click)="s.connect()"
          class="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted"
        >
          <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" /> Refresh
        </button>
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
        @if (s.server(); as info) {
          <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div class="rounded-md border border-border p-3">
              <div class="text-xs text-muted-foreground">Uptime</div>
              <div class="truncate text-sm font-semibold text-foreground">
                {{ info.uptime || '—' }}
              </div>
            </div>
            <div class="rounded-md border border-border p-3">
              <div class="text-xs text-muted-foreground">Connections</div>
              <div class="text-sm font-semibold text-foreground">
                {{ info.connections }}
              </div>
            </div>
            <div class="rounded-md border border-border p-3">
              <div class="text-xs text-muted-foreground">Msgs in / out</div>
              <div class="text-sm font-semibold text-foreground">
                {{ info.inMsgs }} / {{ info.outMsgs }}
              </div>
            </div>
            <div class="rounded-md border border-border p-3">
              <div class="text-xs text-muted-foreground">Data in / out</div>
              <div class="text-sm font-semibold text-foreground">
                {{ size(info.inBytes) }} / {{ size(info.outBytes) }}
              </div>
            </div>
            <div class="rounded-md border border-border p-3">
              <div class="text-xs text-muted-foreground">Memory</div>
              <div class="text-sm font-semibold text-foreground">
                {{ size(info.memBytes) }}
              </div>
            </div>
            <div class="rounded-md border border-border p-3">
              <div class="text-xs text-muted-foreground">Storage</div>
              <div class="text-sm font-semibold text-foreground">
                {{
                  info.jetStream.enabled
                    ? size(info.jetStream.storageBytes) + ' stored'
                    : 'off'
                }}
              </div>
            </div>
          </div>
        }

        <div class="mb-4 grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          <app-messaging-produce-panel />
          <app-messaging-peek-panel />
        </div>

        <app-messaging-stream-list />
      }
    </div>
  `,
})
export class MessagingConsolePageComponent implements OnInit {
  protected readonly s = inject(MessagingConsoleStateService);
  private readonly route = inject(ActivatedRoute);

  readonly applicationId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('applicationId'))),
    { initialValue: this.route.snapshot.paramMap.get('applicationId') },
  );

  protected size(n: number): string {
    return bytes(n);
  }

  ngOnInit(): void {
    this.s.appId.set(this.applicationId() ?? null);
    this.s.init();
  }
}
