import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy, lucideX } from '@ng-icons/lucide';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { InviteResult } from '../../service/iam.service';

@Component({
  selector: 'app-people-invite-result',
  imports: [FlPanel, FlButton, FlIcon],
  providers: [provideIcons({ lucideCheck, lucideCopy, lucideX })],
  template: `
    @let inv = invite();
    <fl-panel
      [title]="(inv.inviteLink ? 'Invite link for ' : 'Temporary password for ') + inv.email"
    >
      <button
        panelActions
        flButton="ghost"
        size="sm"
        type="button"
        [iconOnly]="true"
        title="Dismiss"
        aria-label="Dismiss"
        (click)="dismissed.emit()"
      >
        <fl-icon name="lucideX" [size]="14" />
      </button>
      <div class="flex flex-col gap-3">
        <p class="text-fl-body-sm text-fl-ink-muted">
          {{
            inv.inviteLink
              ? 'Share this link. They open it to set up their account. No email is sent.'
              : 'Share this one-time password. It is shown once and not stored.'
          }}
        </p>
        <div class="flex items-center gap-2">
          <div class="fl-input fl-input--lg flex-1">
            <input
              readonly
              class="fl-mono"
              aria-label="Invite secret"
              [value]="secret()"
              (focus)="selectAll($event)"
            />
          </div>
          <button flButton type="button" (click)="copy()">
            <fl-icon [name]="copied() ? 'lucideCheck' : 'lucideCopy'" />
            {{ copied() ? 'Copied' : 'Copy' }}
          </button>
        </div>
        @if (inv.inviteCode) {
          <p class="text-fl-caption text-fl-ink-muted">
            Code <span class="fl-mono">{{ inv.inviteCode }}</span> is the authoritative fallback if
            the link path needs adjusting.
          </p>
        }
      </div>
    </fl-panel>
  `,
})
export class PeopleInviteResult {
  private readonly destroyRef = inject(DestroyRef);
  readonly invite = input.required<InviteResult>();
  readonly dismissed = output<void>();
  protected readonly copied = signal(false);

  protected secret(): string {
    const inv = this.invite();
    return inv.inviteLink || inv.tempPassword || '';
  }

  protected selectAll(e: Event): void {
    (e.target as HTMLInputElement).select();
  }

  protected async copy(): Promise<void> {
    const text = this.secret();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      const timer = setTimeout(() => this.copied.set(false), 1500);
      this.destroyRef.onDestroy(() => clearTimeout(timer));
    } catch {
      this.copied.set(false);
    }
  }
}
