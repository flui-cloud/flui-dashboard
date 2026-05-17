import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

export interface SidebarNavItem {
  label: string;
  link: string;
  routerLinkActive?: string;
  icon?: string;
}

@Component({
  selector: 'hlm-sidebar-group-tooltip',
  standalone: true,
  imports: [CommonModule, RouterModule],
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
