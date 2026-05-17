import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, signal, computed, inject } from '@angular/core';
import { RolloutState } from '../../service/app-runtime.service';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideRefreshCw,
  lucideMinus,
  lucidePlus,
  lucideAlertTriangle,
  lucideRotateCcw,
  lucideLoader,
  lucideCpu,
  lucidePencil,
  lucideX,
  lucideCheck,
} from '@ng-icons/lucide';
import { AppRuntimeResponseDto } from '../../../core/api/model/appRuntimeResponseDto';
import { UpdateResourcesDto } from '../../../core/api/model/updateResourcesDto';
import { UpdateReplicasDto } from '../../../core/api/model/updateReplicasDto';
import { ResourceSliderComponent } from './resource-slider.component';
import { ApplicationMonitoringService } from '../../service/application-monitoring.service';

@Component({
  selector: 'app-resources-editor',
  standalone: true,
  imports: [CommonModule, NgIconComponent, ResourceSliderComponent],
  providers: [
    provideIcons({
      lucideRefreshCw, lucideMinus, lucidePlus, lucideAlertTriangle,
      lucideRotateCcw, lucideLoader, lucideCpu,
      lucidePencil, lucideX, lucideCheck,
    }),
  ],
  template: `
    <div class="space-y-4">

      <!-- ── Top bar: Refresh ── -->
      <div class="flex justify-end">
        <button type="button" (click)="onRefresh()" [disabled]="savingReplicas || savingResources || savingRestart"
          class="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50">
          <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" />
          Refresh runtime data
        </button>
      </div>

      <!-- ── Restart card ── -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden transition-colors"
           [class]="restartRollout ? 'border-blue-300 dark:border-blue-700' : 'border-gray-200 dark:border-gray-700'">
        <div class="flex items-center justify-between px-5 py-4">
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">Rolling Restart</p>
            @if (restartRollout) {
              <p class="text-xs text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
                {{ restartRollout.message }} — {{ restartRollout.readyReplicas }}/{{ restartRollout.desiredReplicas }} ready
              </p>
            } @else {
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Zero-downtime restart via rolling update</p>
            }
          </div>
          @if (restartRollout) {
            <!-- no button during rollout -->
          } @else if (!confirmRestart()) {
            <button type="button" (click)="promptRestart()" [disabled]="savingRestart"
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors">
              <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" />
              Restart
            </button>
          } @else {
            <div class="flex items-center gap-2">
              <span class="text-xs text-amber-600 dark:text-amber-400 font-medium">Confirm restart?</span>
              <button type="button" (click)="confirmRestartAction()" [disabled]="savingRestart"
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-50 transition-colors">
                @if (savingRestart) { <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" /> }
                Yes, Restart
              </button>
              <button type="button" (click)="cancelRestart()"
                class="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          }
        </div>
        @if (restartRollout) {
          <div class="h-1 w-full bg-blue-100 dark:bg-blue-900/40 overflow-hidden">
            <div class="h-1 w-1/3 bg-blue-500 dark:bg-blue-400 animate-indeterminate"></div>
          </div>
        }
      </div>

      <!-- ── Replicas card ── -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Replicas</span>
            @if (runtime) {
              <div class="flex items-center gap-2 text-xs">
                <span class="flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                  <span class="text-gray-500 dark:text-gray-400">desired</span>
                  <strong class="text-gray-900 dark:text-white">{{ runtime.replicas.desired ?? '—' }}</strong>
                </span>
                <span class="flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full" [class]="readyDot()"></span>
                  <span class="text-gray-500 dark:text-gray-400">ready</span>
                  <strong [class]="readyColor()">{{ runtime.replicas.ready ?? '—' }}</strong>
                </span>
                <span class="flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  <span class="text-gray-500 dark:text-gray-400">available</span>
                  <strong class="text-gray-900 dark:text-white">{{ runtime.replicas.available ?? '—' }}</strong>
                </span>
              </div>
            }
          </div>
          <!-- Edit / Save-Cancel toggle -->
          @if (!replicaEditing()) {
            <button type="button" (click)="startReplicaEdit()" [disabled]="savingReplicas || !runtime"
              class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-40">
              <ng-icon name="lucidePencil" class="h-3.5 w-3.5" />
              Edit
            </button>
          } @else {
            <div class="flex items-center gap-1">
              <button type="button" (click)="cancelReplicaEdit()"
                class="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg transition-colors">
                <ng-icon name="lucideX" class="h-3.5 w-3.5" />
                Cancel
              </button>
              <button type="button" (click)="applyReplicas()" [disabled]="!replicaDirty() || savingReplicas"
                class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40 transition-colors">
                @if (savingReplicas) { <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" /> }
                @else { <ng-icon name="lucideCheck" class="h-3.5 w-3.5" /> }
                Apply
              </button>
            </div>
          }
        </div>

        <div class="px-5 py-4">
          <div class="flex items-center gap-3">
            <button type="button" (click)="decReplicas()"
              [disabled]="!replicaEditing() || replicaValue() <= 0 || savingReplicas"
              class="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ng-icon name="lucideMinus" class="h-4 w-4" />
            </button>
            <span class="text-2xl font-bold text-gray-900 dark:text-white w-8 text-center select-none">{{ replicaValue() }}</span>
            <button type="button" (click)="incReplicas()"
              [disabled]="!replicaEditing() || replicaValue() >= 20 || savingReplicas"
              class="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ng-icon name="lucidePlus" class="h-4 w-4" />
            </button>
            <span class="text-sm text-gray-400 dark:text-gray-500">replica{{ replicaValue() !== 1 ? 's' : '' }}</span>
            @if (rollout?.operation === 'scale') {
              <span class="ml-auto text-xs text-blue-600 dark:text-blue-400 font-mono">
                {{ rollout!.readyReplicas }}/{{ rollout!.desiredReplicas }} ready
              </span>
            }
          </div>
          @if (replicaEditing() && replicaValue() === 0) {
            <div class="flex items-center gap-1.5 mt-2 text-xs text-amber-600 dark:text-amber-400">
              <ng-icon name="lucideAlertTriangle" class="h-3.5 w-3.5 flex-shrink-0" />
              Setting replicas to 0 stops the application without deleting it
            </div>
          }
          @if (rollout?.operation === 'scale') {
            <div class="mt-3 h-1 w-full bg-blue-100 dark:bg-blue-900/40 rounded-full overflow-hidden">
              <div class="h-1 w-1/3 bg-blue-500 dark:bg-blue-400 rounded-full animate-indeterminate"></div>
            </div>
          }
        </div>
      </div>

      <!-- ── Container Resources cards ── -->
      @if (runtime && runtime.containers.length > 0) {
        @for (container of runtime.containers; track container.name; let i = $index) {
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

            <!-- Container header -->
            <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
              <div class="flex items-center gap-2">
                <ng-icon name="lucideCpu" class="h-3.5 w-3.5 text-gray-400" />
                <span class="text-xs font-semibold text-gray-900 dark:text-white font-mono">{{ container.name }}</span>
                <span class="text-xs text-gray-400 dark:text-gray-500 font-mono truncate max-w-48">{{ container.image }}</span>
              </div>

              @if (editingContainerIndex() !== i) {
                <button type="button" (click)="startResourceEdit(i)" [disabled]="savingResources"
                  class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-40">
                  <ng-icon name="lucidePencil" class="h-3.5 w-3.5" />
                  Edit
                </button>
              } @else {
                <div class="flex items-center gap-1">
                  <button type="button" (click)="cancelResourceEdit()"
                    class="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg transition-colors">
                    <ng-icon name="lucideX" class="h-3.5 w-3.5" />
                    Cancel
                  </button>
                  <button type="button" (click)="saveResources(i)" [disabled]="!resourcesDirty() || savingResources"
                    class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    @if (savingResources) { <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" /> }
                    @else { <ng-icon name="lucideCheck" class="h-3.5 w-3.5" /> }
                    Save
                  </button>
                </div>
              }
            </div>

            <!-- Sliders — always shown, disabled when not editing this container -->
            <div class="px-5 py-5">
              <div class="grid grid-cols-2 gap-x-8">

                <!-- CPU column -->
                <div class="space-y-6">
                  @if (monitoringService.metrics(); as m) {
                    <div class="flex items-center gap-1.5 text-xs">
                      <span class="text-gray-400 dark:text-gray-500">Usage:</span>
                      <span class="font-mono font-semibold" [class]="usageColor(cpuUsagePercent(m))">{{ formatCpuCores(m.cpu.usage_cores) }}</span>
                      <span class="text-gray-300 dark:text-gray-600">({{ cpuUsagePercent(m).toFixed(1) }}%)</span>
                    </div>
                  }
                  <app-resource-slider
                    label="CPU Reserved"
                    type="cpu"
                    [value]="i === 0 ? cpuRequest() : (container.requests.cpu ?? '')"
                    [maxValue]="maxCpuMc"
                    [disabled]="editingContainerIndex() !== i || savingResources"
                    (valueChange)="setCpuRequest($event)"
                  />
                  @if (monitoringService.metrics(); as m) {
                    @if (requestHint(cpuRequestPercent(m), 'CPU', m.cpu.requests_cores ?? 0); as msg) {
                      <div class="flex items-start gap-1.5 text-xs rounded-lg px-2.5 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                        <ng-icon name="lucideAlertTriangle" class="h-3 w-3 mt-0.5 flex-shrink-0" />
                        {{ msg }}
                      </div>
                    }
                  }
                  <app-resource-slider
                    label="CPU Maximum"
                    type="cpu"
                    [value]="i === 0 ? cpuLimit() : (container.limits.cpu ?? '')"
                    [maxValue]="maxCpuMc"
                    [disabled]="editingContainerIndex() !== i || savingResources"
                    (valueChange)="setCpuLimit($event)"
                  />
                  @if (monitoringService.metrics(); as m) {
                    @if (resourceHint(cpuUsagePercent(m), 'CPU'); as hint) {
                      <div class="flex items-start gap-1.5 text-xs rounded-lg px-2.5 py-2" [class]="hintClass(hint.level)">
                        <ng-icon name="lucideAlertTriangle" class="h-3 w-3 mt-0.5 flex-shrink-0" />
                        {{ hint.message }}
                      </div>
                    }
                  }
                </div>

                <!-- Memory column -->
                <div class="space-y-6">
                  @if (monitoringService.metrics(); as m) {
                    <div class="flex items-center gap-1.5 text-xs">
                      <span class="text-gray-400 dark:text-gray-500">Usage:</span>
                      <span class="font-mono font-semibold" [class]="usageColor(memUsagePercent(m))">{{ formatMemBytes(m.memory.usage_bytes) }}</span>
                      <span class="text-gray-300 dark:text-gray-600">({{ memUsagePercent(m).toFixed(1) }}%)</span>
                    </div>
                  }
                  <app-resource-slider
                    label="Memory Reserved"
                    type="memory"
                    [value]="i === 0 ? memRequest() : (container.requests.memory ?? '')"
                    [maxValue]="maxMemMib"
                    [disabled]="editingContainerIndex() !== i || savingResources"
                    (valueChange)="setMemRequest($event)"
                  />
                  @if (monitoringService.metrics(); as m) {
                    @if (requestHint(memRequestPercent(m), 'Memory', m.memory.requests_bytes ?? 0); as msg) {
                      <div class="flex items-start gap-1.5 text-xs rounded-lg px-2.5 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                        <ng-icon name="lucideAlertTriangle" class="h-3 w-3 mt-0.5 flex-shrink-0" />
                        {{ msg }}
                      </div>
                    }
                  }
                  <app-resource-slider
                    label="Memory Maximum"
                    type="memory"
                    [value]="i === 0 ? memLimit() : (container.limits.memory ?? '')"
                    [maxValue]="maxMemMib"
                    [disabled]="editingContainerIndex() !== i || savingResources"
                    (valueChange)="setMemLimit($event)"
                  />
                  @if (monitoringService.metrics(); as m) {
                    @if (resourceHint(memUsagePercent(m), 'Memory'); as hint) {
                      <div class="flex items-start gap-1.5 text-xs rounded-lg px-2.5 py-2" [class]="hintClass(hint.level)">
                        <ng-icon name="lucideAlertTriangle" class="h-3 w-3 mt-0.5 flex-shrink-0" />
                        {{ hint.message }}
                      </div>
                    }
                  }
                </div>

              </div>
            </div>

            @if (resourcesRollout) {
              <div class="px-5 pb-3">
                <p class="text-xs text-blue-600 dark:text-blue-400 font-mono mb-2">
                  {{ resourcesRollout.message }} — {{ resourcesRollout.readyReplicas }}/{{ resourcesRollout.desiredReplicas }} ready
                </p>
              </div>
              <div class="h-1 w-full bg-blue-100 dark:bg-blue-900/40 overflow-hidden">
                <div class="h-1 w-1/3 bg-blue-500 dark:bg-blue-400 animate-indeterminate"></div>
              </div>
            }

          </div>
        }
      } @else if (!runtime) {
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-8 text-center">
          <p class="text-sm text-gray-400 dark:text-gray-500">Runtime data not available</p>
        </div>
      }

    </div>
  `,
})
export class AppResourcesEditorComponent implements OnChanges {
  @Input() runtime: AppRuntimeResponseDto | null = null;
  @Input() savingReplicas = false;
  @Input() savingResources = false;
  @Input() savingRestart = false;
  @Input() maxCpuMc = 4000;
  @Input() maxMemMib = 4096;
  @Input() rollout: RolloutState | null = null;

  protected get restartRollout(): RolloutState | null {
    return this.rollout?.operation === 'restart' ? this.rollout : null;
  }

  protected get resourcesRollout(): RolloutState | null {
    return this.rollout?.operation === 'update-resources' ? this.rollout : null;
  }

  protected monitoringService = inject(ApplicationMonitoringService);

  @Output() saveResourcesEvent = new EventEmitter<UpdateResourcesDto>();
  @Output() saveReplicasEvent = new EventEmitter<UpdateReplicasDto>();
  @Output() restartEvent = new EventEmitter<void>();
  @Output() refreshEvent = new EventEmitter<void>();

  // Replica state
  protected replicaEditing = signal(false);
  protected replicaValue = signal(1);
  protected originalReplicas = 1;

  // Resource edit — which container is being edited (-1 = none)
  protected editingContainerIndex = signal(-1);

  // CPU/Memory signals for container 0 (most common case; multi-container uses direct container values)
  protected cpuRequest = signal('');
  protected cpuLimit = signal('');
  protected memRequest = signal('');
  protected memLimit = signal('');
  private originalCpuRequest = '';
  private originalCpuLimit = '';
  private originalMemRequest = '';
  private originalMemLimit = '';

  // UI
  protected confirmRestart = signal(false);

  // Dirty
  protected replicaDirty = computed(() => this.replicaValue() !== this.originalReplicas);
  protected resourcesDirty = computed(() =>
    this.cpuRequest() !== this.originalCpuRequest ||
    this.cpuLimit() !== this.originalCpuLimit ||
    this.memRequest() !== this.originalMemRequest ||
    this.memLimit() !== this.originalMemLimit
  );

  protected readyColor = computed(() => {
    const desired = this.runtime?.replicas?.desired ?? 0;
    const ready = this.runtime?.replicas?.ready ?? 0;
    if (ready === 0) return 'font-semibold text-red-500 dark:text-red-400';
    if (ready < desired) return 'font-semibold text-amber-500 dark:text-amber-400';
    return 'font-semibold text-green-600 dark:text-green-400';
  });

  protected readyDot = computed(() => {
    const desired = this.runtime?.replicas?.desired ?? 0;
    const ready = this.runtime?.replicas?.ready ?? 0;
    if (ready === 0) return 'w-1.5 h-1.5 rounded-full bg-red-400';
    if (ready < desired) return 'w-1.5 h-1.5 rounded-full bg-amber-400';
    return 'w-1.5 h-1.5 rounded-full bg-green-400';
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['runtime'] && this.runtime) {
      // Replicas
      const desired = this.runtime.replicas?.desired ?? 1;
      this.originalReplicas = desired;
      this.replicaValue.set(desired);
      this.replicaEditing.set(false);

      // Load container 0 values into signals (displayed as default for all edit operations)
      const c = this.runtime.containers[0];
      if (c) {
        this.originalCpuRequest = c.requests?.cpu ?? '250m';
        this.originalCpuLimit = c.limits?.cpu ?? '500m';
        this.originalMemRequest = c.requests?.memory ?? '256Mi';
        this.originalMemLimit = c.limits?.memory ?? '512Mi';
        this.cpuRequest.set(this.originalCpuRequest);
        this.cpuLimit.set(this.originalCpuLimit);
        this.memRequest.set(this.originalMemRequest);
        this.memLimit.set(this.originalMemLimit);
      }
      this.editingContainerIndex.set(-1);
    }
  }

  // ── Replica edit ──
  protected startReplicaEdit(): void { this.replicaEditing.set(true); }
  protected cancelReplicaEdit(): void {
    this.replicaValue.set(this.originalReplicas);
    this.replicaEditing.set(false);
  }
  protected decReplicas(): void { if (this.replicaValue() > 0) this.replicaValue.update(v => v - 1); }
  protected incReplicas(): void { if (this.replicaValue() < 20) this.replicaValue.update(v => v + 1); }
  protected applyReplicas(): void {
    this.saveReplicasEvent.emit({ replicas: this.replicaValue() });
    this.originalReplicas = this.replicaValue();
    this.replicaEditing.set(false);
  }

  // ── Resource edit ──
  protected startResourceEdit(containerIndex: number): void {
    const c = this.runtime?.containers[containerIndex];
    if (!c) return;
    this.originalCpuRequest = c.requests?.cpu ?? '250m';
    this.originalCpuLimit = c.limits?.cpu ?? '500m';
    this.originalMemRequest = c.requests?.memory ?? '256Mi';
    this.originalMemLimit = c.limits?.memory ?? '512Mi';
    this.cpuRequest.set(this.originalCpuRequest);
    this.cpuLimit.set(this.originalCpuLimit);
    this.memRequest.set(this.originalMemRequest);
    this.memLimit.set(this.originalMemLimit);
    this.editingContainerIndex.set(containerIndex);
  }

  protected cancelResourceEdit(): void {
    // Reset to originals
    this.cpuRequest.set(this.originalCpuRequest);
    this.cpuLimit.set(this.originalCpuLimit);
    this.memRequest.set(this.originalMemRequest);
    this.memLimit.set(this.originalMemLimit);
    this.editingContainerIndex.set(-1);
  }

  protected saveResources(containerIndex: number): void {
    const containerName = this.runtime?.containers[containerIndex]?.name;
    const dto: UpdateResourcesDto = {
      containerName,
      requests: { cpu: this.cpuRequest() || undefined, memory: this.memRequest() || undefined },
      limits: { cpu: this.cpuLimit() || undefined, memory: this.memLimit() || undefined },
    };
    this.saveResourcesEvent.emit(dto);
    this.editingContainerIndex.set(-1);
  }

  protected setCpuRequest(v: string): void { this.cpuRequest.set(v); }
  protected setCpuLimit(v: string): void { this.cpuLimit.set(v); }
  protected setMemRequest(v: string): void { this.memRequest.set(v); }
  protected setMemLimit(v: string): void { this.memLimit.set(v); }

  // ── Restart ──
  protected promptRestart(): void { this.confirmRestart.set(true); }
  protected cancelRestart(): void { this.confirmRestart.set(false); }
  protected confirmRestartAction(): void { this.confirmRestart.set(false); this.restartEvent.emit(); }

  protected onRefresh(): void { this.refreshEvent.emit(); }

  // ── Monitoring helpers ──
  protected cpuUsagePercent(m: { cpu: { usage_cores: number | null; limits_cores: number | null } }): number {
    const u = m.cpu.usage_cores ?? 0;
    const l = m.cpu.limits_cores ?? 0;
    return l > 0 ? (u / l) * 100 : 0;
  }

  protected cpuRequestPercent(m: { cpu: { usage_cores: number | null; requests_cores: number | null } }): number {
    const u = m.cpu.usage_cores ?? 0;
    const r = m.cpu.requests_cores ?? 0;
    return r > 0 ? (u / r) * 100 : 0;
  }

  protected memUsagePercent(m: { memory: { usage_bytes: number | null; limits_bytes: number | null } }): number {
    const u = m.memory.usage_bytes ?? 0;
    const l = m.memory.limits_bytes ?? 0;
    return l > 0 ? (u / l) * 100 : 0;
  }

  protected memRequestPercent(m: { memory: { usage_bytes: number | null; requests_bytes: number | null } }): number {
    const u = m.memory.usage_bytes ?? 0;
    const r = m.memory.requests_bytes ?? 0;
    return r > 0 ? (u / r) * 100 : 0;
  }

  protected requestHint(pct: number, resource: 'CPU' | 'Memory', requestsValue: number): string | null {
    const minCpuMc = 100;   // below 100m requests is already low — no hint
    const minMemMib = 128;  // below 128 MiB requests is already low — no hint
    if (resource === 'CPU' && requestsValue * 1000 < minCpuMc) return null;
    if (resource === 'Memory' && requestsValue / (1024 * 1024) < minMemMib) return null;
    if (pct > 0 && pct < 15) return `${resource} requests much higher than actual usage — wasting node resources`;
    return null;
  }

  protected usageColor(pct: number): string {
    if (pct >= 90) return 'text-red-600 dark:text-red-400';
    if (pct >= 70) return 'text-orange-500 dark:text-orange-400';
    return 'text-green-600 dark:text-green-400';
  }

  protected resourceHint(pct: number, resource: 'CPU' | 'Memory'): { level: 'low' | 'warn' | 'critical'; message: string } | null {
    if (pct >= 90) return { level: 'critical', message: `${resource} limit almost reached — risk of ${resource === 'CPU' ? 'throttling' : 'OOM kill'}` };
    if (pct >= 70) return { level: 'warn', message: `${resource} usage at ${pct.toFixed(0)}% of limit — consider increasing` };
    if (pct > 0 && pct < 15) return { level: 'low', message: `${resource} limit is much higher than actual usage — consider reducing` };
    return null;
  }

  protected hintClass(level: 'low' | 'warn' | 'critical'): string {
    if (level === 'critical') return 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400';
    if (level === 'warn') return 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400';
    return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400';
  }

  protected formatCpuCores(cores: number | null): string {
    const c = cores ?? 0;
    if (c >= 1) return `${c.toFixed(2)} cores`;
    return `${(c * 1000).toFixed(0)}m`;
  }

  protected formatMemBytes(bytes: number | null): string {
    const b = bytes ?? 0;
    if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
    if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MiB`;
    if (b >= 1024) return `${(b / 1024).toFixed(1)} KiB`;
    return `${b.toFixed(0)} B`;
  }
}
