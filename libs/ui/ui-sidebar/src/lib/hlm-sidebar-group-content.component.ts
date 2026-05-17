import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { hlm } from '@spartan-ng/brain/core';
import {
  BrnSidebarGroupDirective,
  BrnSidebarService,
} from '@dawit-io/spartan-sidebar-core';
import { ClassValue } from 'clsx';
import { HlmSidebarItemComponent } from './hlm-sidebar-item.component';
import { NgIcon } from '@ng-icons/core';
import { SidebarNavItem } from './hlm-sidebar-group-tooltip.component';

@Component({
  selector: 'hlm-sidebar-group-content',
  standalone: true,
  imports: [CommonModule, RouterModule, HlmSidebarItemComponent, NgIcon],
  host: {
    '[class]': '_computedClass()',
    '[attr.data-state]':
      '_sidebarService.isExpanded() ? "expanded" : "collapsed"',
    '[attr.data-group-state]': '_group.isExpanded() ? "expanded" : "collapsed"',
  },
  template: `
    <div
      class="overflow-hidden transition-all duration-200"
      [class.opacity-100]="_group.isExpanded()"
      [class.opacity-0]="!_group.isExpanded()"
      [class.max-h-[1000px]="_group.isExpanded()"
      [class.max-h-0]="!_group.isExpanded()"
    >
      <div class="relative pl-6">
        <div class="bg-border absolute bottom-0 left-0 top-0 ml-2.5 w-px"></div>
        @if (items().length > 0) { @for (item of items(); track item.link) {
        <hlm-sidebar-item
          [label]="item.label"
          [routerLink]="item.link"
          [routerLinkActive]="item.routerLinkActive || ''"
          (clicked)="onNavigate(item.link)"
        >
          @if (item.icon) {
          <ng-icon
            [name]="item.icon"
            class="h-4 w-4 text-muted-foreground"
          ></ng-icon>
          }
        </hlm-sidebar-item>
        } } @else {
        <ng-content />
        }
      </div>
    </div>
  `,
})
export class HlmSidebarGroupContentComponent {
  protected readonly _group = inject(BrnSidebarGroupDirective);
  protected readonly _sidebarService = inject(BrnSidebarService);

  public readonly userClass = input<ClassValue>('');
  public readonly items = input<SidebarNavItem[]>([]);

  protected readonly _computedClass = computed(() =>
    hlm(
      'data-[state=collapsed]:hidden',
      'transition-all duration-200 ease-in-out',
      this.userClass()
    )
  );

  onNavigate(link: string) {
  }
}
