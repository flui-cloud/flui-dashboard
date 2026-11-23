import { Component, afterNextRender, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BuildNamespaceCleanupResultDto } from '../../../core/api/model/buildNamespaceCleanupResultDto';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlField } from '../../../ui/patterns/field';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-build-namespace-cleanup',
  imports: [FormsModule, FlPanel, FlField, FlEmptyState, FlButton, FlSpinner],
  template: `
    <fl-panel title="Clean up stale builds" data-testid="build-namespace-cleanup">
      <div panelActions>
        <button flButton="ghost" size="sm" type="button" (click)="cancelled.emit()">Close</button>
      </div>
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-end gap-3">
          <fl-field label="Older than (minutes)" for="build-cleanup-age">
            <div class="fl-input fl-input--lg">
              <input
                id="build-cleanup-age"
                type="number"
                min="0"
                class="fl-num"
                [ngModel]="olderThanMinutes()"
                (ngModelChange)="olderThanMinutes.set($event)"
              />
            </div>
          </fl-field>
          <button flButton type="button" [disabled]="running()" (click)="previewRequested.emit()">
            @if (running() && !preview()) {
              <fl-spinner label="Loading preview" />
            }
            Preview
          </button>
        </div>
        <p class="text-fl-body-sm text-fl-ink-muted">
          Set 0 to remove every stale task and worker.
        </p>

        @if (preview(); as p) {
          @if (p.deletedJobs.length === 0 && p.deletedPods.length === 0) {
            <fl-empty-state [compact]="true" title="Nothing stale to clean up" />
          } @else {
            <div class="fl-grid-2">
              @if (p.deletedJobs.length > 0) {
                <div class="flex flex-col gap-1">
                  <span class="text-fl-body-sm font-semibold"
                    >Tasks to remove ({{ p.deletedJobs.length }})</span
                  >
                  @for (j of p.deletedJobs; track j) {
                    <span class="fl-mono text-fl-ink-muted">{{ j }}</span>
                  }
                </div>
              }
              @if (p.deletedPods.length > 0) {
                <div class="flex flex-col gap-1">
                  <span class="text-fl-body-sm font-semibold"
                    >Workers to remove ({{ p.deletedPods.length }})</span
                  >
                  @for (pod of p.deletedPods; track pod) {
                    <span class="fl-mono text-fl-ink-muted">{{ pod }}</span>
                  }
                </div>
              }
            </div>
            <div class="flex justify-end gap-2">
              <button flButton="ghost" type="button" (click)="cancelled.emit()">Cancel</button>
              <button
                flButton="danger"
                type="button"
                [disabled]="running()"
                (click)="confirmed.emit()"
              >
                @if (running()) {
                  <fl-spinner label="Removing" />
                }
                Remove stale builds
              </button>
            </div>
          }
        }
      </div>
    </fl-panel>
  `,
})
export class BuildNamespaceCleanup {
  readonly olderThanMinutes = model(0);
  readonly running = input(false);
  readonly preview = input<BuildNamespaceCleanupResultDto | null>(null);
  readonly previewRequested = output<void>();
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  constructor() {
    afterNextRender(() => document.getElementById('build-cleanup-age')?.focus());
  }
}
