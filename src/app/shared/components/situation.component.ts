import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideCircleCheck, lucideCircleAlert } from '@ng-icons/lucide';

export interface SituationAction {
  does: string;
  why?: string;
}

@Component({
  selector: 'app-situation',
  standalone: true,
  imports: [NgIcon],
  providers: [
    provideIcons({ lucideArrowRight, lucideCircleAlert, lucideCircleCheck }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="rounded-lg border px-4 py-3.5"
      [class]="
        tone() === 'attention'
          ? 'border-amber-500/40 bg-amber-500/[0.05]'
          : 'border-border bg-card'
      "
      [attr.data-testid]="testid()"
    >
      <div class="flex items-start gap-3">
        <ng-icon
          [name]="tone() === 'attention' ? 'lucideCircleAlert' : 'lucideCircleCheck'"
          class="mt-0.5 h-4 w-4 shrink-0"
          [class]="tone() === 'attention' ? 'text-amber-500' : 'text-muted-foreground'"
        />

        <div class="min-w-0 space-y-1">
          @for (line of where(); track line) {
            <p class="m-0 text-sm text-foreground">{{ line }}</p>
          }

          @if (actions().length) {
            <ul class="m-0 mt-2 list-none space-y-1 p-0">
              @for (a of actions(); track a.does) {
                <li class="flex items-start gap-2" [attr.data-testid]="testid() + '-todo'">
                  <ng-icon
                    name="lucideArrowRight"
                    class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  />
                  <span class="text-[13px] text-foreground">
                    {{ a.does }}@if (a.why) {
                      <span class="text-muted-foreground"> — {{ a.why }}</span>
                    }
                  </span>
                </li>
              }
            </ul>
          } @else {
            <p
              class="m-0 mt-1 text-[13px] text-muted-foreground"
              [attr.data-testid]="testid() + '-nothing-to-do'"
            >
              {{ nothingToDo() }}
            </p>
          }
        </div>
      </div>
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
