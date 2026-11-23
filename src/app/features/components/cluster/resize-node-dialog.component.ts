import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import {
  NodeResizePreview,
  NodeResizeService,
  ResizeCandidate,
} from '../../service/node-resize.service';
import { NodeDisksService } from '../../service/node-disks.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-resize-node-dialog',
  imports: [
    CdkTrapFocus,
    FormsModule,
    FlAlert,
    FlField,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlSpinner,
  ],
  providers: [provideIcons({ lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
      (click)="closed.emit()"
      (keydown.escape)="closed.emit()"
    >
      <div
        class="fl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resize-node-title"
        (click)="$event.stopPropagation()"
        data-testid="resize-node-dialog"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="resize-node-title">Resize {{ nodeName() }}</h2>
          <button type="button" class="fl-dialog__close" aria-label="Close" (click)="closed.emit()">
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-dialog__body">
          @if (preview(); as p) {
            <p class="m-0 text-fl-ink-muted">
              Now <span class="fl-mono">{{ p.node.currentServerType }}</span>. The node is off for
              about {{ minutes(p) }} minutes while the provider changes its type.
            </p>

            <fl-field label="Machine type" for="resize-type">
              <span class="fl-select-wrap">
                <select
                  id="resize-type"
                  class="fl-select"
                  [ngModel]="target()"
                  (ngModelChange)="target.set($event)"
                  data-testid="resize-type"
                >
                  @for (c of choices(); track c.name) {
                    <option [value]="c.name">{{ label(c) }}</option>
                  }
                </select>
              </span>
            </fl-field>

            @if (provider() === 'hetzner') {
              <label class="fl-check items-start">
                <input
                  type="checkbox"
                  [ngModel]="upgradeDisk()"
                  (ngModelChange)="upgradeDisk.set($event)"
                  data-testid="resize-upgrade-disk"
                />
                <span>
                  Also grow the disk to the size of the new type. It cannot be undone: the node can
                  never move back to a smaller type.
                </span>
              </label>
            }

            @if (copiesTotal() !== null) {
              <fl-field
                [label]="'Space for copies of replicated volumes (GiB, now ' + copiesTotal() + ')'"
                for="resize-copies"
              >
                <span class="fl-input fl-input--lg w-32">
                  <input
                    id="resize-copies"
                    type="number"
                    [min]="copiesTotal()"
                    [ngModel]="copiesGiB()"
                    (ngModelChange)="copiesGiB.set($event)"
                    data-testid="resize-copies"
                  />
                </span>
              </fl-field>
            }

            @if (p.affectedDedicatedApps.length) {
              <fl-alert tone="warning" title="Downtime">
                Stops while the node is off: {{ slugs(p) }}
              </fl-alert>
            }
            @for (s of p.highAvailability?.switchovers ?? []; track s.cluster) {
              <p class="m-0 text-fl-ink-muted">
                The primary of {{ s.cluster }} moves to {{ s.target }} first; writes pause for a few
                seconds.
              </p>
            }
            @if (p.highAvailability?.refusal) {
              <fl-alert tone="error" title="Cannot resize now" data-testid="resize-refusal">
                {{ p.highAvailability?.refusal }}
              </fl-alert>
            }
          } @else if (!error()) {
            <fl-loading-state [rows]="3" />
          }
          @if (error()) {
            <fl-alert tone="error" title="Resize failed">{{ error() }}</fl-alert>
          }
          @if (done()) {
            <fl-alert tone="info" title="Resize queued" data-testid="resize-done">
              {{ done() }}
            </fl-alert>
          }
        </div>
        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="closed.emit()">
            {{ done() ? 'Close' : 'Cancel' }}
          </button>
          @if (!done()) {
            <button
              flButton="primary"
              type="button"
              [disabled]="!canResize()"
              (click)="resize()"
              data-testid="resize-confirm"
            >
              @if (busy()) {
                <fl-spinner label="Queuing" />
              }
              {{ busy() ? 'Queuing…' : 'Resize' }}
            </button>
          }
        </footer>
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
    () => !!this.target() && !this.busy() && !this.preview()?.highAvailability?.refusal,
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
    const delta = c.monthlyDeltaEur === 'n/a' ? '' : `, ${sign}${c.monthlyDeltaEur} €/month`;
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
        ...(copies && copies > (this.copiesTotal() ?? 0) && { copiesGiB: copies }),
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
