import { Component, computed, input } from '@angular/core';
import { ProviderMarkComponent } from '../../../shared/components/provider-mark.component';

const NAMES: Record<string, string> = {
  hetzner: 'Hetzner',
  contabo: 'Contabo',
  scaleway: 'Scaleway',
  aws: 'AWS',
  digitalocean: 'DigitalOcean',
  gcp: 'Google Cloud',
  google: 'Google Cloud',
  azure: 'Azure',
};

@Component({
  selector: 'app-provider-badge',
  imports: [ProviderMarkComponent],
  host: { class: 'fl-row' },
  template: `
    <app-provider-mark [name]="displayName()" [size]="16" />
    <span>{{ displayName() }}</span>
  `,
})
export class ProviderBadgeComponent {
  provider = input.required<string>();

  readonly displayName = computed(() => NAMES[this.provider().toLowerCase()] ?? this.provider());
}
