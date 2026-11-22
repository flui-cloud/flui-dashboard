import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideGlobe, lucidePlus, lucideRefreshCw } from '@ng-icons/lucide';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { MailSectionNavComponent } from './mail-section-nav.component';
import { MailDomainsTable } from './mail-domains-table';
import { MailRecordsTable } from './mail-records-table';
import { MailConsoleService } from '../../service/mail-console.service';
import {
  MailDomainProofs,
  MailPublishResult,
  MailRemoveResult,
} from '../../model/mail-console.models';
import { consoleError } from './mail-format';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  MailDomainsSurfaceInput,
  MailDomainsSurfaceRevision,
  buildMailDomainsSurface,
  presentedContent,
} from './mail-domains-surface';

@Component({
  selector: 'app-mail-domains',
  imports: [
    RouterLink,
    FlAlert,
    FlPanel,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlStatus,
    MailSectionNavComponent,
    MailDomainsTable,
    MailRecordsTable,
  ],
  providers: [provideIcons({ lucideGlobe, lucidePlus, lucideRefreshCw })],
  template: `
    <div class="fl-page">
      <app-mail-section-nav>
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            [disabled]="loading()"
            (click)="load()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
          <a flButton="primary" routerLink="/management/mail/providers">
            <fl-icon name="lucidePlus" />
            Add a sending domain
          </a>
        </ng-container>
      </app-mail-section-nav>

      <p class="m-0 max-w-3xl text-fl-body-sm text-fl-ink-muted">
        Sending domains belong to a provider connection, which holds the credential and the account.
        Add one from the connection that will send from it.
      </p>

      @if (publishError()) {
        <fl-alert tone="error" title="Could not publish the records">{{ publishError() }}</fl-alert>
      }
      @if (error()) {
        <fl-alert tone="error" title="Could not load the domains">{{ error() }}</fl-alert>
      }

      @if (removed(); as gone) {
        <fl-alert
          tone="info"
          [title]="
            gone.revoked
              ? gone.domain + ' was revoked at the provider.'
              : gone.domain + ' was not registered at the provider.'
          "
        >
          @if (gone.dns; as dns) {
            @if (dns.removed.length) {
              Removed from the zone: {{ dns.removed.join(', ') }}.
            }
            @for (left of dns.kept; track left.name + left.kind) {
              <span class="block"
                ><span class="fl-mono">{{ left.kind }} {{ left.name }}</span> kept:
                {{ left.reason }}</span
              >
            }
          } @else {
            The zone was left untouched.
          }
        </fl-alert>
      }

      @if (result(); as r) {
        <fl-panel [title]="'Records for ' + r.domain" [count]="r.outstanding.length || null">
          @if (r.published.length) {
            <fl-status
              panelActions
              tone="success"
              [label]="'Wrote ' + r.published.length + ' record(s) into the zone Flui holds'"
            />
          }
          <div class="flex flex-col gap-3">
            @if (r.outstanding.length) {
              <p class="m-0 text-fl-body-sm text-fl-ink-muted">
                Flui does not hold this zone, so it cannot write these for you. Create them where
                the zone actually lives, exactly as shown, then come back and choose Re-publish. The
                provider re-checks on its own schedule and verification lags DNS by minutes.
              </p>
              <p class="m-0 text-fl-body-sm text-fl-ink-muted">
                Names are given in full, ending in a dot. Many DNS interfaces instead want the part
                before your domain (<span class="fl-mono">_dmarc</span> rather than
                <span class="fl-mono">_dmarc.{{ r.domain }}.</span>) and
                <span class="fl-mono">&#64;</span> for the domain itself.
              </p>
              <app-mail-records-table [records]="r.outstanding" />
            }
            @if (r.error) {
              <fl-alert tone="error" title="The provider reported an error">{{ r.error }}</fl-alert>
            }
          </div>
        </fl-panel>
      }

      <fl-panel
        title="Sending domains"
        [count]="loading() ? null : domains().length"
        [flush]="true"
      >
        @if (loading()) {
          <fl-loading-state [rows]="3" />
        } @else if (error()) {
          <fl-empty-state [compact]="true" title="Nothing to show" />
        } @else if (!domains().length) {
          <fl-empty-state
            icon="lucideGlobe"
            title="No sending domain yet"
            body="No sending domain is registered with the provider yet."
          />
        } @else {
          <app-mail-domains-table
            [domains]="domains()"
            [publishing]="publishing()"
            [removing]="removing()"
            [testing]="testing()"
            (publish)="publish($event)"
            (remove)="askRemove($event)"
            (toggleTest)="toggleTest($event)"
          />
        }
      </fl-panel>
    </div>
  `,
})
export class MailDomainsComponent implements OnInit, OnDestroy {
  private readonly api = inject(MailConsoleService);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly confirm = inject(ConfirmService);

  protected readonly domains = signal<MailDomainProofs[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly publishing = signal(false);
  protected readonly publishError = signal<string | null>(null);
  protected readonly result = signal<MailPublishResult | null>(null);
  protected readonly removing = signal(false);
  protected readonly removed = signal<MailRemoveResult | null>(null);
  protected readonly testing = signal<string | null>(null);

  private readonly surfaceRevision = new MailDomainsSurfaceRevision();

  readonly surface = computed(() => {
    const input: MailDomainsSurfaceInput = {
      domains: this.domains(),
      loading: this.loading(),
      hasLoadError: !!this.error(),
    };
    return buildMailDomainsSurface(input, {
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
    this.api.domains().subscribe({
      next: (domains) => {
        this.domains.set(domains);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.loading.set(false);
      },
    });
  }

  protected toggleTest(domain: string): void {
    this.testing.update((open) => (open === domain ? null : domain));
  }

  protected async askRemove(domain: string): Promise<void> {
    const ok = await this.confirm.confirm({
      title: `Remove ${domain}`,
      body:
        'Deleted at the mail provider. This cannot be undone. The DKIM private key is destroyed; ' +
        'registering this domain again issues a new key under a new selector. In DNS, the DKIM ' +
        'record is deleted and the Flui entry is taken back out of the SPF; the rest of that ' +
        'record is left alone. The MX and DMARC records stay: nothing recorded whether Flui ' +
        'created them, and deleting an MX it did not create stops inbound mail. Delivery history ' +
        'and the suppression list are untouched.',
      confirmLabel: 'Remove permanently',
      destructive: true,
      typeToConfirm: domain,
    });
    if (ok) this.confirmRemove(domain);
  }

  private confirmRemove(domain: string): void {
    this.removing.set(true);
    this.api.removeDomain(domain).subscribe({
      next: (result) => {
        this.removed.set(result);
        this.removing.set(false);
        this.load();
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.removing.set(false);
      },
    });
  }

  protected publish(domain: string): void {
    const name = domain.trim().toLowerCase();
    if (!name) return;
    this.publishing.set(true);
    this.publishError.set(null);
    this.api.publishDomain(name).subscribe({
      next: (result) => {
        this.result.set(result);
        this.publishing.set(false);
        this.load();
      },
      error: (err) => {
        this.publishError.set(consoleError(err));
        this.publishing.set(false);
      },
    });
  }
}
