import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCircleAlert,
  lucideExternalLink,
  lucideEyeOff,
  lucidePlus,
  lucideRotateCcw,
  lucideSend,
  lucideTrash2,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { MailSectionNavComponent } from './mail-section-nav.component';
import { MailRecordRowComponent } from './mail-record-row.component';
import { MailDomainPickerComponent } from './mail-domain-picker.component';
import { MailTestSendComponent } from './mail-test-send.component';
import { MailConnectionSetupComponent } from './mail-connection-setup.component';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { MailConsoleService } from '../../service/mail-console.service';
import {
  MAIL_PROVIDERS,
  MailConnectResult,
  MailConnection,
  MailConnectionConfig,
  MailDomainProofs,
  MailProviderId,
  MailProviderProfile,
  MailScope,
} from '../../model/mail-console.models';
import { consoleError } from './mail-format';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  MailProvidersSurfaceInput,
  MailProvidersSurfaceRevision,
  buildMailProvidersSurface,
  presentedContent,
} from './mail-providers-surface';

const SCOPES: { id: MailScope; title: string; blurb: string }[] = [
  {
    id: 'transactional',
    title: 'Transactional',
    blurb: 'One message, to one person, because they did something. Password resets, invites, receipts.',
  },
  {
    id: 'bulk',
    title: 'Bulk',
    blurb:
      'One message to many. Newsletters, announcements — anything someone subscribed to, whether or not it sells something.',
  },
];

@Component({
  selector: 'app-mail-providers',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReadOnlySectionDirective, 
    FormsModule,
    NgIcon,
    MailSectionNavComponent,
    MailRecordRowComponent,
    MailDomainPickerComponent,
    MailTestSendComponent,
    MailConnectionSetupComponent,
    ConfirmationDialogComponent,
  ],
  providers: [
    provideIcons({
      lucideCheck,
      lucideCircleAlert,
      lucideExternalLink,
      lucideEyeOff,
      lucidePlus,
      lucideRotateCcw,
      lucideSend,
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
          <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" [class.animate-spin]="loading()" />
          Refresh
        </button>
      </app-mail-section-nav>

      <p class="mb-5 max-w-3xl text-sm text-muted-foreground">
        Two senders, kept apart on purpose. A provider that suspends an account over a mailing
        list would take the password resets down with it, so bulk and transactional never share
        an account, a credential or a sending domain.
      </p>

      @if (loading()) {
        @for (i of [1, 2]; track i) {
          <div class="mb-4 rounded-lg border border-border bg-card p-4">
            <div class="skeleton mb-3 h-4 w-32"></div>
            <div class="skeleton mb-2 h-3 w-full max-w-lg"></div>
            <div class="skeleton h-9 w-48"></div>
          </div>
        }
      } @else {
        @if (error()) {
          <div
            class="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
            <span>{{ error() }}</span>
          </div>
        }

        @for (slot of scopes; track slot.id) {
          <div class="mb-4 rounded-lg border border-border bg-card">
            <div class="border-b border-border px-4 py-3">
              <h2 class="text-sm font-semibold text-foreground">{{ slot.title }}</h2>
              <p class="mt-0.5 max-w-2xl text-xs text-muted-foreground">{{ slot.blurb }}</p>
            </div>

            <div class="divide-y divide-border">
              @for (row of rowsFor(slot.id); track row.id) {
                <div class="px-4 py-3">
                 <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span class="flex items-center gap-1.5 font-medium text-foreground">
                        <span
                          class="h-1.5 w-1.5 rounded-full"
                          [class]="row.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40'"
                        ></span>
                        {{ row.label }}
                      </span>
                      <span
                        class="rounded-md px-1.5 py-0.5 text-[11px]"
                        [class]="
                          row.isActive
                            ? 'bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        "
                      >
                        {{ row.isActive ? 'Sending' : 'Ready, not sending' }}
                      </span>
                      @if (row.implicit) {
                        <span
                          class="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                        >
                          already in use
                        </span>
                      }
                      @if (row.sendingDomain) {
                        <span class="font-mono text-xs text-muted-foreground">
                          from {{ row.sendingDomain }}
                        </span>
                      }
                      @if (blindSpotOf(row.provider); as blind) {
                        <span
                          class="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-400"
                          [title]="blind"
                        >
                          <ng-icon name="lucideEyeOff" class="h-3 w-3" /> limited reporting
                        </span>
                      }
                    </div>

                    @if (row.credentialNote) {
                      <p class="mt-1.5 text-xs text-muted-foreground">{{ row.credentialNote }}</p>
                    }
                    @if (row.implicit && !row.sendingDomain) {
                      @if (verifiedDomains().length) {
                        <p class="mt-1.5 text-xs text-muted-foreground">
                          Sending from
                          <span class="font-mono text-foreground">
                            {{ verifiedDomains().join(', ') }}
                          </span>
                          — verified at the provider.
                        </p>
                      } @else {
                        <p class="mt-1.5 text-xs text-muted-foreground">
                          No verified domain yet. Mail is refused until one is set up.
                        </p>
                      }
                    }
                    @if (blindSpotOf(row.provider); as blind) {
                      <p class="mt-1.5 text-xs text-muted-foreground">{{ blind }}</p>
                    }

                    @if (!row.implicit) {
                      <app-mail-connection-setup
                        [connectionId]="row.id"
                        [providerName]="providerLabel(row.provider)"
                      />
                    }

                    @if (!row.webhookRegistered && pushes(row.provider)) {
                      <div class="mt-2 rounded-md bg-amber-50 p-2 dark:bg-amber-500/10">
                        <p class="text-xs font-medium text-amber-900 dark:text-amber-300">
                          Delivered, bounced and marked-as-spam are not being reported.
                        </p>
                        @if (row.webhookNote) {
                          <p class="mt-0.5 text-[11px] text-amber-800 dark:text-amber-400">
                            {{ row.webhookNote }}
                          </p>
                        }
                        <button appReadOnlySection="mail"
                          type="button"
                          (click)="retryWebhook(row)"
                          [disabled]="retrying() === row.id"
                          class="mt-1.5 inline-flex h-7 items-center gap-1.5 rounded-md border border-amber-300 px-2 text-[11px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/20"
                        >
                          @if (retrying() === row.id) {
                            <ng-icon name="lucideRotateCcw" class="h-3 w-3 animate-spin" />
                          }
                          Try again
                        </button>
                      </div>
                    }
                  </div>

                  <div class="flex shrink-0 items-center gap-2">
                    <button appReadOnlySection="mail"
                      type="button"
                      (click)="toggleTest(row)"
                      class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted"
                    >
                      <ng-icon name="lucideSend" class="h-3.5 w-3.5" />
                      {{ testing() === row.id ? 'Close' : 'Test' }}
                    </button>
                    @if (!row.implicit) {
                      <button appReadOnlySection="mail"
                        type="button"
                        (click)="toggleAddDomain(row)"
                        class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted"
                      >
                        <ng-icon name="lucidePlus" class="h-3.5 w-3.5" />
                        {{ adding() === row.id ? 'Close' : 'Add domain' }}
                      </button>
                    }
                    @if (!row.isActive) {
                      <button appReadOnlySection="mail"
                        type="button"
                        (click)="activate(row)"
                        [disabled]="switching() === row.id"
                        class="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary bg-primary/10 px-2.5 text-xs font-medium text-foreground hover:bg-primary/20 disabled:opacity-60"
                      >
                        @if (switching() === row.id) {
                          <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5 animate-spin" />
                        }
                        Send through this one
                      </button>
                    }
                    @if (!row.implicit) {
                      <button appReadOnlySection="mail"
                        type="button"
                        (click)="askDisconnect(row)"
                        class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted"
                      >
                        <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" /> Disconnect
                      </button>
                    }
                  </div>
                 </div>

                  @if (adding() === row.id) {
                    <div class="mt-3 rounded-md border border-border bg-muted/30 p-3">
                      <p class="text-xs text-muted-foreground">
                        Registers the domain with this {{ providerLabel(row.provider) }} account and
                        writes the records it asks for. An account may send from several domains.
                      </p>
                      <div class="mt-2.5 flex flex-wrap items-end gap-3">
                        <div class="min-w-72 flex-1">
                          <app-mail-domain-picker
                            label=""
                            suggestedPrefix="mail"
                            (domainChange)="newDomain.set($event)"
                          />
                        </div>
                        <button appReadOnlySection="mail"
                          type="button"
                          (click)="addDomain(row)"
                          [disabled]="registering() || !newDomain().trim()"
                          class="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                        >
                          @if (registering()) {
                            <ng-icon name="lucideRotateCcw" class="h-4 w-4 animate-spin" />
                          }
                          Register with {{ providerLabel(row.provider) }}
                        </button>
                      </div>
                      @if (addError(); as failed) {
                        <p class="mt-2 text-xs text-destructive">{{ failed }}</p>
                      }
                      @if (added(); as done) {
                        <p class="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{{ done }}</p>
                      }
                    </div>
                  }

                  @if (testing() === row.id) {
                    <app-mail-test-send [connectionId]="row.id" />
                  }
                </div>
              } @empty {
                <div class="px-4 py-3">
                  <p class="text-sm text-muted-foreground">
                    {{
                      slot.id === 'bulk'
                        ? 'Nothing connected. Bulk sends are refused until a provider whose terms allow them is set up.'
                        : 'Nothing connected.'
                    }}
                  </p>
                </div>
              }
            </div>

            @if (openSlot() !== slot.id) {
              <div class="px-4 pb-3">
                <button appReadOnlySection="mail"
                  type="button"
                  (click)="openFor(slot.id)"
                  class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  <ng-icon name="lucidePlus" class="h-3.5 w-3.5" />
                  {{ connectLabel(slot.id) }}
                </button>
              </div>
            }

            @if (openSlot() === slot.id) {
              <div class="border-t border-border bg-muted/30 px-4 py-4">
                <div class="mb-3 flex flex-wrap gap-2">
                  @for (p of providersFor(slot.id); track p.id) {
                    <button
                      type="button"
                      (click)="choose(p.id)"
                      [disabled]="!!p.unproven"
                      [title]="
                        p.unproven
                          ? p.name +
                            ' is implemented but no message has been sent through it end to end yet.'
                          : ''
                      "
                      class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
                      [class]="
                        p.unproven
                          ? 'cursor-not-allowed border-dashed border-border text-muted-foreground/60'
                          : chosen() === p.id
                            ? 'border-primary bg-primary/10 font-medium text-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted'
                      "
                    >
                      {{ p.name }}
                      @if (p.unproven) {
                        <span
                          class="rounded bg-muted px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                          >Soon</span
                        >
                      }
                    </button>
                  }
                </div>

                @if (profile(); as p) {
                  <p class="mb-3 max-w-2xl text-xs text-muted-foreground">{{ p.summary }}</p>

                  <div class="grid gap-3 md:grid-cols-2">
                    @if (p.needsSecret) {
                      <label class="block">
                        <span class="mb-1 block text-xs font-medium text-foreground">
                          {{ p.secretLabel }}
                        </span>
                        <input
                          type="password"
                          [(ngModel)]="secret"
                          autocomplete="off"
                          class="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground"
                        />

                        @if (p.credentialHelp; as help) {
                          <span class="mt-1.5 block text-[11px] text-muted-foreground">
                            {{ help.where }}
                          </span>
                          <a
                            [href]="help.href"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {{ help.linkText }}
                            <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                          </a>
                          @if (help.caveat) {
                            <span class="mt-1 block text-[11px] text-amber-700 dark:text-amber-400">
                              {{ help.caveat }}
                            </span>
                          }
                        }
                      </label>
                    }

                    <div>
                      <app-mail-domain-picker
                        [suggestedPrefix]="slot.id === 'bulk' ? 'news' : 'mail'"
                        [placeholder]="
                          slot.id === 'bulk' ? 'news.example.com' : 'mail.example.com'
                        "
                        (domainChange)="domain = $event"
                      />
                      @if (slot.id === 'bulk') {
                        <span class="mt-1 block text-[11px] text-muted-foreground">
                          Give bulk its own subdomain: reputation is tracked per domain, so a
                          mailing list must not be able to damage password resets.
                        </span>
                      }
                      @if (!p.automatesDomain) {
                        <span class="mt-1 block text-[11px] text-muted-foreground">
                          This provider verifies domains in its own console. Flui can still
                          publish the records you paste.
                        </span>
                      }
                    </div>

                    @if (suggestions(p.id).length) {
                      <div class="md:col-span-2">
                        <span class="mb-1.5 block text-[11px] text-muted-foreground">
                          Already at this provider — pick one instead of typing:
                        </span>
                        <div class="flex flex-wrap gap-1.5">
                          @for (known of suggestions(p.id); track known.domain) {
                            <button
                              type="button"
                              (click)="domain = known.domain"
                              class="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs"
                              [class]="
                                domain === known.domain
                                  ? 'border-primary bg-primary/10 text-foreground'
                                  : 'border-border text-muted-foreground hover:bg-muted'
                              "
                            >
                              @if (known.verified) {
                                <ng-icon name="lucideCheck" class="h-3 w-3 text-emerald-600" />
                              }
                              {{ known.domain }}
                            </button>
                          }
                        </div>
                      </div>
                    }

                    @for (field of p.fields; track field.key) {
                      <label class="block" [class.md:col-span-2]="field.type === 'checkbox'">
                        @if (field.type === 'checkbox') {
                          <span class="flex items-start gap-2">
                            <input
                              type="checkbox"
                              [ngModel]="configBool(field.key)"
                              (ngModelChange)="setConfig(field.key, $event)"
                              class="mt-0.5 h-4 w-4 rounded border-border"
                            />
                            <span>
                              <span class="block text-xs font-medium text-foreground">
                                {{ field.label }}
                              </span>
                              @if (field.hint) {
                                <span class="block text-[11px] text-muted-foreground">
                                  {{ field.hint }}
                                </span>
                              }
                            </span>
                          </span>
                        } @else {
                          <span class="mb-1 block text-xs font-medium text-foreground">
                            {{ field.label }}{{ field.required ? '' : ' (optional)' }}
                          </span>
                          <input
                            [type]="field.type"
                            [ngModel]="configText(field.key)"
                            (ngModelChange)="setConfig(field.key, $event)"
                            class="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground"
                          />
                          @if (field.hint) {
                            <span class="mt-1 block text-[11px] text-muted-foreground">
                              {{ field.hint }}
                            </span>
                          }
                        }
                      </label>
                    }
                  </div>

                  @if (p.blindSpot) {
                    <p
                      class="mt-3 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                    >
                      <ng-icon name="lucideEyeOff" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{{ p.blindSpot }}</span>
                    </p>
                  }

                  @if (holdsScope(slot.id); as held) {
                    <label class="mt-3 flex items-start gap-2">
                      <input
                        type="checkbox"
                        [(ngModel)]="activateNow"
                        [ngModelOptions]="{ standalone: true }"
                        class="mt-0.5 h-4 w-4 rounded border-border"
                      />
                      <span>
                        <span class="block text-xs font-medium text-foreground">
                          Send {{ slot.id }} mail through this one straight away
                        </span>
                        <span class="block text-[11px] text-muted-foreground">
                          {{ held.label }} stops sending and keeps its credential. Leave this
                          unticked to set the provider up now and switch when its domain has
                          verified.
                        </span>
                      </span>
                    </label>
                  } @else if (activeIn(slot.id)) {
                    <p class="mt-3 text-[11px] text-muted-foreground">
                      {{ slot.title }} mail moves from {{ activeIn(slot.id)?.label }} to this
                      provider as soon as it is connected. Disconnecting it hands the mail back.
                    </p>
                  }

                  <div class="mt-4 flex items-center gap-2">
                    <button appReadOnlySection="mail"
                      type="button"
                      (click)="connect(slot.id)"
                      [disabled]="connecting() || !canConnect()"
                      class="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
                    >
                      @if (connecting()) {
                        <ng-icon name="lucideRotateCcw" class="h-4 w-4 animate-spin" />
                      }
                      {{ connecting() ? 'Setting up…' : 'Connect' }}
                    </button>
                    <button
                      type="button"
                      (click)="cancel()"
                      [disabled]="connecting()"
                      class="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        }

        @if (result(); as r) {
          <div class="rounded-lg border border-border bg-card p-4">
            <h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <ng-icon name="lucideCheck" class="h-4 w-4 text-emerald-600" />
              {{ r.connection.label }} is connected
            </h3>

            <p class="mb-2 text-xs text-muted-foreground">
              {{
                r.activated
                  ? 'It is now carrying ' + r.connection.scope + ' mail.'
                  : 'It is not sending yet — another provider still holds the scope. Press "Send through this one" above when you are ready.'
              }}
            </p>

            @if (r.domain?.published?.length) {
              <p class="mb-2 text-xs text-muted-foreground">
                Published {{ r.domain!.published.length }} DNS record(s).
                {{
                  r.domain!.verified
                    ? 'The provider has confirmed the domain.'
                    : 'Waiting for the provider to confirm it — that lags DNS by minutes.'
                }}
              </p>
            }

            @if (r.manualSteps.length) {
              <div class="mb-3">
                <p class="mb-1 text-xs font-medium text-foreground">Left for you</p>
                <ul class="space-y-1">
                  @for (step of r.manualSteps; track step) {
                    <li class="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <ng-icon
                        name="lucideCircleAlert"
                        class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
                      />
                      <span>{{ step }}</span>
                    </li>
                  }
                </ul>
              </div>
            }

            @if (r.domain?.outstanding?.length && !r.domain!.canWrite) {
              <p class="mb-2 text-xs text-muted-foreground">
                Flui does not hold this zone. Publish these where it is hosted:
              </p>
              <div class="space-y-2">
                @for (record of r.domain!.outstanding; track record.name + record.value) {
                  <app-mail-record-row [record]="record" />
                }
              </div>
            }
          </div>
        }
      }

      <app-confirmation-dialog
        #disconnectDialog
        [title]="disconnectTitle()"
        [message]="disconnectMessage"
        [details]="disconnectDetails()"
        confirmText="Disconnect"
        processingText="Disconnecting…"
        variant="danger"
        (confirmed)="confirmDisconnect()"
        (cancelled)="pending.set(null)"
      />
    </div>
  `,
})
export class MailProvidersComponent implements OnInit, OnDestroy {
  private readonly api = inject(MailConsoleService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly scopes = SCOPES;
  protected readonly connections = signal<MailConnection[]>([]);
  protected readonly knownDomains = signal<MailDomainProofs[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly connecting = signal(false);
  protected readonly openSlot = signal<MailScope | null>(null);
  protected readonly chosen = signal<MailProviderId | null>(null);
  protected readonly result = signal<MailConnectResult | null>(null);
  protected readonly pending = signal<MailConnection | null>(null);
  protected readonly switching = signal<string | null>(null);
  protected readonly retrying = signal<string | null>(null);
  protected readonly testing = signal<string | null>(null);
  protected readonly adding = signal<string | null>(null);
  protected readonly newDomain = signal('');
  protected readonly registering = signal(false);
  protected readonly added = signal<string | null>(null);
  protected readonly addError = signal<string | null>(null);

  protected secret = '';
  protected domain = '';
  protected activateNow = false;
  protected readonly config = signal<MailConnectionConfig>({});

  private readonly disconnectDialog = viewChild<ConfirmationDialogComponent>('disconnectDialog');

  protected readonly profile = computed<MailProviderProfile | null>(
    () => MAIL_PROVIDERS.find((p) => p.id === this.chosen()) ?? null,
  );

  protected readonly disconnectTitle = computed(
    () => `Disconnect ${this.pending()?.label ?? 'this provider'}`,
  );

  protected readonly disconnectMessage = 'The stored credential is destroyed.';

  protected readonly disconnectDetails = computed(() => {
    const connection = this.pending();
    return [
      ...(connection?.isActive
        ? [
            `It is the one sending, so ${connection.scope} mail changes hands the moment this ` +
              'is done. Switching to another provider instead leaves this one configured.',
          ]
        : []),
      'Flui polls once more first, so a bounce still in flight is not lost.',
      'The domain stays registered at the provider, and the DNS records stay published.',
      'Delivery outcomes already collected are kept — they carry their own provider name.',
    ];
  });

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

  protected verifiedDomains(): string[] {
    return this.knownDomains()
      .filter((d) => d.verified)
      .map((d) => d.domain);
  }

  protected suggestions(provider: MailProviderId): MailDomainProofs[] {
    const connected = this.connections().some((c) => c.provider === provider && c.isActive);
    return connected ? this.knownDomains() : [];
  }

  protected activeIn(scope: MailScope): MailConnection | undefined {
    return this.connections().find((c) => c.scope === scope && c.isActive);
  }

  protected holdsScope(scope: MailScope): MailConnection | undefined {
    const active = this.activeIn(scope);
    return active && !active.implicit ? active : undefined;
  }

  protected rowsFor(scope: MailScope): MailConnection[] {
    return this.connections()
      .filter((c) => c.scope === scope)
      .sort((a, b) => Number(b.isActive) - Number(a.isActive));
  }

  protected connectLabel(scope: MailScope): string {
    const active = this.activeIn(scope);
    if (!active) return 'Connect a provider';
    return active.implicit ? 'Set up a sending domain' : 'Add another provider';
  }

  protected toggleTest(connection: MailConnection): void {
    this.testing.update((open) => (open === connection.id ? null : connection.id));
  }

  protected toggleAddDomain(connection: MailConnection): void {
    this.adding.update((open) => (open === connection.id ? null : connection.id));
    this.newDomain.set('');
    this.added.set(null);
    this.addError.set(null);
  }

  protected addDomain(connection: MailConnection): void {
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
              `${this.providerLabel(connection.provider)} verifies on its own schedule.`,
        );
      },
      error: (err) => {
        this.addError.set(consoleError(err));
        this.registering.set(false);
      },
    });
  }

  protected activate(connection: MailConnection): void {
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

  protected retryWebhook(connection: MailConnection): void {
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

  protected providersFor(scope: MailScope): MailProviderProfile[] {
    return MAIL_PROVIDERS.filter((p) => p.scopes.includes(scope));
  }

  protected blindSpotOf(provider: MailProviderId): string {
    return MAIL_PROVIDERS.find((p) => p.id === provider)?.blindSpot ?? '';
  }

  protected providerLabel(provider: MailProviderId): string {
    return MAIL_PROVIDERS.find((p) => p.id === provider)?.name ?? provider;
  }

  protected pushes(provider: MailProviderId): boolean {
    return provider === 'brevo' || provider === 'zeptomail';
  }

  protected openFor(scope: MailScope): void {
    this.openSlot.set(scope);
    this.result.set(null);
    const offerable = this.providersFor(scope).find((p) => !p.unproven);
    this.choose(offerable?.id ?? null);
  }

  protected choose(provider: MailProviderId | null): void {
    this.chosen.set(provider);
    this.secret = '';
    this.config.set({});
  }

  protected cancel(): void {
    this.openSlot.set(null);
    this.chosen.set(null);
    this.secret = '';
    this.domain = '';
    this.activateNow = false;
    this.config.set({});
  }

  protected configText(key: keyof MailConnectionConfig): string {
    const value = this.config()[key];
    return value === undefined ? '' : String(value);
  }

  protected configBool(key: keyof MailConnectionConfig): boolean {
    return this.config()[key] === true;
  }

  protected setConfig(key: keyof MailConnectionConfig, value: unknown): void {
    this.config.update((current) => {
      const next = { ...current } as Record<string, unknown>;
      if (value === '' || value === false || value === null || value === undefined) {
        delete next[key];
      } else {
        next[key] = key === 'port' ? Number(value) : value;
      }
      return next as MailConnectionConfig;
    });
  }

  protected canConnect(): boolean {
    const p = this.profile();
    if (!p) return false;
    if (p.needsSecret && !this.secret.trim()) return false;
    if (!this.domain.trim()) return false;
    return p.fields.every((f) => !f.required || this.configText(f.key).trim().length > 0);
  }

  protected connect(scope: MailScope): void {
    const p = this.profile();
    if (!p) return;

    this.connecting.set(true);
    this.error.set(null);
    this.api
      .connect({
        provider: p.id,
        scope,
        ...(this.domain.trim() ? { sendingDomain: this.domain.trim() } : {}),
        ...(this.secret.trim() ? { secret: this.secret.trim() } : {}),
        ...(this.activateNow ? { activate: true } : {}),
        ...(Object.keys(this.config()).length ? { config: this.config() } : {}),
      })
      .subscribe({
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

  protected askDisconnect(connection: MailConnection): void {
    this.pending.set(connection);
    this.disconnectDialog()?.open();
  }

  protected confirmDisconnect(): void {
    const connection = this.pending();
    if (!connection) return;

    this.disconnectDialog()?.setProcessing(true);
    this.api.disconnect(connection.id).subscribe({
      next: () => {
        this.pending.set(null);
        this.disconnectDialog()?.close();
        this.load();
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.disconnectDialog()?.setProcessing(false);
        this.disconnectDialog()?.close();
      },
    });
  }
}
