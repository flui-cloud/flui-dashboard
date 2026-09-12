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
  lucideCheck,
  lucideArrowRight,
  lucideTerminal,
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
      lucideCheck,
      lucideArrowRight,
      lucideTerminal,
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
      [showSuccessModal]="false"
      (operationCompleted)="onOperationCompleted()"
      (operationFailed)="onOperationFailed($event)"
    />

    <!-- Install log: bootstrap output tailed live from the master node. Only
         appears once something has actually been captured — nothing to show
         before the node is SSH-reachable, and nothing at all for worker/BYOS
         creation, which this doesn't cover yet. -->
    @if (installLog().length > 0) {
      <div class="max-w-4xl mx-auto mt-6 bg-card border border-border rounded-lg">
        <div class="p-4 border-b border-border flex items-center justify-between">
          <h2 class="text-base font-semibold flex items-center">
            <ng-icon name="lucideTerminal" class="h-4 w-4 mr-2" />
            Install Log
          </h2>
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
        <div class="p-4 bg-gray-900 dark:bg-black rounded-b-lg">
          <div #logContainer class="font-mono text-xs text-green-400 h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">{{ installLog() }}</div>
        </div>
      </div>
    }

    <!-- Custom Success Card for Cluster (shown after completion) -->
    @if (trackerService.isOperationCompleted()) {
      <div class="max-w-4xl mx-auto mt-6">
        <div class="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-6 animate-in fade-in duration-500">
          <div class="flex items-start justify-between">
            <div class="flex items-start space-x-4">
              <div class="flex-shrink-0 h-12 w-12 rounded-full bg-green-500 flex items-center justify-center">
                <ng-icon name="lucideCheck" class="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-green-900 dark:text-green-100">
                  Cluster Created Successfully!
                </h3>
                <p class="text-sm text-green-700 dark:text-green-300 mt-1">
                  "{{ clusterName() }}" is ready to use. All deployment steps completed successfully.
                </p>
              </div>
            </div>
          </div>
          <div class="mt-6 flex items-center space-x-4">
            <button
              (click)="navigateToCluster()"
              class="inline-flex items-center justify-center rounded-md bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700 transition-colors shadow-md hover:shadow-lg"
            >
              Go to Cluster
              <ng-icon name="lucideArrowRight" class="h-4 w-4 ml-2" />
            </button>
          </div>
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
      title: 'Creating Your Cluster',
      subtitle: `Setting up "${name}" on ${provider}`,
      progressTitle: 'Deployment Progress',
      successTitle: 'Cluster Created Successfully!',
      successMessage: `"${name}" is now ready to use`,
      failureTitle: 'Cluster Creation Failed',
      failureMessage: `The cluster "${name}" could not be created. Delete it from the list and create a new one.`,
      backButtonText: 'Back to Clusters',
      viewDetailsButtonText: 'Go to Cluster',
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

  navigateToCluster(): void {
    const id = this.clusterId() || this.clusterInfo()?.id;
    if (id) {
      this.router.navigate(['/cluster', id]);
    } else {
      // Fallback to cluster list if no ID available
      this.router.navigate(['/cluster']);
    }
  }
}
