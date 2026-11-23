import { Component, input, model } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronRight } from '@ng-icons/lucide';
import { FlButton } from '../../ui/primitives/button';
import { FlIcon } from '../../ui/primitives/icon';

let nextId = 0;

@Component({
  selector: 'app-disclosure',
  imports: [FlButton, FlIcon],
  providers: [provideIcons({ lucideChevronDown, lucideChevronRight })],
  template: `
    <div class="flex flex-col">
      <button
        flButton="ghost"
        type="button"
        class="w-full justify-start px-2 text-left"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="id"
        [attr.data-testid]="testid() ? testid() + '-toggle' : null"
        (click)="open.set(!open())"
      >
        <fl-icon [name]="open() ? 'lucideChevronDown' : 'lucideChevronRight'" />

        @if (icon(); as name) {
          <span
            class="inline-flex"
            [class]="tone() === 'attention' ? 'fl-status fl-status--warning' : 'text-fl-ink-muted'"
          >
            <fl-icon [name]="name" />
          </span>
        }

        <span class="shrink-0 font-medium text-fl-ink">{{ label() }}</span>

        <span
          class="ml-auto truncate text-fl-body-sm text-fl-ink-muted"
          [attr.data-testid]="testid() ? testid() + '-summary' : null"
        >
          {{ summary() }}
        </span>
      </button>

      @if (open()) {
        <div [id]="id" class="pb-1 pl-8 pr-2 pt-2" [attr.data-testid]="testid()">
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
