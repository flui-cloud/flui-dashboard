import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
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
  imports: [CdkTrapFocus, FormsModule, FlAlert, FlField, FlButton, FlIcon],
  providers: [provideIcons({ lucideX })],
  host: { class: 'contents', '(document:keydown.escape)': 'close()' },
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
      (click)="close()"
    >
      <div
        class="fl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scaling-limits-title"
        (click)="$event.stopPropagation()"
        data-testid="limits-dialog"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="scaling-limits-title">Node limits</h2>
          <button type="button" class="fl-dialog__close" aria-label="Close" (click)="close()">
            <fl-icon name="lucideX" />
          </button>
        </header>

        <div class="fl-dialog__body">
          <p class="m-0 text-fl-ink-muted">
            Flui will not take this cluster outside these, and neither will the buttons on the page.
          </p>
          <div class="grid grid-cols-2 gap-3">
            <fl-field label="Floor" for="floor">
              <div class="fl-input fl-input--lg">
                <input id="floor" type="number" min="1" class="fl-mono" [(ngModel)]="floor" />
              </div>
            </fl-field>
            <fl-field label="Ceiling" for="ceiling">
              <div class="fl-input fl-input--lg">
                <input id="ceiling" type="number" min="1" class="fl-mono" [(ngModel)]="ceiling" />
              </div>
            </fl-field>
          </div>
          <p class="m-0 text-fl-caption text-fl-ink-muted">
            Counted across every node, master included: the number shown on the page.
          </p>
          @if (problem(); as message) {
            <fl-alert tone="error" title="Cannot save these limits" data-testid="limits-error">
              {{ message }}
            </fl-alert>
          }
        </div>

        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="close()">Cancel</button>
          <button
            flButton="primary"
            type="button"
            (click)="save()"
            [disabled]="!!problem() || saving()"
          >
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        </footer>
      </div>
    </div>
  `,
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
    if (!Number.isInteger(floor) || floor < 1) return 'The floor is at least one node.';
    if (!Number.isInteger(ceiling) || ceiling < 1) return 'The ceiling is at least one node.';
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
      this.failure.set(error instanceof Error ? error.message : 'The limits could not be saved.');
    }
  }

  close(): void {
    this.closed.emit();
  }
}
