import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';

/**
 * The floor and ceiling this cluster may not cross. They fence both the manual
 * controls and anything Flui does on its own, so they are edited in one place.
 *
 * The thresholds and cooldown the old form also offered are not here: the
 * backend stores them and reads them nowhere.
 */
@Component({
  selector: 'app-scaling-limits-dialog',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4"
      (click)="close()"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Node limits"
        (click)="$event.stopPropagation()"
        class="card-surface w-full max-w-md p-6 shadow-xl flex flex-col gap-5"
        data-testid="limits-dialog"
      >
        <div class="flex flex-col gap-1">
          <h3 class="m-0 text-lg font-semibold text-foreground">Node limits</h3>
          <p class="m-0 text-sm text-sub">
            Flui will not take this cluster outside these, and neither will the
            buttons on the page.
          </p>
        </div>

        <div class="flex items-end gap-4">
          <div class="flex flex-col gap-1.5">
            <label for="floor" class="text-xs font-semibold text-foreground"
              >Floor</label
            >
            <input
              id="floor"
              type="number"
              min="1"
              [(ngModel)]="floor"
              class="h-11 w-28 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="ceiling" class="text-xs font-semibold text-foreground"
              >Ceiling</label
            >
            <input
              id="ceiling"
              type="number"
              min="1"
              [(ngModel)]="ceiling"
              class="h-11 w-28 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground"
            />
          </div>
          <p class="m-0 pb-3 text-[11px] leading-relaxed text-sub">
            Counted across every node, master included — the number shown on the
            page.
          </p>
        </div>

        @if (problem(); as message) {
          <p
            class="m-0 text-sm text-red-600 dark:text-red-400"
            data-testid="limits-error"
          >
            {{ message }}
          </p>
        }

        <div class="flex gap-2">
          <button
            type="button"
            (click)="save()"
            [disabled]="!!problem() || saving()"
            class="min-h-11 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
          <button
            type="button"
            (click)="close()"
            class="min-h-11 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class ScalingLimitsDialogComponent {
  private readonly autoscale = inject(ClusterAutoscaleService);

  readonly clusterId = input.required<string>();
  readonly closed = output<void>();

  readonly floor = signal<number>(this.autoscale.status()?.minNodes ?? 1);
  readonly ceiling = signal<number>(this.autoscale.status()?.maxNodes ?? 3);
  readonly saving = this.autoscale.saving;

  private readonly failure = signal<string | null>(null);

  readonly problem = computed(() => {
    const saved = this.failure();
    if (saved) return saved;
    const floor = Number(this.floor());
    const ceiling = Number(this.ceiling());
    if (!Number.isInteger(floor) || floor < 1)
      return 'The floor is at least one node.';
    if (!Number.isInteger(ceiling) || ceiling < 1)
      return 'The ceiling is at least one node.';
    if (ceiling < floor) return 'The ceiling cannot be below the floor.';
    if (ceiling > 20) return 'A cluster may hold at most 20 nodes.';
    return null;
  });

  async save(): Promise<void> {
    this.failure.set(null);
    try {
      await this.autoscale.updateAutoscale(this.clusterId(), {
        minNodes: Number(this.floor()),
        maxNodes: Number(this.ceiling()),
      });
      this.close();
    } catch (error: unknown) {
      this.failure.set(
        error instanceof Error
          ? error.message
          : 'The limits could not be saved.',
      );
    }
  }

  close(): void {
    this.closed.emit();
  }
}
