import { Component, computed, input, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { AgentConcession, ConcessionOperation } from '../../model/agent-cycle.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-agent-revoke-dialog',
  imports: [FlAlert, FlLoadingState, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="dismissed.emit()"
    >
      <div
        class="fl-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="agent-revoke-title"
        (click)="$event.stopPropagation()"
        data-testid="revoke-dialog"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="agent-revoke-title">Take this permission back</h2>
          <button
            type="button"
            class="fl-dialog__close"
            aria-label="Close"
            (click)="dismissed.emit()"
          >
            <fl-icon name="lucideX" />
          </button>
        </header>

        <div class="fl-dialog__body">
          <p class="m-0">
            Your agent will stop being able to
            <code class="fl-mono">{{ concession().sentence }}</code>
            without asking. Nothing else changes: this was a pause removed, not a permission
            granted, so nothing is taken away from you.
          </p>

          @if (loading()) {
            <fl-loading-state [rows]="2" data-testid="running-loading" />
          } @else {
            @if (running().length) {
              <fl-alert tone="warning" title="Already running" data-testid="what-continues">
                {{ running().length }}
                {{ running().length === 1 ? 'operation' : 'operations' }} already started under this
                permission and will carry on after you revoke it. Revoking stops the next departure,
                not this one.
                <ul class="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                  @for (op of running(); track op.id) {
                    <li class="fl-mono" data-testid="running-operation">
                      {{ op.operationType }}
                      @if (op.resourceName) {
                        · {{ op.resourceName }}
                      }
                      · {{ op.status }}
                      @if (op.progress !== null && op.progress !== undefined) {
                        · {{ op.progress }}%
                      }
                    </li>
                  }
                </ul>
              </fl-alert>
              <label class="fl-check items-start">
                <input
                  type="checkbox"
                  [checked]="alsoStop()"
                  (change)="alsoStop.set(!alsoStop())"
                  data-testid="also-stop"
                />
                <span>
                  Also ask them to stop.
                  <span class="text-fl-ink-muted">
                    Honoured at the next step boundary and never mid-step: a provisioning cut in
                    half leaves paid-for resources behind.
                  </span>
                </span>
              </label>
            } @else {
              <p class="m-0 text-fl-ink-muted" data-testid="what-continues">
                Nothing is running under this permission. Revoking takes effect immediately and
                leaves nothing behind.
              </p>
            }
          }

          @if (error(); as e) {
            <fl-alert tone="error" title="Not revoked" data-testid="revoke-error">{{ e }}</fl-alert>
          }
        </div>

        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="dismissed.emit()">Keep it</button>
          @if (!loading()) {
            <button
              flButton="danger"
              type="button"
              [disabled]="busy()"
              (click)="confirm.emit({ alsoStop: alsoStop() })"
              data-testid="confirm-revoke"
            >
              @if (busy()) {
                <fl-spinner label="Revoking" />
              }
              {{ confirmLabel() }}
            </button>
          }
        </footer>
      </div>
    </div>
  `,
})
export class AgentRevokeDialogComponent {
  readonly concession = input.required<AgentConcession>();
  readonly running = input<ConcessionOperation[]>([]);
  readonly loading = input(false);
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly dismissed = output<void>();
  readonly confirm = output<{ alsoStop: boolean }>();

  protected readonly alsoStop = signal(false);

  protected readonly confirmLabel = computed(() =>
    this.alsoStop() ? 'Revoke and ask them to stop' : 'Revoke',
  );
}
