import { Component, OnInit, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideSearch, lucideShield } from '@ng-icons/lucide';
import { FirewallV2Service } from '../../service/firewall-v2.service';
import {
  ReconciliationStatus,
  CoverageStatus,
  FirewallExtended,
  getCoverageStatusLabel,
} from '../../model/firewall-v2.models';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  FirewallClusterManagementSurfaceInput,
  FirewallClusterManagementSurfaceRevision,
  buildFirewallClusterManagementSurface,
  presentedContent,
} from './firewall-cluster-management-surface';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlMetric, FlMetricStrip, MetricTone } from '../../../ui/patterns/metric-strip';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { ToneLabel, driftState, reconciliationState } from '../cluster/cluster-firewall-format';
import { clusterState, coverageState } from './firewall-format';

export interface FirewallMetric {
  readonly label: string;
  readonly value: number;
  readonly caption?: string;
  readonly tone: MetricTone;
}

const RECONCILE_ACTIONS: MenuAction[] = [{ id: 'reconcile', label: 'Reconcile' }];
const RECONCILING_ACTIONS: MenuAction[] = [
  { id: 'reconcile', label: 'Reconciling…', disabled: true },
];

@Component({
  selector: 'app-firewall-cluster-management',
  imports: [
    MaskIdPipe,
    ReadOnlySectionDirective,
    FormsModule,
    RouterLink,
    FlPageHeader,
    FlPanel,
    FlTable,
    FlAlert,
    FlMetricStrip,
    FlMetric,
    FlEmptyState,
    FlLoadingState,
    FlStatus,
    FlButton,
    FlIcon,
    FlActionsMenu,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideSearch, lucideShield })],
  host: { class: 'block' },
  templateUrl: './firewall-cluster-management.component.html',
})
export class FirewallClusterManagementComponent implements OnInit, OnDestroy {
  private readonly firewallService = inject(FirewallV2Service);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new FirewallClusterManagementSurfaceRevision();

  searchQuery = signal('');
  selectedStatus = signal<ReconciliationStatus | undefined>(undefined);
  selectedCoverage = signal<CoverageStatus | undefined>(undefined);
  reconciling = signal<Set<string>>(new Set());

  firewalls = this.firewallService.extendedFirewalls;
  stats = this.firewallService.stats;
  loading = this.firewallService.loading;
  error = this.firewallService.error;
  readonly total = computed(() => this.firewallService.firewalls().length);

  protected readonly reconcileActions = RECONCILE_ACTIONS;
  protected readonly reconcilingActions = RECONCILING_ACTIONS;

  readonly metrics = computed<FirewallMetric[]>(() => {
    const s = this.stats();
    const caption = (entries: [number, string][]): string | undefined =>
      entries
        .filter(([count]) => count > 0)
        .map(([count, text]) => `${count} ${text}`)
        .join(', ') || undefined;
    const outOfSync = s.drift + s.error;
    const gaps = s.partial + s.orphaned;
    return [
      { label: 'Firewalls', value: s.total, tone: 'default' },
      { label: 'In sync', value: s.inSync, tone: 'default' },
      {
        label: 'In progress',
        value: s.pending + s.reconciling,
        caption: caption([
          [s.pending, 'pending'],
          [s.reconciling, 'reconciling'],
        ]),
        tone: 'default',
      },
      {
        label: 'Out of sync',
        value: outOfSync,
        caption: caption([
          [s.drift, 'drift'],
          [s.error, 'failed'],
        ]),
        tone: outOfSync > 0 ? 'warning' : 'default',
      },
      {
        label: 'Coverage gaps',
        value: gaps,
        caption: caption([
          [s.partial, 'partial'],
          [s.orphaned, 'orphaned'],
        ]),
        tone: gaps > 0 ? 'warning' : 'default',
      },
    ];
  });

  readonly surface = computed(() => {
    const input: FirewallClusterManagementSurfaceInput = {
      firewalls: this.firewalls(),
      totalCount: this.firewallService.firewalls().length,
      isLoading: this.loading(),
      searchQuery: this.searchQuery(),
      statusFilter: this.selectedStatus(),
      coverageFilter: this.selectedCoverage(),
    };
    const content = presentedContent(input);
    return buildFirewallClusterManagementSurface(input, {
      revision: this.surfaceRevision.next(content),
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

  statusOptions = [
    { value: undefined, label: 'Status: All' },
    { value: ReconciliationStatus.IN_SYNC, label: 'In sync' },
    { value: ReconciliationStatus.DRIFT, label: 'Drift detected' },
    { value: ReconciliationStatus.PENDING, label: 'Pending' },
    { value: ReconciliationStatus.ERROR, label: 'Failed' },
    { value: ReconciliationStatus.RECONCILING, label: 'Reconciling' },
  ];

  coverageOptions: { value: CoverageStatus | undefined; label: string }[] = [
    { value: undefined, label: 'Coverage: All' },
    { value: 'FULL', label: 'All nodes ready' },
    { value: 'PARTIAL', label: 'Partial coverage' },
    { value: 'ORPHANED', label: 'Orphaned' },
    { value: 'UNKNOWN', label: 'Unknown' },
  ];

  ngOnInit(): void {
    void (async () => {
      await this.loadFirewalls();
    })();
  }

  async loadFirewalls() {
    await this.firewallService.loadFirewalls();
  }

  async onSearchChange(search: string) {
    this.searchQuery.set(search);
    this.firewallService.updateFilter({ search });
  }

  async onStatusFilterChange(status: ReconciliationStatus | undefined) {
    this.selectedStatus.set(status);
    this.firewallService.updateFilter({ status });
  }

  onCoverageFilterChange(coverage: CoverageStatus | undefined) {
    this.selectedCoverage.set(coverage);
    this.firewallService.updateFilter({ coverage });
  }

  canReconcile(firewall: FirewallExtended): boolean {
    return firewall.hasDrift || firewall.reconciliationStatus === 'ERROR';
  }

  onRowAction(firewall: FirewallExtended, action: string) {
    if (action === 'reconcile') void this.reconcileFirewall(firewall.id);
  }

  async reconcileFirewall(firewallId: string) {
    this.reconciling.update((set) => {
      set.add(firewallId);
      return new Set(set);
    });

    try {
      await this.firewallService.reconcile(firewallId);
    } finally {
      this.reconciling.update((set) => {
        set.delete(firewallId);
        return new Set(set);
      });
    }
  }

  isReconciling(firewallId: string): boolean {
    return this.reconciling().has(firewallId);
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-GB');
  }

  async refresh() {
    await this.loadFirewalls();
  }

  getCoverageLabel(status: CoverageStatus): string {
    return getCoverageStatusLabel(status);
  }

  statusOf(firewall: FirewallExtended): ToneLabel {
    if (this.isReconciling(firewall.id)) return { tone: 'progress', label: 'Reconciling' };
    return reconciliationState(firewall.reconciliationStatus);
  }

  driftMessage(hasDrift: boolean, status: ReconciliationStatus | string): string {
    return driftState(hasDrift, status).label;
  }

  coverageOf(status: CoverageStatus): ToneLabel {
    return coverageState(status);
  }

  coverageNote(firewall: FirewallExtended): string | null {
    if (firewall.coverageStatus === 'ORPHANED') {
      return 'This firewall no longer protects any active cluster node. Consider deleting it.';
    }
    if (firewall.coverageStatus === 'PARTIAL' && firewall.clusterInfo) {
      const waiting = firewall.clusterInfo.totalNodes - firewall.clusterInfo.readyNodes;
      return `${waiting} ${waiting === 1 ? 'node is' : 'nodes are'} not ready.`;
    }
    return null;
  }

  nodesTitle(firewall: FirewallExtended): string {
    return (firewall.clusterInfo?.nodes ?? [])
      .map((node) => `${node.serverName} (${node.nodeType}): ${node.status}`)
      .join('\n');
  }

  clusterOf(status: string | undefined): ToneLabel {
    return clusterState(status);
  }
}
