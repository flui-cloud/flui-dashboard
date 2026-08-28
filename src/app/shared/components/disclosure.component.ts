import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronRight } from '@ng-icons/lucide';

let nextId = 0;

@Component({
  selector: 'app-disclosure',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideChevronDown, lucideChevronRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="rounded-lg border transition-colors"
      [class]="
        tone() === 'attention'
          ? 'border-amber-500/40 bg-amber-500/[0.05]'
          : 'border-border bg-card'
      "
    >
      <button
        type="button"
        class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="id"
        [attr.data-testid]="testid() ? testid() + '-toggle' : null"
        (click)="open.set(!open())"
      >
        <ng-icon
          [name]="open() ? 'lucideChevronDown' : 'lucideChevronRight'"
          class="h-4 w-4 shrink-0 text-muted-foreground"
        />

        @if (icon(); as name) {
          <ng-icon
            [name]="name"
            class="h-4 w-4 shrink-0"
            [class]="tone() === 'attention' ? 'text-amber-500' : 'text-muted-foreground'"
          />
        }

        <span class="shrink-0 text-sm font-medium text-foreground">
          {{ label() }}
        </span>

        <!-- The answer, while shut. Without it the row is a hidden page. -->
        <span
          class="ml-auto truncate text-[13px] text-muted-foreground"
          [attr.data-testid]="testid() ? testid() + '-summary' : null"
        >
          {{ summary() }}
        </span>
      </button>

      @if (open()) {
        <div
          [id]="id"
          class="border-t border-border px-4 py-4"
          [attr.data-testid]="testid()"
        >
          <ng-content />
        </div>
      }
    </div>
  `,
})
export class DisclosureComponent {
  readonly label = input.required<string>();

  readonly summary = input('');

  readonly icon = input<string | null>(null);

  readonly tone = input<'plain' | 'attention'>('plain');

  readonly open = model(false);

  readonly testid = input<string | null>(null);

  protected readonly id = `disclosure-${nextId++}`;
}
