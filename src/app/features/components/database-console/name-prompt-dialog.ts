import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { Component, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlDialog } from '../../../ui/overlays/dialog-frame';

export interface NamePromptOptions {
  readonly title: string;
  readonly label: string;
  readonly hint?: string;
  readonly placeholder?: string;
  readonly confirmLabel: string;
}

@Component({
  selector: 'app-name-prompt-dialog',
  imports: [FlDialog, FlButton, FlField],
  template: `
    <fl-dialog [title]="data.title">
      <fl-field [label]="data.label" for="name-prompt-input" [hint]="data.hint">
        <div class="fl-input fl-input--lg font-mono">
          <input
            id="name-prompt-input"
            autocomplete="off"
            spellcheck="false"
            [placeholder]="data.placeholder ?? ''"
            (input)="onInput($event)"
            (keydown.enter)="submit()"
          />
        </div>
      </fl-field>
      <ng-container dialogFooter>
        <button flButton="ghost" type="button" (click)="ref.close()">Cancel</button>
        <button flButton="primary" type="button" [disabled]="!value().trim()" (click)="submit()">
          {{ data.confirmLabel }}
        </button>
      </ng-container>
    </fl-dialog>
  `,
})
export class NamePromptDialog {
  protected readonly data = inject<NamePromptOptions>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  protected readonly value = signal('');

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected submit(): void {
    const value = this.value().trim();
    if (value) this.ref.close(value);
  }
}

@Injectable({ providedIn: 'root' })
export class NamePromptService {
  private readonly dialog = inject(Dialog);

  async ask(options: NamePromptOptions): Promise<string | null> {
    const ref = this.dialog.open<string, NamePromptOptions>(NamePromptDialog, {
      data: options,
      backdropClass: 'fl-backdrop',
      ariaModal: true,
      autoFocus: 'first-tabbable',
    });
    return (await firstValueFrom(ref.closed)) ?? null;
  }
}
