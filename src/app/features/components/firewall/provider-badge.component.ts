import { Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs/operators';
import { ProviderLogoService } from '../../../shared/services/provider-logo.service';

@Component({
  selector: 'app-provider-badge',
  standalone: true,
  template: `
    <div class="inline-flex items-center gap-1.5">
      @if (logoUrl()) {
        <img
          [src]="logoUrl()"
          [alt]="displayName()"
          class="w-4 h-4 object-contain"
        />
      }
      <span class="text-sm font-medium capitalize">{{ displayName() }}</span>
    </div>
  `,
})
export class ProviderBadgeComponent {
  provider = input.required<string>();

  private readonly providerLogo = inject(ProviderLogoService);

  readonly logoUrl = toSignal(
    toObservable(
      computed(() => `/api/v1/management/providers/${this.provider()}/logo`),
    ).pipe(switchMap((url) => this.providerLogo.resolve(url))),
    { initialValue: null as string | null },
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
}
