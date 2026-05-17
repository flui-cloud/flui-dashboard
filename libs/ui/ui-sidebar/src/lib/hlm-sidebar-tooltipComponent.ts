import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';

@Component({
  selector: 'hlm-sidebar-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-popover text-popover-foreground rounded-md border border-border p-2 shadow-md whitespace-nowrap text-sm z-50">
      {{ text() }}
    </div>
  `,
})
export class HlmSidebarTooltipComponent {
  text = signal('');
}
