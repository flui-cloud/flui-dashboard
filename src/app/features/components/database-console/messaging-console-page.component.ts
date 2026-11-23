import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlMetric, FlMetricStrip } from '../../../ui/patterns/metric-strip';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { MessagingConsoleStateService } from './messaging-console-state.service';
import { MessagingProducePanelComponent } from './messaging-produce-panel.component';
import { MessagingPeekPanelComponent } from './messaging-peek-panel.component';
import { MessagingStreamDetail } from './messaging-stream-detail';
import { MessagingStreamListComponent } from './messaging-stream-list.component';
import { StoreConsoleHeader } from './store-console-header';
import { bytes } from './messaging-format';

/**
 * Messaging console (NATS / JetStream). Server stats + JetStream streams with
 * expandable consumer detail (monitoring API), plus produce (publish) and a
 * non-destructive peek of stored messages over the client port. Built to
 * generalize across queue engines.
 */
@Component({
  selector: 'app-messaging-console-page',
  imports: [
    FlAlert,
    FlButton,
    FlIcon,
    FlLoadingState,
    FlMetric,
    FlMetricStrip,
    StoreConsoleHeader,
    FlPanel,
    MessagingProducePanelComponent,
    MessagingPeekPanelComponent,
    MessagingStreamDetail,
    MessagingStreamListComponent,
  ],
  providers: [MessagingConsoleStateService, provideIcons({ lucideRefreshCw })],
  template: `
    <div class="fl-page">
      <app-store-console-header
        title="Messaging console"
        [appId]="applicationId()"
        [conn]="s.conn()"
        (retry)="s.connect()"
      >
        <ng-container consoleMeta>
          @if (s.server(); as info) {
            <span>{{ s.engineLabel() }} {{ info.version }}</span>
          }
        </ng-container>
        <ng-container consoleActions>
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
        @if (s.server(); as info) {
          <fl-metric-strip>
            <fl-metric label="Uptime" [value]="info.uptime || '—'" />
            <fl-metric label="Connections" [value]="info.connections" />
            <fl-metric label="Messages in / out" [value]="info.inMsgs + ' / ' + info.outMsgs" />
            <fl-metric
              label="Data in / out"
              [value]="size(info.inBytes) + ' / ' + size(info.outBytes)"
            />
            <fl-metric label="Memory" [value]="size(info.memBytes)" />
            <fl-metric
              label="Storage"
              [value]="info.jetStream.enabled ? size(info.jetStream.storageBytes) : 'Off'"
            />
          </fl-metric-strip>
        }

        <div class="flex flex-col items-start gap-5 lg:flex-row">
          <app-messaging-stream-list class="w-full shrink-0 lg:w-72" />
          <div class="flex w-full min-w-0 flex-1 flex-col gap-5">
            <app-messaging-stream-detail />
            <div class="fl-grid-2 items-start">
              <app-messaging-produce-panel />
              <app-messaging-peek-panel />
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class MessagingConsolePageComponent implements OnInit {
  protected readonly s = inject(MessagingConsoleStateService);
  private readonly route = inject(ActivatedRoute);

  readonly applicationId = toSignal(this.route.paramMap.pipe(map((p) => p.get('applicationId'))), {
    initialValue: this.route.snapshot.paramMap.get('applicationId'),
  });

  protected size(n: number): string {
    return bytes(n);
  }

  ngOnInit(): void {
    this.s.appId.set(this.applicationId() ?? null);
    this.s.init();
  }
}
