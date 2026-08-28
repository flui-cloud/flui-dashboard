import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArchive,
  lucideCheck,
  lucideCircleAlert,
  lucideCircleCheck,
  lucideClock,
  lucidePencil,
  lucideUsers,
  lucideX,
} from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { formatTimeSince } from '../../model/dns.models';
import {
  CHECK_COPY,
  ContextEntry,
  EditContextEntry,
  NATURE_COPY,
  VALIDITY_COPY,
  describeHand,
  describeScope,
  isSuspect,
} from '../../model/operating-context.models';

@Component({
  selector: 'app-context-note-card',
  standalone: true,
  imports: [NgIcon, FormsModule, HlmButtonDirective],
  providers: [
    provideIcons({
      lucideArchive,
      lucideCheck,
      lucideCircleAlert,
      lucideCircleCheck,
      lucideClock,
      lucidePencil,
      lucideUsers,
      lucideX,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="grid grid-cols-[3px_1fr] overflow-hidden rounded-lg border border-border bg-card"
      [attr.data-testid]="'note'"
      [attr.data-confidence]="entry().confidence"
    >
      <div [class]="railClass()"></div>

      <div class="space-y-3 p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
            [class]="verdictClass()"
            data-testid="verdict"
            [title]="verdict().note"
          >
            <ng-icon [name]="verdictIcon()" class="h-3.5 w-3.5" />
            {{ verdict().label }}
          </span>

          <span
            class="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
            data-testid="nature"
          >
            {{ natureCopy().label }}
          </span>

          <span
            class="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
            data-testid="level"
          >
            {{ level() }}
          </span>

          @if (retired(); as when) {
            <span
              class="rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground"
              data-testid="retired"
            >
              retired {{ when }}
            </span>
          }

          <span class="ml-auto text-[11px] text-muted-foreground">
            {{ changed() }}
          </span>
        </div>

        <!-- The verdict's meaning is the same sentence on every card carrying
             the same badge, so it rides on the badge rather than being printed
             once per note. Reading a list of six was reading it six times. -->

        @if (editing()) {
          <div class="space-y-2" data-testid="reword">
            <input
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              [(ngModel)]="draftTitle"
              aria-label="Title"
            />
            <textarea
              rows="5"
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              [(ngModel)]="draftBody"
              aria-label="Note"
            ></textarea>
            <p class="m-0 text-[11px] text-muted-foreground">
              Rewording never moves the level. Where a note applies is what the
              note is — to say it somewhere else, write it there.
            </p>
            <div class="flex gap-2">
              <button
                hlmBtn
                size="sm"
                [disabled]="busy()"
                (click)="saveEdit()"
                data-testid="reword-save"
              >
                <ng-icon name="lucideCheck" class="mr-1.5 h-3.5 w-3.5" />
                Save wording
              </button>
              <button
                hlmBtn
                size="sm"
                variant="ghost"
                (click)="cancelEdit()"
                data-testid="reword-cancel"
              >
                <ng-icon name="lucideX" class="mr-1.5 h-3.5 w-3.5" />
                Cancel
              </button>
            </div>
          </div>
        } @else {
          <div class="space-y-1">
            <h3 class="m-0 text-base font-semibold text-foreground" data-testid="title">
              {{ entry().title }}
            </h3>
            <p class="m-0 whitespace-pre-wrap text-sm text-foreground/90" data-testid="body">
              {{ entry().body }}
            </p>
          </div>
        }

        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span class="font-mono" data-testid="topic">{{ entry().topic }}</span>
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
        </div>

        @if (entry().reaches; as reach) {
          <p
            class="m-0 flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-[12px] text-muted-foreground"
            data-testid="reaches"
          >
            <ng-icon name="lucideUsers" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{{ reachSentence() }}</span>
          </p>
        }

        @if (!readOnly() && !editing()) {
          <div class="flex flex-wrap gap-2 pt-1">
            @if (offersConfirm()) {
              <button
                hlmBtn
                size="sm"
                variant="outline"
                [disabled]="busy()"
                (click)="confirm.emit(entry().id)"
                data-testid="confirm"
              >
                <ng-icon name="lucideCheck" class="mr-1.5 h-3.5 w-3.5" />
                Still true — put my name to it
              </button>
            }
            <button
              hlmBtn
              size="sm"
              variant="ghost"
              [disabled]="busy()"
              (click)="startEdit()"
              data-testid="reword-start"
            >
              <ng-icon name="lucidePencil" class="mr-1.5 h-3.5 w-3.5" />
              Reword
            </button>
            <button
              hlmBtn
              size="sm"
              variant="ghost"
              [disabled]="busy()"
              (click)="archive.emit(entry().id)"
              data-testid="archive"
            >
              <ng-icon name="lucideArchive" class="mr-1.5 h-3.5 w-3.5" />
              Retire
            </button>
          </div>
        }

        @if (error(); as message) {
          <p class="m-0 text-sm text-destructive" data-testid="note-error">{{ message }}</p>
        }
      </div>
    </article>
  `,
})
export class ContextNoteCardComponent {
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

  protected readonly verdict = computed(
    () => VALIDITY_COPY[this.entry().confidence],
  );

  protected readonly natureCopy = computed(
    () => NATURE_COPY[this.entry().nature],
  );

  protected readonly checkCopy = computed(
    () => CHECK_COPY[this.entry().checkedBy],
  );

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

  protected readonly writtenBy = computed(() =>
    describeHand(this.entry().writtenBy),
  );

  protected readonly confirmedBy = computed(() =>
    describeHand(this.entry().confirmedBy),
  );

  protected readonly retiredBy = computed(() =>
    describeHand(this.entry().archivedBy),
  );

  protected readonly railClass = computed(() => {
    if (isSuspect(this.entry().confidence)) {
      return 'bg-amber-500 dark:bg-amber-400';
    }
    return this.entry().confidence === 'checked'
      ? 'bg-emerald-500/70 dark:bg-emerald-400/70'
      : 'bg-border';
  });

  protected readonly verdictClass = computed(() => {
    switch (this.entry().confidence) {
      case 'broken':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
      case 'checked':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
      case 'stale':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  });

  protected readonly verdictIcon = computed(() => {
    switch (this.entry().confidence) {
      case 'broken':
        return 'lucideCircleAlert';
      case 'checked':
        return 'lucideCircleCheck';
      default:
        return 'lucideClock';
    }
  });

  protected readonly offersConfirm = computed(
    () => this.entry().checkedBy === 'attestation',
  );

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
