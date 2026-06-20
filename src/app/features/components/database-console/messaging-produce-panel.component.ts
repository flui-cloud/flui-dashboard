import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideSend } from '@ng-icons/lucide';
import { MessagingConsoleStateService } from './messaging-console-state.service';
import { exampleSubject } from './messaging-format';

@Component({
  selector: 'app-messaging-produce-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, FormsModule],
  providers: [provideIcons({ lucideLoader, lucideSend })],
  template: `
    <div class="rounded-md border border-border p-3">
      <div
        class="mb-2 flex items-center gap-2 text-sm font-medium text-foreground"
      >
        <ng-icon name="lucideSend" class="h-4 w-4 text-muted-foreground" />
        Produce a message
      </div>
      @if (s.streams().length) {
        <select
          [(ngModel)]="pubFill"
          (ngModelChange)="fillSubjectFrom($event)"
          class="mb-2 h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-muted-foreground"
        >
          <option value="">
            Fill subject from a {{ s.nouns().item }} ·
            {{ s.nouns().routing.toLowerCase() }}…
          </option>
          @for (st of s.streams(); track st.name) {
            @for (subj of st.subjects; track subj) {
              <option [value]="subj">{{ st.name }} · {{ subj }}</option>
            }
          }
        </select>
      }
      <input
        type="text"
        [(ngModel)]="pubSubject"
        placeholder="subject / routing key (e.g. orders.created)"
        class="mb-1 h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground"
      />
      <p class="mb-2 text-[11px] leading-snug text-muted-foreground">
        Publish a subject that a {{ s.nouns().item }}’s
        {{ s.nouns().routing.toLowerCase() }} captures — not the
        {{ s.nouns().item }} name. Pick one above to start, then edit the last
        token.
      </p>
      <textarea
        [(ngModel)]="pubPayload"
        rows="3"
        placeholder="payload (text or JSON)"
        class="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
      ></textarea>
      <div class="flex items-center gap-2">
        <button
          type="button"
          (click)="publish()"
          [disabled]="s.publishing() || !pubSubject.trim()"
          class="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          @if (s.publishing()) {
            <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
          }
          Publish
        </button>
        @if (s.publishResult(); as r) {
          <span class="text-xs text-emerald-600 dark:text-emerald-400"
            >Routed to {{ r.stream
            }}@if (r.seq != null) {
              · seq {{ r.seq }}
            }</span
          >
        }
        @if (s.publishError()) {
          <span class="text-xs text-destructive">{{ s.publishError() }}</span>
        }
      </div>
    </div>
  `,
})
export class MessagingProducePanelComponent {
  protected readonly s = inject(MessagingConsoleStateService);

  pubSubject = '';
  pubPayload = '';
  pubFill = '';

  // Seed the publish subject from an existing binding/subject pattern, turning
  // wildcards into a concrete token so it actually routes (e.g. events.user.*
  // → events.user.new). The user then edits the last token.
  fillSubjectFrom(pattern: string): void {
    if (pattern) this.pubSubject = exampleSubject(pattern);
    this.pubFill = '';
  }

  publish(): void {
    this.s.publish(this.pubSubject, this.pubPayload);
  }
}
