import {
  Component,
  ElementRef,
  inject,
  input,
  signal,
  computed,
  effect,
  OnInit,
  OnDestroy,
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
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';

type Issuer = ClusterDnsZoneControllerGetIssuers200ResponseInner;
const SolverType = ClusterDnsZoneControllerGetIssuers200ResponseInner.SolverTypeEnum;

@Component({
  selector: 'app-cluster-certificate-issuers',
  imports: [
    FormsModule,
    CanDirective,
    FlAlert,
    FlField,
    FlPanel,
    FlEmptyState,
    FlLoadingState,
    FlTable,
    FlButton,
    FlSpinner,
    FlStatus,
  ],
  providers: [provideIcons({ lucideShieldOff })],
  host: { id: 'standard-certificate-issuers', class: 'fl-stack' },
  template: `
    <fl-panel
      title="Standard certificate issuers (HTTP-01)"
      [count]="httpIssuers().length || null"
      [flush]="true"
    >
      <ng-container panelActions>
        @if (!configuring()) {
          @if (httpIssuers().length > 0) {
            <button
              *fluiCan="'cluster:manage'"
              flButton="ghost"
              size="sm"
              type="button"
              data-testid="http-issuers-delete"
              [disabled]="deleting()"
              (click)="deleteConfirm.set(true)"
            >
              Delete
            </button>
          }
          @if (!loading() || httpIssuers().length > 0) {
            <button flButton size="sm" type="button" [disabled]="deleting()" (click)="toggleForm()">
              {{ httpIssuers().length > 0 ? 'Reconfigure' : 'Configure' }}
            </button>
          }
        }
      </ng-container>

      @if (loading() && httpIssuers().length === 0) {
        <fl-loading-state [rows]="2" />
      } @else if (httpIssuers().length > 0 || configuring()) {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Issuer</th>
                <th scope="col">ACME email</th>
                <th scope="col" class="is-fit">Status</th>
              </tr>
            </thead>
            <tbody>
              @if (httpIssuers().length > 0) {
                @for (issuer of httpIssuers(); track issuer.name) {
                  <tr>
                    <td class="fl-mono">{{ issuer.name }}</td>
                    <td class="text-fl-ink-secondary">{{ issuer.email || '—' }}</td>
                    <td class="is-fit">
                      @if (configuring()) {
                        <fl-status tone="progress" label="Configuring" />
                      } @else {
                        <fl-status
                          [tone]="issuer.ready ? 'success' : 'warning'"
                          [label]="issuer.ready ? 'Ready' : 'Not ready'"
                        />
                      }
                    </td>
                  </tr>
                }
              } @else {
                @for (name of pendingIssuerNames; track name) {
                  <tr>
                    <td class="fl-mono">{{ name }}</td>
                    <td class="text-fl-ink-muted">—</td>
                    <td class="is-fit"><fl-status tone="progress" label="Configuring" /></td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
        @if (configuring()) {
          <p
            class="m-0 border-t border-fl-border-subtle px-4 py-3 text-fl-body-sm text-fl-ink-muted"
          >
            Applying manifests to the cluster and waiting for cert-manager.
          </p>
        }
      } @else {
        <fl-empty-state
          icon="lucideShieldOff"
          [compact]="true"
          title="No standard certificate issuers"
          body="Configure standard issuers to enable certificates for your domains."
        />
      }

      @if (deleteConfirm() || deleteError() || showForm()) {
        <div class="flex flex-col gap-4 border-t border-fl-border p-4">
          @if (deleteConfirm()) {
            <fl-alert tone="error" title="Delete the standard issuers?">
              Both the staging and the production issuer are removed.
              <ng-container alertActions>
                <button
                  flButton="danger"
                  size="sm"
                  type="button"
                  [disabled]="deleting()"
                  (click)="deleteHttpIssuers()"
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
            <div class="flex flex-col gap-4">
              <fl-field
                label="ACME email"
                for="http-issuers-email"
                hint="Used for Let's Encrypt registration and expiry notices."
              >
                <div class="fl-input fl-input--lg">
                  <input
                    id="http-issuers-email"
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
                <button flButton="ghost" type="button" [disabled]="saving()" (click)="toggleForm()">
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
                    Apply configuration
                  }
                </button>
              </div>
            </div>
          }
        </div>
      }
    </fl-panel>
  `,
})
export class ClusterCertificateIssuersComponent implements OnInit, OnDestroy {
  private readonly dnsZoneService = inject(ClusterDnsZoneService);
  private readonly wsService = inject(ClusterIssuerWebSocketService);

  clusterId = input.required<string>();
  refreshTrigger = input<number>(0);

  protected issuers = signal<Issuer[]>([]);
  protected loading = signal(false);
  protected configuring = signal(false);
  protected deleting = signal(false);
  protected showForm = signal(false);
  protected deleteConfirm = signal(false);
  protected saving = signal(false);
  protected formEmail = signal('');
  protected formError = signal<string | null>(null);
  protected deleteError = signal<string | null>(null);

  protected readonly pendingIssuerNames = ['letsencrypt-staging', 'letsencrypt-production'];

  private isHttpIssuer(issuer: Issuer): boolean {
    const name = issuer.name ?? '';
    if (name.includes('wildcard')) return false;
    if (issuer.solverType === SolverType.Dns01 || issuer.solverType === SolverType.Combined)
      return false;
    return true;
  }

  protected httpIssuers = computed(() => this.issuers().filter((i) => this.isHttpIssuer(i)));
  protected isConfigured = computed(() => this.httpIssuers().length > 0);

  constructor() {
    effect(() => {
      const trigger = this.refreshTrigger();
      if (trigger > 0) this.loadIssuers();
    });
  }

  ngOnInit(): void {
    void (async () => {
      await this.loadIssuers();
    })();
  }

  ngOnDestroy(): void {
    const id = this.clusterId();
    if (id) this.wsService.unsubscribeFromCluster(id);
  }

  protected async loadIssuers(): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    this.loading.set(true);
    this.issuers.set(await this.dnsZoneService.getIssuers(id));
    this.loading.set(false);
  }

  readonly el = inject(ElementRef);

  openForm(): void {
    const existing = this.httpIssuers().find((i) => i.email);
    this.formEmail.set(existing?.email ?? '');
    this.formError.set(null);
    this.deleteError.set(null);
    this.showForm.set(true);
    this.el.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected toggleForm(): void {
    const existing = this.httpIssuers().find((i) => i.email);
    this.formEmail.set(existing?.email ?? '');
    this.formError.set(null);
    this.deleteError.set(null);
    this.deleteConfirm.set(false);
    this.showForm.update((v) => !v);
  }

  protected async submitForm(): Promise<void> {
    const email = this.formEmail().trim();
    if (!email) return;
    const id = this.clusterId();

    this.saving.set(true);
    this.formError.set(null);
    this.deleteError.set(null);
    this.deleteConfirm.set(false);

    const ok = await this.dnsZoneService.configureIssuerByType(id, 'http', { acmeEmail: email });
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
        if (e.issuers?.length) this.issuers.set(e.issuers);
      },
      onConfigured: (e: IssuerConfiguredEvent) => {
        this.issuers.set(e.issuers);
        this.configuring.set(false);
        this.wsService.unsubscribeFromCluster(id);
      },
      onFailed: (_e: IssuerFailedEvent) => {
        this.configuring.set(false);
        this.wsService.unsubscribeFromCluster(id);
        this.loadIssuers();
      },
    });
  }

  protected async deleteHttpIssuers(): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    this.deleting.set(true);
    this.deleteError.set(null);

    const ok = await this.dnsZoneService.deleteIssuersByType(id, 'http');
    if (!ok) {
      this.deleteError.set(this.dnsZoneService.error() ?? 'HTTP-01 issuer deletion failed');
      this.deleting.set(false);
      return;
    }

    this.deleteConfirm.set(false);
    this.showForm.set(false);
    await this.loadIssuers();
    this.deleting.set(false);
  }
}
