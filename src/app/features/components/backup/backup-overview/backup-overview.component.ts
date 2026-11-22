import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlMetric, FlMetricStrip } from '../../../../ui/patterns/metric-strip';
import { FlPageHeader } from '../../../../ui/patterns/page-header';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlEmptyState } from '../../../../ui/patterns/states';
import { FlTable } from '../../../../ui/patterns/table';
import { FlButton } from '../../../../ui/primitives/button';
import { SandboxService } from '../../../../core/services/sandbox.service';
import { BackupService } from '../../../service/backup.service';
import { ClusterService } from '../../../service/cluster.service';
import { formatBytes } from '../../../model/backup.models';
import { ClusterProtection } from '../../../model/backup-protection.models';
import { EnableBackupsModalComponent } from '../enable-backups/enable-backups-modal.component';
import { PlatformBackupCardComponent } from '../platform/platform-backup-card.component';
import { ClusterProtectionCardComponent } from '../cluster-protection/cluster-protection-card.component';
import { NeedsDecisionListComponent } from '../cluster-protection/needs-decision-list.component';
import { BackupHealthBadgeComponent } from '../shared/health-badge.component';
import { healthNeedsAttention } from '../../../model/backup-activity';
import { ReadOnlySectionDirective } from '../../../../shared/directives/read-only-section.directive';
import { CurrentSurfaceService } from '../../../../core/services/current-surface.service';
import {
  BackupOverviewSurfaceInput,
  BackupOverviewSurfaceRevision,
  buildBackupOverviewSurface,
  presentedContent,
} from './backup-overview-surface';
import { BackupOverviewGuide } from './backup-overview-guide';

@Component({
  selector: 'app-backup-overview',
  imports: [
    ReadOnlySectionDirective,
    FormsModule,
    RouterLink,
    FlPageHeader,
    FlAlert,
    FlMetricStrip,
    FlMetric,
    FlPanel,
    FlEmptyState,
    FlTable,
    FlButton,
    EnableBackupsModalComponent,
    PlatformBackupCardComponent,
    ClusterProtectionCardComponent,
    NeedsDecisionListComponent,
    BackupHealthBadgeComponent,
    BackupOverviewGuide,
  ],
  templateUrl: './backup-overview.component.html',
})
export class BackupOverviewComponent implements OnInit, OnDestroy {
  private readonly backup = inject(BackupService);
  private readonly sandbox = inject(SandboxService);
  /** A demo guest reads this section from the example world: no real cluster and no platform recovery belong in it. */
  protected readonly example = computed(() => this.sandbox.levelOf('backups') === 'stand-in');
  private readonly clusterService = inject(ClusterService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly showEnableModal = signal(false);
  protected readonly cardsRevision = signal(0);
  protected readonly selectedClusterId = signal('');
  private readonly cards = viewChildren(ClusterProtectionCardComponent);
  private readonly protections = signal<Readonly<Record<string, ClusterProtection>>>({});

  readonly clusters = this.clusterService.clusters;
  readonly destinationsCount = computed(() => this.backup.destinations().length);
  readonly policiesCount = computed(() => this.backup.policies().length);
  readonly degradedCount = computed(() => this.backup.degradedPolicies().length);
  readonly restoreCount = computed(() => this.backup.restoreJobs().length);
  readonly totalUsage = computed(() => formatBytes(this.backup.totalUsageBytes()));
  readonly error = this.backup.error;
  readonly attention = computed(() =>
    this.backup.activity().filter((a) => healthNeedsAttention(a.health.state)),
  );

  readonly failedJobs = computed(
    () => this.backup.activity().filter((a) => a.health.state === 'failed').length,
  );

  private readonly knownProtections = computed(() => {
    const byId = this.protections();
    return this.clusters()
      .map((c) => (c.id ? byId[c.id] : undefined))
      .filter((p): p is ClusterProtection => !!p);
  });

  readonly protectedClusters = computed(() => {
    const known = this.knownProtections();
    return known.length ? known.filter((p) => p.protected).length : null;
  });

  readonly decisionItems = computed(() => this.knownProtections().flatMap((p) => p.needsDecision));

  readonly decisionApps = computed(() => {
    if (!this.knownProtections().length) return null;
    return new Set(this.decisionItems().map((i) => i.applicationId)).size;
  });

  readonly fallbackDestinationId = computed(() => this.backup.destinations()[0]?.id ?? null);

  readonly clusterDestinations = computed(() =>
    Object.fromEntries(
      this.knownProtections().map((p) => [
        p.clusterId,
        p.destinationId ?? this.fallbackDestinationId(),
      ]),
    ),
  );

  readonly clusterNames = computed(() =>
    Object.fromEntries(this.clusters().map((c) => [c.id ?? '', c.name ?? c.id ?? ''])),
  );

  private readonly surfaceRevision = new BackupOverviewSurfaceRevision();

  readonly surface = computed(() => {
    const input: BackupOverviewSurfaceInput = {
      destinationsCount: this.destinationsCount(),
      policiesCount: this.policiesCount(),
      degradedPoliciesCount: this.degradedCount(),
      attentionPolicies: this.attention().map((a) => ({
        id: a.policyId,
        name: a.policyName,
        state: a.health.state,
      })),
      restoreJobsCount: this.restoreCount(),
      totalUsageText: this.totalUsage(),
      clustersAvailable: this.clusters().length,
      hasLoadError: !!this.error(),
    };
    return buildBackupOverviewSurface(input, {
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

  openEnableModal(): void {
    if (!this.selectedClusterId()) return;
    this.showEnableModal.set(true);
  }

  onProtectionLoaded(protection: ClusterProtection): void {
    this.protections.update((all) => ({ ...all, [protection.clusterId]: protection }));
  }

  onDecided(): void {
    for (const card of this.cards()) void card.reload();
  }

  onProtectionChanged(): void {
    void this.backup.loadPolicies();
    void this.backup.loadActivity();
  }

  onEnableModalClosed(result: { activated: boolean }): void {
    this.showEnableModal.set(false);
    if (result.activated) {
      this.cardsRevision.update((n) => n + 1);
      void this.backup.loadPolicies();
      void this.backup.loadActivity();
      void this.backup.loadStatus();
    }
  }

  ngOnInit(): void {
    void (async () => {
      await Promise.all([
        this.backup.loadDestinations(),
        this.backup.loadPolicies(),
        this.backup.loadRestoreJobs(),
        this.backup.loadActivity(),
        this.clusterService.loadClusters(),
      ]);
    })();
  }
}
