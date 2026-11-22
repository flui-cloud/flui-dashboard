import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideMinus, lucidePencil, lucidePlus, lucideRefreshCw } from '@ng-icons/lucide';
import { AppRuntimeResponseDto } from '../../../core/api/model/appRuntimeResponseDto';
import { RolloutState } from '../../service/app-runtime.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

const MAX_REPLICAS = 20;

@Component({
  selector: 'app-replicas-panel',
  imports: [
    RouterLink,
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlPanel,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
  ],
  providers: [provideIcons({ lucideMinus, lucidePencil, lucidePlus, lucideRefreshCw })],
  template: `
    <fl-panel title="Replicas">
      <ng-container panelActions>
        <button
          flButton="ghost"
          size="sm"
          type="button"
          [disabled]="busy()"
          (click)="refresh.emit()"
        >
          <fl-icon name="lucideRefreshCw" />
          Refresh
        </button>
        @if (editing()) {
          <button flButton="ghost" size="sm" type="button" (click)="cancel()">Cancel</button>
          <button
            flButton="primary"
            size="sm"
            type="button"
            [disabled]="!dirty() || saving()"
            (click)="apply()"
          >
            @if (saving()) {
              <fl-spinner label="Applying" />
            }
            Apply
          </button>
        } @else if (!runtime()?.replicasRefusal) {
          <button
            flButton
            size="sm"
            type="button"
            [disabled]="saving() || !runtime()"
            (click)="editing.set(true)"
          >
            <fl-icon name="lucidePencil" />
            Edit
          </button>
        }
      </ng-container>

      <div class="flex flex-col gap-4">
        @if (runtime(); as r) {
          <fl-key-value class="fl-kv--compact">
            <fl-kv-item key="Desired"
              ><span class="fl-num">{{ r.replicas.desired ?? '—' }}</span></fl-kv-item
            >
            <fl-kv-item key="Ready">
              <fl-status [tone]="readyTone()" [label]="'' + (r.replicas.ready ?? '—')" />
            </fl-kv-item>
            <fl-kv-item key="Available"
              ><span class="fl-num">{{ r.replicas.available ?? '—' }}</span></fl-kv-item
            >
          </fl-key-value>
        }

        <div class="fl-row">
          <button
            flButton
            size="sm"
            type="button"
            [iconOnly]="true"
            aria-label="One replica less"
            [disabled]="!editing() || value() <= 0 || saving()"
            (click)="value.set(value() - 1)"
          >
            <fl-icon name="lucideMinus" />
          </button>
          <span class="w-8 text-center text-fl-metric fl-num select-none" aria-live="polite">{{
            value()
          }}</span>
          <button
            flButton
            size="sm"
            type="button"
            [iconOnly]="true"
            aria-label="One replica more"
            [disabled]="!editing() || value() >= max || saving()"
            (click)="value.set(value() + 1)"
          >
            <fl-icon name="lucidePlus" />
          </button>
          <span class="fl-muted">{{ value() === 1 ? 'replica' : 'replicas' }}</span>
          @if (rollout()?.operation === 'scale') {
            <fl-status
              class="ml-auto"
              tone="progress"
              [label]="rollout()!.readyReplicas + ' of ' + rollout()!.desiredReplicas + ' ready'"
            />
          }
        </div>

        @if (runtime()?.replicasRefusal; as refusal) {
          <p class="m-0 text-fl-body-sm text-fl-ink-muted" data-testid="replicas-refusal">
            {{ refusal }}
          </p>
        }
        @if (editing() && value() === 0) {
          <fl-alert tone="warning" title="Zero replicas stops the application">
            It is not deleted.
          </fl-alert>
        }
        @if (roomWait(); as wait) {
          <fl-alert tone="warning" title="Waiting for room" data-testid="replicas-waiting-for-room">
            {{ wait }}
            @if (clusterId()) {
              <a alertActions class="fl-link" [routerLink]="['/cluster', clusterId(), 'scaling']"
                >Scaling</a
              >
            }
          </fl-alert>
        }
      </div>
    </fl-panel>
  `,
})
export class ReplicasPanel {
  readonly runtime = input<AppRuntimeResponseDto | null>(null);
  readonly rollout = input<RolloutState | null>(null);
  readonly saving = input(false);
  readonly busy = input(false);
  readonly clusterId = input<string | null>(null);

  readonly applied = output<number>();
  readonly refresh = output<void>();

  protected readonly max = MAX_REPLICAS;
  protected readonly editing = signal(false);
  protected readonly value = signal(1);
  private readonly original = signal(1);

  protected readonly dirty = computed(() => this.value() !== this.original());

  protected readonly roomWait = computed(() => {
    const rollout = this.rollout();
    if (rollout?.waitingForRoom) return rollout.message;
    return this.runtime()?.waitingForRoom?.says ?? null;
  });

  protected readonly readyTone = computed<StatusTone>(() => {
    const desired = this.runtime()?.replicas?.desired ?? 0;
    const ready = this.runtime()?.replicas?.ready ?? 0;
    if (ready === 0) return 'error';
    if (ready < desired) return 'warning';
    return 'success';
  });

  constructor() {
    effect(() => {
      const runtime = this.runtime();
      if (!runtime) return;
      untracked(() => {
        const desired = runtime.replicas?.desired ?? 1;
        this.original.set(desired);
        this.value.set(desired);
        this.editing.set(false);
      });
    });
  }

  protected cancel(): void {
    this.value.set(this.original());
    this.editing.set(false);
  }

  protected apply(): void {
    this.applied.emit(this.value());
    this.original.set(this.value());
    this.editing.set(false);
  }
}
