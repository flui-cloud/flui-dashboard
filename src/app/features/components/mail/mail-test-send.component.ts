import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideSend, lucideX } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { MailConsoleService } from '../../service/mail-console.service';
import { MailTestMessage, MailTestResult } from '../../model/mail-console.models';
import { consoleError } from './mail-format';

type Kind = 'delivery' | 'bounce';

let nextId = 0;

@Component({
  selector: 'app-mail-test-send',
  imports: [FormsModule, RouterLink, FlAlert, FlButton, FlIcon],
  providers: [provideIcons({ lucideSend, lucideX })],
  host: { class: 'flex flex-col gap-3' },
  template: `
    @if (!draft()) {
      <div class="flex flex-col gap-1">
        <div class="fl-row">
          <button
            flButton
            size="sm"
            type="button"
            [disabled]="loading()"
            (click)="open('delivery')"
          >
            <fl-icon name="lucideSend" [size]="14" />
            Compose a test message
          </button>
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [disabled]="loading()"
            (click)="open('bounce')"
            title="Addressed to a subdomain of this domain that deliberately does not exist, so you can watch a real refusal travel from the provider into Activity."
          >
            Probe a bounce
          </button>
        </div>
        <span class="text-fl-caption text-fl-ink-muted">
          A green readiness check says the records are correct. Only a real message says one
          arrives.
        </span>
      </div>
    } @else {
      @let d = draft()!;
      <div class="flex flex-col gap-3 rounded-fl-md border border-fl-border p-3">
        <div class="flex items-center justify-between">
          <span class="text-fl-body-sm font-medium">
            {{ kind() === 'bounce' ? 'Bounce probe' : 'Test message' }}
          </span>
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [iconOnly]="true"
            aria-label="Discard"
            (click)="close()"
          >
            <fl-icon name="lucideX" [size]="14" />
          </button>
        </div>

        <div class="fl-kv fl-kv--compact">
          <div class="fl-kv__item">
            <span class="fl-kv__key">From</span>
            <span class="fl-kv__value fl-mono">{{ d.from }}</span>
          </div>
          @if (kind() === 'bounce') {
            <div class="fl-kv__item">
              <span class="fl-kv__key">To</span>
              <span class="fl-kv__value fl-mono">{{ d.to }}</span>
            </div>
          }
        </div>

        @if (kind() !== 'bounce') {
          <div class="fl-field">
            <label class="fl-field__label" [for]="id + '-to'">To</label>
            <div class="fl-input fl-input--lg">
              <input [id]="id + '-to'" type="email" class="fl-mono" [(ngModel)]="to" />
            </div>
          </div>
        }

        <div class="fl-field">
          <label class="fl-field__label" [for]="id + '-subject'">Subject</label>
          <div class="fl-input fl-input--lg">
            <input [id]="id + '-subject'" type="text" [(ngModel)]="subject" />
          </div>
        </div>

        <div class="fl-field">
          <label class="fl-field__label" [for]="id + '-text'">Message</label>
          <textarea [id]="id + '-text'" class="fl-textarea" rows="5" [(ngModel)]="text"></textarea>
          <span class="fl-field__hint">One recipient, plain text, no attachments.</span>
        </div>

        <div class="fl-row">
          <button
            flButton
            size="sm"
            type="button"
            [disabled]="busy() || !readyToSend()"
            (click)="send()"
          >
            <fl-icon name="lucideSend" [size]="14" />
            {{ busy() ? 'Sending…' : 'Send to ' + recipient() }}
          </button>
        </div>
      </div>
    }

    @if (error(); as failure) {
      <fl-alert tone="error" title="Could not send">{{ failure }}</fl-alert>
    }

    @if (result(); as r) {
      @if (r.alreadySuppressed) {
        <fl-alert tone="info" title="Nothing was sent, and that is the result">
          <span class="fl-mono">{{ r.to }}</span> is already on the do-not-send list from an earlier
          probe, so Flui refused before dialling. Clear it under
          <a class="fl-link" routerLink="/management/mail/suppressions">Suppressions</a> to run it
          again.
        </fl-alert>
      } @else {
        <fl-alert
          tone="info"
          [title]="'Accepted by ' + r.provider + '. Accepted is not delivered.'"
        >
          <span class="fl-mono">{{ r.from }}</span> to <span class="fl-mono">{{ r.to }}</span>.
          {{
            r.kind === 'bounce'
              ? 'It cannot be delivered; the refusal should follow within minutes.'
              : 'The receiver answers in seconds to minutes.'
          }}
          Watch it land in
          <a class="fl-link" routerLink="/management/mail/activity">Activity</a>.
        </fl-alert>
      }
    }
  `,
})
export class MailTestSendComponent {
  readonly domain = input('');
  readonly connectionId = input<string | null>(null);

  private readonly api = inject(MailConsoleService);

  protected readonly id = `mail-test-${nextId++}`;
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

    (id ? this.api.connectionTest(id, body) : this.api.test(this.domain(), body)).subscribe({
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
