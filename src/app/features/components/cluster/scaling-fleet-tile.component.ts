import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ClusterService } from '../../service/cluster.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { getClusterInfo, getClusterNodeId } from '../../model/instance.models';
import { AddWorkerDialogComponent } from './add-worker-dialog.component';
import { RemoveWorkerDialogComponent } from './remove-worker-dialog.component';

/**
 * The node count, and the only place a person adds or removes one by hand.
 * It sits in the scaling strip rather than in a section of its own: "how many
 * nodes" is one question, so it gets one answer on the page.
 */
@Component({
  selector: 'app-scaling-fleet-tile',
  standalone: true,
  imports: [AddWorkerDialogComponent, RemoveWorkerDialogComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div
      class="card-surface p-4 flex flex-col gap-2 h-full"
      data-testid="tile-fleet"
    >
      <div class="text-[10px] font-semibold uppercase tracking-wider text-sub">
        Nodes
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          (click)="askRemove()"
          [disabled]="!canRemove()"
          [title]="removeTooltip()"
          aria-label="Remove a worker"
          class="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span aria-hidden="true" class="text-base leading-none">&minus;</span>
        </button>

        <span
          class="text-2xl font-semibold tracking-tight text-foreground min-w-7 text-center"
          data-testid="tile-value-fleet"
        >
          {{ nodes() }}
        </span>

        <button
          type="button"
          (click)="askAdd()"
          [disabled]="!canAdd()"
          [title]="addTooltip()"
          aria-label="Add a worker"
          class="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span aria-hidden="true" class="text-base leading-none">+</span>
        </button>
      </div>

      <p class="m-0 mt-auto text-[11px] leading-relaxed text-sub">
        {{ note() }}
      </p>
    </div>

    @if (showAdd() && clusterId(); as cid) {
      <app-add-worker-dialog
        [clusterId]="cid"
        [currentNodes]="nodes()"
        [maxNodes]="ceiling()"
        (closed)="showAdd.set(false); reloadNodes()"
      />
    }

    @if (showRemove() && clusterId(); as cid) {
      @if (candidateId(); as nodeId) {
        <app-remove-worker-dialog
          [clusterId]="cid"
          [nodeId]="nodeId"
          [workerName]="candidateName()"
          (closed)="showRemove.set(false); reloadNodes()"
        />
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class ScalingFleetTileComponent {
  private readonly clusterService = inject(ClusterService);
  private readonly autoscale = inject(ClusterAutoscaleService);

  /** The limits line, worded by the parent because only it knows where they come from. */
  readonly note = input<string>('');

  readonly showAdd = signal(false);
  readonly showRemove = signal(false);

  readonly clusterId = computed(
    () => this.clusterService.cluster()?.id ?? null,
  );

  constructor() {
    effect(() => {
      const id = this.clusterId();
      if (id) {
        untracked(() => this.reloadNodes());
      }
    });
  }

  reloadNodes(): void {
    const id = this.clusterId();
    if (id) this.clusterService.loadClusterNodes(id).catch(() => undefined);
  }
  readonly nodes = computed(
    () =>
      this.autoscale.status()?.currentNodes ??
      this.clusterService.nodes().length,
  );
  readonly ceiling = computed(() => this.autoscale.status()?.maxNodes ?? null);

  private readonly workers = computed(() =>
    this.clusterService
      .nodes()
      .filter((n) => getClusterInfo(n)?.nodeType !== 'master'),
  );

  /** The last worker that is neither going away nor broken. */
  readonly candidate = computed(() => {
    const workers = this.workers();
    for (let i = workers.length - 1; i >= 0; i--) {
      const status = (workers[i].status || '').toString().toLowerCase();
      if (status !== 'deleting' && status !== 'error') return workers[i];
    }
    return null;
  });

  /** The dialog addresses a node by its cluster node id, not the instance id. */
  readonly candidateId = computed(() => {
    const node = this.candidate();
    return node ? (getClusterNodeId(node) ?? '') : '';
  });

  readonly candidateName = computed(() => {
    const node = this.candidate();
    return node?.displayName ?? node?.name ?? 'the last worker';
  });

  readonly canAdd = computed(() => {
    const ceiling = this.ceiling();
    return ceiling == null || this.nodes() < ceiling;
  });

  readonly canRemove = computed(() => {
    const floor = this.autoscale.status()?.minNodes;
    if (this.workers().length === 0 || !this.candidate()) return false;
    return floor == null || this.nodes() > floor;
  });

  readonly addTooltip = computed(() =>
    this.canAdd()
      ? 'Add a worker to this cluster'
      : `The ceiling of ${this.ceiling()} nodes is reached — raise it first`,
  );

  readonly removeTooltip = computed(() => {
    if (this.workers().length === 0)
      return 'This cluster has no worker to remove';
    if (!this.candidate()) return 'Every worker is busy';
    if (!this.canRemove())
      return `Removing one would go below the floor of ${this.autoscale.status()?.minNodes} nodes`;
    return `Remove ${this.candidateName()}`;
  });

  askAdd(): void {
    if (this.canAdd()) this.showAdd.set(true);
  }

  askRemove(): void {
    if (this.canRemove()) this.showRemove.set(true);
  }
}
