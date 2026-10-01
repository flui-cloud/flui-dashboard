import { Component, OnDestroy, OnInit, computed, effect, inject, signal, ChangeDetectionStrategy } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { BackupPolicy } from '../../../model/backup.models';
import { BackupPolicyActivity } from '../../../model/backup-run.models';
import { policyEngineLabel } from '../../../model/backup-protection.models';
import { formatLocalDateTime, formatRelativeTime, formatUtcDateTime } from '../../../model/backup-activity';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { BackupHealthBadgeComponent } from '../shared/health-badge.component';
import { BackupRunsTableComponent } from '../shared/runs-table.component';
import { BackupProgressModalComponent } from '../shared/progress-modal.component';
import { BackupBackLinkComponent } from '../shared/back-link.component';
import { ReadOnlySectionDirective } from '../../../../shared/directives/read-only-section.directive';
import { CurrentSurfaceService } from '../../../../core/services/current-surface.service';
import {
  PolicyDetailSurfaceInput,
  PolicyDetailSurfaceRevision,
  buildPolicyDetailSurface,
  presentedContent,
} from './policy-detail-surface';

@Component({
  selector: 'app-policy-detail',
  standalone: true,
  imports: [
    ReadOnlySectionDirective,
    BackupStatusBadgeComponent,
    BackupHealthBadgeComponent,
    BackupRunsTableComponent,
    BackupProgressModalComponent,
    BackupBackLinkComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="p-6 max-w-3xl space-y-4">
      <app-backup-back-link link="/management/backup/policies" label="Back to policies" />
      @if (policy(); as p) {
      <header class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-semibold">{{ p.name }}</h1>
          <p class="text-sm text-muted-foreground">
            <app-backup-status-badge kind="policy" [value]="p.status" />
            <span class="ml-2 capitalize">{{ p.profile }} profile</span>
          </p>
        </div>
        @if (!clusterGone()) {
        <div class="flex items-center gap-2">
          <button appReadOnlySection="backup"
            type="button"
            class="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            [disabled]="toggling()"
            (click)="onToggle(p)"
          >
            {{ toggling() ? '…' : (p.status === 'paused' ? 'Resume' : 'Pause') }}
          </button>
          <button appReadOnlySection="backup"
            type="button"
            class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            [disabled]="running()"
            (click)="onRunNow(p.id)"
          >
            {{ running() ? 'Starting…' : 'Run now' }}
          </button>
        </div>
        }
      </header>

      @if (clusterGone()) {
      <div class="rounded border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
        Its cluster no longer exists, so this policy is paused and will not run again. The backups it
        took stay restorable.
      </div>
      } @else if (p.status === 'paused') {
      <div class="rounded border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
        Policy is paused — scheduled backups won't run until you resume it. A
        database policy keeps shipping WAL for point-in-time recovery until deleted.
      </div>
      }

      @if (p.status === 'degraded') {
      <div class="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
        Policy is degraded — primary is healthy but a replica destination is failing. Recovery will retry automatically.
      </div>
      }

      <section class="rounded-lg border border-border bg-card p-5 space-y-3 text-sm" aria-labelledby="policy-schedule-title">
        <div class="flex items-center justify-between gap-2">
          <h3 id="policy-schedule-title" class="text-sm font-semibold">Schedule</h3>
          @if (activity(); as a) {
          <app-backup-health-badge [state]="a.health.state" [detail]="a.health.detail" />
          }
        </div>
        @if (activity(); as a) {
        <div>
          <div class="font-medium">{{ a.schedule.description }}</div>
          @if (a.schedule.cron) {
          <div class="font-mono text-xs text-muted-foreground">{{ a.schedule.cron }} ({{ a.schedule.timezone }})</div>
          }
        </div>
        @if (a.health.detail) {
        <p class="text-xs text-muted-foreground">{{ a.health.detail }}</p>
        }
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="text-xs text-muted-foreground">Next run</div>
            @if (a.schedule.nextRunAt) {
            <div [attr.title]="utc(a.schedule.nextRunAt)">
              {{ relative(a.schedule.nextRunAt) }}
              <span class="text-xs text-muted-foreground">· {{ local(a.schedule.nextRunAt) }}</span>
            </div>
            } @else {
            <div class="text-muted-foreground">—</div>
            }
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Last success</div>
            @if (a.health.lastSuccessAt) {
            <div [attr.title]="local(a.health.lastSuccessAt) + ' (' + utc(a.health.lastSuccessAt) + ')'">
              {{ relative(a.health.lastSuccessAt) }}
            </div>
            } @else {
            <div class="text-muted-foreground">Never</div>
            }
          </div>
        </div>
        } @else if (activityLoading()) {
        <p class="text-muted-foreground">Loading schedule…</p>
        } @else {
        <div class="font-mono text-xs">{{ p.cronSchedule || 'on-demand' }}</div>
        @if (activityError()) {
        <p class="text-xs text-red-600 dark:text-red-400">
          Could not load the schedule and run history.
          <button type="button" class="underline" (click)="reloadActivity(p.id)">Retry</button>
        </p>
        }
        }
      </section>

      <section class="rounded-lg border border-border bg-card p-5 space-y-2" aria-labelledby="policy-runs-title">
        <div class="flex items-center justify-between">
          <h3 id="policy-runs-title" class="text-sm font-semibold">Runs</h3>
          @if (activity(); as a) {
          <span class="text-xs text-muted-foreground">{{ a.runs.length }} shown</span>
          }
        </div>
        @if (activity(); as a) {
        @if (a.runs.length) {
        <app-backup-runs-table [runs]="a.runs" />
        } @else {
        <p class="text-sm text-muted-foreground">No runs yet.</p>
        }
        } @else if (activityLoading()) {
        <p class="text-sm text-muted-foreground">Loading runs…</p>
        } @else if (activityError()) {
        <p class="text-sm text-muted-foreground">Run history unavailable.</p>
        }
      </section>

      <div class="rounded-lg border border-border bg-card p-5 space-y-3 text-sm">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="text-xs text-muted-foreground">Scope</div>
            <div class="capitalize">{{ p.scope.replace('_',' ') }}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Retention</div>
            @if (p.engineClass === 'volume_copy') {
            <div>7 daily, 4 weekly{{ p.metadata?.['keepMonthly'] ? ', 3 monthly' : '' }}</div>
            } @else {
            <div>{{ p.retentionDays }}d / {{ p.retentionMaxCopies || '∞' }} copies</div>
            }
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Protects with</div>
            <div>{{ engineLabel(p.engineClass, p.engine) }}</div>
          </div>
          @if (p.engineClass === 'volume_copy' && (p.metadata?.['pauseDuringCopy'] || excluded(p).length)) {
          <div>
            <div class="text-xs text-muted-foreground">Options</div>
            <div>
              {{ p.metadata?.['pauseDuringCopy'] ? 'App stopped during each copy' : '' }}
              @if (excluded(p).length) {
              <span class="block">Left out: {{ excluded(p).join(', ') }}</span>
              }
            </div>
          </div>
          }
        </div>
      </div>

      <div class="rounded-lg border border-border bg-card p-5 space-y-2">
        <h3 class="text-sm font-semibold">Destinations</h3>
        <ul class="space-y-1 text-sm">
          @for (d of p.destinations; track d.id) {
          <li class="flex items-center justify-between">
            <span>
              <span class="font-medium">{{ d.destination?.name || d.destinationId.slice(0,8) }}</span>
              <span class="text-muted-foreground ml-2 capitalize">{{ d.role }}</span>
            </span>
            <span class="text-xs text-muted-foreground">
              Replication: {{ d.lastReplicationStatus }}
            </span>
          </li>
          }
        </ul>
      </div>

      <div class="flex justify-end">
        <button appReadOnlySection="backup" type="button" class="text-sm text-red-600 hover:underline" (click)="onDelete(p)">
          Delete policy
        </button>
      </div>
      } @else {
      <p class="text-sm text-muted-foreground">Loading…</p>
      }

      <app-backup-progress-modal
        [operationId]="activeOpId()"
        title="Running backup"
        (closed)="onProgressClosed()"
      />
    </div>
  `,
})
export class PolicyDetailComponent implements OnInit, OnDestroy {
  protected readonly engineLabel = policyEngineLabel;

  protected excluded(p: BackupPolicy): string[] {
    const list = p.metadata?.['excludeVolumes'];
    return Array.isArray(list) ? (list as string[]) : [];
  }

  private readonly backup = inject(BackupService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly policy = signal<BackupPolicy | null>(null);
  protected readonly running = signal(false);
  protected readonly toggling = signal(false);
  protected readonly activeOpId = signal<string | null>(null);
  protected readonly clusterGone = computed(
    () => this.policy()?.metadata?.['pausedReason'] === 'cluster_gone',
  );
  protected readonly activity = signal<BackupPolicyActivity | null>(null);
  protected readonly activityLoading = signal(false);
  protected readonly activityError = signal(false);

  protected readonly relative = (iso: string) => formatRelativeTime(iso);
  protected readonly local = formatLocalDateTime;
  protected readonly utc = formatUtcDateTime;

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
        this.backup.getPolicy(id).then((p) => this.policy.set(p)),
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
    if (result?.operationId) this.activeOpId.set(result.operationId);
    else if (result) void this.reloadActivity(policyId);
    else this.toast.showError(this.backup.error() ?? 'Could not start the backup');
  }

  onProgressClosed(): void {
    this.activeOpId.set(null);
    const id = this.policy()?.id;
    if (id) void this.reloadActivity(id);
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
    if (!confirm(`Delete policy "${p.name}"?`)) return;
    const ok = await this.backup.deletePolicy(p.id);
    if (ok) this.router.navigate(['/management/backup/policies']);
  }
}
