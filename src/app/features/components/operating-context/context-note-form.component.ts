import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideLayers,
  lucideLoader,
  lucideUsers,
} from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { ClusterOption } from '../../model/iam.model';
import {
  ABOUT_AXES,
  ABOUT_LABEL,
  AboutAxis,
  CheckKind,
  ContextProbeOption,
  EMPTY_LEVEL,
  ENTRY_NATURES,
  EntryNature,
  EntryReach,
  LevelDraft,
  NATURE_COPY,
  PREMISE_HINT,
  PROBE_OPS,
  ProbeOp,
  TOPIC_HINT,
  answerTypeOf,
  declaredParamsOf,
  WHERE_AXES,
  WHERE_LABEL,
  WhereAxis,
  WriteContextEntry,
  probeAllowedAt,
  probeParamsOf,
  prospectiveScope,
  reachIsWiderThanOwners,
  whatIsStillNeeded,
  writeBodyOf,
} from '../../model/operating-context.models';
import { OperatingContextService } from '../../service/operating-context.service';

const FIELD =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const SELECT = `${FIELD} h-10 appearance-none pr-8`;

interface ReachState {
  line: EntryReach | null;
  loading: boolean;
  error: string | null;
}

const IDLE_REACH: ReachState = { line: null, loading: false, error: null };

const FAILED_REACH: ReachState = {
  line: null,
  loading: false,
  error:
    'Who this note reaches could not be read. Nothing here is stopping the note being written — but it would be written without having seen its audience.',
};

@Component({
  selector: 'app-context-note-form',
  standalone: true,
  imports: [FormsModule, NgIcon, HlmButtonDirective],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideLayers,
      lucideLoader,
      lucideUsers,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="space-y-6 rounded-lg border border-border bg-card p-5"
      data-testid="note-form"
      (submit)="submit($event)"
    >
      <!-- ── What kind of note ─────────────────────────────────── -->
      <fieldset class="space-y-2 border-0 p-0">
        <legend class="text-label mb-1 p-0">What kind of note is this</legend>
        <div class="grid gap-2 sm:grid-cols-2">
          @for (option of natures; track option) {
            <button
              type="button"
              class="rounded-lg border p-3 text-left transition-colors"
              [class]="nature() === option ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'"
              [attr.aria-pressed]="nature() === option"
              [attr.data-testid]="'nature-' + option"
              (click)="nature.set(option)"
            >
              <span class="block text-sm font-semibold text-foreground">
                {{ copyFor(option).label }}
              </span>
              <span class="mt-0.5 block text-[12px] text-muted-foreground">
                {{ copyFor(option).means }}
              </span>
            </button>
          }
        </div>
      </fieldset>

      <!-- ── Where it applies: two axes ────────────────────────── -->
      <fieldset class="space-y-3 border-0 p-0">
        <legend class="text-label mb-1 p-0">Where it applies</legend>
        <p class="m-0 flex items-start gap-2 text-[12px] text-muted-foreground">
          <ng-icon name="lucideLayers" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Two separate questions, not one nested inside the other. An
            application belongs to a project and runs on a cluster; it receives
            every note whose region contains it, down either axis.
          </span>
        </p>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <label class="block text-[12px] font-medium text-foreground" for="about-axis">
              What it is about
            </label>
            <select
              id="about-axis"
              [class]="selectClass"
              [ngModel]="about()"
              name="about"
              (ngModelChange)="about.set($event)"
              data-testid="about-axis"
            >
              @for (axis of aboutAxes; track axis) {
                <option [value]="axis">{{ aboutLabel[axis] }}</option>
              }
            </select>

            @switch (about()) {
              @case ('apps') {
                <input
                  [class]="fieldClass"
                  placeholder="slugs, comma separated"
                  [ngModel]="slugs()"
                  name="slugs"
                  (ngModelChange)="slugs.set($event)"
                  data-testid="about-slugs"
                />
              }
              @case ('project') {
                <input
                  [class]="fieldClass"
                  placeholder="project"
                  [ngModel]="project()"
                  name="project"
                  (ngModelChange)="project.set($event)"
                  data-testid="about-project"
                />
              }
              @case ('kind') {
                <input
                  [class]="fieldClass"
                  placeholder="kind, e.g. DATABASE"
                  [ngModel]="kind()"
                  name="kind"
                  (ngModelChange)="kind.set($event)"
                  data-testid="about-kind"
                />
              }
              @case ('tag') {
                <input
                  [class]="fieldClass"
                  placeholder="tags, comma separated"
                  [ngModel]="tags()"
                  name="tags"
                  (ngModelChange)="tags.set($event)"
                  data-testid="about-tags"
                />
              }
            }
          </div>

          <div class="space-y-2">
            <label class="block text-[12px] font-medium text-foreground" for="where-axis">
              Where it runs
            </label>
            <select
              id="where-axis"
              [class]="selectClass"
              [ngModel]="where()"
              name="where"
              (ngModelChange)="where.set($event)"
              data-testid="where-axis"
            >
              @for (axis of whereAxes; track axis) {
                <option [value]="axis">{{ whereLabel[axis] }}</option>
              }
            </select>

            @switch (where()) {
              @case ('cluster') {
                <select
                  [class]="selectClass"
                  [ngModel]="clusterId()"
                  name="clusterId"
                  (ngModelChange)="clusterId.set($event)"
                  data-testid="where-cluster"
                >
                  <option value="">Pick a cluster…</option>
                  @for (cluster of clusters(); track cluster.id) {
                    <option [value]="cluster.id">{{ cluster.name }}</option>
                  }
                </select>
              }
              @case ('provider') {
                <input
                  [class]="fieldClass"
                  placeholder="provider, e.g. hetzner"
                  [ngModel]="provider()"
                  name="provider"
                  (ngModelChange)="provider.set($event)"
                  data-testid="where-provider"
                />
              }
            }
          </div>
        </div>
      </fieldset>

      <!-- ── The words ─────────────────────────────────────────── -->
      <fieldset class="space-y-3 border-0 p-0">
        <legend class="text-label mb-1 p-0">The note</legend>

        <div class="space-y-1">
          <label class="block text-[12px] font-medium text-foreground" for="note-topic">
            Subject
          </label>
          <input
            id="note-topic"
            [class]="fieldClass"
            placeholder="master-node-scaling"
            [ngModel]="topic()"
            name="topic"
            (ngModelChange)="topic.set($event)"
            data-testid="topic"
          />
          <p class="m-0 text-[11px] text-muted-foreground">{{ topicHint }}</p>
        </div>

        <input
          [class]="fieldClass"
          placeholder="Title"
          aria-label="Title"
          [ngModel]="title()"
          name="title"
          (ngModelChange)="title.set($event)"
          data-testid="title"
        />

        <textarea
          rows="5"
          [class]="fieldClass"
          placeholder="What is done here, or why it was decided."
          aria-label="Note"
          [ngModel]="noteBody()"
          name="body"
          (ngModelChange)="noteBody.set($event)"
          data-testid="body"
        ></textarea>
      </fieldset>

      <!-- ── What keeps it honest ──────────────────────────────── -->
      <fieldset class="space-y-3 border-0 p-0">
        <legend class="text-label mb-1 p-0">What keeps it honest</legend>
        <p class="m-0 text-[12px] text-muted-foreground">
          A note ages. Leaning it on a live fact, or on a signature with a shelf
          life, is what lets it ask to be revisited instead of advising
          something that stopped being true.
        </p>

        <select
          [class]="selectClass"
          [ngModel]="checkKind()"
          name="checkKind"
          (ngModelChange)="checkKind.set($event)"
          aria-label="What keeps it honest"
          data-testid="check-kind"
        >
          <option value="none">Nothing — it is prose, and says so</option>
          <option value="attestation">A person confirms it, and that lapses</option>
          @if (probeUsable()) {
            <option value="probe">A live fact the platform can compare</option>
          }
        </select>

        @if (!probeUsable()) {
          <p class="m-0 text-[11px] text-muted-foreground" data-testid="no-probe-here">
            A note about the whole installation cannot be compared with
            anything: it is either an intention, or it belongs at a narrower
            level.
          </p>
        }

        @if (checkKind() === 'attestation') {
          <label class="block space-y-1 text-[12px] font-medium text-foreground">
            <span>A confirmation is worth (days)</span>
            <input
              type="number"
              min="1"
              max="365"
              [class]="fieldClass"
              [ngModel]="validForDays()"
              name="validForDays"
              (ngModelChange)="validForDays.set(+$event)"
              data-testid="valid-for-days"
            />
          </label>
        }

        @if (checkKind() === 'probe') {
          <div class="space-y-2" data-testid="probe-editor">
            <select
              [class]="selectClass"
              [ngModel]="probeId()"
              name="probeId"
              (ngModelChange)="pickProbe($event)"
              aria-label="Which fact"
              data-testid="probe-id"
            >
              <option value="">Pick a fact…</option>
              @for (probe of probes(); track probe.id) {
                <option [value]="probe.id">{{ probe.id }}</option>
              }
            </select>

            @if (probeDescription(); as describes) {
              <p class="m-0 text-[11px] text-muted-foreground" data-testid="probe-describes">
                {{ describes }}
              </p>
            }

            @if (declaredParams(); as declared) {
              @for (param of declared; track param.name) {
                <div class="space-y-1" data-testid="declared-param">
                  <label
                    class="block text-[12px] font-medium text-foreground"
                    [attr.for]="'param-' + param.name"
                  >
                    {{ param.name }}
                    @if (!param.required) {
                      <span class="font-normal text-muted-foreground">
                        — optional
                      </span>
                    }
                  </label>
                  @if (param.oneOf; as choices) {
                    <select
                      [id]="'param-' + param.name"
                      [class]="selectClass"
                      [ngModel]="paramValue(param.name)"
                      [name]="'param-' + param.name"
                      (ngModelChange)="setParam(param.name, $event)"
                      [attr.data-testid]="'param-' + param.name"
                    >
                      <option value="">Pick one…</option>
                      @for (choice of choices; track choice) {
                        <option [value]="choice">{{ choice }}</option>
                      }
                    </select>
                  } @else {
                    <input
                      [id]="'param-' + param.name"
                      [class]="fieldClass"
                      [placeholder]="param.name"
                      [ngModel]="paramValue(param.name)"
                      [name]="'param-' + param.name"
                      (ngModelChange)="setParam(param.name, $event)"
                      [attr.data-testid]="'param-' + param.name"
                    />
                  }
                </div>
              }
            } @else {
              <p
                class="m-0 text-[11px] text-muted-foreground"
                data-testid="undeclared-params"
              >
                This fact did not say what it wants. Name the parameters
                yourself — the API will say if one is missing.
              </p>
              @for (row of paramRows(); track $index) {
                <div class="flex gap-2">
                  <input
                    [class]="fieldClass"
                    placeholder="parameter"
                    aria-label="Parameter name"
                    [ngModel]="row.name"
                    [name]="'param-name-' + $index"
                    (ngModelChange)="setRow($index, 'name', $event)"
                    data-testid="param-name"
                  />
                  <input
                    [class]="fieldClass"
                    placeholder="value"
                    aria-label="Parameter value"
                    [ngModel]="row.value"
                    [name]="'param-value-' + $index"
                    (ngModelChange)="setRow($index, 'value', $event)"
                    data-testid="param-value"
                  />
                </div>
              }
              <button
                type="button"
                hlmBtn
                size="sm"
                variant="ghost"
                (click)="addParam()"
                data-testid="add-param"
              >
                Another parameter
              </button>
            }

            <div class="flex gap-2">
              <select
                [class]="selectClass"
                [ngModel]="probeOp()"
                name="probeOp"
                (ngModelChange)="probeOp.set($event)"
                aria-label="Comparison"
                data-testid="probe-op"
              >
                @for (op of probeOps; track op) {
                  <option [value]="op">{{ op }}</option>
                }
              </select>
              @if (probeOp() !== 'exists') {
                @switch (answerType()) {
                  @case ('boolean') {
                    <select
                      [class]="selectClass"
                      aria-label="Expected value"
                      [ngModel]="probeExpected()"
                      name="probeExpected"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="probeExpected.set($event)"
                      data-testid="probe-expected"
                    >
                      <option value="">Pick one…</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  }
                  @case ('number') {
                    <input
                      type="number"
                      [class]="fieldClass"
                      placeholder="expected number"
                      aria-label="Expected value"
                      [ngModel]="probeExpected()"
                      name="probeExpected"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="probeExpected.set($event)"
                      data-testid="probe-expected"
                    />
                  }
                  @default {
                    <input
                      [class]="fieldClass"
                      placeholder="expected value"
                      aria-label="Expected value"
                      [ngModel]="probeExpected()"
                      name="probeExpected"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="probeExpected.set($event)"
                      data-testid="probe-expected"
                    />
                  }
                }
              }
            </div>
            <p class="m-0 text-[11px] text-muted-foreground" data-testid="premise-hint">
              {{ premiseHint }}
            </p>
          </div>
        }
      </fieldset>

      <!-- ── Who will read it ──────────────────────────────────── -->
      <div
        class="flex items-start gap-3 rounded-lg border px-4 py-3"
        [class]="reachEmphasis()"
        role="note"
        data-testid="reach"
      >
        <ng-icon name="lucideUsers" class="mt-0.5 h-4 w-4 shrink-0" />
        <div class="space-y-1">
          <p class="m-0 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            This note will be read by
          </p>
          @if (reachLoading()) {
            <p class="m-0 text-sm text-muted-foreground" data-testid="reach-loading">
              <ng-icon name="lucideLoader" class="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
              Working out who that is…
            </p>
          } @else {
            @if (reach(); as line) {
              <p class="m-0 text-sm text-foreground" data-testid="reach-sentence">
                {{ line.sentence }}
              </p>
              @if (line.reachesGuests) {
                <p class="m-0 text-[12px] text-muted-foreground" data-testid="reach-guests">
                  Visitors trying this installation are among them.
                </p>
              }
            } @else if (reachError()) {
              <p class="m-0 text-sm text-muted-foreground" data-testid="reach-error">
                {{ reachError() }}
              </p>
            } @else {
              <p class="m-0 text-sm text-muted-foreground" data-testid="reach-pending">
                Finish naming the level and this says who ends up reading it.
              </p>
            }
          }
          <p class="m-0 text-[11px] text-muted-foreground">
            This is what happens, not what is permitted. A note advises; it
            never stops anyone doing anything.
          </p>
        </div>
      </div>

      @if (error(); as message) {
        <p class="m-0 flex items-start gap-2 text-sm text-destructive" data-testid="form-error">
          <ng-icon name="lucideCircleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ message }}</span>
        </p>
      }

      @if (stillNeeded(); as missing) {
        <p class="m-0 text-[12px] text-muted-foreground" data-testid="still-needed">
          {{ missing }}
        </p>
      }

      <div class="flex items-center gap-3">
        <button hlmBtn type="submit" [disabled]="busy() || !ready()" data-testid="save">
          @if (busy()) {
            <ng-icon name="lucideLoader" class="mr-1.5 h-4 w-4 animate-spin" />
          }
          Write the note
        </button>
        <button hlmBtn type="button" variant="ghost" (click)="cancel.emit()" data-testid="cancel">
          Cancel
        </button>
      </div>
    </form>
  `,
})
export class ContextNoteFormComponent {
  private readonly api = inject(OperatingContextService);

  readonly clusters = input<ClusterOption[]>([]);
  readonly probes = input<ContextProbeOption[]>([]);
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<WriteContextEntry>();
  readonly cancel = output<void>();

  protected readonly natures = ENTRY_NATURES;
  protected readonly aboutAxes = ABOUT_AXES;
  protected readonly whereAxes = WHERE_AXES;
  protected readonly aboutLabel = ABOUT_LABEL;
  protected readonly whereLabel = WHERE_LABEL;
  protected readonly probeOps = PROBE_OPS;
  protected readonly topicHint = TOPIC_HINT;
  protected readonly premiseHint = PREMISE_HINT;
  protected readonly fieldClass = FIELD;
  protected readonly selectClass = SELECT;

  protected readonly nature = signal<EntryNature>('practice');
  protected readonly about = signal<AboutAxis>('everything');
  protected readonly where = signal<WhereAxis>('anywhere');
  protected readonly slugs = signal('');
  protected readonly project = signal('');
  protected readonly kind = signal('');
  protected readonly tags = signal('');
  protected readonly clusterId = signal('');
  protected readonly provider = signal('');
  protected readonly topic = signal('');
  protected readonly title = signal('');
  protected readonly noteBody = signal('');
  protected readonly checkKind = signal<CheckKind>('none');
  protected readonly probeId = signal('');
  protected readonly probeOp = signal<ProbeOp>('equals');
  protected readonly probeExpected = signal('');
  protected readonly validForDays = signal(90);
  protected readonly paramRows = signal<Array<{ name: string; value: string }>>(
    [{ name: '', value: '' }],
  );

  protected readonly paramAnswers = signal<Record<string, string>>({});

  protected readonly level = computed<LevelDraft>(() => ({
    ...EMPTY_LEVEL,
    about: this.about(),
    where: this.where(),
    slugs: split(this.slugs()),
    project: this.project().trim(),
    kind: this.kind().trim(),
    tags: split(this.tags()),
    clusterId: this.clusterId(),
    provider: this.provider().trim(),
  }));

  protected readonly prospective = computed(() =>
    prospectiveScope(this.level()),
  );

  private readonly reachKey = computed(() => {
    const scope = this.prospective();
    if (!scope) return '';
    return `${scope.scopeType}|${scope.scopeRef ?? ''}|${this.nature()}`;
  });

  private readonly reachState = toSignal(
    toObservable(this.reachKey).pipe(
      switchMap((key) => {
        if (!key) return of(IDLE_REACH);
        const [scopeType, scopeRef, nature] = key.split('|');
        return this.api
          .reach(
            scopeType as EntryReach['scopeType'],
            nature as EntryNature,
            scopeRef || undefined,
          )
          .pipe(
            map((line) => ({ line, loading: false, error: null }) as ReachState),
            catchError(() => of(FAILED_REACH)),
            startWith({ line: null, loading: true, error: null } as ReachState),
          );
      }),
    ),
    { initialValue: IDLE_REACH },
  );

  protected readonly reach = computed(() => this.reachState().line);
  protected readonly reachLoading = computed(() => this.reachState().loading);
  protected readonly reachError = computed(() => this.reachState().error);

  protected readonly probeUsable = computed(() => {
    const scope = this.prospective();
    return !scope || probeAllowedAt(scope.scopeType);
  });

  protected readonly chosenProbe = computed(() =>
    this.probes().find((p) => p.id === this.probeId()),
  );

  protected readonly probeDescription = computed(
    () => this.chosenProbe()?.describes ?? '',
  );

  protected readonly declaredParams = computed(() => this.chosenProbe()?.takes);

  protected readonly probeParams = computed(() => {
    const declared = this.declaredParams();
    return declared
      ? declaredParamsOf(this.paramAnswers(), declared)
      : probeParamsOf(this.paramRows());
  });

  protected readonly answerType = computed(() =>
    answerTypeOf(this.chosenProbe(), this.probeParams()),
  );

  protected readonly draft = computed(() =>
    writeBodyOf({
      level: this.level(),
      nature: this.nature(),
      topic: this.topic(),
      title: this.title(),
      body: this.noteBody(),
      checkKind: this.checkKind(),
      probeId: this.probeId(),
      probeParams: this.probeParams(),
      probeOp: this.probeOp(),
      probeExpected: this.probeExpected(),
      validForDays: this.validForDays(),
    }),
  );

  protected readonly stillNeeded = computed(() =>
    whatIsStillNeeded(this.draft(), this.chosenProbe()),
  );

  protected readonly ready = computed(() => !this.stillNeeded());

  protected readonly reachEmphasis = computed(() => {
    const line = this.reach();
    return line && reachIsWiderThanOwners(line)
      ? 'border-primary/30 bg-primary/[0.07]'
      : 'border-border bg-muted/40';
  });

  protected copyFor(nature: EntryNature): { label: string; means: string } {
    return NATURE_COPY[nature];
  }

  protected paramValue(name: string): string {
    return this.paramAnswers()[name] ?? '';
  }

  protected setParam(name: string, value: string): void {
    this.paramAnswers.update((answers) => ({ ...answers, [name]: value }));
  }

  protected pickProbe(id: string): void {
    this.probeId.set(id);
    this.paramAnswers.set({});
  }

  protected setRow(index: number, field: 'name' | 'value', value: string): void {
    this.paramRows.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  protected addParam(): void {
    this.paramRows.update((rows) => [...rows, { name: '', value: '' }]);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const draft = this.draft();
    if (draft && this.ready()) this.save.emit(draft);
  }

}

function split(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
