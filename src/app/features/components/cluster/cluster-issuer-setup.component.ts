import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  effect,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideShieldOff } from '@ng-icons/lucide';
import { ClusterDnsZoneService } from '../../service/cluster-dns-zone.service';
import {
  ClusterIssuerWebSocketService,
  IssuerStatusEvent,
  IssuerConfiguredEvent,
  IssuerFailedEvent,
} from '../../service/cluster-issuer-websocket.service';
import { ClusterDnsZoneControllerGetIssuers200ResponseInner } from '../../../core/api/model/clusterDnsZoneControllerGetIssuers200ResponseInner';
import { CanDirective } from '../../../core/directives/can.directive';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

type Issuer = ClusterDnsZoneControllerGetIssuers200ResponseInner;
const SolverType = ClusterDnsZoneControllerGetIssuers200ResponseInner.SolverTypeEnum;

@Component({
  selector: 'app-cluster-issuer-setup',
  imports: [
    FormsModule,
    CanDirective,
    FlAlert,
    FlField,
    FlPanel,
    FlEmptyState,
    FlTable,
    FlButton,
    FlSpinner,
    FlStatus,
  ],
  providers: [provideIcons({ lucideShieldOff })],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Wildcard certificate issuers (DNS-01)" [flush]="true">
      <ng-container panelActions>
        @if (allDns01Ready()) {
          <fl-status tone="success" label="DNS-01 ready" />
        } @else if (hasHttp01()) {
          <fl-status tone="error" label="Action required" />
        }
        @if (dnsIssuers().length > 0 && !configuring() && !showForm()) {
          <button
            *fluiCan="'cluster:manage'"
            flButton="ghost"
            size="sm"
            type="button"
            data-testid="dns-issuers-delete"
            [disabled]="deleting()"
            (click)="deleteConfirm.set(true)"
          >
            Delete
          </button>
        }
        @if (displayIssuers().length > 0 && !configuring() && !showForm()) {
          <button flButton size="sm" type="button" [disabled]="deleting()" (click)="openForm()">
            Reconfigure
          </button>
        }
      </ng-container>

      @if (displayIssuers().length > 0) {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Issuer</th>
                <th scope="col">Solver</th>
                <th scope="col" class="is-fit">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (issuer of displayIssuers(); track issuer.name) {
                <tr>
                  <td class="whitespace-normal">
                    <span class="flex min-w-0 flex-col">
                      <span class="fl-mono">{{ issuer.name }}</span>
                      @if (issuer.email && !configuring()) {
                        <span class="text-fl-caption text-fl-ink-muted">{{ issuer.email }}</span>
                      }
                      @if (issuer.message && !configuring()) {
                        <span class="text-fl-caption text-fl-ink-muted" [title]="issuer.message">{{
                          issuer.message
                        }}</span>
                      }
                    </span>
                  </td>
                  <td class="fl-mono">{{ configuring() ? '—' : issuer.solverType || '—' }}</td>
                  <td class="is-fit">
                    <fl-status [tone]="issuerTone(issuer)" [label]="issuerLabel(issuer)" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <fl-empty-state
          icon="lucideShieldOff"
          [compact]="true"
          title="No wildcard certificate issuers"
          body="Enter an ACME email to configure them."
        />
      }

      @if (
        configuring() ||
        configureError() ||
        deleteConfirm() ||
        deleteError() ||
        showForm() ||
        (hasHttp01() && !configuring())
      ) {
        <div class="flex flex-col gap-4 border-t border-fl-border p-4">
          @if (configuring()) {
            <fl-status
              tone="progress"
              label="Applying manifests, waiting for cert-manager to register with Let's Encrypt"
            />
          }

          @if (hasHttp01() && !configuring() && !showForm()) {
            <fl-alert tone="error" title="Current issuers do not support wildcard certificates">
              Update the issuer configuration to enable wildcard certificates for your domains.
              <button alertActions flButton size="sm" type="button" (click)="openForm()">
                Reconfigure wildcard issuers
              </button>
            </fl-alert>
          }

          @if (configureError()) {
            <fl-alert tone="error" title="Configuration failed">{{ configureError() }}</fl-alert>
          }

          @if (deleteConfirm()) {
            <fl-alert tone="error" title="Delete the wildcard issuers?">
              Both the staging and the production issuer are removed.
              <ng-container alertActions>
                <button
                  flButton="danger"
                  size="sm"
                  type="button"
                  [disabled]="deleting()"
                  (click)="deleteDnsIssuers()"
                >
                  @if (deleting()) {
                    <fl-spinner label="Deleting" />
                    Deleting…
                  } @else {
                    Delete
                  }
                </button>
                <button
                  flButton="ghost"
                  size="sm"
                  type="button"
                  [disabled]="deleting()"
                  (click)="deleteConfirm.set(false)"
                >
                  Cancel
                </button>
              </ng-container>
            </fl-alert>
          }

          @if (deleteError()) {
            <fl-alert tone="error" title="Could not delete the issuers">{{
              deleteError()
            }}</fl-alert>
          }

          @if (showForm()) {
            <fl-field
              label="ACME email"
              for="dns-issuers-email"
              hint="Used for Let's Encrypt registration and expiry notices."
            >
              <div class="fl-input fl-input--lg">
                <input
                  id="dns-issuers-email"
                  type="email"
                  placeholder="admin@example.com"
                  [ngModel]="formEmail()"
                  (ngModelChange)="formEmail.set($event)"
                />
              </div>
            </fl-field>

            @if (formError()) {
              <fl-alert tone="error" title="Configuration failed">{{ formError() }}</fl-alert>
            }

            <div class="flex justify-end gap-2">
              <button flButton="ghost" type="button" [disabled]="saving()" (click)="closeForm()">
                Cancel
              </button>
              <button
                flButton="primary"
                type="button"
                [disabled]="saving() || !formEmail().trim()"
                (click)="submitForm()"
              >
                @if (saving()) {
                  <fl-spinner label="Applying" />
                  Applying…
                } @else {
                  Configure wildcard issuers
                }
              </button>
            </div>
          }
        </div>
      }
    </fl-panel>
  `,
})
export class ClusterIssuerSetupComponent implements OnInit, OnDestroy {
  private readonly dnsZoneService = inject(ClusterDnsZoneService);
  private readonly wsService = inject(ClusterIssuerWebSocketService);

  clusterId = input.required<string>();
  /** Increment this input to trigger a refresh from the parent */
  refreshTrigger = input<number>(0);
  /** When true, opens the form automatically on init (e.g. after fresh zone assignment) */
  openFormOnInit = input<boolean>(false);
  /** ACME email already stored on the zone assignment — used when no issuer carries one yet */
  fallbackAcmeEmail = input<string>('');
  /** Emitted when issuer ready-state changes */
  issuersReadyChange = output<boolean>();

  protected issuers = signal<Issuer[]>([]);
  protected loading = signal(false);
  protected configuring = signal(false);
  protected showForm = signal(false);
  protected saving = signal(false);
  protected deleting = signal(false);
  protected deleteConfirm = signal(false);
  protected formEmail = signal('');
  protected formError = signal<string | null>(null);
  protected configureError = signal<string | null>(null);
  protected deleteError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const trigger = this.refreshTrigger();
      if (trigger > 0) this.reloadIssuers();
    });
  }

  private isDnsIssuer(issuer: Issuer): boolean {
    const name = issuer.name ?? '';
    return (
      name.includes('wildcard') ||
      issuer.solverType === SolverType.Dns01 ||
      issuer.solverType === SolverType.Combined
    );
  }

  protected dnsIssuers = computed(() => this.issuers().filter((i) => this.isDnsIssuer(i)));

  protected readonly placeholderNames = [
    'letsencrypt-staging-wildcard',
    'letsencrypt-production-wildcard',
  ];

  protected allDns01Ready = computed(
    () =>
      this.dnsIssuers().length > 0 &&
      this.dnsIssuers().every(
        (i) =>
          i.ready && (i.solverType === SolverType.Dns01 || i.solverType === SolverType.Combined),
      ),
  );

  protected hasHttp01 = computed(() =>
    this.issuers().some((i) => !this.isDnsIssuer(i) && i.solverType === SolverType.Http01),
  );

  protected displayIssuers(): Issuer[] {
    if (this.dnsIssuers().length > 0) return this.dnsIssuers();
    if (this.configuring()) return this.placeholderNames.map((name) => ({ name, ready: false }));
    return [];
  }

  ngOnInit(): void {
    void (async () => {
      const id = this.clusterId();
      if (!id) return;
      this.loading.set(true);
      const loaded = await this.dnsZoneService.getIssuers(id);
      this.issuers.set(loaded);
      this.loading.set(false);
      this.issuersReadyChange.emit(
        loaded.some((i) => i.ready && i.solverType === SolverType.Dns01),
      );

      const existingEmail = loaded.find((i) => this.isDnsIssuer(i) && i.email)?.email;
      this.formEmail.set(existingEmail ?? this.fallbackAcmeEmail());

      const needsConfigure =
        !loaded.some((i) => this.isDnsIssuer(i)) ||
        loaded.some((i) => !this.isDnsIssuer(i) && i.solverType === SolverType.Http01);
      if (this.openFormOnInit() || needsConfigure) {
        this.showForm.set(true);
      }
    })();
  }

  ngOnDestroy(): void {
    const id = this.clusterId();
    if (id) this.wsService.unsubscribeFromCluster(id);
  }

  openForm(): void {
    const existing = this.dnsIssuers().find((i) => i.email);
    this.formEmail.set(existing?.email ?? this.fallbackAcmeEmail());
    this.formError.set(null);
    this.deleteError.set(null);
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
    this.formError.set(null);
  }

  protected async submitForm(): Promise<void> {
    const email = this.formEmail().trim();
    if (!email) return;
    const id = this.clusterId();

    this.saving.set(true);
    this.formError.set(null);
    this.configureError.set(null);
    this.deleteError.set(null);
    this.deleteConfirm.set(false);

    const secretOk = await this.dnsZoneService.configureDnsSecret(id);
    if (!secretOk) {
      this.formError.set(this.dnsZoneService.error() ?? 'Failed to configure DNS secret');
      this.saving.set(false);
      return;
    }

    const ok = await this.dnsZoneService.configureDnsIssuers(id, { acmeEmail: email });
    if (!ok) {
      this.formError.set(this.dnsZoneService.error() ?? 'Configuration failed');
      this.saving.set(false);
      return;
    }

    this.saving.set(false);
    this.showForm.set(false);
    this.configuring.set(true);

    this.wsService.subscribeToCluster(id, {
      onStatus: (e: IssuerStatusEvent) => {
        if (e.issuers?.length) {
          this.issuers.set(e.issuers);
          this.issuersReadyChange.emit(
            e.issuers.some((i) => i.ready && i.solverType === SolverType.Dns01),
          );
        }
      },
      onConfigured: (e: IssuerConfiguredEvent) => {
        this.issuers.set(e.issuers);
        this.configuring.set(false);
        this.issuersReadyChange.emit(
          e.issuers.some((i) => i.ready && i.solverType === SolverType.Dns01),
        );
        this.wsService.unsubscribeFromCluster(id);
      },
      onFailed: (e: IssuerFailedEvent) => {
        this.configuring.set(false);
        this.configureError.set(e.error ?? 'Issuer configuration timed out');
        this.wsService.unsubscribeFromCluster(id);
        this.reloadIssuers();
      },
    });
  }

  private async reloadIssuers(): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    const loaded = await this.dnsZoneService.getIssuers(id);
    this.issuers.set(loaded);
    this.issuersReadyChange.emit(loaded.some((i) => i.ready && i.solverType === SolverType.Dns01));
  }

  protected async deleteDnsIssuers(): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    this.deleting.set(true);
    this.deleteError.set(null);

    const ok = await this.dnsZoneService.deleteIssuersByType(id, 'dns');
    if (!ok) {
      this.deleteError.set(this.dnsZoneService.error() ?? 'DNS-01 issuer deletion failed');
      this.deleting.set(false);
      return;
    }

    this.deleteConfirm.set(false);
    this.showForm.set(false);
    await this.reloadIssuers();
    this.deleting.set(false);
  }

  protected issuerTone(issuer: Issuer): StatusTone {
    if (this.configuring()) return 'progress';
    if (!issuer.ready) return 'warning';
    if (issuer.solverType === SolverType.Http01) return 'warning';
    return 'success';
  }

  protected issuerLabel(issuer: Issuer): string {
    if (this.configuring()) return 'Configuring';
    return issuer.ready ? 'Ready' : 'Not ready';
  }
}
