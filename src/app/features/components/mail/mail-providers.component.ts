import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { MailSectionNavComponent } from './mail-section-nav.component';
import { MailIdentityEmailComponent } from './mail-identity-email.component';
import { MailConnectForm } from './mail-connect-form';
import { MailConnectResultPanel } from './mail-connect-result';
import { MailConnectionAction, MailScopePanel } from './mail-scope-panel';
import { MailConsoleService } from '../../service/mail-console.service';
import {
  ConnectProviderInput,
  MailConnectResult,
  MailConnection,
  MailDomainProofs,
  MailScope,
} from '../../model/mail-console.models';
import { consoleError } from './mail-format';
import { MAIL_SCOPE_SLOTS, connectLabel, providerLabel, rowsFor } from './mail-providers-helpers';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  MailProvidersSurfaceInput,
  MailProvidersSurfaceRevision,
  buildMailProvidersSurface,
  presentedContent,
} from './mail-providers-surface';

@Component({
  selector: 'app-mail-providers',
  imports: [
    FlAlert,
    FlPanel,
    FlLoadingState,
    FlButton,
    FlIcon,
    MailSectionNavComponent,
    MailIdentityEmailComponent,
    MailConnectForm,
    MailConnectResultPanel,
    MailScopePanel,
  ],
  providers: [provideIcons({ lucideRefreshCw })],
  template: `
    <div class="fl-page">
      <app-mail-section-nav>
        <button
          headerActions
          flButton
          type="button"
          [iconOnly]="true"
          aria-label="Refresh"
          [disabled]="loading()"
          (click)="load()"
        >
          <fl-icon name="lucideRefreshCw" />
        </button>
      </app-mail-section-nav>

      <p class="m-0 max-w-3xl text-fl-body-sm text-fl-ink-muted">
        Two senders, kept apart on purpose. A provider that suspends an account over a mailing list
        would take the password resets down with it, so bulk and transactional never share an
        account, a credential or a sending domain.
      </p>

      @if (loading()) {
        <fl-panel>
          <fl-loading-state [rows]="5" />
        </fl-panel>
      } @else {
        @if (error()) {
          <fl-alert tone="error" title="Request failed">{{ error() }}</fl-alert>
        }

        @if (result(); as r) {
          <app-mail-connect-result [result]="r" />
        }

        @for (slot of scopes; track slot.id) {
          <app-mail-scope-panel
            [slot]="slot"
            [rows]="rows(slot.id)"
            [verifiedDomains]="verifiedDomains()"
            [open]="openSlot() === slot.id"
            [connectLabel]="label(slot.id)"
            [switching]="switching()"
            [retrying]="retrying()"
            [testing]="testing()"
            [adding]="adding()"
            [newDomain]="newDomain()"
            [registering]="registering()"
            [added]="added()"
            [addError]="addError()"
            (openConnect)="openFor(slot.id)"
            (domainChange)="newDomain.set($event)"
            (connectionAction)="onConnectionAction($event)"
          >
            @if (openSlot() === slot.id) {
              <app-mail-connect-form
                [slot]="slot"
                [connections]="connections()"
                [knownDomains]="knownDomains()"
                [connecting]="connecting()"
                (submitted)="connect($event)"
                (cancelled)="cancel()"
              />
            }
          </app-mail-scope-panel>
        }

        <app-mail-identity-email />
      }
    </div>
  `,
})
export class MailProvidersComponent implements OnInit, OnDestroy {
  private readonly api = inject(MailConsoleService);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly confirm = inject(ConfirmService);

  protected readonly scopes = MAIL_SCOPE_SLOTS;
  protected readonly connections = signal<MailConnection[]>([]);
  protected readonly knownDomains = signal<MailDomainProofs[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly connecting = signal(false);
  protected readonly openSlot = signal<MailScope | null>(null);
  protected readonly result = signal<MailConnectResult | null>(null);
  protected readonly switching = signal<string | null>(null);
  protected readonly retrying = signal<string | null>(null);
  protected readonly testing = signal<string | null>(null);
  protected readonly adding = signal<string | null>(null);
  protected readonly newDomain = signal('');
  protected readonly registering = signal(false);
  protected readonly added = signal<string | null>(null);
  protected readonly addError = signal<string | null>(null);

  protected readonly verifiedDomains = computed(() =>
    this.knownDomains()
      .filter((d) => d.verified)
      .map((d) => d.domain),
  );

  private readonly surfaceRevision = new MailProvidersSurfaceRevision();

  readonly surface = computed(() => {
    const input: MailProvidersSurfaceInput = {
      connections: this.connections(),
      loading: this.loading(),
      hasLoadError: !!this.error(),
    };
    return buildMailProvidersSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.connections().subscribe({
      next: (rows) => {
        this.connections.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.loading.set(false);
      },
    });

    this.api.domains().subscribe({
      next: (domains) => this.knownDomains.set(domains),
      error: () => this.knownDomains.set([]),
    });
  }

  protected rows(scope: MailScope): MailConnection[] {
    return rowsFor(this.connections(), scope);
  }

  protected label(scope: MailScope): string {
    return connectLabel(this.connections(), scope);
  }

  protected onConnectionAction({ action, connection }: MailConnectionAction): void {
    switch (action) {
      case 'test':
        this.testing.update((open) => (open === connection.id ? null : connection.id));
        return;
      case 'add-domain':
        this.toggleAddDomain(connection);
        return;
      case 'activate':
        this.activate(connection);
        return;
      case 'retry':
        this.retryWebhook(connection);
        return;
      case 'register':
        this.addDomain(connection);
        return;
      case 'disconnect':
        void this.askDisconnect(connection);
        return;
    }
  }

  private toggleAddDomain(connection: MailConnection): void {
    this.adding.update((open) => (open === connection.id ? null : connection.id));
    this.newDomain.set('');
    this.added.set(null);
    this.addError.set(null);
  }

  private addDomain(connection: MailConnection): void {
    const domain = this.newDomain().trim().toLowerCase();
    if (!domain) return;
    this.registering.set(true);
    this.added.set(null);
    this.addError.set(null);
    this.api.publishForConnection(connection.id, domain).subscribe({
      next: (result) => {
        this.registering.set(false);
        this.added.set(
          result.outstanding.length
            ? `${domain} is registered. Flui does not hold that zone, so its ${result.outstanding.length} record(s) are waiting on the Domains page.`
            : `${domain} is registered and its records are written. ` +
                `${providerLabel(connection.provider)} verifies on its own schedule.`,
        );
      },
      error: (err) => {
        this.addError.set(consoleError(err));
        this.registering.set(false);
      },
    });
  }

  private activate(connection: MailConnection): void {
    this.switching.set(connection.id);
    this.error.set(null);
    this.api.activate(connection.id).subscribe({
      next: () => {
        this.switching.set(null);
        this.load();
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.switching.set(null);
      },
    });
  }

  private retryWebhook(connection: MailConnection): void {
    this.retrying.set(connection.id);
    this.error.set(null);
    this.api.retryWebhook(connection.id).subscribe({
      next: (webhook) => {
        this.retrying.set(null);
        if (!webhook.registered && webhook.reason) this.error.set(webhook.reason);
        this.load();
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.retrying.set(null);
      },
    });
  }

  protected openFor(scope: MailScope): void {
    this.openSlot.set(scope);
    this.result.set(null);
  }

  protected cancel(): void {
    this.openSlot.set(null);
  }

  protected connect(input: ConnectProviderInput): void {
    this.connecting.set(true);
    this.error.set(null);
    this.api.connect(input).subscribe({
      next: (result) => {
        this.result.set(result);
        this.connecting.set(false);
        this.cancel();
        this.load();
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.connecting.set(false);
      },
    });
  }

  private async askDisconnect(connection: MailConnection): Promise<void> {
    const handover = connection.isActive
      ? `It is the one sending, so ${connection.scope} mail changes hands the moment this is ` +
        'done. Switching to another provider instead leaves this one configured. '
      : '';
    const ok = await this.confirm.confirm({
      title: `Disconnect ${connection.label}`,
      body:
        'The stored credential is destroyed. ' +
        handover +
        'Flui polls once more first, so a bounce still in flight is not lost. The domain stays ' +
        'registered at the provider, and the DNS records stay published. Delivery outcomes ' +
        'already collected are kept; they carry their own provider name.',
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (ok) this.disconnect(connection);
  }

  private disconnect(connection: MailConnection): void {
    this.api.disconnect(connection.id).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(consoleError(err)),
    });
  }
}
