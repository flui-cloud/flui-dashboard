import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideLoader,
  lucideSend,
  lucideTriangleAlert,
  lucideX,
} from '@ng-icons/lucide';
import { MailConsoleService } from '../../service/mail-console.service';
import { MailTestMessage, MailTestResult } from '../../model/mail-console.models';
import { consoleError } from './mail-format';

type Kind = 'delivery' | 'bounce';

@Component({
  selector: 'app-mail-test-send',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, NgIcon],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideLoader,
      lucideSend,
      lucideTriangleAlert,
      lucideX,
    }),
  ],
  template: `
    <div class="mt-3 border-t border-border pt-3">
      @if (!draft()) {
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            (click)="open('delivery')"
            [disabled]="loading()"
            class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            @if (loading()) {
              <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
            } @else {
              <ng-icon name="lucideSend" class="h-3.5 w-3.5" />
            }
            Compose a test message
          </button>
          <button
            type="button"
            (click)="open('bounce')"
            [disabled]="loading()"
            class="inline-flex h-8 items-center rounded-md px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Addressed to a subdomain of this domain that deliberately does not exist, so you can watch a real refusal travel from the provider into Activity."
          >
            Probe a bounce
          </button>
        </div>
        <p class="mt-1.5 text-[11px] text-muted-foreground">
          A green readiness check says the records are correct. Only a real message says one
          arrives.
        </p>
      } @else {
        @let d = draft()!;
        <div class="rounded-md border border-border bg-muted/30 p-3">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-medium text-foreground">
              {{ kind() === 'bounce' ? 'Bounce probe' : 'Test message' }}
            </span>
            <button
              type="button"
              (click)="close()"
              class="text-muted-foreground hover:text-foreground"
              title="Discard"
            >
              <ng-icon name="lucideX" class="h-3.5 w-3.5" />
            </button>
          </div>

          <div class="space-y-2 text-xs">
            <div class="flex items-center gap-2">
              <span class="w-14 shrink-0 text-muted-foreground">From</span>
              <span class="min-w-0 flex-1 truncate font-mono text-foreground">{{ d.from }}</span>
            </div>

            <div class="flex items-center gap-2">
              <span class="w-14 shrink-0 text-muted-foreground">To</span>
              @if (kind() === 'bounce') {
                <span class="min-w-0 flex-1 truncate font-mono text-foreground">{{ d.to }}</span>
              } @else {
                <input
                  type="email"
                  [(ngModel)]="to"
                  class="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 font-mono text-xs text-foreground"
                />
              }
            </div>

            <div class="flex items-center gap-2">
              <span class="w-14 shrink-0 text-muted-foreground">Subject</span>
              <input
                type="text"
                [(ngModel)]="subject"
                class="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-xs text-foreground"
              />
            </div>

            <textarea
              [(ngModel)]="text"
              rows="5"
              class="w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs text-foreground"
            ></textarea>
          </div>

          <div class="mt-2 flex items-center gap-2">
            <button
              type="button"
              (click)="send()"
              [disabled]="busy() || !readyToSend()"
              class="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              @if (busy()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
              } @else {
                <ng-icon name="lucideSend" class="h-3.5 w-3.5" />
              }
              Send to {{ recipient() }}
            </button>
            <span class="text-[11px] text-muted-foreground">
              One recipient, plain text, no attachments.
            </span>
          </div>
        </div>
      }

      @if (error(); as failure) {
        <div
          class="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{{ failure }}</span>
        </div>
      }

      @if (result(); as r) {
        <div
          class="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200"
        >
          <div class="flex items-start gap-2">
            <ng-icon name="lucideCircleCheck" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div class="min-w-0">
              @if (r.alreadySuppressed) {
                <p class="font-medium">Nothing was sent — and that is the result.</p>
                <p class="mt-0.5">
                  <span class="font-mono">{{ r.to }}</span> is already on the do-not-send list from
                  an earlier probe, so Flui refused before dialling. Clear it under
                  <a routerLink="/management/mail/suppressions" class="underline">Suppressions</a>
                  to run it again.
                </p>
              } @else {
                <p class="font-medium">Accepted by {{ r.provider }} — accepted is not delivered.</p>
                <p class="mt-0.5">
                  <span class="font-mono">{{ r.from }}</span> →
                  <span class="font-mono">{{ r.to }}</span>.
                  {{
                    r.kind === 'bounce'
                      ? 'It cannot be delivered; the refusal should follow within minutes.'
                      : 'The receiver answers in seconds to minutes.'
                  }}
                  Watch it land in
                  <a routerLink="/management/mail/activity" class="underline">Activity</a>.
                </p>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class MailTestSendComponent {
  readonly domain = input('');
  readonly connectionId = input<string | null>(null);

  private readonly api = inject(MailConsoleService);

  protected to = '';
  protected subject = '';
  protected text = '';

  protected readonly kind = signal<Kind>('delivery');
  protected readonly draft = signal<MailTestMessage | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly result = signal<MailTestResult | null>(null);
  protected readonly error = signal<string | null>(null);

  protected recipient(): string {
    return this.kind() === 'bounce' ? (this.draft()?.to ?? '') : this.to.trim();
  }

  protected readyToSend(): boolean {
    return this.recipient().length > 0;
  }

  protected open(kind: Kind): void {
    this.kind.set(kind);
    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    const id = this.connectionId();
    const request = id ? this.api.connectionTestDraft(id) : this.api.testDraft(this.domain());

    request.subscribe({
      next: (drafts) => {
        const message = kind === 'bounce' ? drafts.bounce : drafts.delivery;
        this.draft.set(message);
        this.to = message.to;
        this.subject = message.subject;
        this.text = message.text;
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.loading.set(false);
      },
    });
  }

  protected close(): void {
    this.draft.set(null);
    this.error.set(null);
  }

  protected send(): void {
    const kind = this.kind();
    this.busy.set(true);
    this.error.set(null);

    const id = this.connectionId();
    const body = {
      kind,
      ...(kind === 'delivery' ? { to: this.to.trim() } : {}),
      subject: this.subject,
      text: this.text,
    };

    (id ? this.api.connectionTest(id, body) : this.api.test(this.domain(), body))
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.busy.set(false);
          this.draft.set(null);
        },
        error: (err) => {
          this.error.set(consoleError(err));
          this.busy.set(false);
        },
      });
  }
}
