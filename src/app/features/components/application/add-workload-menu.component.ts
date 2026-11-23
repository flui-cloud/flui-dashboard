import { Component, inject, input } from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Router } from '@angular/router';
import { InstallPromptService } from '../../../core/services/install-prompt.service';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideGitBranch, lucidePlus, lucideStore } from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

export type AddScope = 'applications' | 'data' | null;

export const DEPLOY_FROM_REPOSITORY = '/apps/deploy/new';
export const CATALOG = '/apps/catalog';

export function catalogQueryFor(scope: AddScope): Record<string, string> {
  return scope ? { list: scope } : {};
}

@Component({
  selector: 'app-add-workload-menu',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, FlButton, FlIcon],
  providers: [provideIcons({ lucideChevronDown, lucideGitBranch, lucidePlus, lucideStore })],
  host: { class: 'inline-flex' },
  template: `
    <button
      flButton="primary"
      type="button"
      [cdkMenuTriggerFor]="menu"
      [cdkMenuPosition]="[
        { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
      ]"
      data-testid="add-workload"
    >
      <fl-icon name="lucidePlus" />
      {{ label() }}
      <fl-icon name="lucideChevronDown" [size]="14" />
    </button>
    <ng-template #menu>
      <div class="fl-menu" cdkMenu>
        <button
          type="button"
          class="fl-menu__item"
          cdkMenuItem
          (cdkMenuItemTriggered)="deploy()"
          data-testid="add-from-repository"
        >
          <fl-icon name="lucideGitBranch" [size]="14" />
          Deploy from a repository
        </button>
        <button
          type="button"
          class="fl-menu__item"
          cdkMenuItem
          (cdkMenuItemTriggered)="install()"
          data-testid="add-from-catalog"
        >
          <fl-icon name="lucideStore" [size]="14" />
          Install from the catalog
        </button>
      </div>
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
