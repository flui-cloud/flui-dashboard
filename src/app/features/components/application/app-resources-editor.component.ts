import { Component, Input, OnChanges, SimpleChanges, signal, computed, inject, input, output, ChangeDetectionStrategy } from '@angular/core';

import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { RouterLink } from '@angular/router';
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
import { ResourceQuantityFieldComponent } from './resource-quantity-field.component';
import { cpuMillicores, memoryMi } from './resource-quantity';
import { AppRuntimeService, PlacementVerdict, ResourcesConsequence, RolloutState } from '../../service/app-runtime.service';
import { ApplicationMonitoringService } from '../../service/application-monitoring.service';

@Component({
  selector: 'app-resources-editor',
  standalone: true,
  imports: [NgIconComponent, ResourceQuantityFieldComponent, RouterLink],
  providers: [
    provideIcons({
      lucideRefreshCw, lucideMinus, lucidePlus, lucideAlertTriangle,
      lucideRotateCcw, lucideLoader, lucideCpu,
      lucidePencil, lucideX, lucideCheck,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="space-y-4">

      <!-- ── Top bar: Refresh ── -->
      <div class="flex justify-end">
        <button type="button" (click)="onRefresh()" [disabled]="savingReplicas() || savingResources() || savingRestart()"
          class="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50">
          <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" />
          Refresh runtime data
        </button>
      </div>

      @if (restartRollout) {
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-blue-300 dark:border-blue-700 overflow-hidden" data-testid="restart-progress">
          <p class="px-5 py-3 text-xs text-blue-600 dark:text-blue-400 font-mono">
            Restarting — {{ restartRollout.message }} — {{ restartRollout.readyReplicas }}/{{ restartRollout.desiredReplicas }} ready
          </p>
          <div class="h-1 w-full bg-blue-100 dark:bg-blue-900/40 overflow-hidden">
            <div class="h-1 w-1/3 bg-blue-500 dark:bg-blue-400 animate-indeterminate"></div>
          </div>
        </div>
      }

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
            <button type="button" (click)="startReplicaEdit()" [disabled]="savingReplicas() || !runtime"
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
              <button type="button" (click)="applyReplicas()" [disabled]="!replicaDirty() || savingReplicas()"
                class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40 transition-colors">
                @if (savingReplicas()) { <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" /> }
                @else { <ng-icon name="lucideCheck" class="h-3.5 w-3.5" /> }
                Apply
              </button>
            </div>
          }
        </div>

        <div class="px-5 py-4">
          <div class="flex items-center gap-3">
            <button type="button" (click)="decReplicas()"
              [disabled]="!replicaEditing() || replicaValue() <= 0 || savingReplicas()"
              class="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ng-icon name="lucideMinus" class="h-4 w-4" />
            </button>
            <span class="text-2xl font-bold text-gray-900 dark:text-white w-8 text-center select-none">{{ replicaValue() }}</span>
            <button type="button" (click)="incReplicas()"
              [disabled]="!replicaEditing() || replicaValue() >= 20 || savingReplicas()"
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
          @if (roomWait(); as wait) {
            <div class="mt-3 flex flex-wrap items-start gap-x-2 gap-y-1 rounded-lg px-3 py-2 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300" data-testid="replicas-waiting-for-room">
              <ng-icon name="lucideLoader" class="h-3.5 w-3.5 mt-0.5 flex-shrink-0 animate-spin" />
              <span class="flex-1">{{ wait }}</span>
              @if (clusterId()) {
                <a [routerLink]="['/cluster', clusterId(), 'scaling']" class="font-medium underline underline-offset-2">Scaling</a>
              }
            </div>
          }
          @if (rollout?.operation === 'scale' && !roomWait()) {
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

            <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
              <div class="flex items-center gap-2 min-w-0">
                <ng-icon name="lucideCpu" class="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <span class="text-xs font-semibold text-gray-900 dark:text-white font-mono">{{ container.name }}</span>
                <span class="text-xs text-gray-400 dark:text-gray-500 font-mono truncate max-w-48">{{ container.image }}</span>
              </div>

              @if (editingContainerIndex() !== i) {
                <button type="button" (click)="startResourceEdit(i)" [disabled]="savingResources()"
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
                  <button type="button" (click)="saveResources(i)" [disabled]="!canSave()"
                    class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    @if (savingResources()) { <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" /> }
                    @else { <ng-icon name="lucideCheck" class="h-3.5 w-3.5" /> }
                    {{ savingResources() ? 'Saving…' : 'Save' }}
                  </button>
                </div>
              }
            </div>

            <div class="px-5 py-5 space-y-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                <div class="space-y-3">
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-semibold text-gray-700 dark:text-gray-200">CPU</span>
                    @if (monitoringService.metrics(); as m) {
                      <span class="text-gray-400 dark:text-gray-500">in use
                        <span class="font-mono font-semibold" [class]="usageColor(cpuUsagePercent(m))">{{ formatCpuCores(m.cpu.usage_cores) }}</span>
                      </span>
                    }
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <app-resource-quantity-field label="Reserved" kind="cpu"
                      [value]="valueFor(i, 'cpuRequest', container.requests.cpu)"
                      [disabled]="editingContainerIndex() !== i || savingResources()"
                      (valueChange)="edit('cpuRequest', $event)" />
                    <app-resource-quantity-field label="Maximum" kind="cpu"
                      [value]="valueFor(i, 'cpuLimit', container.limits.cpu)"
                      [disabled]="editingContainerIndex() !== i || savingResources()"
                      (valueChange)="edit('cpuLimit', $event)" />
                  </div>
                  @if (monitoringService.metrics(); as m) {
                    @if (resourceHint(cpuUsagePercent(m), 'CPU'); as hint) {
                      <p class="flex items-start gap-1.5 text-xs rounded-lg px-2.5 py-2" [class]="hintClass(hint.level)">
                        <ng-icon name="lucideAlertTriangle" class="h-3 w-3 mt-0.5 flex-shrink-0" />
                        {{ hint.message }}
                      </p>
                    }
                  }
                </div>

                <div class="space-y-3">
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-semibold text-gray-700 dark:text-gray-200">Memory</span>
                    @if (monitoringService.metrics(); as m) {
                      <span class="text-gray-400 dark:text-gray-500">in use
                        <span class="font-mono font-semibold" [class]="usageColor(memUsagePercent(m))">{{ formatMemBytes(m.memory.usage_bytes) }}</span>
                      </span>
                    }
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <app-resource-quantity-field label="Reserved" kind="memory"
                      [value]="valueFor(i, 'memRequest', container.requests.memory)"
                      [disabled]="editingContainerIndex() !== i || savingResources()"
                      (valueChange)="edit('memRequest', $event)" />
                    <app-resource-quantity-field label="Maximum" kind="memory"
                      [value]="valueFor(i, 'memLimit', container.limits.memory)"
                      [disabled]="editingContainerIndex() !== i || savingResources()"
                      (valueChange)="edit('memLimit', $event)" />
                  </div>
                  @if (monitoringService.metrics(); as m) {
                    @if (resourceHint(memUsagePercent(m), 'Memory'); as hint) {
                      <p class="flex items-start gap-1.5 text-xs rounded-lg px-2.5 py-2" [class]="hintClass(hint.level)">
                        <ng-icon name="lucideAlertTriangle" class="h-3 w-3 mt-0.5 flex-shrink-0" />
                        {{ hint.message }}
                      </p>
                    }
                  }
                </div>
              </div>

              @if (editingContainerIndex() === i) {
                @if (fieldProblem(); as problem) {
                  <p class="flex items-start gap-1.5 text-xs rounded-lg px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                    <ng-icon name="lucideAlertTriangle" class="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    {{ problem }}
                  </p>
                } @else if (resourcesDirty()) {
                  @if (checking()) {
                    <p class="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                      <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                      Checking where it would run…
                    </p>
                  } @else if (consequence(); as c) {
                    <div class="rounded-lg px-3 py-2 text-xs" [class]="verdictClass(c.placement.verdict)">
                      <p class="flex items-start gap-1.5">
                        <ng-icon [name]="c.placement.verdict === 'fits' ? 'lucideCheck' : 'lucideAlertTriangle'" class="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <span>
                          {{ c.placement.sentence }}
                          @if (c.placement.why) {
                            <button type="button" (click)="showWhy.set(!showWhy())" class="ml-1 underline underline-offset-2 font-medium">{{ showWhy() ? 'Hide' : 'Why' }}</button>
                          }
                        </span>
                      </p>
                      @if (showWhy() && c.placement.why) {
                        <p class="mt-1.5 pl-5 opacity-80">{{ c.placement.why }}</p>
                      }
                      <p class="mt-1.5 pl-5 opacity-70 font-mono">Saved as: CPU {{ c.requests.cpu ?? '—' }} / {{ c.limits.cpu ?? '—' }} · memory {{ c.requests.memory ?? '—' }} / {{ c.limits.memory ?? '—' }} — the app restarts</p>
                    </div>
                  } @else if (consequenceError(); as err) {
                    <p class="text-xs text-red-600 dark:text-red-400">{{ err }}</p>
                  }
                }
              }
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
  readonly savingReplicas = input(false);
  readonly savingResources = input(false);
  readonly savingRestart = input(false);
  readonly appId = input<string | null>(null);
  readonly clusterId = input<string | null>(null);

  protected roomWait(): string | null {
    if (this.rollout?.waitingForRoom) return this.rollout.message;
    return this.runtime?.waitingForRoom?.says ?? null;
  }
  @Input() rollout: RolloutState | null = null;

  protected get restartRollout(): RolloutState | null {
    return this.rollout?.operation === 'restart' ? this.rollout : null;
  }

  protected get resourcesRollout(): RolloutState | null {
    return this.rollout?.operation === 'update-resources' ? this.rollout : null;
  }

  protected monitoringService = inject(ApplicationMonitoringService);
  private readonly runtimeService = inject(AppRuntimeService);

  readonly saveResourcesEvent = output<UpdateResourcesDto>();
  readonly saveReplicasEvent = output<UpdateReplicasDto>();
  readonly restartEvent = output<void>();
  readonly refreshEvent = output<void>();

  // Replica state
  protected replicaEditing = signal(false);
  protected replicaValue = signal(1);
  protected originalReplicas = 1;

  // Resource edit — which container is being edited (-1 = none)
  protected editingContainerIndex = signal(-1);

  protected draft = signal<Draft>(EMPTY_DRAFT);
  private original: Draft = EMPTY_DRAFT;
  protected consequence = signal<ResourcesConsequence | null>(null);
  protected consequenceError = signal<string | null>(null);
  protected checking = signal(false);
  protected showWhy = signal(false);
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  private checkSeq = 0;

  // UI
  protected confirmRestart = signal(false);

  // Dirty
  protected replicaDirty = computed(() => this.replicaValue() !== this.originalReplicas);
  protected resourcesDirty = computed(() =>
    FIELDS.some(field => this.draft()[field] !== this.original[field])
  );

  protected fieldProblem = computed(() => {
    const d = this.draft();
    if (FIELDS.some(field => d[field] === null && this.original[field] !== null)) {
      return 'Enter a positive amount in every field.';
    }
    const cpuReq = cpuMillicores(d.cpuRequest);
    const cpuLim = cpuMillicores(d.cpuLimit);
    if (cpuReq !== null && cpuLim !== null && cpuLim < cpuReq) {
      return 'The CPU maximum is below what is reserved: the maximum must be at least the reservation.';
    }
    const memReq = memoryMi(d.memRequest);
    const memLim = memoryMi(d.memLimit);
    if (memReq !== null && memLim !== null && memLim < memReq) {
      return 'The memory maximum is below what is reserved: the maximum must be at least the reservation.';
    }
    return this.consequence()?.problem ?? null;
  });

  protected canSave = computed(() =>
    this.resourcesDirty() && !this.fieldProblem() && !this.checking() && !this.savingResources()
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
    this.original = {
      cpuRequest: c.requests?.cpu ?? null,
      cpuLimit: c.limits?.cpu ?? null,
      memRequest: c.requests?.memory ?? null,
      memLimit: c.limits?.memory ?? null,
    };
    this.draft.set(this.original);
    this.resetConsequence();
    this.editingContainerIndex.set(containerIndex);
  }

  protected cancelResourceEdit(): void {
    this.draft.set(this.original);
    this.resetConsequence();
    this.editingContainerIndex.set(-1);
  }

  protected valueFor(index: number, field: Field, current: string | null | undefined): string | null {
    return this.editingContainerIndex() === index ? this.draft()[field] : current ?? null;
  }

  protected edit(field: Field, value: string | null): void {
    this.draft.update(d => ({ ...d, [field]: value }));
    this.scheduleCheck();
  }

  protected saveResources(containerIndex: number): void {
    if (!this.canSave()) return;
    this.saveResourcesEvent.emit(this.dtoFor(containerIndex));
    this.resetConsequence();
  }

  protected verdictClass(verdict: PlacementVerdict): string {
    if (verdict === 'fits') return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400';
    if (verdict === 'buys' || verdict === 'proposes') return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300';
    return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400';
  }

  private dtoFor(containerIndex: number): UpdateResourcesDto {
    const d = this.draft();
    const changed = (field: Field) => (d[field] !== this.original[field] ? d[field] ?? undefined : undefined);
    return {
      containerName: this.runtime?.containers[containerIndex]?.name,
      requests: { cpu: changed('cpuRequest'), memory: changed('memRequest') },
      limits: { cpu: changed('cpuLimit'), memory: changed('memLimit') },
    };
  }

  private resetConsequence(): void {
    if (this.checkTimer) clearTimeout(this.checkTimer);
    this.checkSeq++;
    this.consequence.set(null);
    this.consequenceError.set(null);
    this.checking.set(false);
    this.showWhy.set(false);
  }

  private scheduleCheck(): void {
    if (this.checkTimer) clearTimeout(this.checkTimer);
    const appId = this.appId();
    const index = this.editingContainerIndex();
    if (!appId || index < 0 || !this.resourcesDirty() || FIELDS.some(f => this.draft()[f] === null && this.original[f] !== null)) {
      this.checking.set(false);
      this.consequence.set(null);
      return;
    }
    this.checking.set(true);
    const seq = ++this.checkSeq;
    this.checkTimer = setTimeout(() => {
      this.runtimeService.consequence(appId, this.dtoFor(index)).then(
        result => {
          if (seq !== this.checkSeq) return;
          this.consequence.set(result);
          this.consequenceError.set(null);
          this.checking.set(false);
        },
        (err: { error?: { message?: string } }) => {
          if (seq !== this.checkSeq) return;
          this.consequence.set(null);
          this.consequenceError.set(err?.error?.message ?? 'Could not check where it would run.');
          this.checking.set(false);
        },
      );
    }, 400);
  }

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

  protected memUsagePercent(m: { memory: { usage_bytes: number | null; limits_bytes: number | null } }): number {
    const u = m.memory.usage_bytes ?? 0;
    const l = m.memory.limits_bytes ?? 0;
    return l > 0 ? (u / l) * 100 : 0;
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
    return this.formatCores(cores ?? 0);
  }

  private formatCores(c: number): string {
    if (c >= 1) return `${c.toFixed(2)} cores`;
    return `${(c * 1000).toFixed(0)}m`;
  }

  protected formatMemBytes(bytes: number | null): string {
    return this.formatBytes(bytes ?? 0);
  }

  private formatBytes(b: number): string {
    if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
    if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MiB`;
    if (b >= 1024) return `${(b / 1024).toFixed(1)} KiB`;
    return `${b.toFixed(0)} B`;
  }
}

type Field = 'cpuRequest' | 'cpuLimit' | 'memRequest' | 'memLimit';
type Draft = Record<Field, string | null>;
const FIELDS: Field[] = ['cpuRequest', 'cpuLimit', 'memRequest', 'memLimit'];
const EMPTY_DRAFT: Draft = { cpuRequest: null, cpuLimit: null, memRequest: null, memLimit: null };
