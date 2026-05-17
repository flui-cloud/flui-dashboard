import { Component, inject, input, output, signal, computed, effect, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideShieldCheck, lucideShieldAlert, lucideShieldOff,
  lucideLoader, lucideCheckCircle, lucideAlertCircle, lucideWifi, lucideDna, lucideTrash2
} from '@ng-icons/lucide';
import { ClusterDnsZoneService } from '../../service/cluster-dns-zone.service';
import {
  ClusterIssuerWebSocketService,
  IssuerStatusEvent,
  IssuerConfiguredEvent,
  IssuerFailedEvent,
} from '../../service/cluster-issuer-websocket.service';
import { ClusterDnsZoneControllerGetIssuers200ResponseInner } from '../../../core/api/model/clusterDnsZoneControllerGetIssuers200ResponseInner';

type Issuer = ClusterDnsZoneControllerGetIssuers200ResponseInner;
const SolverType = ClusterDnsZoneControllerGetIssuers200ResponseInner.SolverTypeEnum;

@Component({
  selector: 'app-cluster-issuer-setup',
  standalone: true,
  imports: [FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideShieldCheck, lucideShieldAlert, lucideShieldOff,
      lucideLoader, lucideCheckCircle, lucideAlertCircle, lucideWifi, lucideDna, lucideTrash2,
    }),
  ],
  template: `
    <div class="space-y-3">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-foreground">Wildcard Certificate Issuers (DNS-01)</p>
          <p class="text-xs text-sub mt-0.5">
            Manage certificates for wildcard domains.
          </p>
        </div>
        @if (allDns01Ready()) {
          <span class="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
            DNS-01 Ready
          </span>
        } @else if (hasHttp01()) {
          <span class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">
            Action required
          </span>
        }
      </div>

      <!-- Warning: issuers are http01 and must be reconfigured for wildcard -->
      @if (hasHttp01() && !configuring() && !showForm()) {
        <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <ng-icon name="lucideAlertCircle" class="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-red-800 dark:text-red-300">Current issuers do not support wildcard certificates</p>
            <p class="text-xs text-red-700 dark:text-red-400 mt-0.5">
              Update issuer configuration to enable wildcard certificates for your domains.
            </p>
            <button
              (click)="openForm()"
              class="mt-1.5 text-xs text-red-700 dark:text-red-300 font-medium hover:underline"
            >
              Reconfigure wildcard issuers ->
            </button>
          </div>
        </div>
      }

      <!-- Issuers list -->
      @if (dnsIssuers().length > 0 || configuring()) {
        <div class="grid gap-2">
          @for (issuer of displayIssuers(); track issuer.name) {
            <div class="rounded-lg border overflow-hidden" [class]="cardClass(issuer)">
              <div class="flex items-center justify-between px-3 py-2.5">
                <div class="flex items-center gap-2.5 min-w-0">
                  <ng-icon
                    [name]="configuring() ? 'lucideLoader' : (issuer.ready ? 'lucideShieldCheck' : 'lucideShieldAlert')"
                    class="h-4 w-4 flex-shrink-0"
                    [class]="configuring() ? 'animate-spin text-blue-500' : (issuer.ready ? 'text-green-600 dark:text-green-400' : 'text-amber-500 dark:text-amber-400')"
                  />
                  <div class="min-w-0">
                    <p class="text-xs font-medium font-mono text-foreground">{{ issuer.name }}</p>
                    @if (issuer.email && !configuring()) {
                      <p class="text-xs text-sub truncate">{{ issuer.email }}</p>
                    }
                    @if (issuer.message && !configuring()) {
                      <p class="text-xs text-muted-foreground truncate" [title]="issuer.message">{{ issuer.message }}</p>
                    }
                  </div>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <!-- Solver type badge -->
                  @if (!configuring() && issuer.solverType) {
                    <span class="text-xs px-1.5 py-0.5 rounded font-mono font-medium"
                      [class]="issuer.solverType === 'dns01'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'"
                    >
                      {{ issuer.solverType }}
                    </span>
                  }
                  <!-- Ready badge -->
                  <span class="text-xs font-medium px-2 py-0.5 rounded-full" [class]="badgeClass(issuer)">
                    {{ configuring() ? 'Configuring...' : (issuer.ready ? 'Ready' : 'Not Ready') }}
                  </span>
                </div>
              </div>
              @if (configuring()) {
                <div class="h-1 w-full bg-blue-100 dark:bg-blue-900/40 overflow-hidden">
                  <div class="h-1 w-1/3 bg-blue-500 dark:bg-blue-400 rounded-full animate-indeterminate"></div>
                </div>
              }
            </div>
          }
        </div>

        @if (configuring()) {
          <p class="text-xs text-blue-600 dark:text-blue-400">
            Applying manifests - waiting for cert-manager to register with Let's Encrypt...
          </p>
        }

        @if (configureError()) {
          <div class="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400">
            <ng-icon name="lucideAlertCircle" class="h-3.5 w-3.5 flex-shrink-0" />
            {{ configureError() }}
          </div>
        }

        @if (!configuring() && !showForm()) {
          <div class="flex items-center gap-3">
            <button (click)="openForm()" [disabled]="deleting()" class="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
              Reconfigure wildcard issuers
            </button>
            @if (dnsIssuers().length > 0) {
              <button (click)="deleteConfirm.set(true)" [disabled]="deleting()" class="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 inline-flex items-center gap-1">
                <ng-icon name="lucideTrash2" class="h-3 w-3" />
                Delete wildcard issuers
              </button>
            }
          </div>
        }

        @if (deleteConfirm()) {
          <div class="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs">
            <span class="text-red-700 dark:text-red-400 flex-1">Delete wildcard issuers (staging + production)?</span>
            <button (click)="deleteDnsIssuers()" [disabled]="deleting()" class="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium disabled:opacity-50">
              @if (deleting()) { Deleting... } @else { Delete }
            </button>
            <button (click)="deleteConfirm.set(false)" [disabled]="deleting()" class="px-2 py-1 text-muted-foreground hover:text-foreground text-xs disabled:opacity-50">Cancel</button>
          </div>
        }

        @if (deleteError()) {
          <div class="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400">
            <ng-icon name="lucideAlertCircle" class="h-3.5 w-3.5 flex-shrink-0" />
            {{ deleteError() }}
          </div>
        }
      } @else {
        <div class="flex items-start gap-3 p-3 card-inner border border-border rounded-lg">
          <ng-icon name="lucideShieldOff" class="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p class="text-xs text-sub">
            No wildcard certificate issuers configured yet. Enter an ACME email to continue.
          </p>
        </div>
      }

      <!-- ACME email form -->
      @if (showForm()) {
        <div class="border border-border rounded-lg p-3 space-y-3 card-inner">

          <div class="space-y-1">
            <label class="text-xs font-medium text-foreground">
              ACME Email <span class="text-red-500">*</span>
            </label>
            <input
              type="email"
              [(ngModel)]="formEmail"
              placeholder="admin@example.com"
              class="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="text-xs text-sub">
              Used for Let's Encrypt registration and expiry notifications.
            </p>
          </div>

          @if (formError()) {
            <div class="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400">
              <ng-icon name="lucideAlertCircle" class="h-3.5 w-3.5 flex-shrink-0" />
              {{ formError() }}
            </div>
          }

          <div class="flex items-center gap-2">
            <button
              (click)="submitForm()"
              [disabled]="saving() || !formEmail.trim()"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              @if (saving()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                Applying...
              } @else {
                <ng-icon name="lucideCheckCircle" class="h-3.5 w-3.5" />
                Configure Wildcard Issuers
              }
            </button>
            <button
              (click)="closeForm()"
              [disabled]="saving()"
              class="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      }
    </div>
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
  /** Emitted when issuer ready-state changes */
  issuersReadyChange = output<boolean>();

  protected issuers = signal<Issuer[]>([]);
  protected loading = signal(false);
  protected configuring = signal(false);
  protected showForm = signal(false);
  protected saving = signal(false);
  protected deleting = signal(false);
  protected deleteConfirm = signal(false);
  protected formEmail = '';
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
    return name.includes('wildcard')
      || issuer.solverType === SolverType.Dns01
      || issuer.solverType === SolverType.Combined;
  }

  protected dnsIssuers = computed(() =>
    this.issuers().filter(i => this.isDnsIssuer(i))
  );

  protected readonly placeholderNames = ['letsencrypt-staging-wildcard', 'letsencrypt-production-wildcard'];

  protected allDns01Ready = computed(() =>
    this.dnsIssuers().length > 0
      && this.dnsIssuers().every(i => i.ready && (i.solverType === SolverType.Dns01 || i.solverType === SolverType.Combined))
  );

  protected hasHttp01 = computed(() =>
    this.issuers().some(i => !this.isDnsIssuer(i) && i.solverType === SolverType.Http01)
  );

  protected displayIssuers(): Issuer[] {
    if (this.dnsIssuers().length > 0) return this.dnsIssuers();
    if (this.configuring()) return this.placeholderNames.map(name => ({ name, ready: false }));
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
      this.issuersReadyChange.emit(loaded.some(i => i.ready && i.solverType === SolverType.Dns01));
  
      // Pre-fill email
      const existingEmail = loaded.find(i => this.isDnsIssuer(i) && i.email)?.email;
      this.formEmail = existingEmail ?? '';
  
      // Open form when: explicitly requested (new assignment), no issuers yet, or issuers are http01
      const needsConfigure = !loaded.some(i => this.isDnsIssuer(i)) || loaded.some(i => !this.isDnsIssuer(i) && i.solverType === SolverType.Http01);
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
    const existing = this.dnsIssuers().find(i => i.email);
    this.formEmail = existing?.email ?? '';
    this.formError.set(null);
    this.deleteError.set(null);
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
    this.formError.set(null);
  }

  protected async submitForm(): Promise<void> {
    const email = this.formEmail.trim();
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
          this.issuersReadyChange.emit(e.issuers.some(i => i.ready && i.solverType === SolverType.Dns01));
        }
      },
      onConfigured: (e: IssuerConfiguredEvent) => {
        this.issuers.set(e.issuers);
        this.configuring.set(false);
        this.issuersReadyChange.emit(e.issuers.some(i => i.ready && i.solverType === SolverType.Dns01));
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
    this.issuersReadyChange.emit(loaded.some(i => i.ready && i.solverType === SolverType.Dns01));
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

  protected cardClass(issuer: Issuer): string {
    if (this.configuring()) return 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800';
    if (!issuer.ready) return 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800';
    if (issuer.solverType === SolverType.Http01) return 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800';
    return 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800';
  }

  protected badgeClass(issuer: Issuer): string {
    if (this.configuring()) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (!issuer.ready) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    if (issuer.solverType === SolverType.Http01) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  }
}
