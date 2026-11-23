import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideLockKeyhole, lucideLockKeyholeOpen, lucideRefreshCw } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { SecretsConsoleStateService } from './secrets-console-state.service';
import { SecretsTreeComponent } from './secrets-tree.component';
import { SecretsEditorComponent } from './secrets-editor.component';
import { StoreConsoleHeader } from './store-console-header';

@Component({
  selector: 'app-secrets-console-page',
  imports: [
    FlAlert,
    FlButton,
    FlIcon,
    FlLoadingState,
    StoreConsoleHeader,
    FlPanel,
    FlStatus,
    SecretsTreeComponent,
    SecretsEditorComponent,
  ],
  providers: [
    SecretsConsoleStateService,
    provideIcons({ lucideLockKeyhole, lucideLockKeyholeOpen, lucideRefreshCw }),
  ],
  template: `
    <div class="fl-page">
      <app-store-console-header
        title="Secrets"
        [appId]="applicationId()"
        [conn]="s.conn()"
        (retry)="s.connect()"
      >
        <ng-container consoleMeta>
          @if (s.server()?.sealed) {
            <fl-status tone="error" label="Sealed" />
          }
          @if (s.conn() === 'connected') {
            <fl-status
              [tone]="s.readOnly() ? 'neutral' : 'warning'"
              [label]="s.readOnly() ? 'Read-only' : 'Writes on'"
            />
          }
          @if (s.server(); as srv) {
            <span>{{ s.engineLabel() }} {{ srv.version }}</span>
            <span class="fl-mono">{{ srv.mount }}/</span>
          }
        </ng-container>
        <ng-container consoleActions>
          <button
            flButton
            type="button"
            [attr.aria-pressed]="!s.readOnly()"
            [title]="s.readOnly() ? 'Read-only: writes blocked' : 'Writes enabled'"
            (click)="s.readOnly.set(!s.readOnly())"
          >
            <fl-icon [name]="s.readOnly() ? 'lucideLockKeyhole' : 'lucideLockKeyholeOpen'" />
            {{ s.readOnly() ? 'Allow writes' : 'Block writes' }}
          </button>
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
        <div class="flex flex-col items-start gap-5 lg:flex-row">
          <app-secrets-tree class="w-full shrink-0 lg:w-80" />
          <app-secrets-editor class="w-full min-w-0 flex-1" />
        </div>
      }
    </div>
  `,
})
export class SecretsConsolePageComponent implements OnInit {
  protected readonly s = inject(SecretsConsoleStateService);
  private readonly route = inject(ActivatedRoute);

  readonly applicationId = toSignal(this.route.paramMap.pipe(map((p) => p.get('applicationId'))), {
    initialValue: this.route.snapshot.paramMap.get('applicationId'),
  });

  ngOnInit(): void {
    this.s.appId.set(this.applicationId() ?? null);
    this.s.init();
  }
}
