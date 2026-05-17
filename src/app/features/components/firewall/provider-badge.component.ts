import { Component, computed, inject, input } from '@angular/core';
import { AppConfigService } from '../../../core/services/app-config.service';

@Component({
  selector: 'app-provider-badge',
  standalone: true,
  template: `
    <div class="inline-flex items-center gap-1.5">
      <img
        [src]="logoUrl()"
        [alt]="displayName()"
        class="w-4 h-4 object-contain"
        (error)="onImgError($event)"
      />
      <span class="text-sm font-medium capitalize">{{ displayName() }}</span>
    </div>
  `,
})
export class ProviderBadgeComponent {
  provider = input.required<string>();

  private readonly appConfig = inject(AppConfigService);

  readonly logoUrl = computed(() =>
    `${this.appConfig.apiBaseUrl}/api/v1/management/providers/${this.provider()}/logo`
  );

  displayName(): string {
    const p = this.provider().toLowerCase();
    switch (p) {
      case 'hetzner':    return 'Hetzner';
      case 'contabo':    return 'Contabo';
      case 'scaleway':   return 'Scaleway';
      case 'aws':        return 'AWS';
      case 'digitalocean': return 'DigitalOcean';
      case 'gcp':
      case 'google':     return 'Google Cloud';
      case 'azure':      return 'Azure';
      default:           return this.provider();
    }
  }

  onImgError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
