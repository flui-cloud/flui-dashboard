import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import {
  UpgradeProviders,
  VisitorSignInService,
} from '../../../core/services/visitor-sign-in.service';

@Component({
  selector: 'app-visitor-sign-in-dialog',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  providers: [provideIcons({ lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (gate.dialogOpen()) {
      <div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" (click)="close()">
        <div class="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] p-4">
          <div
            #panel
            role="dialog"
            aria-modal="true"
            aria-labelledby="visitor-sign-in-title"
            tabindex="-1"
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-6 outline-none"
            (click)="$event.stopPropagation()"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 id="visitor-sign-in-title" class="text-lg font-semibold text-gray-900 dark:text-white">
                  Sign in to deploy
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Your visit, keys and agent come with you.
                </p>
              </div>
              <button
                hlmBtn
                variant="ghost"
                size="sm"
                type="button"
                aria-label="Close"
                class="h-8 w-8 p-0 flex-shrink-0"
                data-testid="visitor-sign-in-close"
                (click)="close()"
              >
                <ng-icon name="lucideX" class="h-4 w-4" />
              </button>
            </div>

            <div class="mt-5 flex flex-col gap-2">
              @if (loading()) {
                <button hlmBtn variant="outline" type="button" disabled>Continue with GitHub</button>
                <button hlmBtn variant="outline" type="button" disabled>Continue with Google</button>
              } @else {
                @for (option of choices().providers; track option.provider) {
                  <button
                    hlmBtn
                    variant="outline"
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
                    hlmBtn
                    variant="outline"
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

  constructor() {
    effect(() => {
      if (this.gate.dialogOpen()) untracked(() => void this.load());
    });
  }

  @HostListener('document:keydown.escape')
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
        '.mt-5 button:not([disabled])',
      ) ?? null
    );
  }
}
