import { Component, Input } from '@angular/core';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldCheck, lucideCircleAlert } from '@ng-icons/lucide';

@Component({
  selector: 'app-instance-managed-badge',
  standalone: true,
  imports: [HlmBadgeDirective, NgIcon],
  providers: [
    provideIcons({
      lucideShieldCheck,
      lucideCircleAlert,
    }),
  ],
  template: `
    @if (isManaged) {
      <span
        hlmBadge
        variant="default"
        class="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
      >
        <ng-icon name="lucideShieldCheck" class="h-3 w-3" />
        Managed by Flui
      </span>
    } @else {
      <span
        hlmBadge
        variant="destructive"
        class="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium"
      >
        <ng-icon name="lucideCircleAlert" class="h-3 w-3" />
        Unmanaged
      </span>
    }
  `,
})
export class InstanceManagedBadgeComponent {
  @Input({ required: true }) isManaged!: boolean;
}
