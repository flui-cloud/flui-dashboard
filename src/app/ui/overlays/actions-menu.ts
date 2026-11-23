import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideEllipsis } from '@ng-icons/lucide';
import { FlButton } from '../primitives/button';
import { FlIcon } from '../primitives/icon';

export interface MenuAction {
  readonly id: string;
  readonly label: string;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly hint?: string;
  readonly separatorBefore?: boolean;
}

@Component({
  selector: 'fl-actions-menu',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, FlButton, FlIcon],
  providers: [provideIcons({ lucideChevronDown, lucideEllipsis })],
  template: `
    @if (compact()) {
      <button
        flButton="ghost"
        size="sm"
        type="button"
        [iconOnly]="true"
        [attr.aria-label]="label()"
        [cdkMenuTriggerFor]="menu"
      >
        <fl-icon name="lucideEllipsis" />
      </button>
    } @else {
      <button flButton type="button" [size]="size()" [cdkMenuTriggerFor]="menu">
        {{ label() }}
        <fl-icon name="lucideChevronDown" [size]="14" />
      </button>
    }
    <ng-template #menu>
      <div class="fl-menu" cdkMenu>
        @for (item of items(); track item.id) {
          @if (item.separatorBefore) {
            <div class="fl-menu__sep" role="separator"></div>
          }
          <button
            type="button"
            class="fl-menu__item"
            cdkMenuItem
            [class.fl-menu__item--danger]="item.danger"
            [class.fl-menu__item--hinted]="!!item.hint"
            [cdkMenuItemDisabled]="!!item.disabled"
            (cdkMenuItemTriggered)="action.emit(item.id)"
          >
            {{ item.label }}
            @if (item.hint) {
              <span class="fl-menu__hint">{{ item.hint }}</span>
            }
          </button>
        }
      </div>
    </ng-template>
  `,
})
export class FlActionsMenu {
  readonly items = input.required<readonly MenuAction[]>();
  readonly label = input('Actions');
  readonly size = input<'md' | 'sm'>('md');
  readonly compact = input(false);
  readonly action = output<string>();
}
