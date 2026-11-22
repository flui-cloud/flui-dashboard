import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { Component, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FlButton } from '../primitives/button';
import { FlDialog } from './dialog-frame';

export interface ConfirmOptions {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly destructive?: boolean;
  readonly typeToConfirm?: string;
}

@Component({
  selector: 'fl-confirm-dialog',
  imports: [FlDialog, FlButton],
  template: `
    <fl-dialog [title]="data.title">
      <p>{{ data.body }}</p>
      @if (data.typeToConfirm) {
        <div class="fl-field">
          <label class="fl-field__label" for="fl-confirm-input">
            Type <span class="fl-mono">{{ data.typeToConfirm }}</span> to confirm
          </label>
          <div class="fl-input fl-input--lg">
            <input
              id="fl-confirm-input"
              autocomplete="off"
              spellcheck="false"
              (input)="onInput($event)"
            />
          </div>
        </div>
      }
      <ng-container dialogFooter>
        <button flButton="ghost" type="button" (click)="ref.close(false)">Cancel</button>
        <button
          [flButton]="data.destructive ? 'danger' : 'primary'"
          type="button"
          [disabled]="!ready()"
          (click)="ref.close(true)"
        >
          {{ data.confirmLabel }}
        </button>
      </ng-container>
    </fl-dialog>
  `,
})
export class FlConfirmDialog {
  protected readonly data = inject<ConfirmOptions>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly typed = signal('');
  protected readonly ready = computed(
    () => !this.data.typeToConfirm || this.typed() === this.data.typeToConfirm,
  );

  protected onInput(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
  }
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(Dialog);

  async confirm(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open<boolean, ConfirmOptions>(FlConfirmDialog, {
      data: options,
      backdropClass: 'fl-backdrop',
      ariaModal: true,
      role: options.destructive ? 'alertdialog' : 'dialog',
      autoFocus: options.typeToConfirm ? 'first-tabbable' : 'dialog',
    });
    return (await firstValueFrom(ref.closed)) === true;
  }
}
