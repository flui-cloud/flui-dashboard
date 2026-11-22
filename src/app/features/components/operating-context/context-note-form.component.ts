import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { provideIcons } from '@ng-icons/core';
import { lucideUsers } from '@ng-icons/lucide';
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
import { ExplainComponent } from '../../../shared/components/explain.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { ContextNoteCheckComponent, ParamRow } from './context-note-check';

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
    'Who this note reaches could not be read. Nothing here is stopping the note being written, but it would be written without having seen its audience.',
};

@Component({
  selector: 'app-context-note-form',
  imports: [
    FormsModule,
    ExplainComponent,
    ContextNoteCheckComponent,
    FlAlert,
    FlButton,
    FlField,
    FlIcon,
    FlLoadingState,
    FlPanel,
    FlSpinner,
  ],
  providers: [provideIcons({ lucideUsers })],
  host: { class: 'block' },
  templateUrl: './context-note-form.component.html',
})
export class ContextNoteFormComponent {
  private readonly api = inject(OperatingContextService);

  readonly clusters = input<ClusterOption[]>([]);
  readonly probes = input<ContextProbeOption[]>([]);
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<WriteContextEntry>();
  readonly dismissed = output<void>();

  protected readonly natures = ENTRY_NATURES;
  protected readonly aboutAxes = ABOUT_AXES;
  protected readonly whereAxes = WHERE_AXES;
  protected readonly aboutLabel = ABOUT_LABEL;
  protected readonly whereLabel = WHERE_LABEL;
  protected readonly topicHint = TOPIC_HINT;

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
  protected readonly paramRows = signal<ParamRow[]>([{ name: '', value: '' }]);

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

  protected readonly prospective = computed(() => prospectiveScope(this.level()));

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
          .reach(scopeType as EntryReach['scopeType'], nature as EntryNature, scopeRef || undefined)
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

  protected readonly probeDescription = computed(() => this.chosenProbe()?.describes ?? '');

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
      ? 'border-fl-accent bg-fl-accent-soft'
      : 'border-fl-border bg-fl-surface-subtle';
  });

  protected copyFor(nature: EntryNature): { label: string; means: string } {
    return NATURE_COPY[nature];
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
