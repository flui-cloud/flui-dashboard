import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo } from '@ng-icons/lucide';

let nextId = 0;

@Component({
  selector: 'app-explain',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideInfo })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-1.5 align-middle">
      <span [class]="labelClass()">{{ label() }}</span>
      <button
        type="button"
        class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="id"
        [attr.aria-label]="open() ? 'Hide the explanation' : 'What is this?'"
        [attr.data-testid]="testid() ? testid() + '-toggle' : null"
        (click)="open.set(!open())"
      >
        <ng-icon name="lucideInfo" class="h-3.5 w-3.5" />
      </button>
    </span>

    @if (open()) {
      <p
        [id]="id"
        class="m-0 mt-1.5 max-w-prose text-[12px] leading-relaxed text-muted-foreground"
        [attr.data-testid]="testid()"
      >
        <ng-content />
      </p>
    }
  `,
})
export class ExplainComponent {
  readonly label = input.required<string>();

  readonly labelClass = input('text-[12px] font-medium text-foreground');

  readonly testid = input<string | null>(null);

  protected readonly open = signal(false);
  protected readonly id = `explain-${nextId++}`;
}
