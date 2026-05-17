import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideTriangleAlert,
  lucideInfo,
  lucideX,
  lucideLoader,
} from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';

export type ConfirmationDialogVariant = 'danger' | 'warning' | 'info';

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, NgIcon, HlmButtonDirective],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideTriangleAlert,
      lucideInfo,
      lucideX,
      lucideLoader,
    }),
  ],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        (click)="onCancel()"
      >
        <div class="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] p-4">
          <div
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
            (click)="$event.stopPropagation()"
          >
            <!-- Header -->
            <div class="flex items-start justify-between p-6 pb-4">
              <div class="flex items-start gap-4 flex-1">
                <div
                  class="flex h-12 w-12 items-center justify-center rounded-full flex-shrink-0"
                  [ngClass]="{
                    'bg-red-100 dark:bg-red-900/20': variant === 'danger',
                    'bg-yellow-100 dark:bg-yellow-900/20': variant === 'warning',
                    'bg-blue-100 dark:bg-blue-900/20': variant === 'info'
                  }"
                >
                  <ng-icon
                    [name]="iconName"
                    class="h-6 w-6"
                    [ngClass]="{
                      'text-red-600 dark:text-red-400': variant === 'danger',
                      'text-yellow-600 dark:text-yellow-400': variant === 'warning',
                      'text-blue-600 dark:text-blue-400': variant === 'info'
                    }"
                  />
                </div>
                <div class="flex-1">
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                    {{ title }}
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {{ message }}
                  </p>
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

            <!-- Footer / Actions -->
            <div class="flex items-center justify-end gap-3 px-6 pb-6">
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
                [disabled]="isProcessing()"
                [ngClass]="{
                  'bg-red-600 hover:bg-red-700 text-white': variant === 'danger',
                  'bg-yellow-600 hover:bg-yellow-700 text-white': variant === 'warning',
                  'bg-blue-600 hover:bg-blue-700 text-white': variant === 'info'
                }"
                class="min-w-[100px]"
              >
                @if (isProcessing()) {
                  <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" />
                  {{ confirmText }}ing...
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
export class ConfirmationDialogComponent {
  @Input() title = 'Confirm Action';
  @Input() message = 'Are you sure you want to proceed?';
  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Cancel';
  @Input() variant: ConfirmationDialogVariant = 'info';
  @Input() icon?: string;

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  isOpen = signal(false);
  isProcessing = signal(false);

  get iconName(): string {
    if (this.icon) return this.icon;

    // Default icons based on variant
    switch (this.variant) {
      case 'danger':
        return 'lucideCircleAlert';
      case 'warning':
        return 'lucideTriangleAlert';
      case 'info':
        return 'lucideInfo';
      default:
        return 'lucideInfo';
    }
  }

  open() {
    this.isOpen.set(true);
    this.isProcessing.set(false);
  }

  close() {
    this.isOpen.set(false);
    this.isProcessing.set(false);
  }

  setProcessing(processing: boolean) {
    this.isProcessing.set(processing);
  }

  onConfirm() {
    this.confirmed.emit();
    // Don't auto-close - let the parent handle it after async operations
  }

  onCancel() {
    if (this.isProcessing()) return;
    this.cancelled.emit();
    this.close();
  }
}
