import { Component, ElementRef, effect, inject, untracked, viewChild } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideX } from '@ng-icons/lucide';
import { InstallPromptService } from '../../../core/services/install-prompt.service';
import { INSTALL_FLUI_URL } from '../../../core/utils/install-flui';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-install-flui-dialog',
  imports: [FlButton, FlIcon],
  providers: [provideIcons({ lucideExternalLink, lucideX })],
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    @if (prompt.dialogOpen()) {
      <div
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="close()"
      >
        <div
          class="fl-dialog outline-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-flui-title"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" id="install-flui-title">Want the full experience?</h2>
            <button
              type="button"
              class="fl-dialog__close"
              aria-label="Close"
              data-testid="install-flui-close"
              (click)="close()"
            >
              <fl-icon name="lucideX" />
            </button>
          </header>
          <div class="fl-dialog__body">
            <p class="text-fl-ink-secondary">
              This demo is read-only. Install Flui on your own server: it is free and open source.
            </p>
          </div>
          <footer class="fl-dialog__footer">
            <button
              flButton="ghost"
              type="button"
              data-testid="install-flui-stay"
              (click)="close()"
            >
              Keep looking around
            </button>
            <a
              #install
              flButton="primary"
              [href]="installUrl"
              target="_blank"
              rel="noopener"
              data-testid="install-flui-link"
              (click)="close()"
            >
              Install Flui
              <fl-icon name="lucideExternalLink" />
            </a>
          </footer>
        </div>
      </div>
    }
  `,
})
export class InstallFluiDialogComponent {
  protected readonly prompt = inject(InstallPromptService);
  protected readonly installUrl = INSTALL_FLUI_URL;
  private readonly install = viewChild<ElementRef<HTMLAnchorElement>>('install');

  private opener: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const open = this.prompt.dialogOpen();
      untracked(() => {
        if (open) {
          this.opener = document.activeElement as HTMLElement | null;
        } else if (this.opener) {
          const opener = this.opener;
          this.opener = null;
          setTimeout(() => opener.focus());
        }
      });
    });
    effect(() => {
      const link = this.install();
      if (link) setTimeout(() => link.nativeElement.focus());
    });
  }

  protected onEscape(): void {
    if (this.prompt.dialogOpen()) this.close();
  }

  protected close(): void {
    this.prompt.close();
  }
}
