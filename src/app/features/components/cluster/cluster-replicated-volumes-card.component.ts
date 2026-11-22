import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ReplicatedVolumesService,
  ReplicatedVolumesView,
} from '../../service/replicated-volumes.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

const and = (names: string[]) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

@Component({
  selector: 'app-cluster-replicated-volumes-card',
  imports: [FlPanel, FlAlert, FlButton, FlSpinner, FlStatus],
  host: { class: 'block' },
  template: `
    @if (view(); as v) {
      <fl-panel title="Replicated volumes" data-testid="replicated-volumes-card">
        <fl-status panelActions [tone]="state().tone" [label]="state().label" />
        <div class="flex flex-col gap-3">
          <p class="m-0 text-fl-body-sm">{{ headline() }}</p>
          @for (w of v.warnings; track w) {
            <fl-alert tone="warning" title="Check the copies">{{ w }}</fl-alert>
          }
          @if (error()) {
            <fl-alert tone="error" title="Could not enable">{{ error() }}</fl-alert>
          }
          <div class="fl-row">
            <button
              flButton="ghost"
              size="sm"
              type="button"
              [attr.aria-expanded]="open()"
              (click)="open.set(!open())"
            >
              {{ open() ? 'Hide details' : 'Details' }}
            </button>
            @if (canEnable()) {
              <button
                [flButton]="confirming() ? 'primary' : ''"
                size="sm"
                type="button"
                data-testid="replicated-volumes-enable"
                [disabled]="busy()"
                (click)="enable()"
              >
                @if (busy()) {
                  <fl-spinner label="Enabling" />
                }
                {{ confirming() ? 'Confirm: set aside 20 GiB on each node' : 'Enable' }}
              </button>
            }
          </div>
          @if (open()) {
            <ul
              class="m-0 flex list-disc flex-col gap-1 pl-5 text-fl-body-sm text-fl-ink-muted"
              data-testid="replicated-volumes-details"
            >
              <li>
                An application asks for it with
                <span class="fl-mono">replicated: true</span> on a volume in flui.yaml, and moves to
                another copy only if every volume it mounts is replicated.
              </li>
              @if (voteLine()) {
                <li>{{ voteLine() }}</li>
              }
              @if (copyLine()) {
                <li>{{ copyLine() }}</li>
              }
              <li>Volumes that already exist do not change.</li>
            </ul>
          }
        </div>
      </fl-panel>
    }
  `,
})
export class ClusterReplicatedVolumesCardComponent {
  private readonly service = inject(ReplicatedVolumesService);

  readonly clusterId = input.required<string | null | undefined>();
  readonly view = signal<ReplicatedVolumesView | null>(null);
  readonly open = signal(false);
  readonly confirming = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly state = computed<{ tone: StatusTone; label: string }>(() => {
    const v = this.view();
    if (v?.operation) return { tone: 'progress', label: 'Being enabled' };
    if (v?.enabled) return { tone: 'success', label: 'On' };
    return { tone: 'neutral', label: 'Off' };
  });

  readonly canEnable = computed(() => {
    const v = this.view();
    return !!v && !v.enabled && !v.operation && v.plan.feasible;
  });

  readonly headline = computed(() => {
    const v = this.view();
    if (!v) return '';
    if (v.operation) return `Preparing the nodes and the volume engine (${v.operation.status}).`;
    if (v.enabled) {
      return `Copies on ${and(v.storageNodes)}, one in each location.`;
    }
    if (v.plan.feasible) {
      return `Enabling keeps copies on ${and(v.plan.storageNodes)} (${and(v.plan.zones)}).`;
    }
    return `Not possible yet: ${v.plan.reason}`;
  });

  readonly voteLine = computed(() => {
    const v = this.view();
    const p = v?.plan;
    if (v?.enabled || !p?.feasible || !p.tieBreakers.length) return '';
    const s = p.tieBreakers.length === 1 ? 's' : '';
    return `${and(p.tieBreakers)} cast${s} the tie-breaking vote and hold${s} no data.`;
  });

  readonly copyLine = computed(() => {
    const v = this.view();
    if (!v) return '';
    let copies = 0;
    if (v.enabled) copies = v.storageNodes.length;
    else if (v.plan.feasible) copies = v.plan.zones.length;
    if (copies < 2) return '';
    const other = copies === 2 ? 'the other location' : 'the other locations';
    return `One copy in each of ${copies} locations: it survives losing a server or a location, and every write waits for ${other}.`;
  });

  constructor() {
    effect(() => {
      const id = this.clusterId();
      if (id) this.load(id);
    });
  }

  enable(): void {
    const id = this.clusterId();
    if (!id) return;
    if (!this.confirming()) {
      this.confirming.set(true);
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.service.enable(id).subscribe({
      next: () => {
        this.busy.set(false);
        this.confirming.set(false);
        this.load(id);
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.confirming.set(false);
        this.error.set(e.error?.message ?? 'Replicated volumes could not be enabled.');
      },
    });
  }

  private load(id: string): void {
    this.service.get(id).subscribe({
      next: (v) => this.view.set(v),
      error: () => this.view.set(null),
    });
  }
}
