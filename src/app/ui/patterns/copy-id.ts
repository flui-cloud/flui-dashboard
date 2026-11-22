import { Clipboard } from '@angular/cdk/clipboard';
import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy } from '@ng-icons/lucide';
import { FlIcon } from '../primitives/icon';

@Component({
  selector: 'fl-copy-id',
  imports: [FlIcon],
  providers: [provideIcons({ lucideCopy, lucideCheck })],
  host: { class: 'fl-copy' },
  template: `
    <span class="fl-mono">{{ display() ?? value() }}</span>
    <button
      type="button"
      [attr.aria-label]="copied() ? 'Copied' : 'Copy ' + label()"
      (click)="copy()"
    >
      <fl-icon [name]="copied() ? 'lucideCheck' : 'lucideCopy'" [size]="13" />
    </button>
  `,
})
export class FlCopyId {
  private readonly clipboard = inject(Clipboard);
  private readonly destroyRef = inject(DestroyRef);
  readonly value = input.required<string>();
  readonly label = input('ID');
  readonly display = input<string | null>(null);
  protected readonly copied = signal(false);

  protected copy(): void {
    if (!this.clipboard.copy(this.value())) return;
    this.copied.set(true);
    const timer = setTimeout(() => this.copied.set(false), 1500);
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }
}
