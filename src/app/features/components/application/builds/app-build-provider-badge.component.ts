import { Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideGithub, lucideBox, lucideFileCode, lucideHammer } from '@ng-icons/lucide';
import { AppBuildResponseDto } from '../../../../core/api/model/appBuildResponseDto';

type Provider = AppBuildResponseDto['provider'];

interface ProviderMeta {
  label: string;
  icon: 'lucideGithub' | 'lucideBox' | 'lucideFileCode' | 'lucideHammer';
  cssClass: string;
}

const BASE = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium';

function metaFor(provider: Provider): ProviderMeta {
  switch (provider) {
    case 'GITHUB_ACTIONS':
      return { label: 'GitHub Actions', icon: 'lucideGithub', cssClass: `${BASE} bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400` };
    case 'IN_CLUSTER_AGENT':
      return { label: 'Flui In-Cluster', icon: 'lucideHammer', cssClass: `${BASE} bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400` };
    case 'RAILPACK':
      return { label: 'Railpack', icon: 'lucideBox', cssClass: `${BASE} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400` };
    case 'DOCKERFILE':
      return { label: 'Dockerfile', icon: 'lucideFileCode', cssClass: `${BASE} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300` };
    default:
      return { label: provider, icon: 'lucideHammer', cssClass: `${BASE} bg-muted text-muted-foreground` };
  }
}

@Component({
  selector: 'app-build-provider-badge',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideGithub, lucideBox, lucideFileCode, lucideHammer })],
  template: `
    <span [class]="meta().cssClass">
      <ng-icon [name]="meta().icon" class="h-3 w-3" />
      {{ meta().label }}
    </span>
  `,
})
export class AppBuildProviderBadgeComponent {
  provider = input.required<Provider>();
  meta = computed(() => metaFor(this.provider()));
}
