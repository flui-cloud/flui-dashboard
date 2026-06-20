import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePencil, lucideX, lucideLoader } from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';

/**
 * Reusable single-field input modal — the project's styled replacement for the
 * native `prompt()`. Same open()/close()/setProcessing() lifecycle as
 * {@link ConfirmationDialogComponent}; emits the trimmed value on confirm.
 */
@Component({
  selector: 'app-input-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon, HlmButtonDirective],
  providers: [provideIcons({ lucidePencil, lucideX, lucideLoader })],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        (click)="onCancel()"
      >
        <div
          class="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] p-4"
        >
          <div
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
            (click)="$event.stopPropagation()"
          >
            <div class="flex items-start justify-between p-6 pb-4">
              <div class="flex items-start gap-4 flex-1">
                <div
                  class="flex h-12 w-12 items-center justify-center rounded-full flex-shrink-0 bg-blue-100 dark:bg-blue-900/20"
                >
                  <ng-icon
                    [name]="icon"
                    class="h-6 w-6 text-blue-600 dark:text-blue-400"
                  />
                </div>
                <div class="flex-1">
                  <h3
                    class="text-lg font-semibold text-gray-900 dark:text-white"
                  >
                    {{ title }}
                  </h3>
                  @if (message) {
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {{ message }}
                    </p>
                  }
                </div>
              </div>
              <button
                hlmBtn
                variant="ghost"
                size="sm"
                (click)="onCancel()"
                [disabled]="isProcessing()"
                class="h-8 w-8 p-0 flex-shrink-0"
              >
                <ng-icon name="lucideX" class="h-4 w-4" />
              </button>
            </div>

            <div class="px-6 pb-2">
              <input
                #field
                type="text"
                [(ngModel)]="value"
                [placeholder]="placeholder"
                [disabled]="isProcessing()"
                (keydown.enter)="onConfirm()"
                class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              @if (error()) {
                <p class="mt-2 text-xs text-red-600 dark:text-red-400">
                  {{ error() }}
                </p>
              }
            </div>

            <div class="flex items-center justify-end gap-3 px-6 pb-6 pt-4">
              <button
                hlmBtn
                variant="outline"
                (click)="onCancel()"
                [disabled]="isProcessing()"
                class="min-w-[80px]"
              >
                {{ cancelText }}
              </button>
              <button
                hlmBtn
                (click)="onConfirm()"
                [disabled]="isProcessing() || !value.trim()"
                class="min-w-[100px] bg-blue-600 hover:bg-blue-700 text-white"
              >
                @if (isProcessing()) {
                  <ng-icon
                    name="lucideLoader"
                    class="h-4 w-4 mr-2 animate-spin"
                  />
                  {{ confirmText }}…
                } @else {
                  {{ confirmText }}
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class InputDialogComponent {
  @Input() title = 'Enter a value';
  @Input() message = '';
  @Input() placeholder = '';
  @Input() confirmText = 'Create';
  @Input() cancelText = 'Cancel';
  @Input() icon = 'lucidePencil';

  @Output() confirmed = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  value = '';
  isOpen = signal(false);
  isProcessing = signal(false);
  error = signal<string | null>(null);

  open(initial = '') {
    this.value = initial;
    this.error.set(null);
    this.isProcessing.set(false);
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.isProcessing.set(false);
  }

  setProcessing(processing: boolean) {
    this.isProcessing.set(processing);
  }

  setError(message: string) {
    this.error.set(message);
    this.isProcessing.set(false);
  }

  onConfirm() {
    const v = this.value.trim();
    if (!v || this.isProcessing()) return;
    this.confirmed.emit(v);
  }

  onCancel() {
    if (this.isProcessing()) return;
    this.cancelled.emit();
    this.close();
  }
}
