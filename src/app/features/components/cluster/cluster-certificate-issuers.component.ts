import { Component, ElementRef, inject, input, signal, computed, effect, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideShieldCheck, lucideShieldAlert, lucideShieldOff,
  lucideLoader, lucideCheckCircle, lucideAlertCircle, lucideSettings2, lucideTrash2
} from '@ng-icons/lucide';
import { ClusterDnsZoneService } from '../../service/cluster-dns-zone.service';
import { ClusterIssuerWebSocketService, IssuerStatusEvent, IssuerConfiguredEvent, IssuerFailedEvent } from '../../service/cluster-issuer-websocket.service';
import { ClusterDnsZoneControllerGetIssuers200ResponseInner } from '../../../core/api/model/clusterDnsZoneControllerGetIssuers200ResponseInner';

type Issuer = ClusterDnsZoneControllerGetIssuers200ResponseInner;
const SolverType = ClusterDnsZoneControllerGetIssuers200ResponseInner.SolverTypeEnum;

@Component({
  selector: 'app-cluster-certificate-issuers',
  standalone: true,
  imports: [NgIconComponent, FormsModule],
  providers: [
    provideIcons({
      lucideShieldCheck, lucideShieldAlert, lucideShieldOff,
      lucideLoader, lucideCheckCircle, lucideAlertCircle, lucideSettings2, lucideTrash2
    }),
  ],
  template: `
    <div id="standard-certificate-issuers" class="space-y-4">
      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Standard Certificate Issuers (HTTP-01)</h3>
        <p class="text-xs text-sub mt-0.5">
          Manage certificates for standard domains.
        </p>
      </div>

      @if (loading() && httpIssuers().length === 0) {
        <div class="flex items-center gap-2 py-3 text-sm text-gray-500 dark:text-gray-400">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Loading standard certificate issuers...
        </div>
      } @else if (httpIssuers().length > 0) {
        <div class="grid gap-2">
          @for (issuer of httpIssuers(); track issuer.name) {
            <div class="rounded-lg border overflow-hidden"
              [class]="issuer.ready
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'"
            >
              <div class="flex items-center justify-between px-3 py-2.5">
                <div class="flex items-center gap-2.5">
                  <ng-icon
                    [name]="configuring() ? 'lucideLoader' : (issuer.ready ? 'lucideShieldCheck' : 'lucideShieldAlert')"
                    class="h-4 w-4 flex-shrink-0"
                    [class]="configuring() ? 'animate-spin text-blue-500' : (issuer.ready ? 'text-green-600 dark:text-green-400' : 'text-amber-500 dark:text-amber-400')"
                  />
                  <div>
                    <p class="text-xs font-medium font-mono text-gray-900 dark:text-white">{{ issuer.name }}</p>
                    @if (issuer.email) {
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ issuer.email }}</p>
                    }
                  </div>
                </div>
                <span class="text-xs font-medium px-2 py-0.5 rounded-full"
                  [class]="configuring()
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : (issuer.ready
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400')"
                >
                  {{ configuring() ? 'Configuring...' : (issuer.ready ? 'Ready' : 'Not Ready') }}
                </span>
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
            Applying manifests to the cluster and waiting for cert-manager...
          </p>
        }

        @if (!configuring()) {
          <div class="flex items-center gap-3">
            <button
              (click)="toggleForm()"
              [disabled]="deleting()"
              class="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
            >
              <ng-icon name="lucideSettings2" class="h-3 w-3" />
              Reconfigure standard issuers
            </button>
            <button
              (click)="deleteConfirm.set(true)"
              [disabled]="deleting()"
              class="text-xs text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
            >
              <ng-icon name="lucideTrash2" class="h-3 w-3" />
              Delete standard issuers
            </button>
          </div>
        }
      } @else {
        @if (configuring()) {
          <div class="grid gap-2">
            @for (name of pendingIssuerNames; track name) {
              <div class="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 overflow-hidden">
                <div class="flex items-center justify-between px-3 py-2.5">
                  <div class="flex items-center gap-2.5">
                    <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin text-blue-500" />
                    <p class="text-xs font-medium font-mono text-gray-900 dark:text-white">{{ name }}</p>
                  </div>
                  <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Configuring...
                  </span>
                </div>
                <div class="h-1 w-full bg-blue-100 dark:bg-blue-900/40 overflow-hidden">
                  <div class="h-1 w-1/3 bg-blue-500 dark:bg-blue-400 rounded-full animate-indeterminate"></div>
                </div>
              </div>
            }
          </div>
          <p class="text-xs text-blue-600 dark:text-blue-400">
            Applying manifests to the cluster and waiting for cert-manager...
          </p>
        } @else {
          <div class="flex items-start gap-3 p-3 card-inner border border-border rounded-lg">
            <ng-icon name="lucideShieldOff" class="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-foreground">No standard certificate issuers configured</p>
              <p class="text-xs text-sub mt-0.5">
                Configure standard issuers to enable certificates for your domains.
              </p>
            </div>
          </div>
          <button
            (click)="toggleForm()"
            class="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            <ng-icon name="lucideSettings2" class="h-3 w-3" />
            Configure standard issuers
          </button>
        }
      }

      @if (deleteConfirm()) {
        <div class="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs">
          <span class="text-red-700 dark:text-red-400 flex-1">Delete standard issuers (staging + production)?</span>
          <button (click)="deleteHttpIssuers()" [disabled]="deleting()" class="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium disabled:opacity-50">
            @if (deleting()) { Deleting... } @else { Delete }
          </button>
          <button (click)="deleteConfirm.set(false)" [disabled]="deleting()" class="px-2 py-1 text-muted-foreground hover:text-foreground text-xs disabled:opacity-50">
            Cancel
          </button>
        </div>
      }

      @if (deleteError()) {
        <div class="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400">
          <ng-icon name="lucideAlertCircle" class="h-3.5 w-3.5 flex-shrink-0" />
          {{ deleteError() }}
        </div>
      }

      @if (showForm()) {
        <div class="border border-border rounded-lg p-4 space-y-4 card-inner">
          <p class="text-xs font-semibold text-foreground">Configure Standard Issuers</p>

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
                Apply Configuration
              }
            </button>
            <button
              (click)="toggleForm()"
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
  protected formEmail = '';
  protected formError = signal<string | null>(null);
  protected deleteError = signal<string | null>(null);

  protected readonly pendingIssuerNames = ['letsencrypt-staging', 'letsencrypt-production'];

  private isHttpIssuer(issuer: Issuer): boolean {
    const name = issuer.name ?? '';
    if (name.includes('wildcard')) return false;
    if (issuer.solverType === SolverType.Dns01 || issuer.solverType === SolverType.Combined) return false;
    return true;
  }

  protected httpIssuers = computed(() => this.issuers().filter(i => this.isHttpIssuer(i)));
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
    const existing = this.httpIssuers().find(i => i.email);
    this.formEmail = existing?.email ?? '';
    this.formError.set(null);
    this.deleteError.set(null);
    this.showForm.set(true);
    this.el.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected toggleForm(): void {
    const existing = this.httpIssuers().find(i => i.email);
    this.formEmail = existing?.email ?? '';
    this.formError.set(null);
    this.deleteError.set(null);
    this.deleteConfirm.set(false);
    this.showForm.update(v => !v);
  }

  protected async submitForm(): Promise<void> {
    const email = this.formEmail.trim();
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
