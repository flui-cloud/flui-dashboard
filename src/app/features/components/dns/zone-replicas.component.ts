import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideExternalLink,
  lucidePlus,
  lucideRadioTower,
} from '@ng-icons/lucide';
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
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { ZoneReplicaReport } from './zone-replica-report';

const ALL_PROVIDERS: ReplicaProvider[] = ['hetzner', 'scaleway'];

const STATUS: Record<ReplicaStatus, { tone: StatusTone; label: string }> = {
  active: { tone: 'success', label: 'Active' },
  degraded: { tone: 'error', label: 'Degraded' },
  pending: { tone: 'warning', label: 'Pending' },
  populating: { tone: 'progress', label: 'Populating' },
  disabled: { tone: 'neutral', label: 'Disabled' },
};

const PROVIDER_LABEL: Record<ReplicaProvider, string> = {
  hetzner: 'Hetzner',
  scaleway: 'Scaleway',
};

let nextId = 0;

/**
 * Dual-provider redundancy panel for a single logical DNS zone. Lists the
 * secondary-provider replicas, gates the lifecycle drivers (populate / verify /
 * disable / enable / remove) by status, and surfaces the reconciliation diff
 * report inline.
 */
@Component({
  selector: 'app-zone-replicas',
  imports: [
    FlPanel,
    FlAlert,
    FlField,
    FlTable,
    FlEmptyState,
    FlActionsMenu,
    FlStatus,
    FlButton,
    FlIcon,
    FlSpinner,
    ZoneReplicaReport,
  ],
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideExternalLink,
      lucidePlus,
      lucideRadioTower,
    }),
  ],
  host: { class: 'fl-stack py-2' },
  templateUrl: './zone-replicas.component.html',
})
export class ZoneReplicasComponent {
  private readonly service = inject(DnsReplicaService);
  private readonly dnsZonesService = inject(DnsZonesService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly zone = input.required<DnsZone>();
  readonly changed = output<void>();

  protected readonly id = `zone-replicas-${nextId++}`;

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

  protected readonly actionsOf = computed<Record<string, MenuAction[]>>(() => {
    const busy = this.busyId();
    return Object.fromEntries(
      this.replicas().map((r) => {
        const disabled = busy === r.id;
        const items: MenuAction[] = [];
        if (this.canVerify(r)) items.push({ id: 'verify', label: 'Verify', disabled });
        if (this.canDisable(r)) items.push({ id: 'disable', label: 'Disable', disabled });
        if (this.canEnable(r)) items.push({ id: 'enable', label: 'Enable', disabled });
        items.push({
          id: 'remove',
          label: 'Remove replica',
          danger: true,
          disabled,
          separatorBefore: items.length > 0,
        });
        return [r.id, items];
      }),
    );
  });

  providerLabel(provider: string): string {
    return PROVIDER_LABEL[provider as ReplicaProvider] ?? provider;
  }

  statusOf(status: ReplicaStatus): { tone: StatusTone; label: string } {
    return STATUS[status] ?? STATUS.disabled;
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB');
  }

  reportSummary(report: ReplicaDiffReport): string {
    if (report.errors.length > 0) {
      return `${report.errors.length} error(s)`;
    }
    return `${report.created} created · ${report.updated} updated · ${report.orphansDeleted} removed`;
  }

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

  onAction(r: DnsReplica, action: string): void {
    if (action === 'verify') void this.verify(r);
    else if (action === 'disable') void this.disable(r);
    else if (action === 'enable') void this.enable(r);
    else if (action === 'remove') void this.requestRemove(r);
  }

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
      this.hint.set(this.delegationHint(provider));
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

  async populate(r: DnsReplica): Promise<void> {
    await this.runReport(r, () => this.service.populateReplica(this.zone().id, r.id), 'Populated');
  }

  async verify(r: DnsReplica): Promise<void> {
    await this.runReport(r, () => this.service.verifyReplica(this.zone().id, r.id), 'Verified');
    this.hint.set(this.delegationHint(r.dnsProvider));
  }

  async disable(r: DnsReplica): Promise<void> {
    await this.runSimple(
      r,
      () => this.service.disableReplica(this.zone().id, r.id),
      'Replica disabled',
    );
  }

  async enable(r: DnsReplica): Promise<void> {
    await this.runSimple(
      r,
      () => this.service.enableReplica(this.zone().id, r.id),
      'Replica enabled',
    );
  }

  async requestRemove(r: DnsReplica): Promise<void> {
    this.pendingRemove.set(r);
    const confirmed = await this.confirmService.confirm({
      title: 'Remove replica',
      body: "Remove this redundancy replica from Flui? The provider's DNS records are left in place and must be cleaned up manually if no longer wanted.",
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (confirmed) {
      await this.onRemoveConfirmed();
    } else {
      this.pendingRemove.set(null);
    }
  }

  async onRemoveConfirmed(): Promise<void> {
    const r = this.pendingRemove();
    if (!r) return;
    this.busyId.set(r.id);
    try {
      await this.service.removeReplica(this.zone().id, r.id);
      this.toast.showSuccess('Replica removed');
      await this.refresh();
    } catch (e) {
      this.toast.showError(this.msg(e));
    } finally {
      this.busyId.set(null);
      this.pendingRemove.set(null);
    }
  }

  toggleReport(id: string): void {
    this.expandedReport.update((cur) => (cur === id ? null : id));
  }

  private delegationHint(provider: string): string {
    return `Verify the replica and run dig @<ns> before adding the ${this.providerLabel(provider)} nameservers at your registrar.`;
  }

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
