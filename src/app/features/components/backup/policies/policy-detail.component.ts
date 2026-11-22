import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { BackupPolicy } from '../../../model/backup.models';
import { BackupPolicyActivity } from '../../../model/backup-run.models';
import { policyEngineLabel } from '../../../model/backup-protection.models';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { BackupRunsTableComponent } from '../shared/runs-table.component';
import { BackupProgressModalComponent } from '../shared/progress-modal.component';
import { ReadOnlySectionDirective } from '../../../../shared/directives/read-only-section.directive';
import { MaskIdPipe } from '../../../../shared/pipes/mask-id.pipe';
import { CurrentSurfaceService } from '../../../../core/services/current-surface.service';
import { Crumb } from '../../../../ui/patterns/breadcrumb';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlCopyId } from '../../../../ui/patterns/copy-id';
import { FlPageHeader } from '../../../../ui/patterns/page-header';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../../ui/patterns/states';
import { ConfirmService } from '../../../../ui/overlays/confirm';
import { FlActionsMenu, MenuAction } from '../../../../ui/overlays/actions-menu';
import { FlButton } from '../../../../ui/primitives/button';
import { PolicyDetailFacts } from './policy-detail-facts';
import { PolicyDetailSchedule } from './policy-detail-schedule';
import {
  PolicyDetailSurfaceInput,
  PolicyDetailSurfaceRevision,
  buildPolicyDetailSurface,
  presentedContent,
} from './policy-detail-surface';

@Component({
  selector: 'app-policy-detail',
  imports: [
    RouterLink,
    ReadOnlySectionDirective,
    MaskIdPipe,
    BackupStatusBadgeComponent,
    BackupRunsTableComponent,
    BackupProgressModalComponent,
    PolicyDetailFacts,
    PolicyDetailSchedule,
    FlAlert,
    FlCopyId,
    FlPageHeader,
    FlPanel,
    FlEmptyState,
    FlLoadingState,
    FlActionsMenu,
    FlButton,
  ],
  template: `
    <div class="fl-page">
      @if (policy(); as p) {
        <fl-page-header [title]="p.name" [breadcrumb]="crumbs(p.name)">
          <app-backup-status-badge headerStatus kind="policy" [value]="p.status" />
          <fl-copy-id headerMeta [value]="p.id" [display]="p.id | maskId" label="policy ID" />
          <span headerMeta>{{ engineLabel(p.engineClass, p.engine) }}</span>
          <ng-container headerActions>
            @if (!clusterGone()) {
              <button
                flButton
                appReadOnlySection="backup"
                type="button"
                [disabled]="toggling()"
                (click)="onToggle(p)"
              >
                {{ toggling() ? 'Saving…' : p.status === 'paused' ? 'Resume' : 'Pause' }}
              </button>
              <button
                flButton="primary"
                appReadOnlySection="backup"
                type="button"
                [disabled]="running()"
                (click)="onRunNow(p.id)"
              >
                {{ running() ? 'Starting…' : 'Run now' }}
              </button>
            }
            <fl-actions-menu
              appReadOnlySection="backup"
              [items]="menu"
              data-testid="policy-actions"
              (action)="onDelete(p)"
            />
          </ng-container>
        </fl-page-header>

        @if (clusterGone()) {
          <fl-alert tone="info" title="Cluster deleted">
            Its cluster no longer exists, so this policy is paused and will not run again. The
            backups it took stay restorable.
          </fl-alert>
        } @else if (p.status === 'paused') {
          <fl-alert tone="info" title="Policy paused">
            Scheduled backups do not run until you resume it. A database policy keeps shipping WAL
            for point-in-time recovery until it is deleted.
          </fl-alert>
        }
        @if (p.status === 'degraded') {
          <fl-alert tone="warning" title="Policy degraded">
            The primary destination is healthy but a replica is failing. Flui retries on its own.
          </fl-alert>
        }

        <app-policy-detail-schedule
          [policy]="p"
          [activity]="activity()"
          [loading]="activityLoading()"
          [failed]="activityError()"
          (retry)="reloadActivity(p.id)"
        />

        <fl-panel title="Runs" [count]="activity()?.runs?.length ?? null" [flush]="true">
          @if (activity(); as a) {
            @if (a.runs.length) {
              <app-backup-runs-table [runs]="a.runs" />
            } @else {
              <fl-empty-state [compact]="true" title="No runs yet" />
            }
          } @else if (activityLoading()) {
            <fl-loading-state [rows]="3" />
          } @else if (activityError()) {
            <fl-empty-state [compact]="true" title="Run history unavailable" />
          }
        </fl-panel>

        <app-policy-detail-facts [policy]="p" [activity]="activity()" />
      } @else if (loaded()) {
        <fl-page-header title="Policy" [breadcrumb]="crumbs('Not found')" />
        <fl-panel>
          <fl-empty-state title="Policy not found" body="It may have been deleted.">
            <a flButton size="sm" routerLink="/management/backup/policies">Back to policies</a>
          </fl-empty-state>
        </fl-panel>
      } @else {
        <fl-page-header title="Policy" [breadcrumb]="crumbs('Loading')" />
        <fl-panel><fl-loading-state [rows]="5" /></fl-panel>
      }

      <app-backup-progress-modal
        [operationId]="activeOpId()"
        title="Running backup"
        (settled)="onRunSettled()"
        (closed)="onProgressClosed()"
      />
    </div>
  `,
})
export class PolicyDetailComponent implements OnInit, OnDestroy {
  protected readonly engineLabel = policyEngineLabel;
  protected readonly menu: readonly MenuAction[] = [
    { id: 'delete', label: 'Delete policy', danger: true },
  ];

  private readonly backup = inject(BackupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly policy = signal<BackupPolicy | null>(null);
  protected readonly loaded = signal(false);
  protected readonly running = signal(false);
  protected readonly toggling = signal(false);
  protected readonly activeOpId = signal<string | null>(null);
  protected readonly clusterGone = computed(
    () => this.policy()?.metadata?.['pausedReason'] === 'cluster_gone',
  );
  protected readonly activity = signal<BackupPolicyActivity | null>(null);
  protected readonly activityLoading = signal(false);
  protected readonly activityError = signal(false);

  protected crumbs(last: string): readonly Crumb[] {
    return [
      { label: 'Backups', link: '/management/backup' },
      { label: 'Policies', link: '/management/backup/policies' },
      { label: last },
    ];
  }

  private readonly surfaceRevision = new PolicyDetailSurfaceRevision();

  readonly surface = computed(() => {
    const input: PolicyDetailSurfaceInput = { policy: this.policy(), activity: this.activity() };
    const content = presentedContent(input);
    if (!content) return null;
    return buildPolicyDetailSurface(input, {
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

  ngOnInit(): void {
    void (async () => {
      const id = this.route.snapshot.paramMap.get('id');
      if (!id) return;
      await Promise.all([
        this.backup.getPolicy(id).then((p) => {
          this.policy.set(p);
          this.loaded.set(true);
        }),
        this.reloadActivity(id),
      ]);
    })();
  }

  async reloadActivity(policyId: string): Promise<void> {
    this.activityLoading.set(true);
    this.activityError.set(false);
    try {
      this.activity.set(await this.backup.getPolicyActivity(policyId));
    } catch {
      this.activityError.set(true);
    } finally {
      this.activityLoading.set(false);
    }
  }

  async onRunNow(policyId: string): Promise<void> {
    this.running.set(true);
    const result = await this.backup.runOnDemand(policyId);
    this.running.set(false);
    if (!result) {
      this.toast.showError(this.backup.error() ?? 'Could not start the backup');
      return;
    }
    if (result.operationId) this.activeOpId.set(result.operationId);
    void this.reloadActivity(policyId);
  }

  onRunSettled(): void {
    const id = this.policy()?.id;
    if (id) void this.reloadActivity(id);
  }

  onProgressClosed(): void {
    this.activeOpId.set(null);
    this.onRunSettled();
  }

  async onToggle(p: BackupPolicy): Promise<void> {
    const paused = p.status === 'paused';
    this.toggling.set(true);
    const updated = paused
      ? await this.backup.resumePolicy(p.id)
      : await this.backup.pausePolicy(p.id);
    this.toggling.set(false);
    if (updated) {
      this.policy.set(updated);
      this.toast.showSuccess(paused ? 'Policy resumed' : 'Policy paused');
    } else {
      this.toast.showError('Could not update the policy');
    }
  }

  async onDelete(p: BackupPolicy): Promise<void> {
    const ok = await this.confirm.confirm({
      title: `Delete ${p.name}`,
      body: 'The policy stops running and is removed. This cannot be undone.',
      confirmLabel: 'Delete policy',
      destructive: true,
      typeToConfirm: p.name,
    });
    if (!ok) return;
    const deleted = await this.backup.deletePolicy(p.id);
    if (deleted) this.router.navigate(['/management/backup/policies']);
  }
}
