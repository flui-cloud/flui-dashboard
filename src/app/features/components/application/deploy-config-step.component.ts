import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeployWizardStateService } from '../../service/deploy-wizard-state.service';

const RESOURCE_PROFILES = ['nano', 'micro', 'small', 'medium', 'large', 'xlarge'] as const;

@Component({
  selector: 'app-deploy-config-step',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5">
      <!-- Port -->
      <div class="space-y-1.5">
        <label class="text-sm font-medium">Application Port</label>
        <input
          type="number"
          [ngModel]="config().port"
          (ngModelChange)="updateConfig('port', $event)"
          min="1"
          max="65535"
          class="h-9 w-32 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p class="text-xs text-muted-foreground">The port your application listens on.</p>
      </div>

      <!-- Healthcheck path -->
      <div class="space-y-1.5">
        <label class="text-sm font-medium">Healthcheck Path</label>
        <input
          type="text"
          [ngModel]="config().healthcheckPath"
          (ngModelChange)="updateConfig('healthcheckPath', $event)"
          placeholder="/health"
          class="h-9 w-64 rounded-md border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p class="text-xs text-muted-foreground">HTTP path used to check application readiness.</p>
      </div>

      <!-- Resource profile -->
      <div class="space-y-1.5">
        <label class="text-sm font-medium">Resource Profile</label>
        <div class="flex flex-wrap gap-2">
          @for (profile of resourceProfiles; track profile) {
            <button
              type="button"
              (click)="updateConfig('resourceProfile', profile)"
              [class]="getProfileButtonClass(profile)"
            >
              {{ profile }}
            </button>
          }
        </div>
      </div>

      <!-- Replicas -->
      <div class="flex items-start gap-6">
        <div class="space-y-1.5">
          <label class="text-sm font-medium">Min Replicas</label>
          <input
            type="number"
            [ngModel]="config().minReplicas"
            (ngModelChange)="updateConfig('minReplicas', +$event)"
            min="1"
            max="10"
            class="h-9 w-20 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium">Max Replicas</label>
          <input
            type="number"
            [ngModel]="config().maxReplicas"
            (ngModelChange)="updateConfig('maxReplicas', +$event)"
            min="1"
            max="20"
            class="h-9 w-20 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
    </div>
  `,
})
export class DeployConfigStepComponent {
  private readonly state = inject(DeployWizardStateService);

  config = this.state.deployConfig;
  readonly resourceProfiles = RESOURCE_PROFILES;

  updateConfig<K extends keyof ReturnType<typeof this.state.deployConfig>>(
    key: K,
    value: ReturnType<typeof this.state.deployConfig>[K]
  ): void {
    this.state.deployConfig.update(c => ({ ...c, [key]: value }));
  }

  getProfileButtonClass(profile: string): string {
    const isSelected = this.config().resourceProfile === profile;
    const base = 'px-3 py-1.5 rounded-md border text-sm transition-colors capitalize';
    return isSelected
      ? `${base} border-primary bg-primary/10 text-foreground font-medium`
      : `${base} border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground`;
  }
}
