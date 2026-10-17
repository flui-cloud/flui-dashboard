import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { InstallPromptService } from '../../../core/services/install-prompt.service';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideGitBranch, lucidePlus, lucideStore } from '@ng-icons/lucide';
import { BrnMenuTriggerDirective } from '@spartan-ng/brain/menu';
import { HlmMenuComponent, HlmMenuItemDirective, HlmMenuItemIconDirective } from '@spartan-ng/ui-menu-helm';

export type AddScope = 'applications' | 'data' | null;

export const DEPLOY_FROM_REPOSITORY = '/apps/deploy/new';
export const CATALOG = '/apps/catalog';

export function catalogQueryFor(scope: AddScope): Record<string, string> {
  return scope ? { list: scope } : {};
}

@Component({
  selector: 'app-add-workload-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, BrnMenuTriggerDirective, HlmMenuComponent, HlmMenuItemDirective, HlmMenuItemIconDirective],
  providers: [provideIcons({ lucideChevronDown, lucideGitBranch, lucidePlus, lucideStore })],
  host: { class: 'inline-flex' },
  template: `
    <button
      type="button"
      [brnMenuTriggerFor]="menu"
      align="end"
      class="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
      data-testid="add-workload"
    >
      <ng-icon name="lucidePlus" class="h-4 w-4" />
      {{ label() }}
      <ng-icon name="lucideChevronDown" class="h-3.5 w-3.5 opacity-80" />
    </button>
    <ng-template #menu>
      <hlm-menu class="w-60">
        <button hlmMenuItem type="button" (click)="deploy()" data-testid="add-from-repository">
          <ng-icon name="lucideGitBranch" hlmMenuIcon />
          <span>Deploy from a repository</span>
        </button>
        <button hlmMenuItem type="button" (click)="install()" data-testid="add-from-catalog">
          <ng-icon name="lucideStore" hlmMenuIcon />
          <span>Install from the catalog</span>
        </button>
      </hlm-menu>
    </ng-template>
  `,
})
export class AddWorkloadMenuComponent {
  readonly scope = input<AddScope>(null);
  readonly label = input('Add');

  private readonly router = inject(Router);
  private readonly installPrompt = inject(InstallPromptService);

  protected deploy(): void {
    if (this.installPrompt.requireInstall()) return;
    void this.router.navigate([DEPLOY_FROM_REPOSITORY]);
  }

  protected install(): void {
    void this.router.navigate([CATALOG], { queryParams: catalogQueryFor(this.scope()) });
  }
}
