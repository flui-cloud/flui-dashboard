import { Component, input } from '@angular/core';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideX } from '@ng-icons/lucide';

@Component({
  selector: 'app-usage-status-badge',
  standalone: true,
  imports: [HlmBadgeDirective, NgIcon],
  providers: [
    provideIcons({
      lucideCheck,
      lucideX,
    }),
  ],
  template: `
    <span
      hlmBadge
      [variant]="variant()"
      class="inline-flex items-center gap-1.5 font-medium"
    >
      <ng-icon [name]="icon()" class="h-3 w-3" />
      {{ label() }}
    </span>
  `,
})
export class UsageStatusBadgeComponent {
  inUse = input.required<boolean>();

  variant() {
    return this.inUse() ? 'default' : 'outline';
  }

  icon() {
    return this.inUse() ? 'lucideCheck' : 'lucideX';
  }

  label() {
    return this.inUse() ? 'In Use' : 'Unused';
  }
}
