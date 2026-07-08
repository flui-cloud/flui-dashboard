import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBan,
  lucideChevronDown,
  lucideChevronRight,
  lucideCircleCheck,
  lucideExternalLink,
  lucideInfo,
  lucideLoader,
  lucidePlay,
  lucidePlus,
  lucidePower,
  lucideRadioTower,
  lucideSearchCheck,
  lucideServer,
  lucideTrash2,
  lucideTriangleAlert,
  lucideX,
} from '@ng-icons/lucide';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { ToastService } from '../../../shared/services/toast.service';
import {
  DnsReplica,
  DnsReplicaService,
  DnsZone,
  ReplicaDiffReport,
  ReplicaProvider,
  ReplicaStatus,
} from '../../service/dns-replica.service';
import { DnsZonesService } from '../../service/dns-zones.service';

const ALL_PROVIDERS: ReplicaProvider[] = ['hetzner', 'scaleway'];

const STATUS_BADGE: Record<ReplicaStatus, string> = {
  active:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400',
  degraded:
    'border-destructive/30 bg-destructive/10 text-destructive',
  pending:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  populating:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  disabled: 'border-border bg-muted text-muted-foreground',
};

const PROVIDER_LABEL: Record<ReplicaProvider, string> = {
  hetzner: 'Hetzner',
  scaleway: 'Scaleway',
};

/**
 * Dual-provider redundancy panel for a single logical DNS zone. Lists the
 * secondary-provider replicas, gates the lifecycle drivers (populate / verify /
 * disable / enable / remove) by status, and surfaces the reconciliation diff
 * report inline.
 */
@Component({
  selector: 'app-zone-replicas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, ConfirmationDialogComponent],
  providers: [
    provideIcons({
      lucideBan,
      lucideChevronDown,
      lucideChevronRight,
      lucideCircleCheck,
      lucideExternalLink,
      lucideInfo,
      lucideLoader,
      lucidePlay,
      lucidePlus,
      lucidePower,
      lucideRadioTower,
      lucideSearchCheck,
      lucideServer,
      lucideTrash2,
      lucideTriangleAlert,
      lucideX,
    }),
  ],
  template: `
    <div class="space-y-3 rounded-lg border border-border bg-card p-4">
      <div class="flex items-start justify-between gap-2">
        <div>
          <h3 class="flex items-center gap-1.5 text-sm font-semibold">
            <ng-icon name="lucideRadioTower" class="h-4 w-4 text-muted-foreground" />
            Provider redundancy
          </h3>
          <p class="mt-0.5 text-xs text-muted-foreground">
            Publish
            <span class="font-mono">{{ zone().zoneName }}</span>
            on a second, independent DNS provider. Primary:
            <span class="font-medium text-foreground">{{ primaryLabel() }}</span>
          </p>
        </div>
        @if (canAddMore()) {
          <button
            type="button"
            (click)="toggleAdd()"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <ng-icon [name]="adding() ? 'lucideX' : 'lucidePlus'" class="h-3.5 w-3.5" />
            {{ adding() ? 'Cancel' : 'Add replica' }}
          </button>
        }
      </div>

      <!-- Add replica form -->
      @if (adding()) {
        <div class="space-y-2 rounded-md border border-dashed border-border bg-muted/30 p-3">
          <div class="flex flex-wrap items-end gap-2">
            <label class="flex flex-col gap-1 text-xs">
              <span class="font-medium text-muted-foreground">Provider</span>
              <select
                [value]="newProvider()"
                (change)="onProviderChange($event)"
                class="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="" disabled>Select provider…</option>
                @for (p of availableProviders(); track p) {
                  <option [value]="p">{{ providerLabel(p) }}</option>
                }
              </select>
            </label>
            <label class="flex flex-1 flex-col gap-1 text-xs">
              <span class="font-medium text-muted-foreground">Provider zone ID (optional)</span>
              <input
                type="text"
                [value]="newProviderZoneId()"
                (input)="onZoneIdChange($event)"
                placeholder="auto-discover if left blank"
                class="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="button"
              (click)="register()"
              [disabled]="!newProvider() || submitting()"
              class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              @if (submitting()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
              } @else {
                <ng-icon name="lucidePlus" class="h-3.5 w-3.5" />
              }
              Register
            </button>
          </div>

          <div class="space-y-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-900/20">
            <p class="text-xs font-medium text-amber-800 dark:text-amber-300">Don't see your domain?</p>
            <p class="text-xs text-amber-700 dark:text-amber-400">
              The zone is discovered directly in your
              <span class="font-semibold">{{ secondaryLabel() }}</span> account —
              <span class="font-mono">{{ zone().zoneName }}</span> must already exist there.
              Once registered, update the domain's NS records at your registrar to include
              <span class="font-semibold">{{ secondaryLabel() }}</span>'s nameservers.
            </p>
            @if (secondaryDelegation(); as delegation) {
              <div class="border-t border-amber-200 pt-1 dark:border-amber-700">
                <a
                  [href]="delegation.delegationGuideUrl"
                  target="_blank"
                  class="inline-flex items-center gap-1 text-xs text-amber-700 underline hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
                >
                  View official delegation guide
                  <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                </a>
              </div>
            }
          </div>
        </div>
      }

      <!-- Registrar hint -->
      @if (hint()) {
        <div class="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          <ng-icon name="lucideInfo" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{{ hint() }}</span>
        </div>
      }

      <!-- Replica rows -->
      @if (replicas().length === 0) {
        <p class="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          No redundancy configured — this zone is published on {{ primaryLabel() }} only.
        </p>
      } @else {
        <ul class="space-y-2">
          @for (r of replicas(); track r.id) {
            <li class="rounded-md border border-border bg-background p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-flex items-center gap-1 text-sm font-medium">
                    <ng-icon name="lucideServer" class="h-3.5 w-3.5 text-muted-foreground" />
                    {{ providerLabel(r.dnsProvider) }}
                  </span>
                  <span
                    class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize"
                    [class]="statusClass(r.status)"
                  >
                    {{ r.status }}
                  </span>
                  @if (r.providerZoneId) {
                    <span class="font-mono text-xs text-muted-foreground">{{ r.providerZoneId }}</span>
                  }
                </div>

                <div class="flex items-center gap-1.5">
                  @if (canPopulate(r)) {
                    <button
                      type="button"
                      (click)="populate(r)"
                      [disabled]="busyId() === r.id"
                      class="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <ng-icon [name]="busyId() === r.id ? 'lucideLoader' : 'lucidePlay'" class="h-3.5 w-3.5" [class.animate-spin]="busyId() === r.id" />
                      Populate
                    </button>
                  }
                  @if (canVerify(r)) {
                    <button
                      type="button"
                      (click)="verify(r)"
                      [disabled]="busyId() === r.id"
                      class="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      <ng-icon name="lucideSearchCheck" class="h-3.5 w-3.5" />
                      Verify
                    </button>
                  }
                  @if (canDisable(r)) {
                    <button
                      type="button"
                      (click)="disable(r)"
                      [disabled]="busyId() === r.id"
                      class="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                    >
                      <ng-icon name="lucideBan" class="h-3.5 w-3.5" />
                      Disable
                    </button>
                  }
                  @if (canEnable(r)) {
                    <button
                      type="button"
                      (click)="enable(r)"
                      [disabled]="busyId() === r.id"
                      class="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      <ng-icon name="lucidePower" class="h-3.5 w-3.5" />
                      Enable
                    </button>
                  }
                  <button
                    type="button"
                    (click)="requestRemove(r)"
                    [disabled]="busyId() === r.id"
                    class="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-muted disabled:opacity-50"
                  >
                    <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>

              <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Last reconciled: {{ formatDate(r.lastReconciledAt) }}</span>
                @if (reports()[r.id]; as report) {
                  <button
                    type="button"
                    (click)="toggleReport(r.id)"
                    class="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                  >
                    <ng-icon [name]="expandedReport() === r.id ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-3 w-3" />
                    {{ reportSummary(report) }}
                  </button>
                }
              </div>

              @if (r.errorMessage) {
                <p class="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                  <ng-icon name="lucideTriangleAlert" class="h-3 w-3" />
                  {{ r.errorMessage }}
                </p>
              }

              @if (expandedReport() === r.id && reports()[r.id]; as report) {
                <div class="mt-2 space-y-1 rounded-md border border-border bg-muted/40 p-2 text-xs">
                  <div class="flex flex-wrap gap-x-4 gap-y-0.5">
                    <span><span class="font-medium text-foreground">{{ report.created }}</span> created</span>
                    <span><span class="font-medium text-foreground">{{ report.updated }}</span> updated</span>
                    <span><span class="font-medium text-foreground">{{ report.orphansDeleted }}</span> removed</span>
                    <span><span class="font-medium text-foreground">{{ report.mismatches.length }}</span> mismatches</span>
                  </div>
                  @for (m of report.mismatches; track m.name + m.type) {
                    <p class="font-mono text-muted-foreground">
                      {{ m.type }} {{ m.name }}: expected {{ m.expected }}, got {{ m.actual }}
                    </p>
                  }
                  @for (err of report.errors; track err) {
                    <p class="flex items-center gap-1 text-destructive">
                      <ng-icon name="lucideTriangleAlert" class="h-3 w-3" /> {{ err }}
                    </p>
                  }
                  @if (report.errors.length === 0 && report.mismatches.length === 0) {
                    <p class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <ng-icon name="lucideCircleCheck" class="h-3 w-3" /> In sync — no drift.
                    </p>
                  }
                </div>
              }
            </li>
          }
        </ul>
      }
    </div>

    <app-confirmation-dialog
      variant="danger"
      title="Remove replica"
      message="Remove this redundancy replica from Flui? The provider's DNS records are left in place and must be cleaned up manually if no longer wanted."
      confirmText="Remove"
      (confirmed)="onRemoveConfirmed()"
      (cancelled)="pendingRemove.set(null)"
    />
  `,
})
export class ZoneReplicasComponent {
  private readonly service = inject(DnsReplicaService);
  private readonly dnsZonesService = inject(DnsZonesService);
  private readonly toast = inject(ToastService);

  readonly zone = input.required<DnsZone>();
  readonly changed = output<void>();

  private readonly confirmDialog = viewChild(ConfirmationDialogComponent);

  readonly replicas = linkedSignal<DnsReplica[]>(() => this.zone().replicas ?? []);
  readonly busyId = signal<string | null>(null);
  readonly adding = signal(false);
  readonly submitting = signal(false);
  readonly newProvider = signal<ReplicaProvider | ''>('');
  readonly newProviderZoneId = signal('');
  readonly reports = signal<Record<string, ReplicaDiffReport>>({});
  readonly expandedReport = signal<string | null>(null);
  readonly hint = signal<string | null>(null);
  readonly pendingRemove = signal<DnsReplica | null>(null);

  readonly primaryLabel = computed(() => this.providerLabel(this.zone().dnsProvider));

  readonly availableProviders = computed<ReplicaProvider[]>(() => {
    const primary = this.zone().dnsProvider;
    const used = new Set<string>(this.replicas().map((r) => r.dnsProvider));
    return ALL_PROVIDERS.filter((p) => p !== primary && !used.has(p));
  });

  readonly canAddMore = computed(() => this.availableProviders().length > 0);

  /** Selected secondary provider, falling back to the only available one. */
  private readonly effectiveSecondary = computed<ReplicaProvider | ''>(() => {
    const chosen = this.newProvider();
    if (chosen) return chosen;
    const available = this.availableProviders();
    return available.length === 1 ? available[0] : '';
  });

  readonly secondaryLabel = computed(() => {
    const provider = this.effectiveSecondary();
    return provider ? this.providerLabel(provider) : 'the secondary provider';
  });

  readonly secondaryDelegation = computed(() => {
    const provider = this.effectiveSecondary();
    if (!provider) return undefined;
    return this.dnsZonesService.dnsCapableProviders().find((p) => p.id === provider)
      ?.dnsZoneDelegation;
  });

  providerLabel(provider: string): string {
    return PROVIDER_LABEL[provider as ReplicaProvider] ?? provider;
  }

  statusClass(status: ReplicaStatus): string {
    return STATUS_BADGE[status] ?? STATUS_BADGE.disabled;
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return 'never';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  }

  reportSummary(report: ReplicaDiffReport): string {
    if (report.errors.length > 0) {
      return `${report.errors.length} error(s)`;
    }
    return `${report.created} created · ${report.updated} updated · ${report.orphansDeleted} removed`;
  }

  // ── Status gating ──────────────────────────────────────────────────────────
  canPopulate(r: DnsReplica): boolean {
    return r.status === 'pending' || r.status === 'degraded';
  }

  canVerify(r: DnsReplica): boolean {
    return r.status !== 'disabled';
  }

  canDisable(r: DnsReplica): boolean {
    return r.status !== 'disabled';
  }

  canEnable(r: DnsReplica): boolean {
    return r.status === 'disabled';
  }

  // ── Add replica ────────────────────────────────────────────────────────────
  toggleAdd(): void {
    this.adding.update((v) => !v);
    if (!this.adding()) {
      this.newProvider.set('');
      this.newProviderZoneId.set('');
    } else if (this.dnsZonesService.dnsCapableProviders().length === 0) {
      void this.dnsZonesService.loadDnsCapableProviders();
    }
  }

  onProviderChange(event: Event): void {
    this.newProvider.set((event.target as HTMLSelectElement).value as ReplicaProvider | '');
  }

  onZoneIdChange(event: Event): void {
    this.newProviderZoneId.set((event.target as HTMLInputElement).value);
  }

  async register(): Promise<void> {
    const provider = this.newProvider();
    if (!provider) return;
    this.submitting.set(true);
    try {
      const zoneId = this.newProviderZoneId().trim();
      await this.service.registerReplica(this.zone().id, {
        dnsProvider: provider,
        providerZoneId: zoneId || undefined,
      });
      this.toast.showSuccess(`${this.providerLabel(provider)} replica registered`);
      this.hint.set(
        `Verify + run \`dig @<ns>\` before adding ${this.providerLabel(provider)}'s nameservers at your registrar.`,
      );
      this.adding.set(false);
      this.newProvider.set('');
      this.newProviderZoneId.set('');
      await this.refresh();
    } catch (e) {
      this.toast.showError(this.msg(e));
    } finally {
      this.submitting.set(false);
    }
  }

  // ── Lifecycle actions ──────────────────────────────────────────────────────
  async populate(r: DnsReplica): Promise<void> {
    await this.runReport(r, () => this.service.populateReplica(this.zone().id, r.id), 'Populated');
  }

  async verify(r: DnsReplica): Promise<void> {
    await this.runReport(r, () => this.service.verifyReplica(this.zone().id, r.id), 'Verified');
    this.hint.set(
      `Verify + run \`dig @<ns>\` before adding ${this.providerLabel(r.dnsProvider)}'s nameservers at your registrar.`,
    );
  }

  async disable(r: DnsReplica): Promise<void> {
    await this.runSimple(r, () => this.service.disableReplica(this.zone().id, r.id), 'Replica disabled');
  }

  async enable(r: DnsReplica): Promise<void> {
    await this.runSimple(r, () => this.service.enableReplica(this.zone().id, r.id), 'Replica enabled');
  }

  requestRemove(r: DnsReplica): void {
    this.pendingRemove.set(r);
    this.confirmDialog()?.open();
  }

  async onRemoveConfirmed(): Promise<void> {
    const r = this.pendingRemove();
    if (!r) return;
    const dialog = this.confirmDialog();
    dialog?.setProcessing(true);
    this.busyId.set(r.id);
    try {
      await this.service.removeReplica(this.zone().id, r.id);
      this.toast.showSuccess('Replica removed');
      await this.refresh();
    } catch (e) {
      this.toast.showError(this.msg(e));
    } finally {
      this.busyId.set(null);
      dialog?.setProcessing(false);
      dialog?.close();
      this.pendingRemove.set(null);
    }
  }

  toggleReport(id: string): void {
    this.expandedReport.update((cur) => (cur === id ? null : id));
  }

  // ── Internals ──────────────────────────────────────────────────────────────
  private async runReport(
    r: DnsReplica,
    call: () => Promise<ReplicaDiffReport>,
    verb: string,
  ): Promise<void> {
    this.busyId.set(r.id);
    try {
      const report = await call();
      this.reports.update((cur) => ({ ...cur, [r.id]: report }));
      this.expandedReport.set(r.id);
      if (report.errors.length > 0) {
        this.toast.showWarning(`${verb} with ${report.errors.length} error(s)`);
      } else {
        this.toast.showSuccess(`${verb}: ${this.reportSummary(report)}`);
      }
      await this.refresh();
    } catch (e) {
      this.toast.showError(this.msg(e));
    } finally {
      this.busyId.set(null);
    }
  }

  private async runSimple(
    r: DnsReplica,
    call: () => Promise<DnsReplica>,
    successMsg: string,
  ): Promise<void> {
    this.busyId.set(r.id);
    try {
      await call();
      this.toast.showSuccess(successMsg);
      await this.refresh();
    } catch (e) {
      this.toast.showError(this.msg(e));
    } finally {
      this.busyId.set(null);
    }
  }

  private async refresh(): Promise<void> {
    try {
      this.replicas.set(await this.service.listReplicas(this.zone().id));
    } catch (e) {
      this.toast.showError(this.msg(e));
    } finally {
      this.changed.emit();
    }
  }

  private msg(e: unknown): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message ?? err?.message ?? 'Request failed';
  }
}
