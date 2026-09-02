import { Component, computed, contentChild, input, ChangeDetectionStrategy } from '@angular/core';
import { hlm } from '@spartan-ng/brain/core';
import { BrnSidebarGroupDirective } from '@dawit-io/spartan-sidebar-core';
import { ClassValue } from 'clsx';
import { HlmSidebarGroupContentComponent } from './hlm-sidebar-group-content.component';
import { SidebarNavItem } from './hlm-sidebar-group-tooltip.component';

@Component({
  selector: 'hlm-sidebar-group',
  standalone: true,
  hostDirectives: [BrnSidebarGroupDirective],
  host: {
    '[class]': '_computedClass()',
    '[style.display]': '_isVisible() ? null : "none"',
  },
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <ng-content />
  `,
})
export class HlmSidebarGroupComponent {
  public readonly userClass = input<ClassValue>('');
  public readonly items = input<SidebarNavItem[]>([]);

  protected readonly _content = contentChild(HlmSidebarGroupContentComponent);
  protected readonly _isVisible = computed(() => this._content()?.hasVisibleItems() ?? true);

  protected readonly _computedClass = computed(() => hlm('flex flex-col gap-1', this.userClass()));
}
