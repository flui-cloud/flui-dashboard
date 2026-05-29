/**
 * Cluster Progress Tracker Component (Refactored)
 *
 * Thin wrapper around the generic OperationProgressTrackerComponent
 * Customized for cluster creation with specific labels and routing.
 *
 * REFACTORED: Reduced from ~720 lines to ~200 lines by using shared components
 * Custom success state with cluster-specific actions (Go to Cluster, Download Kubeconfig)
 */

import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideArrowRight,
} from '@ng-icons/lucide';
import {
  OperationProgressTrackerComponent,
  OperationLabels,
} from '../../../shared/components/operation-progress/operation-progress-tracker.component';
import { OperationTrackerService } from '../../../shared/services/operation-tracker.service';
import { ClusterService } from '../../service/cluster.service';

@Component({
  selector: 'cluster-progress-tracker',
  standalone: true,
  imports: [CommonModule, OperationProgressTrackerComponent, NgIcon],
  providers: [
    provideIcons({
      lucideCheck,
      lucideArrowRight,
    }),
  ],
  template: `
    <app-operation-progress-tracker
      [operationId]="operationId"
      [operationType]="'cluster'"
      [resourceName]="clusterName()"
      [labels]="customLabels()"
      [successRoute]="successRoute()"
      [failureRoute]="'/cluster'"
      [retryRoute]="'/cluster/create'"
      [showSuccessModal]="false"
      (operationCompleted)="onOperationCompleted()"
      (operationFailed)="onOperationFailed($event)"
    />

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
export class ClusterProgressTrackerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clusterService = inject(ClusterService);
  trackerService = inject(OperationTrackerService); // Inject for template access

  operationId: string = '';
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
      failureMessage: `The cluster "${name}" could not be created. Please review the error details below.`,
      retryButtonText: 'Retry Creation',
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
