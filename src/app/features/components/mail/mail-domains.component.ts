import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideLoader,
  lucidePlus,
  lucideRotateCcw,
  lucideTrash2,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { MailSectionNavComponent } from './mail-section-nav.component';
import { MailProofPillComponent } from './mail-proof-pill.component';
import { MailTestSendComponent } from './mail-test-send.component';
import { MailRecordRowComponent } from './mail-record-row.component';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { MailConsoleService } from '../../service/mail-console.service';
import {
  MailDomainProofs,
  MailPublishResult,
  MailRemoveResult,
} from '../../model/mail-console.models';
import { consoleError } from './mail-format';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';

@Component({
  selector: 'app-mail-domains',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReadOnlySectionDirective, 
    FormsModule,
    NgIcon,
    MailSectionNavComponent,
    MailProofPillComponent,
    MailTestSendComponent,
    MailRecordRowComponent,
    RouterLink,
    ConfirmationDialogComponent,
  ],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideLoader,
      lucidePlus,
      lucideRotateCcw,
      lucideTrash2,
      lucideTriangleAlert,
    }),
  ],
  template: `
    <div class="p-4 md:p-6">
      <app-mail-section-nav>
        <button
          slot="actions"
          type="button"
          (click)="load()"
          [disabled]="loading()"
          class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-60"
        >
          <ng-icon
            name="lucideRotateCcw"
            class="h-3.5 w-3.5"
            [class.animate-spin]="loading()"
          />
          Refresh
        </button>
      </app-mail-section-nav>

      <section class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <p class="text-xs text-muted-foreground">
          Sending domains belong to a provider connection — that is where the credential and the
          account are. Add one from the connection that will send from it.
        </p>
        <a
          routerLink="/management/mail/providers"
          class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          <ng-icon name="lucidePlus" class="h-3.5 w-3.5" /> Add a sending domain
        </a>
      </section>
      @if (publishError()) {
        <p class="mb-3 text-xs text-destructive">{{ publishError() }}</p>
      }

      @if (result(); as r) {
        <section class="mb-5 rounded-lg border border-border bg-card p-4">
          <h2 class="text-sm font-medium text-foreground">{{ r.domain }}</h2>
          @if (r.published.length) {
            <p class="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
              Wrote {{ r.published.length }} record(s) into the zone Flui holds.
            </p>
          }
          @if (r.outstanding.length) {
            <p class="mt-2 text-xs text-muted-foreground">
              Flui does not hold this zone, so it cannot write these for you. Create them where the
              zone actually lives, exactly as shown, then come back and press
              <span class="font-medium text-foreground">Re-publish</span> — the provider re-checks
              on its own schedule and verification lags DNS by minutes.
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              Names are given in full, ending in a dot. Many DNS interfaces instead want the part
              <em>before</em> your domain — <span class="font-mono">_dmarc</span> rather than
              <span class="font-mono">_dmarc.{{ r.domain }}.</span> — and
              <span class="font-mono">&#64;</span> for the domain itself.
            </p>
            <div class="mt-2 space-y-1.5">
              @for (rec of r.outstanding; track rec.name + rec.kind) {
                <app-mail-record-row [record]="rec" />
              }
            </div>
          }
          @if (r.error) {
            <p class="mt-2 text-xs text-destructive">{{ r.error }}</p>
          }
        </section>
      }

      @if (loading()) {
        <div class="space-y-3">
          @for (i of [1, 2]; track i) {
            <div class="rounded-lg border border-border bg-card p-4">
              <div class="flex flex-wrap items-center gap-3">
                <div class="skeleton h-4 flex-1"></div>
                <div class="skeleton h-5 w-12"></div>
                <div class="skeleton h-5 w-14"></div>
                <div class="skeleton h-5 w-16"></div>
                <div class="skeleton h-5 w-20"></div>
                <div class="skeleton h-7 w-24"></div>
              </div>
            </div>
          }
        </div>
      } @else if (error()) {
        <div
          class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ error() }}</span>
        </div>
      } @else if (!domains().length) {
        <p class="text-sm text-muted-foreground">
          No sending domain is registered with the provider yet.
        </p>
      } @else {
        <div class="space-y-3">
          @for (d of domains(); track d.domain) {
            <div class="rounded-lg border border-border bg-card p-4">
              <div class="flex flex-wrap items-center gap-3">
                <span class="min-w-0 truncate text-sm font-medium text-foreground">{{
                  d.domain
                }}</span>
                <span
                  class="inline-flex flex-1 items-center gap-1 text-[11px] text-muted-foreground"
                >
                  {{ providerLabel(d.provider) }} · {{ d.scope }}
                  <span
                    class="rounded px-1 py-0.5 font-medium"
                    [class]="
                      d.active
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                    "
                  >
                    {{ d.active ? 'Sending' : 'Standby' }}
                  </span>
                </span>
                <app-mail-proof-pill purpose="spf" [verdict]="d.spf" />
                <app-mail-proof-pill purpose="dkim" [verdict]="d.dkim" />
                <app-mail-proof-pill purpose="dmarc" [verdict]="d.dmarc" />
                @if (d.verified) {
                  <span
                    class="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400"
                  >
                    <ng-icon name="lucideCircleCheck" class="h-3.5 w-3.5" /> Verified
                  </span>
                } @else {
                  <span class="text-xs text-amber-700 dark:text-amber-400">Not verified yet</span>
                }
                <button appReadOnlySection="mail"
                  type="button"
                  (click)="publish(d.domain)"
                  [disabled]="publishing()"
                  class="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  Re-publish
                </button>
                <button appReadOnlySection="mail"
                  type="button"
                  (click)="askRemove(d.domain)"
                  [disabled]="removing()"
                  class="inline-flex h-7 items-center gap-1 rounded-md border border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  title="Hand this domain back to the provider"
                >
                  <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" /> Remove
                </button>
              </div>
              @if (!d.verified) {
                <p class="mt-2 text-xs text-muted-foreground">
                  Records can be correct and published while the provider has not re-checked them
                  yet. Verification lags DNS by minutes.
                </p>
              }
              <app-mail-test-send [domain]="d.domain" />

              @if (removed(); as gone) {
                @if (gone.domain === d.domain) {
                  <div class="mt-3 rounded-md border border-border bg-muted/40 p-2.5 text-xs">
                    <p class="font-medium text-foreground">
                      {{
                        gone.revoked
                          ? gone.domain + ' was revoked at the provider.'
                          : gone.domain + ' was not registered at the provider.'
                      }}
                    </p>
                    @if (gone.dns; as dns) {
                      @if (dns.removed.length) {
                        <p class="mt-1 text-muted-foreground">
                          Removed from the zone: {{ dns.removed.join(', ') }}.
                        </p>
                      }
                      @for (left of dns.kept; track left.name + left.kind) {
                        <p class="mt-1 text-muted-foreground">
                          <span class="font-mono">{{ left.kind }} {{ left.name }}</span> —
                          {{ left.reason }}
                        </p>
                      }
                    } @else {
                      <p class="mt-1 text-muted-foreground">The zone was left untouched.</p>
                    }
                  </div>
                }
              }
            </div>
          }
        </div>
      }

      <app-confirmation-dialog
        #removeDialog
        [title]="removeTitle()"
        [message]="removeMessage"
        [details]="removeDetails"
        confirmText="Remove permanently"
        processingText="Removing…"
        variant="danger"
        (confirmed)="confirmRemove()"
        (cancelled)="pendingRemove.set(null)"
      />
    </div>
  `,
})
export class MailDomainsComponent implements OnInit {
  private readonly api = inject(MailConsoleService);

  protected readonly domains = signal<MailDomainProofs[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly publishing = signal(false);
  protected readonly publishError = signal<string | null>(null);
  protected readonly result = signal<MailPublishResult | null>(null);
  protected readonly removing = signal(false);
  protected readonly pendingRemove = signal<string | null>(null);
  protected readonly removed = signal<MailRemoveResult | null>(null);

  @ViewChild('removeDialog')
  private readonly removeDialog?: ConfirmationDialogComponent;

  protected readonly removeTitle = computed(() => `Remove ${this.pendingRemove() ?? 'this domain'}`);

  protected readonly removeMessage = 'Deleted at the mail provider. This cannot be undone.';

  protected readonly removeDetails = [
    'The DKIM private key is destroyed. Registering this domain again issues a new key under a new selector.',
    'In DNS: the DKIM record is deleted, and the Flui entry is taken back out of the SPF. The rest of that record is left alone.',
    'The MX and DMARC records stay. Nothing recorded whether Flui created them, and deleting an MX it did not create stops inbound mail.',
    'Delivery history and the suppression list are untouched.',
  ];

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

  protected askRemove(domain: string): void {
    this.pendingRemove.set(domain);
    this.removeDialog?.open();
  }

  protected confirmRemove(): void {
    const domain = this.pendingRemove();
    if (!domain) return;
    this.removeDialog?.setProcessing(true);
    this.removing.set(true);
    this.api.removeDomain(domain).subscribe({
      next: (result) => {
        this.removed.set(result);
        this.removing.set(false);
        this.pendingRemove.set(null);
        this.removeDialog?.close();
        this.load();
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.removing.set(false);
        this.removeDialog?.setProcessing(false);
        this.removeDialog?.close();
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

  protected providerLabel(id: string): string {
    return PROVIDER_LABELS[id] ?? id;
  }
}

const PROVIDER_LABELS: Record<string, string> = {
  'scaleway-tem': 'Scaleway',
  brevo: 'Brevo',
  zeptomail: 'ZeptoMail',
  smtp: 'SMTP relay',
};
