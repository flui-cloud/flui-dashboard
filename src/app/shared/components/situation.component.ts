import { Component, input } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideArrowRight } from '@ng-icons/lucide';
import { FlIcon } from '../../ui/primitives/icon';
import { FlStatus } from '../../ui/primitives/status';

export interface SituationAction {
  does: string;
  why?: string;
}

@Component({
  selector: 'app-situation',
  imports: [FlIcon, FlStatus],
  providers: [provideIcons({ lucideArrowRight })],
  template: `
    <section
      class="flex flex-col gap-2 rounded-fl-lg border border-fl-border bg-fl-surface px-4 py-3"
      [attr.data-testid]="testid()"
    >
      @for (line of where(); track line) {
        <fl-status
          class="whitespace-normal"
          [tone]="tone() === 'attention' ? 'warning' : 'success'"
          [label]="line"
        />
      }

      @if (actions().length) {
        <ul class="m-0 flex list-none flex-col gap-1 p-0">
          @for (a of actions(); track a.does) {
            <li
              class="flex items-start gap-2 text-fl-body-sm text-fl-ink"
              [attr.data-testid]="testid() + '-todo'"
            >
              <fl-icon
                name="lucideArrowRight"
                [size]="14"
                class="mt-0.5 shrink-0 text-fl-ink-muted"
              />
              <span>
                {{ a.does }}
                @if (a.why) {
                  <span class="text-fl-ink-muted"> — {{ a.why }}</span>
                }
              </span>
            </li>
          }
        </ul>
      } @else {
        <p
          class="m-0 text-fl-body-sm text-fl-ink-muted"
          [attr.data-testid]="testid() + '-nothing-to-do'"
        >
          {{ nothingToDo() }}
        </p>
      }
    </section>
  `,
})
export class SituationComponent {
  readonly where = input.required<string[]>();

  readonly actions = input<SituationAction[]>([]);

  readonly nothingToDo = input('Nothing needs doing.');

  readonly tone = input<'plain' | 'attention'>('plain');

  readonly testid = input('situation');
}
