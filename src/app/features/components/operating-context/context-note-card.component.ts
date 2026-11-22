import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideUsers } from '@ng-icons/lucide';
import { formatTimeSince } from '../../model/dns.models';
import {
  CHECK_COPY,
  ContextEntry,
  EditContextEntry,
  NATURE_COPY,
  VALIDITY_COPY,
  describeHand,
  describeScope,
} from '../../model/operating-context.models';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';

const VERDICT_TONE: Record<ContextEntry['confidence'], StatusTone> = {
  broken: 'warning',
  checked: 'success',
  stale: 'neutral',
  unverified: 'neutral',
};

@Component({
  selector: 'app-context-note-card',
  imports: [FormsModule, FlAlert, FlButton, FlField, FlIcon, FlStatus, FlTag],
  providers: [provideIcons({ lucideUsers })],
  host: { class: 'block' },
  template: `
    <article
      class="fl-panel"
      [attr.data-testid]="'note'"
      [attr.data-confidence]="entry().confidence"
    >
      <header class="fl-panel__header">
        <h3 class="fl-panel__title" data-testid="title">{{ entry().title }}</h3>
        <div class="fl-panel__actions">
          <fl-status
            [tone]="verdictTone()"
            [label]="verdict().label"
            [attr.title]="verdict().note"
            data-testid="verdict"
          />
        </div>
      </header>

      <div class="fl-panel__body flex flex-col gap-3">
        @if (editing()) {
          <div class="flex flex-col gap-3" data-testid="reword">
            <fl-field label="Title" [for]="'reword-title-' + entry().id">
              <div class="fl-input fl-input--lg">
                <input [id]="'reword-title-' + entry().id" [(ngModel)]="draftTitle" />
              </div>
            </fl-field>
            <fl-field
              label="Note"
              [for]="'reword-body-' + entry().id"
              hint="Rewording never moves the level. Where a note applies is what the note is: to say it somewhere else, write it there."
            >
              <textarea
                [id]="'reword-body-' + entry().id"
                rows="5"
                class="fl-textarea"
                [(ngModel)]="draftBody"
              ></textarea>
            </fl-field>
            <div class="fl-row">
              <button
                flButton="primary"
                size="sm"
                type="button"
                [disabled]="busy()"
                (click)="saveEdit()"
                data-testid="reword-save"
              >
                Save wording
              </button>
              <button
                flButton="ghost"
                size="sm"
                type="button"
                (click)="cancelEdit()"
                data-testid="reword-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        } @else {
          <p class="m-0 whitespace-pre-wrap text-fl-body-sm" data-testid="body">
            {{ entry().body }}
          </p>
        }

        <div class="fl-row text-fl-caption text-fl-ink-muted">
          <fl-tag data-testid="nature">{{ natureCopy().label }}</fl-tag>
          <fl-tag class="fl-mono" data-testid="level">{{ level() }}</fl-tag>
          @if (retired(); as when) {
            <fl-tag data-testid="retired">retired {{ when }}</fl-tag>
          }
          <span class="fl-mono" data-testid="topic">{{ entry().topic }}</span>
          <span>·</span>
          <span data-testid="checked-by">{{ checkCopy() }}</span>
          @if (writtenBy(); as who) {
            <span>·</span>
            <span data-testid="written-by">written by {{ who }}</span>
          }
          @if (confirmedBy(); as who) {
            <span>·</span>
            <span data-testid="confirmed-by">last confirmed by {{ who }}</span>
          }
          @if (retiredBy(); as who) {
            <span>·</span>
            <span data-testid="retired-by">retired by {{ who }}</span>
          }
          <span class="ml-auto">{{ changed() }}</span>
        </div>

        @if (entry().reaches; as reach) {
          <p
            class="m-0 flex items-start gap-2 text-fl-body-sm text-fl-ink-muted"
            data-testid="reaches"
          >
            <fl-icon name="lucideUsers" [size]="14" />
            <span>{{ reachSentence() }}</span>
          </p>
        }

        @if (error(); as message) {
          <fl-alert tone="error" title="Not saved" data-testid="note-error">{{ message }}</fl-alert>
        }

        @if (!readOnly() && !editing()) {
          <div class="fl-row">
            @if (offersConfirm()) {
              <button
                flButton
                size="sm"
                type="button"
                [disabled]="busy()"
                (click)="confirm.emit(entry().id)"
                data-testid="confirm"
              >
                Still true, put my name to it
              </button>
            }
            <button
              flButton="ghost"
              size="sm"
              type="button"
              [disabled]="busy()"
              (click)="startEdit()"
              data-testid="reword-start"
            >
              Reword
            </button>
            <button
              flButton="ghost"
              size="sm"
              type="button"
              [disabled]="busy()"
              (click)="retire()"
              data-testid="archive"
            >
              Retire
            </button>
          </div>
        }
      </div>
    </article>
  `,
})
export class ContextNoteCardComponent {
  private readonly confirmService = inject(ConfirmService);

  readonly entry = input.required<ContextEntry>();
  readonly clusterNames = input<Record<string, string>>({});
  readonly busy = input(false);
  readonly readOnly = input(false);
  readonly error = input<string | null>(null);

  readonly confirm = output<string>();
  readonly archive = output<string>();
  readonly reword = output<{ id: string; edit: EditContextEntry }>();

  protected readonly editing = signal(false);
  protected draftTitle = '';
  protected draftBody = '';

  protected readonly verdict = computed(() => VALIDITY_COPY[this.entry().confidence]);

  protected readonly natureCopy = computed(() => NATURE_COPY[this.entry().nature]);

  protected readonly checkCopy = computed(() => CHECK_COPY[this.entry().checkedBy]);

  protected readonly level = computed(() =>
    describeScope(this.entry(), (id) => this.clusterNames()[id]),
  );

  protected readonly reachSentence = computed(() => {
    const reach = this.entry().reaches;
    if (!reach) return '';
    const ref = this.entry().scopeRef;
    const name = ref ? this.clusterNames()[ref] : undefined;
    return name ? reach.sentence.split(ref!).join(name) : reach.sentence;
  });

  protected readonly changed = computed(() =>
    formatTimeSince(this.entry().updatedAt).toLowerCase(),
  );

  protected readonly retired = computed(() => {
    const at = this.entry().archivedAt;
    return at ? formatTimeSince(at).toLowerCase() : null;
  });

  protected readonly writtenBy = computed(() => describeHand(this.entry().writtenBy));

  protected readonly confirmedBy = computed(() => describeHand(this.entry().confirmedBy));

  protected readonly retiredBy = computed(() => describeHand(this.entry().archivedBy));

  protected readonly verdictTone = computed(() => VERDICT_TONE[this.entry().confidence]);

  protected readonly offersConfirm = computed(() => this.entry().checkedBy === 'attestation');

  protected async retire(): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Retire this note',
      body: 'It stops being handed out as advice and moves to Retired, where it can still be read.',
      confirmLabel: 'Retire note',
      destructive: true,
    });
    if (ok) this.archive.emit(this.entry().id);
  }

  protected startEdit(): void {
    this.draftTitle = this.entry().title;
    this.draftBody = this.entry().body;
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
  }

  protected saveEdit(): void {
    this.reword.emit({
      id: this.entry().id,
      edit: { title: this.draftTitle, body: this.draftBody },
    });
    this.editing.set(false);
  }
}
