import { Component, computed, input } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideGithub, lucideBox, lucideFileCode, lucideHammer } from '@ng-icons/lucide';
import { AppBuildResponseDto } from '../../../../core/api/model/appBuildResponseDto';
import { FlIcon } from '../../../../ui/primitives/icon';

type Provider = AppBuildResponseDto['provider'];

interface ProviderMeta {
  label: string;
  icon: 'lucideGithub' | 'lucideBox' | 'lucideFileCode' | 'lucideHammer';
}

function metaFor(provider: Provider): ProviderMeta {
  switch (provider) {
    case 'GITHUB_ACTIONS':
      return { label: 'GitHub Actions', icon: 'lucideGithub' };
    case 'IN_CLUSTER_AGENT':
      return { label: 'In-cluster', icon: 'lucideHammer' };
    case 'RAILPACK':
      return { label: 'Railpack', icon: 'lucideBox' };
    case 'DOCKERFILE':
      return { label: 'Dockerfile', icon: 'lucideFileCode' };
    default:
      return { label: provider, icon: 'lucideHammer' };
  }
}

@Component({
  selector: 'app-build-provider-badge',
  standalone: true,
  imports: [FlIcon],
  providers: [provideIcons({ lucideGithub, lucideBox, lucideFileCode, lucideHammer })],
  host: { class: 'inline-flex items-center gap-1.5' },
  template: `
    <fl-icon class="text-fl-ink-muted" [name]="meta().icon" [size]="14" />
    <span>{{ meta().label }}</span>
  `,
})
export class AppBuildProviderBadgeComponent {
  provider = input.required<Provider>();
  meta = computed(() => metaFor(this.provider()));
}
