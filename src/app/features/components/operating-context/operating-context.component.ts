import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronUp,
  lucideCircleAlert,
  lucideLayers,
  lucideLoader,
  lucidePlus,
  lucideTriangleAlert,
  lucideX,
} from '@ng-icons/lucide';
import { Observable } from 'rxjs';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { ClusterOption } from '../../model/iam.model';
import {
  ContextConflict,
  ContextEntry,
  ContextProbeOption,
  EditContextEntry,
  WriteContextEntry,
  conflictGroups,
  needsReview,
  suspectFirst,
} from '../../model/operating-context.models';
import {
  ContextFocus,
  OperatingContextService,
} from '../../service/operating-context.service';
import { ContextNoteCardComponent } from './context-note-card.component';
import { ContextNoteFormComponent } from './context-note-form.component';

@Component({
  selector: 'app-operating-context',
  standalone: true,
  imports: [
    FormsModule,
    NgIcon,
    HlmButtonDirective,
    ContextNoteCardComponent,
    ContextNoteFormComponent,
  ],
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideChevronUp,
      lucideCircleAlert,
      lucideLayers,
      lucideLoader,
      lucidePlus,
      lucideTriangleAlert,
      lucideX,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-5xl space-y-8 p-6">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">
          How this installation is run
        </h1>
        <p class="m-0 text-sm text-muted-foreground">
          What people here decided about how things are done, where each
          decision applies, and which of them the platform can no longer
          confirm.
        </p>
      </header>

      <div
        role="note"
        class="flex items-start gap-3.5 rounded-lg border border-primary/20 bg-primary/[0.07] px-4 py-3.5"
        data-testid="preamble"
      >
        <span
          class="shrink-0 pt-0.5 font-mono text-[11px] font-semibold tracking-widest text-accent-foreground"
        >
          ADVICE
        </span>
        <p class="m-0 text-sm text-muted-foreground">
          <span class="font-semibold text-foreground">
            These are notes, not permissions.
          </span>
          {{ preamble() }}
        </p>
      </div>

      <!-- ── What reaches a given thing ────────────────────────── -->
      <section class="space-y-2" data-testid="focus">
        <div class="flex flex-wrap items-end gap-3">
          <div class="space-y-1">
            <label class="block text-[12px] font-medium text-foreground" for="focus-slug">
              Application
            </label>
            <input
              id="focus-slug"
              [class]="fieldClass"
              placeholder="slug"
              [ngModel]="focusSlug()"
              (ngModelChange)="focusSlug.set($event)"
              data-testid="focus-slug"
            />
          </div>
          <div class="space-y-1">
            <label class="block text-[12px] font-medium text-foreground" for="focus-cluster">
              Cluster
            </label>
            <select
              id="focus-cluster"
              [class]="selectClass"
              [ngModel]="focusCluster()"
              (ngModelChange)="focusCluster.set($event)"
              data-testid="focus-cluster"
            >
              <option value="">Any cluster</option>
              @for (cluster of clusters(); track cluster.id) {
                <option [value]="cluster.id">{{ cluster.name }}</option>
              }
            </select>
          </div>
          <button hlmBtn size="sm" variant="outline" (click)="load()" data-testid="focus-apply">
            Show what reaches it
          </button>
          @if (focused()) {
            <button hlmBtn size="sm" variant="ghost" (click)="clearFocus()" data-testid="focus-clear">
              <ng-icon name="lucideX" class="mr-1.5 h-3.5 w-3.5" />
              Everything again
            </button>
          }
        </div>
        <p class="m-0 flex items-start gap-2 text-[12px] text-muted-foreground">
          <ng-icon name="lucideLayers" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Two axes, not a hierarchy: what a thing is, and where it runs. A
            resource receives the union of every note whose region contains it —
            arriving down both at once, with neither taking precedence.
          </span>
        </p>
      </section>

      @if (loadError(); as message) {
        <div
          class="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          data-testid="load-error"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ message }}</span>
        </div>
      }

      <!-- ── Writing one ───────────────────────────────────────── -->
      @if (readOnlyHere()) {
        <p class="m-0 text-sm text-muted-foreground" data-testid="read-only-here">
          {{ readOnlyWhy() }}
        </p>
      } @else if (writing()) {
        <app-context-note-form
          [clusters]="clusters()"
          [probes]="probes()"
          [busy]="saving()"
          [error]="saveError()"
          (save)="write($event)"
          (cancel)="writing.set(false)"
        />
      } @else {
        <button hlmBtn (click)="writing.set(true)" data-testid="start-writing">
          <ng-icon name="lucidePlus" class="mr-1.5 h-4 w-4" />
          Write a note
        </button>
      }

      @if (loading()) {
        <p class="m-0 flex items-center gap-2 text-sm text-muted-foreground" data-testid="loading">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Reading what has been decided here…
        </p>
      }

      <!-- ── Asking to be re-read ──────────────────────────────── -->
      @if (!loading()) {
        <section class="space-y-3" data-testid="group-review">
          <div class="flex items-baseline justify-between gap-4 border-b border-border pb-2.5">
            <p class="text-label m-0">Asking to be re-read</p>
            <p class="m-0 text-[13px] text-muted-foreground" data-testid="review-count">
              {{ reviewNote() }}
            </p>
          </div>

          @for (entry of review(); track entry.id) {
            <app-context-note-card
              [entry]="entry"
              [clusterNames]="clusterNames()"
              [busy]="acting() === entry.id"
              [readOnly]="readOnlyHere()"
              [error]="errorFor(entry.id)"
              (confirm)="confirm($event)"
              (archive)="archive($event)"
              (reword)="reword($event)"
            />
          } @empty {
            <p class="m-0 text-sm text-muted-foreground" data-testid="nothing-to-review">
              Nothing is asking to be revisited. A note that leans on a live fact
              says so here the moment the platform stops agreeing with it.
            </p>
          }
        </section>

        <!-- ── Where two notes disagree ────────────────────────── -->
        <section class="space-y-3" data-testid="group-conflicts">
          <div class="flex items-baseline justify-between gap-4 border-b border-border pb-2.5">
            <p class="text-label m-0">Where two notes disagree</p>
            <p class="m-0 text-[13px] text-muted-foreground" data-testid="conflict-count">
              {{ conflictNote() }}
            </p>
          </div>

          @for (group of conflicts(); track group.topic) {
            <div class="space-y-2 rounded-lg border border-dashed border-border p-3" data-testid="conflict">
              <p class="m-0 flex items-center gap-2 text-[12px] text-muted-foreground">
                <ng-icon name="lucideCircleAlert" class="h-3.5 w-3.5" />
                <span>
                  Both of these are about
                  <span class="font-mono text-foreground">{{ group.topic }}</span>
                  and they say different things. Neither wins — being written at
                  a narrower level does not make a note more right, and one of
                  the two is very often simply older.
                </span>
              </p>
              @for (entry of group.entries; track entry.id) {
                <app-context-note-card
                  [entry]="entry"
                  [clusterNames]="clusterNames()"
                  [busy]="acting() === entry.id"
                  [readOnly]="readOnlyHere()"
                  [error]="errorFor(entry.id)"
                  (confirm)="confirm($event)"
                  (archive)="archive($event)"
                  (reword)="reword($event)"
                />
              }
            </div>
          } @empty {
            <p class="m-0 text-sm text-muted-foreground" data-testid="no-conflicts">
              {{ noConflictNote() }}
            </p>
          }
        </section>

        <!-- ── What still holds ────────────────────────────────── -->
        <section class="space-y-3" data-testid="group-holding">
          <div class="flex items-baseline justify-between gap-4 border-b border-border pb-2.5">
            <p class="text-label m-0">What still holds</p>
            <p class="m-0 text-[13px] text-muted-foreground" data-testid="holding-count">
              {{ holdingNote() }}
            </p>
          </div>

          @for (entry of holding(); track entry.id) {
            <app-context-note-card
              [entry]="entry"
              [clusterNames]="clusterNames()"
              [busy]="acting() === entry.id"
              [readOnly]="readOnlyHere()"
              [error]="errorFor(entry.id)"
              (confirm)="confirm($event)"
              (archive)="archive($event)"
              (reword)="reword($event)"
            />
          } @empty {
            <p class="m-0 text-sm text-muted-foreground" data-testid="nothing-here">
              Nothing has been written down about how this installation is run.
              The first note is usually the one somebody had to explain twice.
            </p>
          }
        </section>

        <!-- ── Why it used to be done this way ─────────────────── -->
        @if (!readOnlyHere()) {
          <section class="space-y-3" data-testid="group-archive">
            <div class="flex items-baseline justify-between gap-4 border-b border-border pb-2.5">
              <p class="text-label m-0">Why it used to be done this way</p>
              <button
                hlmBtn
                size="sm"
                variant="ghost"
                (click)="toggleArchive()"
                data-testid="archive-toggle"
              >
                <ng-icon
                  [name]="showArchive() ? 'lucideChevronUp' : 'lucideChevronDown'"
                  class="mr-1.5 h-3.5 w-3.5"
                />
                {{ showArchive() ? 'Hide what was retired' : 'Show what was retired' }}
              </button>
            </div>

            @if (showArchive()) {
              <p class="m-0 text-[12px] text-muted-foreground" data-testid="archive-why">
                Retiring a note archives it rather than deleting it: a rule that
                was true once explains a decision that was made once. These are
                read here and nowhere else — a withdrawn rule is never handed to
                an agent as advice, and its premise is not asked again, so each
                one says what was believed on the day it was withdrawn.
              </p>

              @if (archiveLoading()) {
                <p class="m-0 flex items-center gap-2 text-sm text-muted-foreground" data-testid="archive-loading">
                  <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                  Reading what was retired…
                </p>
              } @else if (archiveError()) {
                <p class="m-0 text-sm text-muted-foreground" data-testid="archive-error">
                  {{ archiveError() }}
                </p>
              } @else {
                @for (entry of archived(); track entry.id) {
                  <app-context-note-card
                    [entry]="entry"
                    [clusterNames]="clusterNames()"
                    [readOnly]="true"
                  />
                } @empty {
                  <p class="m-0 text-sm text-muted-foreground" data-testid="archive-empty">
                    Nothing has been retired here yet.
                  </p>
                }
              }
            }
          </section>
        }
      }
    </div>
  `,
})
export class OperatingContextComponent implements OnInit {
  private readonly api = inject(OperatingContextService);
  private readonly clusterApi = inject(InfrastructureClustersService);
  private readonly sandbox = inject(SandboxService);

  protected readonly fieldClass =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  protected readonly selectClass = `${this.fieldClass} h-10 appearance-none pr-8`;

  private readonly entries = signal<ContextEntry[]>([]);
  private readonly rawConflicts = signal<ContextConflict[]>([]);
  protected readonly clusters = signal<ClusterOption[]>([]);
  protected readonly probes = signal<ContextProbeOption[]>([]);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  private readonly conflictsUnread = signal(false);

  protected readonly writing = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly acting = signal<string | null>(null);
  protected readonly entryError = signal<Record<string, string>>({});

  protected readonly focusSlug = signal('');
  protected readonly focusCluster = signal('');

  protected readonly showArchive = signal(false);
  protected readonly archived = signal<ContextEntry[]>([]);
  protected readonly archiveLoading = signal(false);
  protected readonly archiveError = signal<string | null>(null);

  private readonly deliveredPreamble = signal('');

  protected readonly preamble = computed(
    () =>
      this.deliveredPreamble() ||
      'Follow them where they help. Nothing written here widens what anybody may do — that is decided by permissions, elsewhere.',
  );

  protected readonly clusterNames = computed(() =>
    Object.fromEntries(this.clusters().map((c) => [c.id, c.name])),
  );

  protected readonly focused = computed(
    () => !!this.focusSlug().trim() || !!this.focusCluster(),
  );

  protected readonly review = computed(() =>
    suspectFirst(this.entries().filter((e) => needsReview(e.confidence))),
  );

  protected readonly holding = computed(() =>
    this.entries().filter((e) => !needsReview(e.confidence)),
  );

  protected readonly conflicts = computed(() =>
    conflictGroups(this.rawConflicts(), this.entries()),
  );

  protected readonly readOnlyHere = computed(
    () => this.sandbox.levelOf('operating-context') === 'read-only',
  );

  protected readonly readOnlyWhy = computed(
    () =>
      this.sandbox.whyFor('operating-context') ||
      'Writing a note belongs to whoever runs this instance.',
  );

  protected readonly reviewNote = computed(() => {
    const count = this.review().length;
    if (!count) return 'nothing';
    const broken = this.review().filter((e) => e.confidence === 'broken').length;
    const head = count === 1 ? '1 note' : `${count} notes`;
    return broken ? `${head} · ${broken} with a fallen premise` : head;
  });

  protected readonly holdingNote = computed(() => {
    const count = this.holding().length;
    return count === 1 ? '1 note' : `${count} notes`;
  });

  protected readonly conflictNote = computed(() => {
    if (this.conflictsUnread()) return 'could not be read';
    const count = this.conflicts().length;
    if (!count) return 'none';
    return count === 1 ? '1 subject' : `${count} subjects`;
  });

  protected readonly noConflictNote = computed(() =>
    this.conflictsUnread()
      ? 'The disagreements could not be read. The notes above are all here; only the pairing of the ones that contradict each other is missing.'
      : 'No two notes here say different things about the same subject.',
  );

  ngOnInit(): void {
    this.load();
    this.loadClusters();
    this.loadProbes();
  }

  protected errorFor(id: string): string | null {
    return this.entryError()[id] ?? null;
  }

  protected clearFocus(): void {
    this.focusSlug.set('');
    this.focusCluster.set('');
    this.load();
  }

  protected toggleArchive(): void {
    const next = !this.showArchive();
    this.showArchive.set(next);
    if (next) this.loadArchive();
  }

  private loadArchive(): void {
    this.archiveLoading.set(true);
    this.archiveError.set(null);
    this.api.retired(this.focus()).subscribe({
      next: (entries) => {
        this.archived.set(entries);
        this.archiveLoading.set(false);
      },
      error: (err: unknown) => {
        this.archived.set([]);
        this.archiveLoading.set(false);
        this.archiveError.set(
          messageOf(err, 'What was retired here could not be read.'),
        );
      },
    });
  }

  protected load(): void {
    const focus = this.focus();
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list(focus).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.entries.set([]);
        this.loading.set(false);
        this.loadError.set(
          messageOf(err, 'What has been decided here could not be read.'),
        );
      },
    });
    this.api.advice(focus).subscribe({
      next: (delivery) => {
        this.rawConflicts.set(delivery.conflicts ?? []);
        this.deliveredPreamble.set(delivery.preamble ?? '');
        this.conflictsUnread.set(false);
      },
      error: () => {
        this.rawConflicts.set([]);
        this.conflictsUnread.set(true);
      },
    });
    if (this.showArchive()) this.loadArchive();
  }

  protected write(entry: WriteContextEntry): void {
    this.saving.set(true);
    this.saveError.set(null);
    this.api.create(entry).subscribe({
      next: () => {
        this.saving.set(false);
        this.writing.set(false);
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.saveError.set(messageOf(err, 'That note was not written.'));
      },
    });
  }

  protected confirm(id: string): void {
    this.act(id, this.api.confirm(id), 'That confirmation did not go through.');
  }

  protected archive(id: string): void {
    this.act(id, this.api.archive(id), 'That note was not retired.');
  }

  protected reword(event: { id: string; edit: EditContextEntry }): void {
    this.act(
      event.id,
      this.api.edit(event.id, event.edit),
      'That wording was not saved.',
    );
  }

  private act(id: string, call: Observable<unknown>, fallback: string): void {
    this.acting.set(id);
    this.clearEntryError(id);
    call.subscribe({
      next: () => {
        this.acting.set(null);
        this.load();
      },
      error: (err: unknown) => {
        this.acting.set(null);
        this.entryError.update((errors) => ({
          ...errors,
          [id]: messageOf(err, fallback),
        }));
      },
    });
  }

  private clearEntryError(id: string): void {
    this.entryError.update((errors) => {
      const next = { ...errors };
      delete next[id];
      return next;
    });
  }

  private focus(): ContextFocus | undefined {
    const slug = this.focusSlug().trim();
    const clusterId = this.focusCluster();
    if (!slug && !clusterId) return undefined;
    return { slug: slug || undefined, clusterId: clusterId || undefined };
  }

  private loadClusters(): void {
    this.clusterApi.clustersControllerListClusters().subscribe({
      next: (list) =>
        this.clusters.set(
          (list ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            provider: c.provider,
          })),
        ),
      error: () => this.clusters.set([]),
    });
  }

  private loadProbes(): void {
    this.api.probes().subscribe({
      next: (list) => this.probes.set(list ?? []),
      error: () => this.probes.set([]),
    });
  }
}

function messageOf(err: unknown, fallback: string): string {
  const message = (err as { error?: { message?: unknown } } | null)?.error
    ?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === 'string') {
    return message[0];
  }
  return fallback;
}
