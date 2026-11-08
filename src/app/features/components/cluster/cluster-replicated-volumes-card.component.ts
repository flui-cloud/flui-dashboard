import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideCopy } from '@ng-icons/lucide';
import {
  ReplicatedVolumesService,
  ReplicatedVolumesView,
} from '../../service/replicated-volumes.service';

const and = (names: string[]) =>
  names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

@Component({
  selector: 'app-cluster-replicated-volumes-card',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideCopy })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <div class="card-inner p-4" data-testid="replicated-volumes-card">
        <div class="flex items-center justify-between gap-4">
          <span class="flex items-center gap-2">
            <ng-icon
              name="lucideCopy"
              class="h-4 w-4 text-sky-600 dark:text-sky-400"
            />
            <span class="text-label">Replicated volumes</span>
          </span>
          <span
            class="text-xs font-medium"
            [class]="
              v.enabled
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-muted-foreground'
            "
          >
            {{ v.operation ? 'Being enabled' : v.enabled ? 'On' : 'Off' }}
          </span>
        </div>
        <p class="m-0 mt-2 text-sm">{{ headline() }}</p>
        @for (w of v.warnings; track w) {
          <p class="m-0 mt-1 text-xs text-amber-700 dark:text-amber-400">
            {{ w }}
          </p>
        }
        @if (error()) {
          <p class="m-0 mt-1 text-xs text-destructive">{{ error() }}</p>
        }
        <div class="mt-3 flex items-center gap-3">
          <button
            type="button"
            class="text-xs text-primary hover:underline"
            (click)="open.set(!open())"
          >
            {{ open() ? 'Hide details' : 'Details' }}
          </button>
          @if (canEnable()) {
            <button
              type="button"
              class="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-50"
              data-testid="replicated-volumes-enable"
              [disabled]="busy()"
              (click)="enable()"
            >
              {{
                confirming()
                  ? 'Confirm: set aside 20 GiB on each node'
                  : 'Enable'
              }}
            </button>
          }
        </div>
        @if (open()) {
          <ul
            class="mt-2 space-y-1 text-xs text-muted-foreground"
            data-testid="replicated-volumes-details"
          >
            <li>
              An application asks for it with
              <span class="font-mono">replicated: true</span> on a volume in
              flui.yaml, and moves to another copy only if every volume it
              mounts is replicated.
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

  readonly canEnable = computed(() => {
    const v = this.view();
    return !!v && !v.enabled && !v.operation && v.plan.feasible;
  });

  readonly headline = computed(() => {
    const v = this.view();
    if (!v) return '';
    if (v.operation)
      return `Preparing the nodes and the volume engine (${v.operation.status}).`;
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
        this.error.set(
          e.error?.message ?? 'Replicated volumes could not be enabled.',
        );
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
