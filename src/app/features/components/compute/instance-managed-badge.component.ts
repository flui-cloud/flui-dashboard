import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldCheck, lucideCircleAlert, lucideServerOff } from '@ng-icons/lucide';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @switch (ownership()) {
      @case ('self') {
        <span
          hlmBadge
          variant="default"
          class="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 border-green-300"
        >
          <ng-icon name="lucideShieldCheck" class="h-3 w-3" />
          Managed by Flui
        </span>
      }
      @case ('other-flui') {
        <span
          hlmBadge
          variant="default"
          class="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 border-amber-300"
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
  readonly ownership = input.required<InstanceOwnership>();
}
