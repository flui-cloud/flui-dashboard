import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, interval, map, firstValueFrom } from 'rxjs';
import { ClusterInfo, ClusterCreationStep, ClusterStatus, ClusterType, ProviderType, ClusterConfiguration, ClusterMetrics, AutoScalingConfig, OperationStatus } from '../model/cluster.models';
import { InfrastructureClustersService } from '../../core/api/api/infrastructureClusters.service';
import { InfrastructureOperationsService } from '../../core/api/api/infrastructureOperations.service';
import { VirtualInstancesService } from '../../core/api/api/virtualInstances.service';
import { ProviderManagementService } from '../../core/api/api/providerManagement.service';
import { CreateClusterDto, UpdateClusterVNetDto, ProviderDefinitionDto, ClusterResponseDto } from '../../core/api/model/models';
import { InstanceWithLabels } from '../model/instance.models';
import { InfrastructureWebSocketService } from './infrastructure-websocket.service';

export interface ProviderInfo {
  id: string;
  name: string;
  enabled: boolean;
  configured: boolean;
}


@Injectable({
  providedIn: 'root',
})
export class ClusterService {
  private readonly clustersApi = inject(InfrastructureClustersService);
  private readonly operationsApi = inject(InfrastructureOperationsService);
  private readonly instancesApi = inject(VirtualInstancesService);
  private readonly providersApi = inject(ProviderManagementService);
  private readonly infrastructureWs = inject(InfrastructureWebSocketService);

  private readonly clusterInfo = signal<ClusterInfo | null>(null);
  private readonly isLoading = signal<boolean>(false);
  private readonly error = signal<string | null>(null);
  private readonly creationSteps = signal<ClusterCreationStep[]>([]);
  private readonly currentOperationId = signal<string | null>(null);
  private readonly creationProgress = signal<number>(0);
  private readonly creationMessage = signal<string>('');
  private readonly currentStepIndex = signal<number>(0);
  private readonly totalSteps = signal<number>(0);
  private readonly currentStepProgress = signal<number>(0);
  private readonly stepMessages: Set<string> = new Set(); // Track unique step identifiers for dynamic steps
  private readonly operationStatus = signal<OperationStatus | null>(null);

  // Cluster list management signals
  private readonly clustersList = signal<ClusterInfo[]>([]);
  private readonly selectedClusterId = signal<string | null>(null);
  private readonly listLoading = signal<boolean>(false);
  private readonly listError = signal<string | null>(null);

  // Provider management signals
  private readonly providersList = signal<ProviderInfo[]>([]);
  private readonly providersLoading = signal<boolean>(false);
  private readonly providersError = signal<string | null>(null);

  readonly cluster = this.clusterInfo.asReadonly();
  readonly loading = this.isLoading.asReadonly();
  readonly errorMessage = this.error.asReadonly();
  readonly steps = this.creationSteps.asReadonly();
  readonly progress = this.creationProgress.asReadonly();
  readonly progressMessage = this.creationMessage.asReadonly();
  readonly stepIndex = this.currentStepIndex.asReadonly();
  readonly stepsTotal = this.totalSteps.asReadonly();
  readonly stepProgress = this.currentStepProgress.asReadonly();
  readonly operation = this.operationStatus.asReadonly();

  // Deletion progress: map of clusterId → percentage (0–100), present while deleting
  private readonly deletionProgressMap = signal<Record<string, number>>({});
  readonly deletionProgress = this.deletionProgressMap.asReadonly();

  // Attach-VNet operation state
  private readonly attachVNetInProgress = signal<boolean>(false);
  private readonly attachVNetProgressSig = signal<number>(0);
  private readonly attachVNetMessageSig = signal<string>('');
  private readonly attachVNetCurrentStepSig = signal<number>(0);
  private readonly attachVNetTotalStepsSig = signal<number>(0);
  private readonly attachVNetErrorSig = signal<string | null>(null);
  readonly attachVNetRunning = this.attachVNetInProgress.asReadonly();
  readonly attachVNetProgress = this.attachVNetProgressSig.asReadonly();
  readonly attachVNetMessage = this.attachVNetMessageSig.asReadonly();
  readonly attachVNetCurrentStep = this.attachVNetCurrentStepSig.asReadonly();
  readonly attachVNetTotalSteps = this.attachVNetTotalStepsSig.asReadonly();
  readonly attachVNetError = this.attachVNetErrorSig.asReadonly();

  // Cluster list readonly signals
  readonly clusters = this.clustersList.asReadonly();
  readonly selectedId = this.selectedClusterId.asReadonly();
  readonly listIsLoading = this.listLoading.asReadonly();
  readonly listErrorMessage = this.listError.asReadonly();

  // Provider readonly signals
  readonly providers = this.providersList.asReadonly();
  readonly providersIsLoading = this.providersLoading.asReadonly();
  readonly providersErrorMessage = this.providersError.asReadonly();

  // Cluster nodes state
  private readonly clusterNodes = signal<InstanceWithLabels[]>([]);
  readonly nodes = this.clusterNodes.asReadonly();
  private readonly nodesLoading = signal<boolean>(false);
  readonly nodesIsLoading = this.nodesLoading.asReadonly();
  private readonly nodesError = signal<string | null>(null);
  readonly nodesErrorMessage = this.nodesError.asReadonly();

  readonly hasCluster = computed(() => !!this.clusterInfo());
  readonly isClusterActive = computed(
    () => this.clusterInfo()?.status === ClusterStatus.ACTIVE
  );
  readonly isClusterCreating = computed(
    () => this.clusterInfo()?.status === ClusterStatus.CREATING
  );
  readonly hasClusters = computed(() => this.clustersList().length > 0);
  readonly selectedCluster = computed(() => {
    const id = this.selectedClusterId();
    if (!id) return null;
    return this.clustersList().find(c => c.id === id) || null;
  });

  // Provider computed signals
  readonly hasConfiguredProviders = computed(() =>
    this.providersList().some(p => p.configured && p.enabled)
  );
  readonly configuredProvidersCount = computed(() =>
    this.providersList().filter(p => p.configured && p.enabled).length
  );
  readonly enabledProviders = computed(() =>
    this.providersList().filter(p => p.enabled)
  );

  // Provider-related methods
  async loadProviders(): Promise<void> {
    this.providersLoading.set(true);
    this.providersError.set(null);

    try {
      // First, get list of available providers
      const availableProviders = await firstValueFrom(
        this.providersApi.managementControllerGetAvailableProviders()
      );

      // Then, for each provider, check if it's configured
      const providersWithConfig: ProviderInfo[] = await Promise.all(
        availableProviders.map(async (provider: ProviderDefinitionDto) => {
          const providerId = provider.id;
          let isConfigured = false;

          try {
            // Check if provider has configuration
            const config = await firstValueFrom(
              this.providersApi.managementControllerGetProviderConfiguration(providerId)
            );

            isConfigured = config?.status === 'active';
          } catch {
            isConfigured = false;
          }

          return {
            id: providerId,
            name: provider.displayName || provider.name,
            enabled: provider.enabled,
            configured: isConfigured,
          };
        })
      );

      this.providersList.set(providersWithConfig);
    } catch (error: any) {
      const errorMessage = error?.error?.message || error.message || 'Failed to load providers';
      console.error('❌ Failed to load providers:', error);
      this.providersError.set(errorMessage);
      throw error;
    } finally {
      this.providersLoading.set(false);
    }
  }

  getConfiguredProvidersCount(): number {
    return this.configuredProvidersCount();
  }

  getConfiguredProviders(): ProviderInfo[] {
    return this.providersList().filter(p => p.configured && p.enabled);
  }

  // Cluster lifecycle methods
  async loadClusterInfo(): Promise<ClusterInfo> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Simulate API call
      await this.delay(800);

      const cluster = this.clusterInfo();
      if (!cluster) {
        throw new Error('Cluster not found');
      }

      return cluster;
    } catch (error: any) {
      this.error.set(error.message || 'Failed to load cluster info');
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async createCluster(config: ClusterConfiguration): Promise<{ operationId: string; clusterId: string }> {
    this.isLoading.set(true);
    this.error.set(null);
    this.creationProgress.set(0);
    this.creationMessage.set('Initializing cluster creation...');

    // Reset dynamic steps tracking
    this.stepMessages.clear();
    this.creationSteps.set([]);
    this.currentStepIndex.set(0);
    this.totalSteps.set(0);
    this.currentStepProgress.set(0);

    try {
      // Prepare API request
      const createClusterDto: CreateClusterDto = {
        name: config.name,
        provider: config.provider as CreateClusterDto.ProviderEnum,
        region: config.region,
        nodeSize: config.nodeTypeId,
        workerCount: 0,
        autoscalingEnabled: config.autoScalingEnabled,
        minNodes: config.minNodes,
        maxNodes: config.maxNodes,
        scaleUpMemoryPct: config.scaleUpMemoryPct,
        scaleUpCpuPct: config.scaleUpCpuPct,
        cooldownSeconds: config.cooldownSeconds,
        sshKeys: config.sshKeys,
        diskSizeGb: config.diskSizeGb,
        vnetConfig: config.vnetConfig,
        firewallRules: config.firewallRules as Array<object> | undefined,
        endpointHostnameMode: config.endpointHostnameMode,
        sharedStorageEnabled: config.sharedStorageEnabled,
        sharedStorageVolumeSizeGb: config.sharedStorageVolumeSizeGb,
      };

      const response = await firstValueFrom(
        this.clustersApi.clustersControllerCreateCluster(createClusterDto)
      );

      this.currentOperationId.set(response.operation_id);

      const newCluster: ClusterInfo = {
        id: response.cluster_id,
        name: config.name,
        status: ClusterStatus.CREATING,
        provider: config.provider,
        region: config.region,
        nodeCount: 0,
        minNodes: config.minNodes,
        maxNodes: config.maxNodes,
        autoScalingEnabled: config.autoScalingEnabled,
        createdAt: new Date(),
        lastActivity: new Date(),
        version: 'v1.28.4',
      };

      this.clusterInfo.set(newCluster);

      this.pollOperationStatus(response.operation_id, response.cluster_id);

      return {
        operationId: response.operation_id,
        clusterId: response.cluster_id
      };
    } catch (error: any) {
      const errorMessage = error?.error?.message || error.message || 'Failed to create cluster';
      console.error('❌ Cluster creation failed:', error);
      this.error.set(errorMessage);
      this.creationMessage.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Add or update dynamic step based on new API structure
   * Uses currentStep identifier instead of message for tracking
   */
  private addDynamicStep(
    currentStepId: string,
    stepDescription: string,
    currentStepIndex: number,
    totalSteps: number,
    currentStepProgress: number,
    overallProgress: number
  ): void {
    if (!currentStepId || currentStepId.trim() === '') return;

    if (this.stepMessages.has(currentStepId)) {
      const steps = this.creationSteps();
      const existingStep = steps.find((s) => s.id === currentStepId);
      if (existingStep?.status === 'running') {
        this.updateCreationStep(existingStep.id, {
          description: `Step ${currentStepIndex + 1} of ${totalSteps}`,
        });
      }
    } else {
      this.stepMessages.add(currentStepId);

      const steps = this.creationSteps();
      if (steps.length > 0) {
        const lastStep = steps.at(-1)!;
        if (lastStep.status === 'running') {
          this.updateCreationStep(lastStep.id, {
            status: 'completed',
            completedAt: new Date(),
          });
        }
      }

      const newStep: ClusterCreationStep = {
        id: currentStepId,
        title: stepDescription || currentStepId,
        description: `Step ${currentStepIndex + 1} of ${totalSteps}`,
        status: 'running',
        startedAt: new Date(),
      };

      this.creationSteps.update((currentSteps) => [...currentSteps, newStep]);
    }
  }

  private async pollOperationStatus(operationId: string, clusterId: string, operationType: 'create' | 'delete' | 'stop' | 'start' = 'create'): Promise<void> {
    const POLL_INTERVAL = 3000;
    const MAX_POLLS = 600; // 30 minutes
    let pollCount = 0;

    const operationMessages = {
      create: {
        timeout: 'Cluster creation timeout. Please check the cluster status manually.',
        success: 'Cluster created successfully!',
        failed: 'Cluster creation failed',
        inProgress: 'Creating cluster...'
      },
      delete: {
        timeout: 'Cluster deletion timeout. Please check the cluster status manually.',
        success: 'Cluster deleted successfully!',
        failed: 'Cluster deletion failed',
        inProgress: 'Deleting cluster...'
      },
      stop: {
        timeout: 'Cluster stop timeout. Please check the cluster status manually.',
        success: 'Cluster stopped successfully!',
        failed: 'Cluster stop operation failed',
        inProgress: 'Stopping cluster...'
      },
      start: {
        timeout: 'Cluster start timeout. Please check the cluster status manually.',
        success: 'Cluster started successfully!',
        failed: 'Cluster start operation failed',
        inProgress: 'Starting cluster...'
      }
    };

    const messages = operationMessages[operationType];

    const poll = async (): Promise<void> => {
      if (pollCount >= MAX_POLLS) {
        this.error.set(messages.timeout);
        this.creationMessage.set('Operation timeout');
        return;
      }

      pollCount++;

      try {
        // Fetch operation status
        const statusResponse = await firstValueFrom(
          this.operationsApi.infrastructureOperationsControllerGetOperationStatus(operationId)
        );

        const status = statusResponse as OperationStatus;

        this.operationStatus.set(status);

        this.creationProgress.set(status.progress);
        this.currentStepIndex.set(status.currentStepIndex);
        this.totalSteps.set(status.totalSteps);
        this.currentStepProgress.set(status.currentStepProgress);

        const stepDescription = status.metadata?.stepDescription || messages.inProgress;
        if (status.totalSteps > 0) {
          this.creationMessage.set(
            `Step ${status.currentStepIndex + 1}/${status.totalSteps}: ${stepDescription}`
          );
        } else {
          this.creationMessage.set(stepDescription);
        }

        // Create dynamic step based on currentStep identifier
        this.addDynamicStep(
          status.currentStep,
          stepDescription,
          status.currentStepIndex,
          status.totalSteps,
          status.currentStepProgress,
          status.progress
        );

        // Check operation status
        if (status.status === 'COMPLETED') {
          this.creationProgress.set(100);
          this.creationMessage.set(messages.success);

          // Mark last step as completed
          const steps = this.creationSteps();
          if (steps.length > 0) {
            const lastStep = steps.at(-1)!;
            if (lastStep.status === 'running') {
              this.updateCreationStep(lastStep.id, {
                status: 'completed',
                completedAt: new Date(),
              });
            }
          }

          // Add final completion step
          const finalStep: ClusterCreationStep = {
            id: `step-final-${Date.now()}`,
            title: messages.success,
            description: operationType === 'create' ? 'Your cluster is ready to use' : 'Operation completed',
            status: 'completed',
            startedAt: new Date(),
            completedAt: new Date(),
          };
          this.creationSteps.update((currentSteps) => [...currentSteps, finalStep]);

          // Fetch final cluster details
          await this.fetchClusterDetails(clusterId);
          return;
        } else if (status.status === 'FAILED') {
          const errorMsg = status.errorMessage || messages.failed;
          console.error(`❌ ${messages.failed}:`, errorMsg);
          this.error.set(errorMsg);
          this.creationMessage.set(errorMsg);

          // Mark last step as error
          const steps = this.creationSteps();
          if (steps.length > 0) {
            const lastStep = steps.at(-1)!;
            if (lastStep.status === 'running') {
              this.updateCreationStep(lastStep.id, {
                status: 'error',
                details: errorMsg,
              });
            }
          }

          // Update cluster status to error only for create/delete operations
          if (operationType === 'create' || operationType === 'delete') {
            this.clusterInfo.update((cluster) =>
              cluster ? { ...cluster, status: ClusterStatus.ERROR } : null
            );
          }
          return;
        } else {
          // Still IN_PROGRESS or PENDING, continue polling
          setTimeout(() => poll(), POLL_INTERVAL);
        }
      } catch (error: any) {
        console.error('❌ Error polling operation status:', error);
        // Continue polling even on error, might be temporary network issue
        setTimeout(() => poll(), POLL_INTERVAL);
      }
    };

    // Start polling
    poll();
  }

  /**
   * Public method to start polling for an operation by operationId only
   * (used by progress tracker route)
   */
  async trackOperation(operationId: string): Promise<void> {
    const POLL_INTERVAL = 3000;
    const MAX_POLLS = 600;
    let pollCount = 0;
    let clusterId: string | null = null;

    const poll = async (): Promise<void> => {
      if (pollCount >= MAX_POLLS) {
        this.error.set('Operation timeout. Please check the status manually.');
        this.creationMessage.set('Operation timeout');
        return;
      }

      pollCount++;

      try {
        const statusResponse = await firstValueFrom(
          this.operationsApi.infrastructureOperationsControllerGetOperationStatus(operationId)
        );

        const status = statusResponse as OperationStatus;
        this.operationStatus.set(status);

        // Try to extract clusterId from metadata or from the status itself
        if (!clusterId && status.metadata?.['clusterId']) {
          clusterId = status.metadata['clusterId'];
        }

        // Update progress
        this.creationProgress.set(status.progress);
        this.currentStepIndex.set(status.currentStepIndex);
        this.totalSteps.set(status.totalSteps);
        this.currentStepProgress.set(status.currentStepProgress);

        const stepDescription = status.metadata?.stepDescription || 'Processing...';
        if (status.totalSteps > 0) {
          this.creationMessage.set(
            `Step ${status.currentStepIndex + 1}/${status.totalSteps}: ${stepDescription}`
          );
        } else {
          this.creationMessage.set(stepDescription);
        }

        // Create dynamic step
        this.addDynamicStep(
          status.currentStep,
          stepDescription,
          status.currentStepIndex,
          status.totalSteps,
          status.currentStepProgress,
          status.progress
        );

        // Check completion
        if (status.status === 'COMPLETED') {
          this.creationProgress.set(100);
          this.creationMessage.set('Operation completed successfully!');

          // Mark last step as completed
          const steps = this.creationSteps();
          if (steps.length > 0) {
            const lastStep = steps.at(-1)!;
            if (lastStep.status === 'running') {
              this.updateCreationStep(lastStep.id, {
                status: 'completed',
                completedAt: new Date(),
              });
            }
          }

          // Add final completion step
          const finalStep: ClusterCreationStep = {
            id: `step-final-${Date.now()}`,
            title: 'Operation completed successfully!',
            description: 'Your cluster is ready to use',
            status: 'completed',
            startedAt: new Date(),
            completedAt: new Date(),
          };
          this.creationSteps.update((currentSteps) => [...currentSteps, finalStep]);

          // Fetch cluster details if we have clusterId
          if (clusterId) {
            await this.fetchClusterDetails(clusterId);
          }
          return;
        } else if (status.status === 'FAILED') {
          const errorMsg = status.errorMessage || 'Operation failed';
          console.error('❌ Operation failed:', errorMsg);
          this.error.set(errorMsg);
          this.creationMessage.set(errorMsg);

          // Mark last step as error
          const steps = this.creationSteps();
          if (steps.length > 0) {
            const lastStep = steps.at(-1)!;
            if (lastStep.status === 'running') {
              this.updateCreationStep(lastStep.id, {
                status: 'error',
                details: errorMsg,
              });
            }
          }

          // Update cluster status to error if we have clusterId
          if (clusterId) {
            this.clusterInfo.update((cluster) =>
              cluster ? { ...cluster, status: ClusterStatus.ERROR } : null
            );
          }
          return;
        } else {
          // Continue polling
          setTimeout(() => poll(), POLL_INTERVAL);
        }
      } catch (error: any) {
        console.error('❌ Error polling operation status:', error);
        setTimeout(() => poll(), POLL_INTERVAL);
      }
    };

    // Start polling
    poll();
  }

  /**
   * Fetch cluster details after creation completes
   */
  private async fetchClusterDetails(clusterId: string): Promise<void> {
    try {
      const clusterResponse = await firstValueFrom(
        this.clustersApi.clustersControllerGetCluster(clusterId)
      );

      // Update cluster info with actual data
      const updatedCluster: ClusterInfo = {
        id: clusterResponse.id,
        name: clusterResponse.name,
        status: this.mapApiStatusToClusterStatus(clusterResponse.status),
        clusterType: clusterResponse.clusterType as ClusterType,
        provider: clusterResponse.provider as ProviderType,
        region: clusterResponse.region,
        nodeCount: clusterResponse.nodeCount,
        minNodes: clusterResponse.minNodes,
        maxNodes: clusterResponse.maxNodes,
        autoScalingEnabled: clusterResponse.autoscalingEnabled,
        masterIpAddress: clusterResponse.masterIpAddress,
        version: clusterResponse.k3sVersion,
        createdAt: new Date(clusterResponse.createdAt),
        lastActivity: new Date(clusterResponse.updatedAt),
        vnetId: clusterResponse.vnetId,
        vnetName: clusterResponse.vnetName,
      };

      this.clusterInfo.set(updatedCluster);
    } catch (error: any) {
      console.error('❌ Error fetching cluster details:', error);
      this.error.set('Cluster created but failed to fetch details');
    }
  }

  /**
   * Load cluster nodes (instances)
   */
  async loadClusterNodes(clusterId: string): Promise<void> {
    this.nodesLoading.set(true);
    this.nodesError.set(null);

    try {
      const response = await firstValueFrom(
        this.instancesApi.instancesControllerFindAll(
          undefined, // type
          undefined, // status
          undefined, // provider
          undefined, // region
          undefined, // dataCenter
          undefined, // search
          clusterId, // clusterId - filter by cluster ID
          true       // skipCache - always fetch fresh data from providers
        )
      );

      if (response.partialErrors && response.partialErrors.length > 0) {
        console.warn('Partial errors loading nodes:', response.partialErrors);
      }

      // InstanceDto already matches InstanceWithLabels structure
      this.clusterNodes.set(response.data as InstanceWithLabels[]);
    } catch (error: any) {
      console.error('❌ Failed to load cluster nodes:', error);
      this.nodesError.set(error?.message || 'Failed to load cluster nodes');
      this.clusterNodes.set([]);
      throw error;
    } finally {
      this.nodesLoading.set(false);
    }
  }

  /**
   * Clear cluster nodes data
   */
  clearClusterNodes(): void {
    this.clusterNodes.set([]);
    this.nodesError.set(null);
  }


  /**
   * Map API status to internal ClusterStatus enum
   */
  private mapApiStatusToClusterStatus(apiStatus: string): ClusterStatus {
    switch (apiStatus.toLowerCase()) {
      case 'creating':
        return ClusterStatus.CREATING;
      case 'ready':
        return ClusterStatus.ACTIVE;
      case 'scaling':
        return ClusterStatus.SCALING;
      case 'error':
        return ClusterStatus.ERROR;
      case 'deleting':
        return ClusterStatus.DELETING;
      case 'deleted':
        return ClusterStatus.NO_CLUSTER;
      case 'stopped':
        return ClusterStatus.STOPPED;
      case 'stopping':
        return ClusterStatus.STOPPING;
      case 'starting':
        return ClusterStatus.STARTING;
      default:
        return ClusterStatus.ERROR;
    }
  }

  /**
   * Load all clusters for the current user
   */
  async loadClusters(): Promise<void> {
    this.listLoading.set(true);
    this.listError.set(null);

    try {
      const response = await firstValueFrom(
        this.clustersApi.clustersControllerListClusters()
      );

      // Map API response to ClusterInfo array
      const clusters: ClusterInfo[] = response.map((cluster: ClusterResponseDto) => ({
        id: cluster.id,
        name: cluster.name,
        status: this.mapApiStatusToClusterStatus(cluster.status),
        clusterType: cluster.clusterType as ClusterType,
        provider: cluster.provider as ProviderType,
        region: cluster.region,
        nodeCount: cluster.nodeCount,
        minNodes: cluster.minNodes,
        maxNodes: cluster.maxNodes,
        autoScalingEnabled: cluster.autoscalingEnabled,
        masterIpAddress: cluster.masterIpAddress,
        version: cluster.k3sVersion,
        createdAt: new Date(cluster.createdAt),
        lastActivity: new Date(cluster.updatedAt),
        vnetId: cluster.vnetId,
        vnetName: cluster.vnetName,
      }));

      this.clustersList.set(clusters);
    } catch (error: any) {
      const errorMessage = error?.error?.message || error.message || 'Failed to load clusters';
      console.error('❌ Failed to load clusters:', error);
      this.listError.set(errorMessage);
      throw error;
    } finally {
      this.listLoading.set(false);
    }
  }

  /**
   * Select a cluster and load its details
   */
  async selectCluster(clusterId: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    this.selectedClusterId.set(clusterId);

    try {
      const clusterResponse = await firstValueFrom(
        this.clustersApi.clustersControllerGetCluster(clusterId)
      );

      const clusterDetails: ClusterInfo = {
        id: clusterResponse.id,
        name: clusterResponse.name,
        status: this.mapApiStatusToClusterStatus(clusterResponse.status),
        clusterType: clusterResponse.clusterType as ClusterType,
        provider: clusterResponse.provider as ProviderType,
        region: clusterResponse.region,
        nodeCount: clusterResponse.nodeCount,
        minNodes: clusterResponse.minNodes,
        maxNodes: clusterResponse.maxNodes,
        autoScalingEnabled: clusterResponse.autoscalingEnabled,
        masterIpAddress: clusterResponse.masterIpAddress,
        version: clusterResponse.k3sVersion,
        createdAt: new Date(clusterResponse.createdAt),
        lastActivity: new Date(clusterResponse.updatedAt),
        vnetId: clusterResponse.vnetId,
        vnetName: clusterResponse.vnetName,
      };

      this.clusterInfo.set(clusterDetails);

      // Update in list if present
      this.clustersList.update(clusters =>
        clusters.map(c => c.id === clusterId ? clusterDetails : c)
      );
    } catch (error: any) {
      const errorMessage = error?.error?.message || error.message || 'Failed to load cluster details';
      console.error('❌ Failed to load cluster details:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Delete a cluster with optional force flag
   */
  async deleteCluster(clusterId: string, force: boolean = false): Promise<{ operationId: string }> {
    this.isLoading.set(true);
    this.error.set(null);

    // Subscribe by resource ID before DELETE so we catch all events
    this.infrastructureWs.subscribeToResource(clusterId, {
      onProgress: (dto) => {
        this.deletionProgressMap.update(map => ({ ...map, [clusterId]: dto.percentage }));
      },
      onCompleted: () => {
        this.infrastructureWs.unsubscribeFromResource(clusterId);
        this.deletionProgressMap.update(map => {
          const next = { ...map };
          delete next[clusterId];
          return next;
        });
        this.clustersList.update(clusters => clusters.filter(c => c.id !== clusterId));
        if (this.clusterInfo()?.id === clusterId) {
          this.clusterInfo.set(null);
        }
      },
      onFailed: (dto) => {
        this.infrastructureWs.unsubscribeFromResource(clusterId);
        this.deletionProgressMap.update(map => {
          const next = { ...map };
          delete next[clusterId];
          return next;
        });
        this.clustersList.update(clusters =>
          clusters.map(c => c.id === clusterId ? { ...c, status: ClusterStatus.ERROR } : c)
        );
        this.error.set(dto.error || 'Cluster deletion failed');
      },
    });

    try {
      const response = await firstValueFrom(
        this.clustersApi.clustersControllerDeleteCluster(clusterId, force)
      );

      // Mark as deleting in UI immediately
      this.clustersList.update(clusters =>
        clusters.map(c =>
          c.id === clusterId ? { ...c, status: ClusterStatus.DELETING } : c
        )
      );

      const current = this.clusterInfo();
      if (current?.id === clusterId) {
        this.clusterInfo.update((cluster) =>
          cluster ? { ...cluster, status: ClusterStatus.DELETING } : null
        );
      }

      const operationId = response.operation_id || '';

      // Fallback: also poll via HTTP in case WebSocket is unavailable
      this.pollDeletion(operationId, clusterId);

      return { operationId };
    } catch (error: any) {
      const errorMessage = error?.error?.message || error.message || 'Failed to delete cluster';
      console.error('❌ Cluster deletion failed:', error);
      this.infrastructureWs.unsubscribeFromResource(clusterId);
      this.deletionProgressMap.update(map => {
        const next = { ...map };
        delete next[clusterId];
        return next;
      });
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * HTTP polling fallback for cluster deletion.
   * Stops automatically once the WebSocket marks the cluster as completed/failed.
   */
  private async pollDeletion(operationId: string, clusterId: string): Promise<void> {
    if (!operationId) return;

    const POLL_INTERVAL = 5000;
    const MAX_POLLS = 360; // 30 minutes
    let polls = 0;

    const poll = async (): Promise<void> => {
      // Stop if WebSocket already resolved this deletion
      const currentCluster = this.clustersList().find(c => c.id === clusterId);
      if (!currentCluster) return; // already removed by WebSocket

      if (polls >= MAX_POLLS) {
        return;
      }
      polls++;

      try {
        const status = await firstValueFrom(
          this.operationsApi.infrastructureOperationsControllerGetOperationStatus(operationId)
        ) as OperationStatus;

        const pct = status.progress ?? 0;
        // Never go backwards: only update if polling reports a higher value
        this.deletionProgressMap.update(map => {
          const current = map[clusterId] ?? 0;
          return pct > current ? { ...map, [clusterId]: pct } : map;
        });

        if (status.status === 'COMPLETED') {
          this.deletionProgressMap.update(map => {
            const next = { ...map };
            delete next[clusterId];
            return next;
          });
          this.clustersList.update(clusters => clusters.filter(c => c.id !== clusterId));
          if (this.clusterInfo()?.id === clusterId) {
            this.clusterInfo.set(null);
          }
          this.infrastructureWs.unsubscribeFromResource(clusterId);
        } else if (status.status === 'FAILED') {
          this.deletionProgressMap.update(map => {
            const next = { ...map };
            delete next[clusterId];
            return next;
          });
          this.clustersList.update(clusters =>
            clusters.map(c => c.id === clusterId ? { ...c, status: ClusterStatus.ERROR } : c)
          );
          this.error.set(status.errorMessage || 'Cluster deletion failed');
          this.infrastructureWs.unsubscribeFromResource(clusterId);
        } else {
          setTimeout(() => poll(), POLL_INTERVAL);
        }
      } catch {
        // Transient error — keep polling
        setTimeout(() => poll(), POLL_INTERVAL);
      }
    };

    setTimeout(() => poll(), POLL_INTERVAL);
  }

  /**
   * Download kubeconfig for a cluster
   */
  async downloadKubeconfig(clusterId: string): Promise<string> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.clustersApi.clustersControllerGetKubeconfig(clusterId)
      );

      return response.kubeconfig || "";
    } catch (error: any) {
      const errorMessage = error?.error?.message || error.message || 'Failed to download kubeconfig';
      console.error('❌ Failed to download kubeconfig:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Helper to download kubeconfig file
   */
  downloadKubeconfigFile(kubeconfig: string, clusterName: string): void {
    const blob = new Blob([kubeconfig], { type: 'text/yaml' });
    const url = globalThis.window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kubeconfig-${clusterName}.yaml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    globalThis.window.URL.revokeObjectURL(url);
  }

  async scaleCluster(nodeCount: number): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      await this.delay(1500);

      this.clusterInfo.update((cluster) =>
        cluster
          ? {
              ...cluster,
              status: ClusterStatus.SCALING,
              lastActivity: new Date(),
            }
          : null
      );

      // Simulate scaling process
      await this.delay(5000);

      this.clusterInfo.update((cluster) =>
        cluster
          ? {
              ...cluster,
              nodeCount,
              status: ClusterStatus.ACTIVE,
              lastActivity: new Date(),
            }
          : null
      );
    } catch (error: any) {
      this.error.set(error.message || 'Failed to scale cluster');
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  // Creation steps management - now handled dynamically via addDynamicStep()

  private updateCreationStep(
    stepId: string,
    updates: Partial<ClusterCreationStep>
  ): void {
    this.creationSteps.update((steps) =>
      steps.map((step) => (step.id === stepId ? { ...step, ...updates } : step))
    );
  }

  // Metrics and monitoring
  getClusterMetrics(): Observable<ClusterMetrics> {
    return interval(5000).pipe(
      map(() => ({
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        diskUsage: Math.random() * 100,
        networkIn: Math.random() * 1000,
        networkOut: Math.random() * 1000,
        podCount: Math.floor(Math.random() * 50) + 10,
        serviceCount: Math.floor(Math.random() * 20) + 5,
        timestamp: new Date(),
      }))
    );
  }

  // Auto-scaling configuration
  async updateAutoScalingConfig(config: AutoScalingConfig): Promise<void> {
    this.isLoading.set(true);

    try {
      await this.delay(1000);

      this.clusterInfo.update((cluster) =>
        cluster
          ? {
              ...cluster,
              autoScalingEnabled: config.enabled,
              minNodes: config.minNodes,
              maxNodes: config.maxNodes,
              lastActivity: new Date(),
            }
          : null
      );
    } catch (error: any) {
      this.error.set(
        error.message || 'Failed to update auto-scaling configuration'
      );
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  // Utility methods
  getProviderDisplayName(provider?: ProviderType): string {
    switch (provider) {
      case ProviderType.HETZNER:
        return 'Hetzner Cloud';
      case ProviderType.CONTABO:
        return 'Contabo VPS';
      case ProviderType.SCALEWAY:
        return 'Scaleway';
      case ProviderType.OVH:
        return 'OVH Cloud';
      default:
        return 'Unknown Provider';
    }
  }


  /**
   * Stop a cluster (power off all servers)
   * Returns operation_id for tracking async operation
   */
  async stopCluster(clusterId: string): Promise<{ operationId: string }> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.clustersApi.clustersControllerStopCluster(clusterId)
      );

      // Update cluster status to STOPPING
      this.clustersList.update(clusters =>
        clusters.map(c =>
          c.id === clusterId ? { ...c, status: ClusterStatus.STOPPING } : c
        )
      );

      const current = this.clusterInfo();
      if (current?.id === clusterId) {
        this.clusterInfo.update(cluster =>
          cluster ? { ...cluster, status: ClusterStatus.STOPPING } : null
        );
      }

      // Start polling operation status
      if (response.operation_id) {
        this.pollOperationStatus(response.operation_id, clusterId, 'stop');
      }

      return { operationId: response.operation_id };
    } catch (error: any) {
      const errorMessage = error?.error?.message || error.message || 'Failed to stop cluster';
      console.error('❌ Cluster stop failed:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Start a cluster (power on all servers)
   * Returns operation_id for tracking async operation
   */
  async startCluster(clusterId: string): Promise<{ operationId: string }> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.clustersApi.clustersControllerStartCluster(clusterId)
      );

      // Update cluster status to STARTING
      this.clustersList.update(clusters =>
        clusters.map(c =>
          c.id === clusterId ? { ...c, status: ClusterStatus.STARTING } : c
        )
      );

      const current = this.clusterInfo();
      if (current?.id === clusterId) {
        this.clusterInfo.update(cluster =>
          cluster ? { ...cluster, status: ClusterStatus.STARTING } : null
        );
      }

      // Start polling operation status
      if (response.operation_id) {
        this.pollOperationStatus(response.operation_id, clusterId, 'start');
      }

      return { operationId: response.operation_id };
    } catch (error: any) {
      const errorMessage = error?.error?.message || error.message || 'Failed to start cluster';
      console.error('❌ Cluster start failed:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Reconcile cluster status with provider
   * Detects if servers were stopped/started manually outside Flui
   * Optional autoFix will align server states to match DB
   */
  async reconcileClusterStatus(clusterId: string, autoFix: boolean = false): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.clustersApi.clustersControllerReconcileClusterStatus(
          clusterId,
          autoFix ? { autoFix: true } : undefined
        )
      );

      // Update cluster status if it changed
      if (response.new_status && response.new_status !== response.previous_status) {
        const newStatus = this.mapApiStatusToClusterStatus(response.new_status);

        this.clustersList.update(clusters =>
          clusters.map(c =>
            c.id === clusterId ? { ...c, status: newStatus } : c
          )
        );

        const current = this.clusterInfo();
        if (current?.id === clusterId) {
          this.clusterInfo.update(cluster =>
            cluster ? { ...cluster, status: newStatus } : null
          );
        }
      }

      return response;
    } catch (error: any) {
      const errorMessage = error?.error?.message || error.message || 'Failed to reconcile cluster status';
      console.error('❌ Cluster reconciliation failed:', error);
      this.error.set(errorMessage);
      throw error;
    }
  }

  // Test helpers - for development only
  setClusterStatus(status: ClusterStatus): void {
    this.clusterInfo.update((cluster) =>
      cluster ? { ...cluster, status } : { status }
    );
  }

  simulateError(message: string): void {
    this.error.set(message);
  }

  clearError(): void {
    this.error.set(null);
  }

  clearAttachVNetState(): void {
    this.attachVNetInProgress.set(false);
    this.attachVNetProgressSig.set(0);
    this.attachVNetMessageSig.set('');
    this.attachVNetCurrentStepSig.set(0);
    this.attachVNetTotalStepsSig.set(0);
    this.attachVNetErrorSig.set(null);
  }

  /**
   * Attach an existing cluster to a VNet/subnet.
   * Resolves to the operation id once the API accepts the request; the
   * Promise additionally settles when the WebSocket reports completion or
   * failure (via the returned `done` promise).
   */
  attachVNet(
    clusterId: string,
    payload: { vnetId: string; subnetId?: string; autoAssignIp?: boolean },
  ): { started: Promise<{ operationId: string }>; done: Promise<void> } {
    this.clearAttachVNetState();
    this.attachVNetInProgress.set(true);

    let resolveDone!: () => void;
    let rejectDone!: (err: Error) => void;
    const done = new Promise<void>((res, rej) => {
      resolveDone = res;
      rejectDone = rej;
    });

    const dto: UpdateClusterVNetDto = {
      vnetId: payload.vnetId,
      subnetId: payload.subnetId,
      autoAssignIp: payload.autoAssignIp,
    };

    const started = (async () => {
      try {
        const response = await firstValueFrom(
          this.clustersApi.clustersControllerAttachClusterToVNet(clusterId, dto),
        );

        const operationId = response.operationId;

        this.infrastructureWs.subscribeToOperation(operationId, {
          onProgress: (event) => {
            this.attachVNetProgressSig.set(event.percentage);
            this.attachVNetCurrentStepSig.set(event.currentStepIndex);
            this.attachVNetTotalStepsSig.set(event.totalSteps);
            this.attachVNetMessageSig.set(event.message);
          },
          onCompleted: () => {
            this.infrastructureWs.unsubscribeFromOperation(operationId);
            this.attachVNetProgressSig.set(100);
            this.attachVNetInProgress.set(false);
            // Refresh cluster details so vnetId/vnetName populate
            void this.fetchClusterDetails(clusterId).finally(() => resolveDone());
          },
          onFailed: (event) => {
            this.infrastructureWs.unsubscribeFromOperation(operationId);
            this.attachVNetInProgress.set(false);
            const message = event.error || 'Failed to attach VNet';
            this.attachVNetErrorSig.set(message);
            rejectDone(new Error(message));
          },
        });

        return { operationId };
      } catch (error: any) {
        this.attachVNetInProgress.set(false);
        const message = this.mapAttachVNetError(error);
        this.attachVNetErrorSig.set(message);
        rejectDone(new Error(message));
        throw new Error(message);
      }
    })();

    return { started, done };
  }

  private mapAttachVNetError(error: unknown): string {
    const err = error as { status?: number; error?: { message?: string }; message?: string };
    const status = err?.status;
    const backendMessage = err?.error?.message || err?.message;
    if (status === 409) {
      return backendMessage
        || 'Cluster is already attached to a different VNet. Detach the current VNet first (not yet supported).';
    }
    if (status === 404) {
      return backendMessage || 'Cluster or VNet not found.';
    }
    if (status === 400) {
      return backendMessage || 'VNet attachment rejected by the provider.';
    }
    return backendMessage || 'Failed to attach VNet';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
