import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert, lucideX, lucideLoader } from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import {
  HlmCardContentDirective,
  HlmCardDescriptionDirective,
  HlmCardDirective,
  HlmCardHeaderDirective,
  HlmCardTitleDirective,
} from '@spartan-ng/ui-card-helm';

export interface DeleteConfirmationData {
  title: string;
  description: string;
  itemName: string;
  itemDescription?: string;
  warningMessage?: string;
  confirmButtonText?: string;
}

@Component({
  selector: 'app-delete-confirmation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    NgIcon,
    HlmButtonDirective,
    HlmCardDirective,
    HlmCardHeaderDirective,
    HlmCardTitleDirective,
    HlmCardDescriptionDirective,
    HlmCardContentDirective,
  ],
  providers: [
    provideIcons({
      lucideTriangleAlert,
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
        <div class="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] p-4">
          <div hlmCard (click)="$event.stopPropagation()">
            <div hlmCardHeader>
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div class="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                    <ng-icon
                      name="lucideTriangleAlert"
                      class="h-5 w-5 text-destructive"
                    />
                  </div>
                  <div>
                    <h2 hlmCardTitle class="text-xl">{{ data()?.title }}</h2>
                    <p hlmCardDescription>
                      {{ data()?.description || 'This action cannot be undone' }}
                    </p>
                  </div>
                </div>
                <button
                  hlmBtn
                  variant="ghost"
                  size="sm"
                  (click)="onCancel()"
                  class="h-8 w-8 p-0"
                >
                  <ng-icon name="lucideX" class="h-4 w-4" />
                </button>
              </div>
            </div>

            <div hlmCardContent class="space-y-4">
              <div class="space-y-2">
                <p class="text-sm text-foreground">
                  You are about to delete:
                </p>
                <div class="rounded-md bg-muted p-3">
                  <p class="font-semibold">{{ data()?.itemName }}</p>
                  @if (data()?.itemDescription) {
                    <p class="text-sm text-muted-foreground">{{ data()?.itemDescription }}</p>
                  }
                </div>
              </div>

              @if (data()?.warningMessage) {
                <div class="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
                  <div class="flex items-start gap-3">
                    <ng-icon
                      name="lucideTriangleAlert"
                      class="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0"
                    />
                    <div class="flex-1">
                      <p class="text-sm text-yellow-700 dark:text-yellow-300">
                        {{ data()?.warningMessage }}
                      </p>
                    </div>
                  </div>
                </div>
              }

              <div class="flex justify-end gap-2 pt-4">
                <button
                  hlmBtn
                  variant="outline"
                  (click)="onCancel()"
                  [disabled]="isDeleting()"
                >
                  Cancel
                </button>
                <button
                  hlmBtn
                  variant="destructive"
                  (click)="onConfirm()"
                  [disabled]="isDeleting()"
                >
                  @if (isDeleting()) {
                    <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  } @else {
                    {{ data()?.confirmButtonText || 'Delete' }}
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class DeleteConfirmationDialogComponent {
  @Input() set confirmationData(value: DeleteConfirmationData | null) {
    this.data.set(value);
  }

  @Input() set deleting(value: boolean) {
    this._isDeleting.set(value);
  }

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  data = signal<DeleteConfirmationData | null>(null);
  private readonly _isDeleting = signal(false);
  private readonly _isOpen = signal(false);

  isOpen = this._isOpen.asReadonly();
  isDeleting = this._isDeleting.asReadonly();

  open(confirmationData: DeleteConfirmationData) {
    this.data.set(confirmationData);
    this._isOpen.set(true);
  }

  close() {
    this._isOpen.set(false);
    this._isDeleting.set(false);
  }

  onConfirm() {
    this.confirmed.emit();
  }

  onCancel() {
    this.cancelled.emit();
    this.close();
  }
}
