import { Component, ElementRef, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import {
  UpgradeProviders,
  VisitorSignInService,
} from '../../../core/services/visitor-sign-in.service';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-visitor-sign-in-dialog',
  imports: [FlButton, FlIcon],
  providers: [provideIcons({ lucideX })],
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    @if (gate.dialogOpen()) {
      <div
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="close()"
      >
        <div
          #panel
          class="fl-dialog outline-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="visitor-sign-in-title"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" id="visitor-sign-in-title">Sign in to deploy</h2>
            <button
              type="button"
              class="fl-dialog__close"
              aria-label="Close"
              data-testid="visitor-sign-in-close"
              (click)="close()"
            >
              <fl-icon name="lucideX" />
            </button>
          </header>
          <div class="fl-dialog__body">
            <p class="text-fl-ink-secondary">Your visit, keys and agent come with you.</p>
            <div class="flex flex-col gap-2" data-sign-in-choices>
              @if (loading()) {
                <button flButton [block]="true" type="button" disabled>Continue with GitHub</button>
                <button flButton [block]="true" type="button" disabled>Continue with Google</button>
              } @else {
                @for (option of choices().providers; track option.provider) {
                  <button
                    flButton
                    [block]="true"
                    type="button"
                    [attr.data-testid]="'visitor-sign-in-' + option.provider"
                    [disabled]="gate.busy()"
                    (click)="gate.withProvider(option.provider)"
                  >
                    Continue with {{ option.name }}
                  </button>
                }
                @if (choices().email) {
                  <button
                    flButton
                    [block]="true"
                    type="button"
                    data-testid="visitor-sign-in-email"
                    [disabled]="gate.busy()"
                    (click)="gate.withEmail()"
                  >
                    Continue with email
                  </button>
                }
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class VisitorSignInDialogComponent {
  protected readonly gate = inject(VisitorSignInService);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly loading = signal(false);
  protected readonly choices = signal<UpgradeProviders>({ providers: [], email: false });

  private opener: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const open = this.gate.dialogOpen();
      untracked(() => {
        if (open) {
          this.opener = document.activeElement as HTMLElement | null;
          void this.load();
        } else if (this.opener) {
          const opener = this.opener;
          this.opener = null;
          setTimeout(() => opener.focus());
        }
      });
    });
  }

  protected onEscape(): void {
    if (this.gate.dialogOpen()) this.close();
  }

  protected close(): void {
    this.gate.close();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    setTimeout(() => this.panel()?.nativeElement.focus());
    const choices = await this.gate.providers();
    this.choices.set(choices);
    this.loading.set(false);
    setTimeout(() => this.firstChoice()?.focus());
  }

  private firstChoice(): HTMLButtonElement | null {
    return (
      this.panel()?.nativeElement.querySelector<HTMLButtonElement>(
        '[data-sign-in-choices] button:not([disabled])',
      ) ?? null
    );
  }
}
