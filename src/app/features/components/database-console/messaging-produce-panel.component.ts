import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { MessagingConsoleStateService } from './messaging-console-state.service';
import { exampleSubject } from './messaging-format';

@Component({
  selector: 'app-messaging-produce-panel',
  imports: [FormsModule, FlAlert, FlButton, FlField, FlPanel, FlSpinner, FlStatus],
  host: { class: 'block' },
  template: `
    <fl-panel title="Produce a message">
      <div class="flex flex-col gap-4">
        @if (s.streams().length) {
          <fl-field
            label="Start from"
            for="msg-pub-fill"
            [hint]="'Fills the subject from a ' + s.nouns().item + ' ' + routing() + '.'"
          >
            <span class="fl-select-wrap">
              <select
                id="msg-pub-fill"
                class="fl-select"
                [(ngModel)]="pubFill"
                (ngModelChange)="fillSubjectFrom($event)"
              >
                <option value="">Pick a {{ s.nouns().item }} {{ routing() }}</option>
                @for (st of s.streams(); track st.name) {
                  @for (subj of st.subjects; track subj) {
                    <option [value]="subj">{{ st.name }} · {{ subj }}</option>
                  }
                }
              </select>
            </span>
          </fl-field>
        }
        <fl-field
          label="Subject"
          for="msg-pub-subject"
          [hint]="
            'Publish to a subject that a ' +
            s.nouns().item +
            ' captures, not to the ' +
            s.nouns().item +
            ' name.'
          "
        >
          <div class="fl-input fl-input--lg font-mono">
            <input
              id="msg-pub-subject"
              type="text"
              placeholder="orders.created"
              [(ngModel)]="pubSubject"
            />
          </div>
        </fl-field>
        <fl-field label="Payload" for="msg-pub-payload" hint="Text or JSON.">
          <textarea
            id="msg-pub-payload"
            class="fl-textarea font-mono"
            rows="3"
            [(ngModel)]="pubPayload"
          ></textarea>
        </fl-field>
        @if (s.publishError()) {
          <fl-alert tone="error" title="Not published">{{ s.publishError() }}</fl-alert>
        }
        <div class="fl-row">
          <button
            flButton="primary"
            type="button"
            [disabled]="s.publishing() || !pubSubject.trim()"
            (click)="publish()"
          >
            @if (s.publishing()) {
              <fl-spinner label="Publishing" />
            }
            Publish
          </button>
          @if (s.publishResult(); as r) {
            <fl-status
              tone="success"
              [label]="'Routed to ' + r.stream + (r.seq != null ? ', seq ' + r.seq : '')"
            />
          }
        </div>
      </div>
    </fl-panel>
  `,
})
export class MessagingProducePanelComponent {
  protected readonly s = inject(MessagingConsoleStateService);

  pubSubject = '';
  pubPayload = '';
  pubFill = '';

  protected routing(): string {
    return this.s.nouns().routing.toLowerCase();
  }

  fillSubjectFrom(pattern: string): void {
    if (pattern) this.pubSubject = exampleSubject(pattern);
    this.pubFill = '';
  }

  publish(): void {
    this.s.publish(this.pubSubject, this.pubPayload);
  }
}
