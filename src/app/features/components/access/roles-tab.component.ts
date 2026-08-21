import { Component, inject } from '@angular/core';
import {
  HlmCardDirective,
  HlmCardContentDirective,
} from '@spartan-ng/ui-card-helm';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { IamService } from '../../service/iam.service';

@Component({
  selector: 'app-roles-tab',
  standalone: true,
  imports: [HlmCardDirective, HlmCardContentDirective, HlmBadgeDirective],
  template: `
    <div class="grid gap-4 md:grid-cols-2">
      @for (r of iam.roles(); track r.key) {
        <div hlmCard>
          <div hlmCardContent class="pt-5 space-y-3">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-semibold text-foreground">{{ r.name }}</h3>
                @if (!r.grantable) {
                  <span hlmBadge variant="outline" class="text-[10px] uppercase tracking-wide">
                    {{ r.assignable ? 'not yours to grant' : 'assigned by the platform' }}
                  </span>
                }
              </div>
              <p class="text-sm text-muted-foreground">{{ r.description }}</p>
            </div>
            <div class="flex flex-wrap gap-1.5">
              @for (p of r.permissions; track p) {
                <span hlmBadge variant="secondary" class="text-[11px] font-mono">{{ p }}</span>
              }
            </div>
          </div>
        </div>
      }
    </div>
    <p class="mt-4 text-xs text-muted-foreground">
      Built-in roles are read-only. Custom roles are not available at launch.
      Two of these come with a sandbox tenancy and are never granted by hand;
      <span class="font-medium">Owner</span> is conferred only by another owner.
    </p>
  `,
})
export class RolesTabComponent {
  protected readonly iam = inject(IamService);
}
