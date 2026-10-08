import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { ProviderMarkComponent } from '../../../shared/components/provider-mark.component';

@Component({
  selector: 'app-provider-badge',
  standalone: true,
  imports: [ProviderMarkComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="inline-flex items-center gap-1.5">
      <app-provider-mark [name]="displayName()" [size]="16" />
      <span class="text-sm font-medium capitalize">{{ displayName() }}</span>
    </div>
  `,
})
export class ProviderBadgeComponent {
  provider = input.required<string>();

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
}
