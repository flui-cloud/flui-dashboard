import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, computed, effect, inject, input, output } from '@angular/core';

import { FlAlert } from '../../../../ui/patterns/alert';
import { FlButton } from '../../../../ui/primitives/button';
import { FlStatus } from '../../../../ui/primitives/status';
import { BackupService } from '../../../service/backup.service';
import { ActiveOperation } from '../../../model/backup.models';

let nextId = 0;

@Component({
  selector: 'app-backup-progress-modal',
  imports: [CdkTrapFocus, FlAlert, FlButton, FlStatus],
  template: `
    @if (op(); as o) {
      <div
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (keydown.escape)="onClose()"
      >
        <div class="fl-dialog" role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId">
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" [id]="titleId">{{ title() }}</h2>
          </header>
          <div class="fl-dialog__body">
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-fl-body-sm text-fl-ink-muted">{{
                  o.status === 'running' ? o.message || 'In progress…' : ''
                }}</span>
                <span class="fl-num text-fl-body-sm text-fl-ink-muted">{{ o.percentage }}%</span>
              </div>
              <span
                class="fl-bar"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                [attr.aria-valuenow]="o.percentage"
                [attr.aria-label]="title()"
                ><span [style.width.%]="o.percentage"></span
              ></span>
            </div>

            @if (o.status === 'running' && o.currentStep) {
              <p class="text-fl-body-sm text-fl-ink-muted">Step {{ o.currentStep }}</p>
            }
            @if (o.status === 'failed') {
              <fl-alert tone="error" title="Failed" data-testid="progress-failed">{{
                o.error || 'It failed.'
              }}</fl-alert>
            } @else if (o.status === 'completed' && o.partial) {
              <fl-alert
                tone="warning"
                title="Finished, but not everything was backed up"
                data-testid="progress-partial"
                >{{ o.detail }}</fl-alert
              >
            } @else if (o.status === 'completed') {
              <div class="flex flex-col gap-1" data-testid="progress-completed">
                <fl-status tone="success" label="Completed successfully" />
                @if (o.detail) {
                  <p class="text-fl-body-sm text-fl-ink-muted">{{ o.detail }}</p>
                }
              </div>
            }
          </div>
          <footer class="fl-dialog__footer">
            <button flButton type="button" data-testid="progress-close" (click)="onClose()">
              {{ o.status === 'running' ? 'Keep running in background' : 'Close' }}
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class BackupProgressModalComponent {
  private readonly backup = inject(BackupService);

  readonly operationId = input.required<string | null>();
  readonly title = input<string>('Backup operation');
  readonly closed = output<void>();
  readonly settled = output<ActiveOperation>();

  protected readonly titleId = `backup-progress-title-${nextId++}`;
  private announced: string | null = null;

  readonly op = computed(() => {
    const id = this.operationId();
    if (!id) return null;
    return this.backup.activeOperations()[id] ?? null;
  });

  constructor() {
    effect(() => {
      const o = this.op();
      if (!o || o.status === 'running' || this.announced === o.operationId) return;
      this.announced = o.operationId;
      this.settled.emit(o);
    });
  }

  onClose(): void {
    const id = this.operationId();
    this.closed.emit();
    if (id) this.backup.clearOperation(id);
  }
}
