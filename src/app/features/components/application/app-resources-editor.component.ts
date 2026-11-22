import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  signal,
  computed,
  inject,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';

import { provideIcons } from '@ng-icons/core';
import { lucidePencil } from '@ng-icons/lucide';
import { AppRuntimeResponseDto } from '../../../core/api/model/appRuntimeResponseDto';
import { ContainerResourcesDto } from '../../../core/api/model/containerResourcesDto';
import { UpdateResourcesDto } from '../../../core/api/model/updateResourcesDto';
import { UpdateReplicasDto } from '../../../core/api/model/updateReplicasDto';
import { ResourceQuantityFieldComponent } from './resource-quantity-field.component';
import { cpuMillicores, memoryMi } from './resource-quantity';
import {
  AppRuntimeService,
  ResourcesConsequence,
  RolloutState,
} from '../../service/app-runtime.service';
import { ApplicationMonitoringService } from '../../service/application-monitoring.service';
import { ReplicasPanel } from './replicas-panel';
import { ResourceHint, ResourceKind, resourceHint, usageOf, verdictTone } from './resources-format';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';

type Field = 'cpuRequest' | 'cpuLimit' | 'memRequest' | 'memLimit';
type Draft = Record<Field, string | null>;
const FIELDS: Field[] = ['cpuRequest', 'cpuLimit', 'memRequest', 'memLimit'];
const EMPTY_DRAFT: Draft = { cpuRequest: null, cpuLimit: null, memRequest: null, memLimit: null };

const KINDS: readonly { kind: ResourceKind; title: string; request: Field; limit: Field }[] = [
  { kind: 'cpu', title: 'CPU', request: 'cpuRequest', limit: 'cpuLimit' },
  { kind: 'memory', title: 'Memory', request: 'memRequest', limit: 'memLimit' },
];

@Component({
  selector: 'app-resources-editor',
  standalone: true,
  imports: [
    ResourceQuantityFieldComponent,
    ReplicasPanel,
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlPanel,
    FlEmptyState,
    FlUsageBar,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
  ],
  providers: [provideIcons({ lucidePencil })],
  host: { class: 'fl-stack' },
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (restartRollout; as r) {
      <fl-alert tone="info" title="Restarting" data-testid="restart-progress">
        <span class="block">{{ r.message }}</span>
        <span class="block fl-num">{{ r.readyReplicas }} of {{ r.desiredReplicas }} ready</span>
      </fl-alert>
    }

    <app-replicas-panel
      [runtime]="runtime"
      [rollout]="rollout"
      [saving]="savingReplicas()"
      [busy]="savingReplicas() || savingResources() || savingRestart()"
      [clusterId]="clusterId()"
      (applied)="applyReplicas($event)"
      (refresh)="onRefresh()"
    />

    @if (runtime && runtime.containers.length > 0) {
      @for (container of runtime.containers; track container.name; let i = $index) {
        <fl-panel [title]="container.name">
          <ng-container panelActions>
            @if (editingContainerIndex() !== i) {
              <button
                flButton
                size="sm"
                type="button"
                [disabled]="savingResources()"
                (click)="startResourceEdit(i)"
              >
                <fl-icon name="lucidePencil" />
                Edit
              </button>
            } @else {
              <button flButton="ghost" size="sm" type="button" (click)="cancelResourceEdit()">
                Cancel
              </button>
              <button
                flButton="primary"
                size="sm"
                type="button"
                [disabled]="!canSave()"
                (click)="saveResources(i)"
              >
                @if (savingResources()) {
                  <fl-spinner label="Saving" />
                }
                {{ savingResources() ? 'Saving…' : 'Save' }}
              </button>
            }
          </ng-container>

          <div class="flex flex-col gap-5">
            <p class="m-0 truncate fl-mono fl-muted" [title]="container.image">
              {{ container.image }}
            </p>
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
              @for (k of kinds; track k.kind) {
                <section class="flex flex-col gap-3" [attr.aria-label]="k.title">
                  <h3 class="m-0 text-fl-body-sm font-semibold">{{ k.title }}</h3>
                  @if (editingContainerIndex() === i) {
                    <div class="grid grid-cols-2 gap-3">
                      <app-resource-quantity-field
                        label="Reserved"
                        [kind]="k.kind"
                        [value]="valueFor(i, k.request, amount(container.requests, k.kind))"
                        [disabled]="savingResources()"
                        (valueChange)="edit(k.request, $event)"
                      />
                      <app-resource-quantity-field
                        label="Maximum"
                        [kind]="k.kind"
                        [value]="valueFor(i, k.limit, amount(container.limits, k.kind))"
                        [disabled]="savingResources()"
                        (valueChange)="edit(k.limit, $event)"
                      />
                    </div>
                  } @else {
                    <fl-key-value class="fl-kv--compact">
                      <fl-kv-item key="Reserved" [mono]="true">{{
                        amount(container.requests, k.kind) ?? '—'
                      }}</fl-kv-item>
                      <fl-kv-item key="Maximum" [mono]="true">{{
                        amount(container.limits, k.kind) ?? '—'
                      }}</fl-kv-item>
                    </fl-key-value>
                  }
                  @if (monitoringService.metrics(); as m) {
                    @let u = usage(m, k.kind);
                    @if (u.percent !== null) {
                      <fl-usage-bar
                        [percent]="u.percent"
                        [label]="k.title + ' in use'"
                        [aside]="u.amount + ' in use'"
                        [warnAt]="70"
                      />
                      @if (hint(u.percent, k.kind); as h) {
                        <fl-alert [tone]="h.tone" [title]="h.title">{{ h.body }}</fl-alert>
                      }
                    } @else {
                      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
                        <span class="fl-mono">{{ u.amount }}</span> in use, no maximum set
                      </p>
                    }
                  }
                </section>
              }
            </div>

            @if (editingContainerIndex() === i) {
              @if (fieldProblem(); as problem) {
                <fl-alert tone="error" title="Cannot save these values">{{ problem }}</fl-alert>
              } @else if (resourcesDirty()) {
                @if (checking()) {
                  <fl-status tone="progress" label="Checking where it would run" />
                } @else if (consequence(); as c) {
                  <fl-alert [tone]="tone(c.placement.verdict)" title="Where it would run">
                    <span class="block">{{ c.placement.sentence }}</span>
                    @if (showWhy() && c.placement.why) {
                      <span class="mt-1 block">{{ c.placement.why }}</span>
                    }
                    <span class="mt-1 block fl-mono">
                      CPU {{ c.requests.cpu ?? '—' }} / {{ c.limits.cpu ?? '—' }}, memory
                      {{ c.requests.memory ?? '—' }} / {{ c.limits.memory ?? '—' }}. Saving restarts
                      the app.
                    </span>
                    @if (c.placement.why) {
                      <button
                        alertActions
                        flButton="ghost"
                        size="sm"
                        type="button"
                        [attr.aria-expanded]="showWhy()"
                        (click)="showWhy.set(!showWhy())"
                      >
                        {{ showWhy() ? 'Hide why' : 'Why' }}
                      </button>
                    }
                  </fl-alert>
                } @else if (consequenceError(); as err) {
                  <fl-alert tone="error" title="Placement check failed">{{ err }}</fl-alert>
                }
              }
            }

            @if (resourcesRollout; as r) {
              <div class="flex flex-wrap items-center gap-2">
                <fl-status tone="progress" [label]="r.message" />
                <span class="fl-num fl-muted"
                  >{{ r.readyReplicas }} of {{ r.desiredReplicas }} ready</span
                >
              </div>
            }
          </div>
        </fl-panel>
      }
    } @else if (!runtime) {
      <fl-panel title="Containers">
        <fl-empty-state [compact]="true" title="Runtime data not available" />
      </fl-panel>
    }
  `,
})
export class AppResourcesEditorComponent implements OnChanges {
  @Input() runtime: AppRuntimeResponseDto | null = null;
  readonly savingReplicas = input(false);
  readonly savingResources = input(false);
  readonly savingRestart = input(false);
  readonly appId = input<string | null>(null);
  readonly clusterId = input<string | null>(null);
  /** Shown to somebody who cannot change it: the advice on sizing is not theirs to act on. */
  readonly advice = input(true);

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

  protected readonly kinds = KINDS;
  protected readonly usage = usageOf;
  protected readonly tone = verdictTone;

  protected editingContainerIndex = signal(-1);

  protected draft = signal<Draft>(EMPTY_DRAFT);
  private original: Draft = EMPTY_DRAFT;
  protected consequence = signal<ResourcesConsequence | null>(null);
  protected consequenceError = signal<string | null>(null);
  protected checking = signal(false);
  protected showWhy = signal(false);
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  private checkSeq = 0;

  protected confirmRestart = signal(false);

  protected resourcesDirty = computed(() =>
    FIELDS.some((field) => this.draft()[field] !== this.original[field]),
  );

  protected fieldProblem = computed(() => {
    const d = this.draft();
    if (FIELDS.some((field) => d[field] === null && this.original[field] !== null)) {
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

  protected canSave = computed(
    () =>
      this.resourcesDirty() && !this.fieldProblem() && !this.checking() && !this.savingResources(),
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['runtime'] && this.runtime) {
      this.editingContainerIndex.set(-1);
    }
  }

  protected applyReplicas(replicas: number): void {
    this.saveReplicasEvent.emit({ replicas });
  }

  protected amount(
    resources: ContainerResourcesDto | undefined,
    kind: ResourceKind,
  ): string | null {
    return resources?.[kind] ?? null;
  }

  protected hint(percent: number, kind: ResourceKind): ResourceHint | null {
    return this.advice() ? resourceHint(percent, kind) : null;
  }

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

  protected valueFor(
    index: number,
    field: Field,
    current: string | null | undefined,
  ): string | null {
    return this.editingContainerIndex() === index ? this.draft()[field] : (current ?? null);
  }

  protected edit(field: Field, value: string | null): void {
    this.draft.update((d) => ({ ...d, [field]: value }));
    this.scheduleCheck();
  }

  protected saveResources(containerIndex: number): void {
    if (!this.canSave()) return;
    this.saveResourcesEvent.emit(this.dtoFor(containerIndex));
    this.resetConsequence();
  }

  private dtoFor(containerIndex: number): UpdateResourcesDto {
    const d = this.draft();
    const changed = (field: Field) =>
      d[field] !== this.original[field] ? (d[field] ?? undefined) : undefined;
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
    if (
      !appId ||
      index < 0 ||
      !this.resourcesDirty() ||
      FIELDS.some((f) => this.draft()[f] === null && this.original[f] !== null)
    ) {
      this.checking.set(false);
      this.consequence.set(null);
      return;
    }
    this.checking.set(true);
    const seq = ++this.checkSeq;
    this.checkTimer = setTimeout(() => {
      this.runtimeService.consequence(appId, this.dtoFor(index)).then(
        (result) => {
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

  protected promptRestart(): void {
    this.confirmRestart.set(true);
  }
  protected cancelRestart(): void {
    this.confirmRestart.set(false);
  }
  protected confirmRestartAction(): void {
    this.confirmRestart.set(false);
    this.restartEvent.emit();
  }

  protected onRefresh(): void {
    this.refreshEvent.emit();
  }
}
