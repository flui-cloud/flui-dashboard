import {
  Component,
  OnInit,
  AfterViewChecked,
  inject,
  computed,
  signal,
  effect,
  ElementRef,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideCopy, lucideDownload } from '@ng-icons/lucide';
import { poll } from '../../../core/state/poll';
import { OperationTrackerService } from '../../../shared/services/operation-tracker.service';
import { ClusterService } from '../../service/cluster.service';
import { InstallLogService } from '../../service/install-log.service';
import { DeploymentStep } from '../../model/application.models';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { DeployProgressSteps } from '../application/deploy-progress-steps';
import { formatDuration, secondsBetween } from '../application/deploy-progress-model';

@Component({
  selector: 'cluster-progress-tracker',
  imports: [
    FlAlert,
    FlCopyId,
    FlKeyValue,
    FlKvItem,
    FlPageHeader,
    FlPanel,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
    DeployProgressSteps,
  ],
  providers: [provideIcons({ lucideArrowRight, lucideCopy, lucideDownload })],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './cluster-progress-tracker.html',
})
export class ClusterProgressTrackerComponent implements OnInit, AfterViewChecked {
  private readonly logContainer = viewChild<ElementRef<HTMLDivElement>>('logContainer');
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clusterService = inject(ClusterService);
  private readonly installLogApi = inject(InstallLogService);
  trackerService = inject(OperationTrackerService);

  operationId: string = '';
  readonly installLog = this.clusterService.installLog;
  readonly downloadingLog = signal(false);
  private shouldScrollLog = false;
  private readonly scrollOnLogChange = effect(() => {
    this.installLog();
    this.shouldScrollLog = true;
  });
  private readonly clusterId = signal<string>('');
  protected readonly now = signal(Date.now());

  readonly clusterInfo = this.clusterService.cluster;
  readonly clusterName = computed(() => this.clusterInfo()?.name || 'Cluster');
  readonly providerName = computed(() =>
    this.clusterService.getProviderDisplayName(this.clusterInfo()?.provider),
  );

  readonly successRoute = computed(() => {
    const id = this.clusterId() || this.clusterInfo()?.id;
    return id ? `/cluster/${id}` : '/cluster';
  });

  protected readonly failed = this.trackerService.isOperationFailed;
  protected readonly completed = this.trackerService.isOperationCompleted;

  protected readonly breadcrumb = computed<Crumb[]>(() => [
    { label: 'Clusters', link: '/cluster' },
    { label: 'Create cluster', link: '/cluster/new' },
    { label: this.clusterName() },
  ]);

  protected readonly title = computed(() => {
    const name = this.clusterName();
    if (this.failed()) return `${name} could not be created`;
    if (this.completed()) return `${name} is ready`;
    return `Creating ${name}`;
  });

  protected readonly state = computed<{ tone: StatusTone; label: string }>(() => {
    if (this.failed()) return { tone: 'error', label: 'Failed' };
    if (this.completed()) return { tone: 'success', label: 'Ready' };
    return { tone: 'progress', label: 'Creating' };
  });

  protected readonly steps = computed<DeploymentStep[]>(() =>
    this.trackerService.steps().map((step) => ({
      id: step.id,
      name: step.title,
      description: step.details || step.description,
      status: step.status,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
    })),
  );

  protected readonly progress = computed(() =>
    Math.round(this.trackerService.getOverallProgress()),
  );

  protected readonly startedAt = computed(() => {
    const started = this.trackerService.operation()?.startedAt;
    return started ? new Date(started) : undefined;
  });

  protected readonly startedTime = computed(() => {
    const started = this.startedAt();
    return started
      ? started.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : '';
  });

  protected readonly elapsed = computed(() => {
    const completedAt = this.trackerService.operation()?.completedAt;
    const end = completedAt ? new Date(completedAt) : this.now();
    const seconds = secondsBetween(this.startedAt(), end);
    return seconds === null ? '' : formatDuration(seconds);
  });

  private completionHandled = false;
  private readonly handleOutcome = effect(() => {
    if (this.completed() && !this.completionHandled) {
      this.completionHandled = true;
      this.onOperationCompleted();
    }
  });

  constructor() {
    poll(() => this.now.set(Date.now()), 1000);
  }

  ngOnInit(): void {
    void (async () => {
      const opId = this.route.snapshot.paramMap.get('operationId');
      if (!opId) {
        this.router.navigate(['/cluster']);
        return;
      }

      this.operationId = opId;
      this.trackerService.resetState();
      this.trackerService.trackOperation(opId).catch((error) => {
        console.error('Failed to track operation:', error);
      });

      try {
        await this.clusterService.trackOperation(opId);
      } catch (error) {
        console.error('Failed to track cluster creation:', error);
      }

      const op = this.trackerService.operation();
      if (op?.metadata?.['clusterId']) {
        this.clusterId.set(op.metadata['clusterId']);
      }
    })();
  }

  onOperationCompleted(): void {
    const cluster = this.clusterInfo();
    if (cluster?.id) {
      this.clusterId.set(cluster.id);
    }

    const op = this.trackerService.operation();
    if (op?.metadata?.['clusterId'] && !this.clusterId()) {
      this.clusterId.set(op.metadata['clusterId']);
    }
  }

  openCluster(): void {
    void this.router.navigate([this.successRoute()]);
  }

  backToClusters(): void {
    void this.router.navigate(['/cluster']);
  }

  ngAfterViewChecked(): void {
    if (!this.shouldScrollLog) return;
    this.shouldScrollLog = false;
    const el = this.logContainer()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  copyLog(): void {
    navigator.clipboard.writeText(this.installLog());
  }

  downloadLog(): void {
    if (!this.operationId) return;
    this.downloadingLog.set(true);
    this.installLogApi.download(this.operationId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `install-${this.operationId}.log`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingLog.set(false);
      },
      error: () => this.downloadingLog.set(false),
    });
  }
}
