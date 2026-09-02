import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';
import { SidebarNavItem } from '@dawit-io/spartan-sidebar-core';

export type { SidebarNavItem };

@Component({
  selector: 'hlm-sidebar-group-tooltip',
  standalone: true,
  imports: [RouterModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div
      class="bg-popover text-popover-foreground rounded-md border border-border shadow-md z-50"
    >
      <div class="flex flex-col py-2">
        @for (item of items(); track item.link) {
        <a
          [routerLink]="item.link"
          [routerLinkActive]="item.routerLinkActive || ''"
          class="text-sm text-center hover:bg-accent hover:text-accent-foreground px-4 py-2 cursor-pointer"
          (click)="onNavigate(item.link)"
        >
          {{ item.label }}
        </a>
        }
      </div>
    </div>
  `,
})
export class HlmSidebarGroupTooltipComponent {
  public readonly groupLabel = input.required<string>();
  public readonly items = input.required<SidebarNavItem[]>();

  public readonly navigate = output<string>();

  onNavigate(link: string) {
    this.navigate.emit(link);
  }
}
