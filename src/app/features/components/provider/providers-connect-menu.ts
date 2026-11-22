import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucidePlus } from '@ng-icons/lucide';
import { ProviderDefinitionDto } from '../../../core/api';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-providers-connect-menu',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, FlButton, FlIcon],
  providers: [provideIcons({ lucidePlus, lucideChevronDown })],
  template: `
    <button
      flButton="primary"
      type="button"
      [size]="size()"
      [disabled]="providers().length === 0"
      [cdkMenuTriggerFor]="menu"
      data-testid="providers-connect"
    >
      <fl-icon name="lucidePlus" />
      Connect provider
      <fl-icon name="lucideChevronDown" [size]="14" />
    </button>
    <ng-template #menu>
      <div class="fl-menu" cdkMenu>
        @for (p of providers(); track p.id) {
          <button
            type="button"
            class="fl-menu__item"
            cdkMenuItem
            (cdkMenuItemTriggered)="connect.emit(p.id)"
          >
            {{ p.displayName }}
          </button>
        }
      </div>
    </ng-template>
  `,
})
export class ProvidersConnectMenu {
  readonly providers = input.required<readonly ProviderDefinitionDto[]>();
  readonly size = input<'md' | 'sm'>('md');
  readonly connect = output<string>();
}
