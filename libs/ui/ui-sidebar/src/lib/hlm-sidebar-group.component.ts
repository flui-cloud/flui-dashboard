import { Component, computed, input } from '@angular/core';
import { hlm } from '@spartan-ng/brain/core';
import { BrnSidebarGroupDirective } from '@dawit-io/spartan-sidebar-core';
import { ClassValue } from 'clsx';
import { SidebarNavItem } from './hlm-sidebar-group-tooltip.component';

@Component({
  selector: 'hlm-sidebar-group',
  standalone: true,
  hostDirectives: [BrnSidebarGroupDirective],
  host: {
    '[class]': '_computedClass()',
  },
  template: `
    <ng-content />
  `,
})
export class HlmSidebarGroupComponent {
  public readonly userClass = input<ClassValue>('');
  public readonly items = input<SidebarNavItem[]>([]);

  protected readonly _computedClass = computed(() => hlm('flex flex-col gap-1', this.userClass()));
}
