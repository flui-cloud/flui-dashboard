import { Component, Input } from '@angular/core';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideShieldCheck,
  lucideCircleAlert,
  lucideServerOff,
} from '@ng-icons/lucide';
import { InstanceOwnership } from '../../model/instance.models';

@Component({
  selector: 'app-instance-managed-badge',
  standalone: true,
  imports: [HlmBadgeDirective, NgIcon],
  providers: [
    provideIcons({
      lucideShieldCheck,
      lucideCircleAlert,
      lucideServerOff,
    }),
  ],
  template: `
    @switch (ownership) {
      @case ('self') {
        <span
          hlmBadge
          variant="default"
          class="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
        >
          <ng-icon name="lucideShieldCheck" class="h-3 w-3" />
          Managed by Flui
        </span>
      }
      @case ('other-flui') {
        <span
          hlmBadge
          variant="default"
          class="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
          title="Provisioned by another Flui installation sharing this cloud provider account"
        >
          <ng-icon name="lucideServerOff" class="h-3 w-3" />
          Other installation
        </span>
      }
      @default {
        <span
          hlmBadge
          variant="destructive"
          class="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium"
        >
          <ng-icon name="lucideCircleAlert" class="h-3 w-3" />
          Unmanaged
        </span>
      }
    }
  `,
})
export class InstanceManagedBadgeComponent {
  @Input({ required: true }) ownership!: InstanceOwnership;
}
