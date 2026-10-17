import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideX } from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { InstallPromptService } from '../../../core/services/install-prompt.service';
import { INSTALL_FLUI_URL } from '../../../core/utils/install-flui';

@Component({
  selector: 'app-install-flui-dialog',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  providers: [provideIcons({ lucideExternalLink, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (prompt.dialogOpen()) {
      <div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" (click)="close()">
        <div class="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-flui-title"
            tabindex="-1"
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-6 outline-none"
            (click)="$event.stopPropagation()"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 id="install-flui-title" class="text-lg font-semibold text-gray-900 dark:text-white">
                  Want the full experience?
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  This demo is read-only. Install Flui on your own server: it is free and open source.
                </p>
              </div>
              <button
                hlmBtn
                variant="ghost"
                size="sm"
                type="button"
                aria-label="Close"
                class="h-8 w-8 p-0 flex-shrink-0"
                data-testid="install-flui-close"
                (click)="close()"
              >
                <ng-icon name="lucideX" class="h-4 w-4" />
              </button>
            </div>

            <div class="mt-5 flex flex-col gap-2">
              <a
                #install
                hlmBtn
                [href]="installUrl"
                target="_blank"
                rel="noopener"
                data-testid="install-flui-link"
                (click)="close()"
              >
                Install Flui
                <ng-icon name="lucideExternalLink" class="h-4 w-4 ml-1.5" />
              </a>
              <button hlmBtn variant="ghost" type="button" data-testid="install-flui-stay" (click)="close()">
                Keep looking around
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class InstallFluiDialogComponent {
  protected readonly prompt = inject(InstallPromptService);
  protected readonly installUrl = INSTALL_FLUI_URL;
  private readonly install = viewChild<ElementRef<HTMLAnchorElement>>('install');

  constructor() {
    effect(() => {
      const link = this.install();
      if (link) setTimeout(() => link.nativeElement.focus());
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.prompt.dialogOpen()) this.close();
  }

  protected close(): void {
    this.prompt.close();
  }
}
