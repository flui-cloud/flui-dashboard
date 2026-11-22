import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { MailConsoleService } from '../../service/mail-console.service';
import { MailIdentityStatus } from '../../model/mail-console.models';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { consoleError } from './mail-format';
import { MailIdentityTone, mailIdentityView } from './mail-identity-email-view';

const TONE: Record<MailIdentityTone, StatusTone> = {
  ok: 'success',
  warn: 'warning',
  error: 'error',
  idle: 'neutral',
};

@Component({
  selector: 'app-mail-identity-email',
  imports: [
    DatePipe,
    ReadOnlySectionDirective,
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlPanel,
    FlButton,
    FlIcon,
    FlStatus,
  ],
  providers: [provideIcons({ lucideRefreshCw })],
  host: { class: 'block' },
  template: `
    <fl-panel title="Sign-in emails">
      <div panelActions class="fl-row">
        @if (view(); as v) {
          <fl-status [tone]="statusTone()" [label]="v.badge" />
        }
        <button
          appReadOnlySection="mail"
          flButton
          size="sm"
          type="button"
          [disabled]="syncing() || loading()"
          (click)="sync()"
        >
          <fl-icon name="lucideRefreshCw" [size]="14" />
          {{ syncing() ? 'Syncing…' : 'Sync' }}
        </button>
      </div>

      <div class="flex flex-col gap-3">
        <fl-key-value>
          <fl-kv-item key="Covers">Verification and password reset emails</fl-kv-item>
          <fl-kv-item key="Sent through">{{
            view()?.provider ?? 'Your transactional provider'
          }}</fl-kv-item>
          @if (status()?.lastDeliveryAt; as at) {
            <fl-kv-item key="Last sent">{{ at | date: 'medium' }}</fl-kv-item>
          }
        </fl-key-value>
        @if (view()?.note; as note) {
          <fl-alert tone="warning" [title]="noteTitle()">{{ note }}</fl-alert>
        }
        @if (error()) {
          <fl-alert tone="error" title="Could not read the sign-in email status">{{
            error()
          }}</fl-alert>
        }
      </div>
    </fl-panel>
  `,
})
export class MailIdentityEmailComponent implements OnInit {
  private readonly api = inject(MailConsoleService);

  readonly status = signal<MailIdentityStatus | null>(null);
  readonly loading = signal(false);
  readonly syncing = signal(false);
  readonly error = signal<string | null>(null);

  readonly view = computed(() => {
    const status = this.status();
    return status ? mailIdentityView(status) : null;
  });
  readonly statusTone = computed(() => TONE[this.view()?.tone ?? 'idle']);
  readonly noteTitle = computed(() =>
    this.view()?.tone === 'ok' ? 'The last message failed' : (this.view()?.badge ?? ''),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.identity().subscribe({
      next: (status) => {
        this.status.set(status);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.loading.set(false);
      },
    });
  }

  sync(): void {
    this.syncing.set(true);
    this.api.syncIdentity().subscribe({
      next: (status) => {
        this.status.set(status);
        this.error.set(null);
        this.syncing.set(false);
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.syncing.set(false);
      },
    });
  }
}
