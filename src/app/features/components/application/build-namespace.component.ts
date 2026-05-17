import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import {
  lucideHammer,
  lucideLoader,
  lucideRefreshCw,
  lucideTriangleAlert,
  lucideCheck,
  lucideTrash2,
  lucideX,
  lucidePackage,
  lucideCpu,
  lucideServer,
} from '@ng-icons/lucide';
import { BuildNamespaceService } from '../../../core/api/api/buildNamespace.service';
import { BuildCachePanelComponent } from './build-cache-panel.component';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';
import { BuildNamespaceResourcesResponseDto } from '../../../core/api/model/buildNamespaceResourcesResponseDto';
import { BuildNamespaceCleanupResultDto } from '../../../core/api/model/buildNamespaceCleanupResultDto';
import { BuildJobInfoDto } from '../../../core/api/model/buildJobInfoDto';
import { QueuedBuildInfoDto } from '../../../core/api/model/queuedBuildInfoDto';
import { ClusterResponseDto } from '../../../core/api/model/clusterResponseDto';

function formatAge(minutes: number): string {
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getJobStatusClass(status: BuildJobInfoDto['status']): string {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
  switch (status) {
    case 'Running':   return `${base} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`;
    case 'Pending':   return `${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300`;
    case 'Succeeded': return `${base} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`;
    case 'Failed':
    case 'Unknown':
    default:          return `${base} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`;
  }
}

function getQueuedStatusClass(status: QueuedBuildInfoDto['status']): string {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
  switch (status) {
    case 'PENDING':   return `${base} bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300`;
    case 'CLONING':
    case 'ANALYZING':
    case 'BUILDING':
    case 'PUSHING':   return `${base} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`;
    default:          return `${base} bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400`;
  }
}

function getQueuedStatusLabel(status: QueuedBuildInfoDto['status']): string {
  switch (status) {
    case 'PENDING':   return 'Queued';
    case 'CLONING':   return 'Cloning';
    case 'ANALYZING': return 'Analyzing';
    case 'BUILDING':  return 'Building';
    case 'PUSHING':   return 'Pushing';
    default:          return status;
  }
}

function getPodPhaseClass(phase: string): string {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
  switch (phase) {
    case 'Running':   return `${base} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`;
    case 'Pending':   return `${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300`;
    case 'Succeeded': return `${base} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`;
    default:          return `${base} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`;
  }
}

@Component({
  selector: 'app-build-namespace',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon, BuildCachePanelComponent],
  providers: [
    provideIcons({
      lucideHammer, lucideLoader, lucideRefreshCw, lucideTriangleAlert,
      lucideCheck, lucideTrash2, lucideX, lucidePackage, lucideCpu, lucideServer,
    }),
  ],
  template: `
    <div class="p-6 space-y-6 max-w-6xl mx-auto">

      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
          <ng-icon name="lucideHammer" class="h-6 w-6" />
          Build Queue
        </h1>
        <p class="text-sm text-muted-foreground mt-1">
          Active build tasks and workers running on the selected cluster
        </p>
      </div>

      <!-- Cluster selector + actions -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <label class="text-sm font-medium">Cluster</label>
          @if (isLoadingClusters()) {
            <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin text-muted-foreground" />
          } @else {
            <select
              [ngModel]="selectedClusterId()"
              (ngModelChange)="onClusterChange($event)"
              class="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option [value]="null" disabled>Select a cluster...</option>
              @for (c of clusters(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          }
        </div>

        @if (selectedClusterId()) {
          <button (click)="loadResources()" [disabled]="isLoadingResources()"
            class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ng-icon name="lucideRefreshCw" [class]="isLoadingResources() ? 'animate-spin' : ''" class="h-4 w-4 mr-1.5" />
            Refresh
          </button>

          @if (!showCleanupPanel()) {
            <button (click)="showCleanupPanel.set(true)"
              class="inline-flex items-center px-3 py-1.5 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors">
              <ng-icon name="lucideTrash2" class="h-4 w-4 mr-1.5 text-red-500" />
              Cleanup...
            </button>
          }
        }

        <!-- Resource totals -->
        @if (resources()) {
          <span class="text-xs text-muted-foreground ml-auto">
            {{ resources()!.queuedBuilds.length }} queued ·
            {{ resources()!.jobs.length }} running ·
            {{ resources()!.totalCpuRequestMillicores }}m CPU · {{ resources()!.totalMemoryRequestMiB }} MiB RAM
          </span>
        }
      </div>

      <!-- Error -->
      @if (error()) {
        <div class="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          <ng-icon name="lucideTriangleAlert" class="h-4 w-4 flex-shrink-0" />
          {{ error() }}
        </div>
      }

      <!-- Cleanup panel -->
      @if (showCleanupPanel()) {
        <div class="bg-card border border-border rounded-lg p-4 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-medium text-sm">Clean Up Stale Builds</h3>
            <button (click)="cancelCleanup()" class="text-muted-foreground hover:text-foreground">
              <ng-icon name="lucideX" class="h-4 w-4" />
            </button>
          </div>

          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground whitespace-nowrap">Older than</label>
            <input type="number" min="0"
              [ngModel]="olderThanMinutes()"
              (ngModelChange)="olderThanMinutes.set($event)"
              class="w-20 h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            <span class="text-sm text-muted-foreground">minutes (0 = all stale)</span>
            <button (click)="previewCleanup()" [disabled]="isRunningCleanup()"
              class="inline-flex items-center px-3 py-1.5 rounded-md bg-muted text-sm font-medium hover:bg-accent disabled:opacity-60 transition-colors">
              @if (isRunningCleanup() && !cleanupPreview()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 mr-1.5 animate-spin" />
              }
              Preview
            </button>
          </div>

          @if (cleanupPreview()) {
            <div class="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
              @if (cleanupPreview()!.deletedJobs.length === 0 && cleanupPreview()!.deletedPods.length === 0) {
                <p class="text-muted-foreground">Nothing stale to clean up.</p>
              } @else {
                @if (cleanupPreview()!.deletedJobs.length > 0) {
                  <div>
                    <span class="font-medium">Tasks to remove ({{ cleanupPreview()!.deletedJobs.length }}):</span>
                    <div class="mt-1 space-y-0.5">
                      @for (j of cleanupPreview()!.deletedJobs; track j) {
                        <div class="font-mono text-xs text-muted-foreground">{{ j }}</div>
                      }
                    </div>
                  </div>
                }
                @if (cleanupPreview()!.deletedPods.length > 0) {
                  <div>
                    <span class="font-medium">Workers to remove ({{ cleanupPreview()!.deletedPods.length }}):</span>
                    <div class="mt-1 space-y-0.5">
                      @for (p of cleanupPreview()!.deletedPods; track p) {
                        <div class="font-mono text-xs text-muted-foreground">{{ p }}</div>
                      }
                    </div>
                  </div>
                }
                <button (click)="confirmCleanup()" [disabled]="isRunningCleanup()"
                  class="inline-flex items-center px-4 py-1.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors mt-2">
                  @if (isRunningCleanup()) {
                    <ng-icon name="lucideLoader" class="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  } @else {
                    <ng-icon name="lucideTrash2" class="h-3.5 w-3.5 mr-1.5" />
                  }
                  Confirm Delete
                </button>
              }
            </div>
          }
        </div>
      }

      <!-- Build cache panel -->
      @if (selectedClusterId()) {
        <app-build-cache-panel [clusterId]="selectedClusterId()!" />
      }

      <!-- No cluster selected -->
      @if (!selectedClusterId() && !isLoadingClusters()) {
        <div class="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <ng-icon name="lucideServer" class="h-10 w-10 mb-3" />
          <p class="text-sm">Select a cluster to view active builds.</p>
        </div>
      }

      <!-- Loading resources -->
      @if (isLoadingResources() && !resources()) {
        <div class="flex items-center justify-center py-12 text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-5 w-5 animate-spin mr-2" />
          <span class="text-sm">Loading active builds...</span>
        </div>
      }

      @if (resources()) {

        <!-- Queued Builds table -->
        <div class="bg-card border border-border rounded-lg overflow-hidden">
          <div class="px-4 py-3 border-b border-border flex items-center gap-2">
            <ng-icon name="lucideLoader" class="h-4 w-4 text-muted-foreground" />
            <h2 class="font-semibold text-sm">Queue</h2>
            <span class="text-xs text-muted-foreground">({{ resources()!.queuedBuilds.length }})</span>
            <span class="text-xs text-muted-foreground ml-auto">Waiting to start — no worker allocated yet</span>
          </div>

          @if (resources()!.queuedBuilds.length > 0) {
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border bg-muted/40">
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">App</th>
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Branch</th>
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Commit</th>
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Waiting for</th>
                </tr>
              </thead>
              <tbody>
                @for (q of resources()!.queuedBuilds; track q.buildId) {
                  <tr class="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td class="px-4 py-2.5">
                      <span class="font-medium text-sm">{{ q.appSlug ?? '—' }}</span>
                    </td>
                    <td class="px-4 py-2.5 text-xs text-muted-foreground font-mono">{{ q.branch }}</td>
                    <td class="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                      {{ q.commitSha ? q.commitSha.substring(0, 7) : '—' }}
                    </td>
                    <td class="px-4 py-2.5">
                      <span [class]="getQueuedStatusClass(q.status)">{{ getQueuedStatusLabel(q.status) }}</span>
                    </td>
                    <td class="px-4 py-2.5 text-xs text-muted-foreground">{{ formatAge(q.ageMinutes) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="text-sm text-muted-foreground text-center py-6">Queue is empty.</p>
          }
        </div>

        <!-- Build Tasks table -->
        <div class="bg-card border border-border rounded-lg overflow-hidden">
          <div class="px-4 py-3 border-b border-border flex items-center gap-2">
            <ng-icon name="lucidePackage" class="h-4 w-4 text-muted-foreground" />
            <h2 class="font-semibold text-sm">Build Tasks</h2>
            <span class="text-xs text-muted-foreground">({{ resources()!.jobs.length }})</span>
          </div>

          @if (resources()!.jobs.length > 0) {
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border bg-muted/40">
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">ID</th>
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">App / Type</th>
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Running for</th>
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">CPU</th>
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Memory</th>
                </tr>
              </thead>
              <tbody>
                @for (job of resources()!.jobs; track job.name) {
                  <tr class="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td class="px-4 py-2.5">
                      <code class="text-xs font-mono text-muted-foreground">{{ job.buildId ?? job.name }}</code>
                    </td>
                    <td class="px-4 py-2.5 text-xs text-muted-foreground">
                      @if (job.appSlug) {
                        <span class="font-medium text-foreground">{{ job.appSlug }}</span>
                      } @else if (job.purpose) {
                        <span class="italic">{{ job.purpose }}</span>
                      } @else {
                        <span>—</span>
                      }
                    </td>
                    <td class="px-4 py-2.5">
                      <span [class]="getJobStatusClass(job.status)">{{ job.status }}</span>
                    </td>
                    <td class="px-4 py-2.5 text-xs text-muted-foreground">{{ formatAge(job.ageMinutes) }}</td>
                    <td class="px-4 py-2.5 text-xs font-mono text-muted-foreground">{{ job.cpuRequest }}</td>
                    <td class="px-4 py-2.5 text-xs font-mono text-muted-foreground">{{ job.memoryRequest }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="text-sm text-muted-foreground text-center py-8">No active build tasks.</p>
          }
        </div>

        <!-- Build Workers table -->
        <div class="bg-card border border-border rounded-lg overflow-hidden">
          <div class="px-4 py-3 border-b border-border flex items-center gap-2">
            <ng-icon name="lucideCpu" class="h-4 w-4 text-muted-foreground" />
            <h2 class="font-semibold text-sm">Build Workers</h2>
            <span class="text-xs text-muted-foreground">({{ resources()!.pods.length }})</span>
          </div>

          @if (resources()!.pods.length > 0) {
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border bg-muted/40">
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">ID</th>
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">App</th>
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Running for</th>
                  <th class="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Processes</th>
                </tr>
              </thead>
              <tbody>
                @for (pod of resources()!.pods; track pod.name) {
                  <tr class="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td class="px-4 py-2.5">
                      <code class="text-xs font-mono text-muted-foreground">{{ pod.buildId ?? pod.name }}</code>
                    </td>
                    <td class="px-4 py-2.5 text-xs text-muted-foreground">
                      {{ pod.appSlug ?? '—' }}
                    </td>
                    <td class="px-4 py-2.5">
                      <span [class]="getPodPhaseClass(pod.phase)">{{ pod.phase }}</span>
                    </td>
                    <td class="px-4 py-2.5 text-xs text-muted-foreground">{{ formatAge(pod.ageMinutes) }}</td>
                    <td class="px-4 py-2.5 text-xs text-muted-foreground">
                      @for (c of pod.containers; track c.name) {
                        <span class="inline-flex items-center mr-2">
                          <span [class]="c.ready ? 'text-green-500' : 'text-red-500'" class="mr-1">●</span>
                          {{ c.name }}
                        </span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="text-sm text-muted-foreground text-center py-8">No active workers.</p>
          }
        </div>

      }

    </div>
  `,
})
export class BuildNamespaceComponent implements OnInit {
  private readonly buildNamespaceApi = inject(BuildNamespaceService);
  private readonly clustersApi = inject(InfrastructureClustersService);

  clusters = signal<ClusterResponseDto[]>([]);
  selectedClusterId = signal<string | null>(null);
  resources = signal<BuildNamespaceResourcesResponseDto | null>(null);
  isLoadingClusters = signal(false);
  isLoadingResources = signal(false);
  error = signal<string | null>(null);
  cleanupPreview = signal<BuildNamespaceCleanupResultDto | null>(null);
  isRunningCleanup = signal(false);
  showCleanupPanel = signal(false);
  olderThanMinutes = signal(0);

  readonly formatAge = formatAge;
  readonly getJobStatusClass = getJobStatusClass;
  readonly getPodPhaseClass = getPodPhaseClass;
  readonly getQueuedStatusClass = getQueuedStatusClass;
  readonly getQueuedStatusLabel = getQueuedStatusLabel;

  ngOnInit(): void {
    void (async () => {
      this.isLoadingClusters.set(true);
      try {
        const list = await firstValueFrom(this.clustersApi.clustersControllerListClusters());
        this.clusters.set(list);
        if (list.length === 1) {
          this.selectedClusterId.set(list[0].id);
          await this.loadResources();
        }
      } catch (e: any) {
        this.error.set(e?.error?.message ?? 'Failed to load clusters');
      } finally {
        this.isLoadingClusters.set(false);
      }
    })();
  }

  async onClusterChange(clusterId: string): Promise<void> {
    this.selectedClusterId.set(clusterId);
    this.resources.set(null);
    this.cleanupPreview.set(null);
    this.showCleanupPanel.set(false);
    await this.loadResources();
  }

  async loadResources(): Promise<void> {
    const id = this.selectedClusterId();
    if (!id) return;
    this.isLoadingResources.set(true);
    this.error.set(null);
    try {
      const data = await firstValueFrom(
        this.buildNamespaceApi.buildNamespaceControllerGetNamespaceResources(id)
      );
      this.resources.set(data);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to load build resources');
    } finally {
      this.isLoadingResources.set(false);
    }
  }

  async previewCleanup(): Promise<void> {
    const id = this.selectedClusterId();
    if (!id) return;
    this.isRunningCleanup.set(true);
    this.cleanupPreview.set(null);
    try {
      const result = await firstValueFrom(
        this.buildNamespaceApi.buildNamespaceControllerCleanupNamespace(id, {
          olderThanMinutes: this.olderThanMinutes(),
          dryRun: true,
        })
      );
      this.cleanupPreview.set(result);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to run preview');
    } finally {
      this.isRunningCleanup.set(false);
    }
  }

  async confirmCleanup(): Promise<void> {
    const id = this.selectedClusterId();
    if (!id) return;
    this.isRunningCleanup.set(true);
    try {
      await firstValueFrom(
        this.buildNamespaceApi.buildNamespaceControllerCleanupNamespace(id, {
          olderThanMinutes: this.olderThanMinutes(),
          dryRun: false,
        })
      );
      this.cleanupPreview.set(null);
      this.showCleanupPanel.set(false);
      await this.loadResources();
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to clean up stale builds');
    } finally {
      this.isRunningCleanup.set(false);
    }
  }

  cancelCleanup(): void {
    this.showCleanupPanel.set(false);
    this.cleanupPreview.set(null);
  }
}
