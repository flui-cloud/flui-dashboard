import { Component, computed, input } from '@angular/core';
import { FlAlert } from '../../../ui/patterns/alert';

/**
 * Inline notice for consoles whose read-only gate is NOT enforced by the engine itself.
 * SQL runs in a real read-only transaction the database enforces; Redis/Mongo/Kafka and the
 * REST Dev Tools have no read-only connection mode, so Flui classifies each command/request
 * and blocks writes while read-only is on. That classification is a guardrail, not a hard
 * guarantee — a mis-classified command could slip through. This makes the difference explicit.
 */
@Component({
  selector: 'app-gate-notice',
  imports: [FlAlert],
  host: { class: 'block' },
  template: `
    <fl-alert tone="warning" title="Read-only is a Flui safeguard" [attr.title]="tooltip()">
      {{ engine() }} has no read-only mode, so Flui checks each command and blocks writes. Keep it
      on: it is a guardrail, not a guarantee.
    </fl-alert>
  `,
})
export class GateNoticeComponent {
  readonly engine = input('the engine');
  readonly tooltip = computed(
    () =>
      `SQL runs in a read-only transaction the database enforces. ` +
      `${this.engine()} has no read-only connection mode: Flui inspects each command and ` +
      `blocks writes while read-only is on, but a misclassified command could still run.`,
  );
}
