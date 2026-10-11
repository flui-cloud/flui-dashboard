import { Component, OnInit, OnDestroy, computed, effect, inject, signal, ChangeDetectionStrategy } from '@angular/core';

import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FirewallV2Service } from '../../service/firewall-v2.service';
import {
  ReconciliationStatus,
  CoverageStatus,
  getCoverageStatusLabel,
  getDriftIndicator,
  getStatusBadgeLabel,
} from '../../model/firewall-v2.models';
import { StatTileComponent, StatTileData, StatTileNote } from '../../../shared/components/charts';
import { FirewallClusterInfoDto, FirewallNodeInfoDto } from '../../../core/api/model/models';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  FirewallClusterManagementSurfaceInput,
  FirewallClusterManagementSurfaceRevision,
  buildFirewallClusterManagementSurface,
  presentedContent,
} from './firewall-cluster-management-surface';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';

/**
 * Main component for listing and managing cluster firewalls
 * Displays all firewalls with filtering, coverage status and quick actions
 */
@Component({
  selector: 'app-firewall-cluster-management',
  standalone: true,
  imports: [MaskIdPipe,
    ReadOnlySectionDirective,
    FormsModule,
    RouterLink,
    StatTileComponent,
],
  templateUrl: './firewall-cluster-management.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./firewall-cluster-management.component.scss']
})
export class FirewallClusterManagementComponent implements OnInit, OnDestroy {
  private readonly firewallService = inject(FirewallV2Service);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new FirewallClusterManagementSurfaceRevision();

  // Local state
  searchQuery = signal('');
  selectedStatus = signal<ReconciliationStatus | undefined>(undefined);
  selectedCoverage = signal<CoverageStatus | undefined>(undefined);
  reconciling = signal<Set<string>>(new Set());

  // Service state
  firewalls = this.firewallService.extendedFirewalls;
  stats = this.firewallService.stats;
  loading = this.firewallService.loading;
  error = this.firewallService.error;

  readonly tiles = computed<StatTileData[]>(() => {
    const s = this.stats();
    const notes = (entries: [number, string, StatTileNote['tone']][]): StatTileNote[] =>
      entries.filter(([count]) => count > 0).map(([count, text, tone]) => ({ text: `${count} ${text}`, tone }));
    return [
      { label: 'Firewalls', value: String(s.total) },
      { label: 'In sync', value: String(s.inSync) },
      {
        label: 'In progress',
        value: String(s.pending + s.reconciling),
        notes: notes([[s.pending, 'pending', 'muted'], [s.reconciling, 'reconciling', 'muted']]),
      },
      {
        label: 'Out of sync',
        value: String(s.drift + s.error),
        notes: notes([[s.drift, 'drift', 'warn'], [s.error, 'error', 'bad']]),
      },
      {
        label: 'Coverage gaps',
        value: String(s.partial + s.orphaned),
        notes: notes([[s.partial, 'partial coverage', 'warn'], [s.orphaned, 'orphaned', 'bad']]),
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
    // Publish this page's own Semantic Surface snapshot whenever it changes;
    // ngOnDestroy clears it so the snapshot never outlives this page.
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  // Status options for filter
  statusOptions = [
    { value: undefined, label: 'All Statuses' },
    { value: ReconciliationStatus.IN_SYNC, label: 'In Sync' },
    { value: ReconciliationStatus.DRIFT, label: 'Drift Detected' },
    { value: ReconciliationStatus.PENDING, label: 'Pending' },
    { value: ReconciliationStatus.ERROR, label: 'Error' },
    { value: ReconciliationStatus.RECONCILING, label: 'Reconciling' }
  ];

  // Coverage options for filter
  coverageOptions: { value: CoverageStatus | undefined; label: string }[] = [
    { value: undefined, label: 'All Coverage' },
    { value: 'FULL', label: 'Full Coverage' },
    { value: 'PARTIAL', label: 'Partial Coverage' },
    { value: 'ORPHANED', label: 'Orphaned' },
    { value: 'UNKNOWN', label: 'Unknown' }
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

  async reconcileFirewall(firewallId: string, event: Event) {
    event.stopPropagation();

    this.reconciling.update(set => {
      set.add(firewallId);
      return new Set(set);
    });

    try {
      await this.firewallService.reconcile(firewallId);
    } finally {
      this.reconciling.update(set => {
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
    return new Date(dateString).toLocaleString();
  }

  async refresh() {
    await this.loadFirewalls();
  }

  // Coverage helpers

  getCoverageLabel(status: CoverageStatus): string {
    return getCoverageStatusLabel(status);
  }

  coverageDotClass(status: CoverageStatus): string | null {
    switch (status) {
      case 'PARTIAL':  return 'bg-amber-500';
      case 'ORPHANED': return 'bg-destructive';
      default:         return null;
    }
  }

  statusLabel(status: ReconciliationStatus | string): string {
    return getStatusBadgeLabel(status as ReconciliationStatus);
  }

  driftMessage(hasDrift: boolean, status: ReconciliationStatus | string): string {
    return getDriftIndicator(hasDrift, status as ReconciliationStatus).replace(/^\S+\s/, '');
  }

  statusDotClass(status: ReconciliationStatus | string): string {
    return STATUS_DOT[statusTone(status)];
  }

  statusTextClass(status: ReconciliationStatus | string): string {
    return STATUS_TEXT[statusTone(status)];
  }

  getNodeDotClass(status: FirewallNodeInfoDto.StatusEnum): string {
    const base = 'inline-block h-2 w-2 rounded-full';
    switch (status) {
      case 'ready':    return `${base} bg-green-500`;
      case 'creating':
      case 'joining':  return `${base} bg-primary`;
      case 'error':    return `${base} bg-destructive`;
      default:         return `${base} bg-muted-foreground/50`;
    }
  }

  getClusterStatusClass(status: FirewallClusterInfoDto.ClusterStatusEnum): string {
    switch (status) {
      case 'ready':    return STATUS_TEXT.ok;
      case 'creating':
      case 'scaling':  return STATUS_TEXT.info;
      case 'error':
      case 'deletion_failed': return STATUS_TEXT.danger;
      case 'stopped':  return STATUS_TEXT.warn;
      default:         return STATUS_TEXT.muted;
    }
  }
}

type Tone = 'ok' | 'info' | 'warn' | 'danger' | 'muted';

const STATUS_DOT: Record<Tone, string> = {
  ok: 'bg-green-500',
  info: 'bg-primary',
  warn: 'bg-amber-500',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground/50',
};

const STATUS_TEXT: Record<Tone, string> = {
  ok: 'text-green-700 dark:text-green-400',
  info: 'text-primary',
  warn: 'text-amber-700 dark:text-amber-400',
  danger: 'text-destructive',
  muted: 'text-muted-foreground',
};

function statusTone(status: ReconciliationStatus | string): Tone {
  switch (status) {
    case ReconciliationStatus.IN_SYNC:     return 'ok';
    case ReconciliationStatus.RECONCILING: return 'info';
    case ReconciliationStatus.DRIFT:       return 'warn';
    case ReconciliationStatus.ERROR:       return 'danger';
    default:                               return 'muted';
  }
}
