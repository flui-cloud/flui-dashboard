import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideMail } from '@ng-icons/lucide';
import { SandboxService } from '../../../core/services/sandbox.service';

@Component({
  selector: 'app-sandbox-save-action',
  standalone: true,
  imports: [FormsModule, NgIcon],
  providers: [provideIcons({ lucideCheck, lucideMail })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [':host { display: contents; }'],
  template: `
    @if (done()) {
      <span class="flex items-center gap-1.5 opacity-90">
        <ng-icon name="lucideCheck" class="h-3.5 w-3.5" />
        Sent — the link is in your inbox.
      </span>
    } @else if (open()) {
      <form class="flex items-center gap-1.5" (ngSubmit)="submit()">
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          [(ngModel)]="email"
          [disabled]="busy()"
          class="h-6 w-52 rounded border border-border bg-background px-2 text-xs
                 text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          [disabled]="busy()"
          class="h-6 rounded bg-foreground/10 px-2 text-xs font-medium hover:bg-foreground/20
                 disabled:opacity-50"
        >
          {{ busy() ? 'Sending…' : 'Send' }}
        </button>
        <button type="button" class="text-xs underline opacity-70" (click)="close()">
          Cancel
        </button>
      </form>
      @if (error(); as message) {
        <span class="opacity-80">{{ message }}</span>
      }
    } @else {
      <button
        type="button"
        class="flex items-center gap-1.5 underline decoration-dotted underline-offset-2 opacity-80 hover:opacity-100"
        (click)="open.set(true)"
      >
        <ng-icon name="lucideMail" class="h-3.5 w-3.5" />
        Save this sandbox
      </button>
    }
  `,
})
export class SandboxSaveActionComponent {
  private readonly sandbox = inject(SandboxService);

  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);
  protected email = '';

  protected close(): void {
    this.open.set(false);
    this.error.set(null);
  }

  protected submit(): void {
    const email = this.email.trim();
    if (!email || this.busy()) return;

    this.busy.set(true);
    this.error.set(null);
    this.sandbox.save(email).subscribe({
      next: (result) => {
        this.busy.set(false);
        if (result.sent) {
          this.done.set(true);
          return;
        }
        this.error.set(
          result.reason === 'not_configured'
            ? 'This instance cannot send email, so there is no link to send. Keep this tab open instead.'
            : 'That did not go through. Try again in a moment.',
        );
      },
      error: (failure: { message?: string }) => {
        this.busy.set(false);
        this.error.set(failure?.message ?? 'That did not go through.');
      },
    });
  }
}
