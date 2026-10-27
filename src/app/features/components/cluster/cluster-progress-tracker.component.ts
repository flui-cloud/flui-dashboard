/**
 * Cluster Progress Tracker Component (Refactored)
 *
 * Thin wrapper around the generic OperationProgressTrackerComponent
 * Customized for cluster creation with specific labels and routing.
 *
 * REFACTORED: Reduced from ~720 lines to ~200 lines by using shared components
 * Custom success state with cluster-specific actions (Go to Cluster)
 */

import { Component, OnInit, AfterViewChecked, inject, computed, signal, effect, ElementRef, viewChild, ChangeDetectionStrategy } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCopy,
  lucideDownload,
  lucideLoader,
} from '@ng-icons/lucide';
import {
  OperationProgressTrackerComponent,
  OperationLabels,
} from '../../../shared/components/operation-progress/operation-progress-tracker.component';
import { OperationTrackerService } from '../../../shared/services/operation-tracker.service';
import { ClusterService } from '../../service/cluster.service';
import { InstallLogService } from '../../service/install-log.service';

@Component({
  selector: 'cluster-progress-tracker',
  standalone: true,
  imports: [OperationProgressTrackerComponent, NgIcon],
  providers: [
    provideIcons({
      lucideCopy,
      lucideDownload,
      lucideLoader,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-operation-progress-tracker
      [operationId]="operationId"
      [operationType]="'cluster'"
      [resourceName]="clusterName()"
      [labels]="customLabels()"
      [successRoute]="successRoute()"
      [failureRoute]="'/cluster'"
      (operationCompleted)="onOperationCompleted()"
      (operationFailed)="onOperationFailed($event)"
    />

    @if (installLog().length > 0) {
      <div class="max-w-4xl mx-auto mt-6 bg-card border border-border rounded-lg overflow-hidden">
        <div class="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 class="text-sm font-medium">Install log</h2>
          <div class="flex items-center gap-3">
            <button (click)="copyLog()"
              class="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ng-icon name="lucideCopy" class="h-3.5 w-3.5 mr-1" />
              Copy
            </button>
            <button (click)="downloadLog()" [disabled]="downloadingLog()"
              class="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60">
              <ng-icon [name]="downloadingLog() ? 'lucideLoader' : 'lucideDownload'" class="h-3.5 w-3.5 mr-1" [class.animate-spin]="downloadingLog()" />
              Download
            </button>
          </div>
        </div>
        <div class="p-4 bg-zinc-950">
          <div #logContainer class="font-mono text-xs text-zinc-300 h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">{{ installLog() }}</div>
        </div>
      </div>
    }

  `,
})
export class ClusterProgressTrackerComponent implements OnInit, AfterViewChecked {
  private readonly logContainer = viewChild<ElementRef<HTMLDivElement>>('logContainer');
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clusterService = inject(ClusterService);
  private readonly installLogApi = inject(InstallLogService);
  trackerService = inject(OperationTrackerService); // Inject for template access

  operationId: string = '';
  readonly installLog = this.clusterService.installLog;
  readonly downloadingLog = signal(false);
  private shouldScrollLog = false;
  private readonly scrollOnLogChange = effect(() => {
    this.installLog();
    this.shouldScrollLog = true;
  });
  private readonly clusterId = signal<string>('');

  // Computed cluster info from service
  readonly clusterInfo = this.clusterService.cluster;
  readonly clusterName = computed(() => this.clusterInfo()?.name || 'Cluster');

  // Computed success route (navigate to cluster detail when ready)
  readonly successRoute = computed(() => {
    const id = this.clusterId() || this.clusterInfo()?.id;
    return id ? `/cluster/${id}` : '/cluster';
  });

  // Custom labels for cluster creation
  readonly customLabels = computed<Partial<OperationLabels>>(() => {
    const name = this.clusterName();
    const provider = this.clusterService.getProviderDisplayName(this.clusterInfo()?.provider);

    return {
      title: `Creating ${name}`,
      subtitle: `Setting up the cluster on ${provider}`,
      progressTitle: 'Progress',
      successTitle: `${name} is ready`,
      successMessage: `The cluster is running on ${provider}`,
      failureTitle: `${name} could not be created`,
      failureMessage: 'Delete it from the cluster list and create a new one.',
      backButtonText: 'Back to Clusters',
      viewDetailsButtonText: 'Open cluster',
    };
  });

  ngOnInit(): void {
    void (async () => {
      // Read operationId from route params
      const opId = this.route.snapshot.paramMap.get('operationId');
      if (!opId) {
        this.router.navigate(['/cluster']);
        return;
      }
  
      this.operationId = opId;
  
      // Start tracking this operation using ClusterService
      // (which internally uses the same OperationTrackerService)
      try {
        await this.clusterService.trackOperation(opId);
      } catch (error) {
        console.error('Failed to track cluster creation:', error);
      }
  
      // Try to extract clusterId from metadata if available
      // This allows navigation on success even if cluster is not fully loaded yet
      const op = this.trackerService.operation();
      if (op?.metadata?.['clusterId']) {
        this.clusterId.set(op.metadata['clusterId']);
      }
    })();
  }

  onOperationCompleted(): void {

    // Fetch final cluster details to update state
    const cluster = this.clusterInfo();
    if (cluster?.id) {
      this.clusterId.set(cluster.id);
    }

    // Extract cluster ID from operation metadata
    const op = this.trackerService.operation();
    if (op?.metadata?.['clusterId'] && !this.clusterId()) {
      this.clusterId.set(op.metadata['clusterId']);
    }
  }

  onOperationFailed(_error: string): void {}

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
