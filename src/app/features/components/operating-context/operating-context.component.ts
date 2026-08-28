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
  lucideArchive,
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
import { ExplainComponent } from '../../../shared/components/explain.component';

type ContextTab = 'attention' | 'holding' | 'archive';

@Component({
  selector: 'app-operating-context',
  standalone: true,
  imports: [
    FormsModule,
    NgIcon,
    HlmButtonDirective,
    ContextNoteCardComponent,
    ContextNoteFormComponent,
    ExplainComponent,
  ],
  providers: [
    provideIcons({
      lucideArchive,
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
      <header class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="m-0 text-2xl font-semibold tracking-tight text-foreground">
          How this installation is run
        </h1>
        <span
          class="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.07] px-2.5 py-1"
          data-testid="preamble"
        >
          <span class="font-mono text-[10px] font-semibold tracking-widest text-accent-foreground">
            ADVICE
          </span>
          <app-explain
            label="not permissions"
            labelClass="text-[12px] text-muted-foreground"
            testid="preamble-why"
          >
            {{ preamble() }}
          </app-explain>
        </span>
      </header>

      <!-- ── What reaches a given thing ────────────────────────── -->
      @if (!firstRun()) {
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
        <app-explain label="Two axes, not a hierarchy" testid="reach-why">
          What a thing is, and where it runs. A resource receives every note
          whose region contains it — down both at once, neither taking
          precedence.
        </app-explain>
      </section>
      }

      @if (loadError(); as message) {
        <div
          class="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          data-testid="load-error"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ message }}</span>
        </div>
      }

      <!-- ── The first time anybody arrives ────────────────────── -->
      @if (firstRun() && !writing()) {
        <section
          class="card-surface mx-auto max-w-2xl space-y-5 p-8 text-center"
          data-testid="first-run"
        >
          <div class="space-y-2">
            <h2 class="m-0 text-lg font-semibold text-foreground">
              Nothing has been written down yet
            </h2>
            <p class="m-0 text-sm text-muted-foreground">
              The local conventions nobody can work out from the code — why the
              master is left alone, when deploys happen, which cluster is not to
              be touched. Everybody here reads them, and so does every agent
              before it changes anything.
            </p>
          </div>

          <div class="rounded-lg border border-dashed border-border p-4 text-left">
            <p class="m-0 text-[11px] uppercase tracking-wide text-muted-foreground">
              For example
            </p>
            <p class="m-0 mt-1.5 text-sm font-medium text-foreground">
              The master is not resized
            </p>
            <p class="m-0 mt-0.5 text-[13px] text-muted-foreground">
              The API runs on it, so resizing takes the control plane down.
              Add workers instead.
            </p>
          </div>

          @if (readOnlyHere()) {
            <p class="m-0 text-sm text-muted-foreground" data-testid="first-run-read-only">
              {{ readOnlyWhy() }}
            </p>
          } @else {
            <button hlmBtn (click)="writing.set(true)" data-testid="write-first">
              <ng-icon name="lucidePlus" class="mr-1.5 h-4 w-4" />
              Write the first note
            </button>
          }
        </section>
      }

      <!-- ── Writing one ───────────────────────────────────────── -->
      @if (readOnlyHere() && !firstRun()) {
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
          (dismissed)="writing.set(false)"
        />
      } @else if (!firstRun()) {
        <button hlmBtn (click)="writing.set(true)" data-testid="start-writing">
          <ng-icon name="lucidePlus" class="mr-1.5 h-4 w-4" />
          Write a note
        </button>
      }

      @if (loading()) {
        <div class="space-y-3" data-testid="loading" aria-busy="true">
          @for (row of [1, 2, 3]; track row) {
            <div class="card-surface space-y-3 p-4">
              <div class="flex items-center gap-2">
                <div class="skeleton h-5 w-56"></div>
                <div class="skeleton h-4 w-16"></div>
              </div>
              <div class="skeleton h-3 w-72"></div>
              <div class="skeleton h-3 w-full max-w-xl"></div>
            </div>
          }
        </div>
      }

      @if (!loading() && !firstRun()) {
        <!-- ── Three questions, one at a time ─────────────────── -->
        <div class="border-b border-border">
          <nav class="-mb-px flex gap-1 overflow-x-auto scrollbar-none" data-testid="tabs">
            @for (t of tabs; track t.id) {
              <button
                type="button"
                (click)="chooseTab(t.id)"
                class="inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors md:px-5"
                [class]="
                  tab() === t.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                "
                [attr.aria-current]="tab() === t.id ? 'page' : null"
                [attr.data-testid]="'tab-' + t.id"
              >
                <ng-icon [name]="t.icon" class="h-4 w-4" />
                <span>{{ t.label }}</span>
                @if (countFor(t.id); as n) {
                  <span
                    class="rounded-full px-1.5 py-0.5 text-[11px] tabular-nums"
                    [class]="
                      t.id === 'attention'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-muted text-muted-foreground'
                    "
                    [attr.data-testid]="'tab-count-' + t.id"
                  >
                    {{ n }}
                  </span>
                }
              </button>
            }
          </nav>
        </div>
      }

      <!-- ── Asking to be re-read ──────────────────────────────── -->
      @if (!loading() && !firstRun() && tab() === 'attention') {
        <section class="space-y-3" data-testid="group-review">
          <div class="flex items-baseline justify-between gap-4 pb-1">
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
            <app-explain
              label="Nothing is asking to be revisited"
              labelClass="text-sm text-muted-foreground"
              testid="nothing-to-review"
            >
              A note that leans on a live fact appears here the moment the
              platform stops agreeing with it.
            </app-explain>
          }
        </section>

        <!-- ── Where two notes disagree ────────────────────────── -->
        <section class="space-y-3" data-testid="group-conflicts">
          <div class="flex items-baseline justify-between gap-4 pb-1">
            <p class="text-label m-0">Where two notes disagree</p>
            <p class="m-0 text-[13px] text-muted-foreground" data-testid="conflict-count">
              {{ conflictNote() }}
            </p>
          </div>

          @for (group of conflicts(); track group.topic) {
            <div class="space-y-2 rounded-lg border border-dashed border-border p-3" data-testid="conflict">
              <p class="m-0 flex items-center gap-2 text-[12px] text-muted-foreground">
                <ng-icon name="lucideCircleAlert" class="h-3.5 w-3.5 shrink-0" />
                <span class="font-mono text-foreground">{{ group.topic }}</span>
                <app-explain
                  label="neither wins"
                  labelClass="text-[12px] text-muted-foreground"
                  [testid]="'conflict-why-' + group.topic"
                >
                  Being written at a narrower level does not make a note more
                  right, and one of the two is very often simply older.
                </app-explain>
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
      }

      <!-- ── What still holds ──────────────────────────────────── -->
      @if (!loading() && !firstRun() && tab() === 'holding') {
        <section class="space-y-3" data-testid="group-holding">
          <div class="flex items-baseline justify-between gap-4 pb-1">
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
            <app-explain
              label="Nothing written down yet"
              labelClass="text-sm text-muted-foreground"
              testid="nothing-here"
            >
              The first note is usually the one somebody had to explain twice.
            </app-explain>
          }
        </section>
      }

      <!-- ── Why it used to be done this way ───────────────────── -->
      @if (!loading() && !firstRun() && tab() === 'archive') {
        @if (!readOnlyHere()) {
          <section class="space-y-3" data-testid="group-archive">
            <div class="flex items-baseline justify-between gap-4 pb-1">
              <p class="text-label m-0">Why it used to be done this way</p>
            </div>

            <app-explain
              label="Archived, not deleted"
              labelClass="text-[12px] text-muted-foreground"
              testid="archive-why"
            >
              A rule that was true once explains a decision that was made once.
              These are read here and nowhere else — a withdrawn rule is never
              handed to an agent as advice, and its premise is not asked again,
              so each one says what was believed on the day it was withdrawn.
            </app-explain>

              @if (archiveLoading()) {
                <div class="space-y-3" data-testid="archive-loading" aria-busy="true">
                  @for (row of [1, 2]; track row) {
                    <div class="card-surface space-y-2 p-4">
                      <div class="skeleton h-4 w-48"></div>
                      <div class="skeleton h-3 w-64"></div>
                    </div>
                  }
                </div>
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

  protected readonly tab = signal<ContextTab>('holding');

  private chosen = false;

  protected readonly tabs: ReadonlyArray<{
    id: ContextTab;
    label: string;
    icon: string;
  }> = [
    { id: 'attention', label: 'Needs a look', icon: 'lucideCircleAlert' },
    { id: 'holding', label: 'In force', icon: 'lucideLayers' },
    { id: 'archive', label: 'Retired', icon: 'lucideArchive' },
  ];

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

  protected readonly firstRun = computed(
    () => !this.loading() && !this.entries().length && !this.focused(),
  );

  protected chooseTab(id: ContextTab): void {
    this.chosen = true;
    this.tab.set(id);
    if (id === 'archive' && !this.archived().length) this.loadArchive();
  }

  protected countFor(id: ContextTab): number | null {
    if (id === 'attention') {
      const n = this.review().length + this.conflicts().length;
      return n || null;
    }
    if (id === 'holding') return this.holding().length || null;
    return null;
  }

  private openingTab(): ContextTab {
    return this.review().length || this.conflicts().length
      ? 'attention'
      : 'holding';
  }

  private openOnWhatMatters(): void {
    if (!this.chosen) this.tab.set(this.openingTab());
  }

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
        this.openOnWhatMatters();
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
        this.openOnWhatMatters();
      },
      error: () => {
        this.rawConflicts.set([]);
        this.conflictsUnread.set(true);
      },
    });
    if (this.tab() === 'archive') this.loadArchive();
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
