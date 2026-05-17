import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye } from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { InstanceWithLabels } from '../../model/instance.models';

@Component({
  selector: 'app-instance-actions',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  providers: [
    provideIcons({
      lucideEye,
    }),
  ],
  template: `
    <div class="flex items-center justify-center">
      @if (isManaged) {
        <button
          hlmBtn
          variant="ghost"
          size="sm"
          (click)="onViewDetails()"
          class="h-8 px-3"
          title="View details"
        >
          <ng-icon name="lucideEye" class="h-4 w-4 mr-2" />
          Details
        </button>
      } @else {
        <span class="text-xs text-muted-foreground italic">
          No actions
        </span>
      }
    </div>
  `,
})
export class InstanceActionsComponent {
  @Input({ required: true }) instance!: InstanceWithLabels;
  @Input({ required: true }) isManaged!: boolean;

  constructor(private readonly router: Router) {}

  onViewDetails() {
    this.router.navigate([
      '/infrastructure/compute',
      this.instance.provider,
      this.instance.providerId,
    ]);
  }
}
