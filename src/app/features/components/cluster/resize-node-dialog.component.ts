import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NodeResizePreview,
  NodeResizeService,
  ResizeCandidate,
} from '../../service/node-resize.service';
import { NodeDisksService } from '../../service/node-disks.service';

@Component({
  selector: 'app-resize-node-dialog',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      (click)="closed.emit()"
    >
      <div
        class="card-surface w-full max-w-lg p-5"
        role="dialog"
        aria-modal="true"
        (click)="$event.stopPropagation()"
        data-testid="resize-node-dialog"
      >
        <h3 class="m-0 text-base font-semibold">Resize {{ nodeName() }}</h3>
        @if (preview(); as p) {
          <p class="m-0 mt-1 text-xs text-muted-foreground">
            Now {{ p.node.currentServerType }}. The node is off for about
            {{ minutes(p) }} minutes while the provider changes its type.
          </p>

          <label class="mt-4 block text-xs font-medium" for="resize-type">
            Machine type
          </label>
          <select
            id="resize-type"
            class="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            [ngModel]="target()"
            (ngModelChange)="target.set($event)"
            data-testid="resize-type"
          >
            @for (c of choices(); track c.name) {
              <option [value]="c.name">{{ label(c) }}</option>
            }
          </select>

          @if (provider() === 'hetzner') {
            <label class="mt-3 flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                class="mt-0.5"
                [ngModel]="upgradeDisk()"
                (ngModelChange)="upgradeDisk.set($event)"
                data-testid="resize-upgrade-disk"
              />
              <span>
                Also grow the disk to the size of the new type. It cannot be
                undone: the node can never move back to a smaller type.
              </span>
            </label>
          }

          @if (copiesTotal() !== null) {
            <label class="mt-3 block text-xs font-medium" for="resize-copies">
              Space for copies of replicated volumes (GiB, now
              {{ copiesTotal() }})
            </label>
            <input
              id="resize-copies"
              type="number"
              class="mt-1 w-32 rounded-md border border-border bg-background px-2 py-1 text-sm"
              [min]="copiesTotal()"
              [ngModel]="copiesGiB()"
              (ngModelChange)="copiesGiB.set($event)"
              data-testid="resize-copies"
            />
          }

          @if (p.affectedDedicatedApps.length) {
            <p class="m-0 mt-3 text-xs text-amber-700 dark:text-amber-400">
              Stops while the node is off:
              {{ slugs(p) }}
            </p>
          }
          @for (s of p.highAvailability?.switchovers ?? []; track s.cluster) {
            <p class="m-0 mt-2 text-xs text-muted-foreground">
              The primary of {{ s.cluster }} moves to {{ s.target }} first;
              writes pause for a few seconds.
            </p>
          }
          @if (p.highAvailability?.refusal) {
            <p
              class="m-0 mt-3 text-xs text-destructive"
              data-testid="resize-refusal"
            >
              {{ p.highAvailability?.refusal }}
            </p>
          }
        } @else if (!error()) {
          <p class="m-0 mt-3 text-xs text-muted-foreground">
            Reading the node…
          </p>
        }
        @if (error()) {
          <p class="m-0 mt-3 text-xs text-destructive">{{ error() }}</p>
        }
        @if (done()) {
          <p
            class="m-0 mt-3 text-xs text-muted-foreground"
            data-testid="resize-done"
          >
            {{ done() }}
          </p>
        }

        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            (click)="closed.emit()"
          >
            {{ done() ? 'Close' : 'Cancel' }}
          </button>
          @if (!done()) {
            <button
              type="button"
              class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              [disabled]="!canResize()"
              (click)="resize()"
              data-testid="resize-confirm"
            >
              {{ busy() ? 'Queuing…' : 'Resize' }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class ResizeNodeDialogComponent implements OnInit {
  private readonly resizes = inject(NodeResizeService);
  private readonly disks = inject(NodeDisksService);

  readonly clusterId = input.required<string>();
  readonly nodeId = input.required<string>();
  readonly nodeName = input.required<string>();
  readonly provider = input<string | undefined>();
  readonly closed = output<void>();
  readonly queued = output<string>();

  readonly preview = signal<NodeResizePreview | null>(null);
  readonly target = signal<string>('');
  readonly upgradeDisk = signal(false);
  readonly copiesTotal = signal<number | null>(null);
  readonly copiesGiB = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly done = signal<string | null>(null);

  readonly choices = computed<ResizeCandidate[]>(() =>
    (this.preview()?.candidates ?? []).filter((c) => c.direction !== 'current'),
  );

  readonly canResize = computed(
    () =>
      !!this.target() &&
      !this.busy() &&
      !this.preview()?.highAvailability?.refusal,
  );

  ngOnInit(): void {
    this.resizes.preview(this.clusterId(), this.nodeId()).subscribe({
      next: (p) => {
        this.preview.set(p);
        const next =
          p.candidates.find((c) => c.direction === 'upgrade') ??
          p.candidates.find((c) => c.direction !== 'current');
        this.target.set(next?.name ?? '');
      },
      error: (e: { error?: { message?: string } }) =>
        this.error.set(e?.error?.message ?? 'The node could not be read.'),
    });
    this.disks.get(this.clusterId()).subscribe({
      next: (v) => {
        const copies = v.nodes.find((n) => n.node === this.nodeName())?.copies;
        if (copies) this.copiesTotal.set(Math.round(copies.totalGiB));
      },
      error: () => undefined,
    });
  }

  minutes(p: NodeResizePreview): number {
    return Math.round(p.expectedDowntimeMs / 60000);
  }

  slugs(p: NodeResizePreview): string {
    return p.affectedDedicatedApps.map((a) => a.slug).join(', ');
  }

  label(c: ResizeCandidate): string {
    const sign = Number.parseFloat(c.monthlyDeltaEur) > 0 ? '+' : '';
    const delta =
      c.monthlyDeltaEur === 'n/a'
        ? ''
        : `, ${sign}${c.monthlyDeltaEur} €/month`;
    return `${c.name}: ${c.cores} vCPU, ${c.memoryGb} GB, ${c.diskGb} GB disk${delta}`;
  }

  resize(): void {
    this.busy.set(true);
    this.error.set(null);
    const copies = this.copiesGiB();
    this.resizes
      .resize(this.clusterId(), this.nodeId(), {
        targetServerType: this.target(),
        ...(this.upgradeDisk() && { upgradeDisk: true }),
        ...(copies &&
          copies > (this.copiesTotal() ?? 0) && { copiesGiB: copies }),
      })
      .subscribe({
        next: (op) => {
          this.busy.set(false);
          this.done.set(
            `Resize queued. ${this.nodeName()} is back in a few minutes; the Operations page follows it.`,
          );
          this.queued.emit(op.id);
        },
        error: (e: { error?: { message?: string } }) => {
          this.busy.set(false);
          this.error.set(e?.error?.message ?? 'The resize was refused.');
        },
      });
  }
}
