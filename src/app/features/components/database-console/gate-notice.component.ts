import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';

/**
 * Inline notice for consoles whose read-only gate is NOT enforced by the engine itself.
 * SQL runs in a real read-only transaction the database enforces; Redis/Mongo/Kafka and the
 * REST Dev Tools have no read-only connection mode, so Flui classifies each command/request
 * and blocks writes while read-only is on. That classification is a guardrail, not a hard
 * guarantee — a mis-classified command could slip through. This makes the difference explicit.
 */
@Component({
  selector: 'app-gate-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ lucideTriangleAlert })],
  template: `
    <div
      class="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400"
      [title]="tooltip()"
    >
      <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Read-only here is a Flui safeguard (command check) —
        <span class="font-semibold">not enforced by {{ engine() }}</span>. Keep it on for
        safety; it's a guardrail, not a hard guarantee.
      </span>
    </div>
  `,
})
export class GateNoticeComponent {
  readonly engine = input('the engine');
  readonly tooltip = computed(
    () =>
      `Unlike SQL — which runs in a real read-only transaction the database enforces — ` +
      `${this.engine()} has no read-only connection mode. Flui inspects each command and ` +
      `blocks writes while read-only is on, but a mis-classified command could still run. ` +
      `Treat read-only as a guardrail, not a guarantee.`,
  );
}
