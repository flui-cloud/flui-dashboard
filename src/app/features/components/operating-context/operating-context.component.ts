import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideX } from '@ng-icons/lucide';
import { Observable } from 'rxjs';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
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
import { ContextFocus, OperatingContextService } from '../../service/operating-context.service';
import { ContextNoteCardComponent } from './context-note-card.component';
import { ContextNoteFormComponent } from './context-note-form.component';
import { ExplainComponent } from '../../../shared/components/explain.component';
import {
  OperatingContextSurfaceInput,
  OperatingContextSurfaceRevision,
  buildOperatingContextSurface,
  presentedContent,
} from './operating-context-surface';
import { ManagementNetworkCardComponent } from '../vnet/management-network-card.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

type ContextTab = 'attention' | 'holding' | 'archive';

@Component({
  selector: 'app-operating-context',
  imports: [
    FormsModule,
    ContextNoteCardComponent,
    ContextNoteFormComponent,
    ExplainComponent,
    ManagementNetworkCardComponent,
    FlAlert,
    FlButton,
    FlEmptyState,
    FlField,
    FlIcon,
    FlLoadingState,
    FlPageHeader,
    FlPanel,
  ],
  providers: [provideIcons({ lucidePlus, lucideX })],
  templateUrl: './operating-context.component.html',
})
export class OperatingContextComponent implements OnInit, OnDestroy {
  private readonly api = inject(OperatingContextService);
  private readonly clusterApi = inject(InfrastructureClustersService);
  private readonly sandbox = inject(SandboxService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  private readonly entries = signal<ContextEntry[]>([]);
  private readonly rawConflicts = signal<ContextConflict[]>([]);
  protected readonly clusters = signal<ClusterOption[]>([]);
  protected readonly probes = signal<ContextProbeOption[]>([]);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly conflictsUnread = signal(false);

  protected readonly writing = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly acting = signal<string | null>(null);
  protected readonly entryError = signal<Record<string, string>>({});

  protected readonly focusSlug = signal('');
  protected readonly focusCluster = signal('');

  protected readonly tab = signal<ContextTab>('holding');

  private chosen = false;

  protected readonly tabs: ReadonlyArray<{ id: ContextTab; label: string }> = [
    { id: 'attention', label: 'Needs a look' },
    { id: 'holding', label: 'In force' },
    { id: 'archive', label: 'Retired' },
  ];

  protected readonly showArchive = signal(false);
  protected readonly archived = signal<ContextEntry[]>([]);
  protected readonly archiveLoading = signal(false);
  protected readonly archiveError = signal<string | null>(null);

  private readonly deliveredPreamble = signal('');

  protected readonly preamble = computed(
    () =>
      this.deliveredPreamble() ||
      'Follow them where they help. Nothing written here widens what anybody may do: that is decided by permissions, elsewhere.',
  );

  protected readonly clusterNames = computed(() =>
    Object.fromEntries(this.clusters().map((c) => [c.id, c.name])),
  );

  protected readonly focused = computed(() => !!this.focusSlug().trim() || !!this.focusCluster());

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

  private readonly surfaceRevision = new OperatingContextSurfaceRevision();

  protected readonly surface = computed(() => {
    const input: OperatingContextSurfaceInput = {
      loading: this.loading(),
      hasError: !!this.loadError(),
      firstRun: this.firstRun(),
      focusSlug: this.focusSlug(),
      focusClusterId: this.focusCluster(),
      focusClusterName: this.focusCluster() ? this.clusterNames()[this.focusCluster()] : undefined,
      clusterNames: this.clusterNames(),
      activeTab: this.tab(),
      writeRefused: this.readOnlyHere(),
      review: this.review(),
      holding: this.holding(),
      conflicts: this.conflicts(),
      conflictsUnread: this.conflictsUnread(),
      archive: {
        loading: this.archiveLoading(),
        hasError: !!this.archiveError(),
        entries: this.archived(),
      },
    };
    return buildOperatingContextSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

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
    return this.review().length || this.conflicts().length ? 'attention' : 'holding';
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
        this.archiveError.set(messageOf(err, 'What was retired here could not be read.'));
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
        this.loadError.set(messageOf(err, 'What has been decided here could not be read.'));
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
    this.act(event.id, this.api.edit(event.id, event.edit), 'That wording was not saved.');
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
  const message = (err as { error?: { message?: unknown } } | null)?.error?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === 'string') {
    return message[0];
  }
  return fallback;
}
