import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBan,
  lucideBell,
  lucideCircleCheck,
  lucideCircleDashed,
  lucideEuro,
  lucideListOrdered,
  lucidePause,
  lucideSettings,
} from '@ng-icons/lucide';
import { ScalingPreview } from '../../model/scaling-group.models';
import { SectionGroup } from '../../model/scaling-section.models';
import { LadderRow, ladderRows, rowsAgree } from './ladder-rows';
import { ScalingLadderDialogComponent } from './now-ladder-dialog.component';
import { ScalingGroupStore } from './scaling-group.store';
import {
  SectionFailureComponent,
  SectionSkeletonComponent,
} from './section-states.component';

const EMPTY_PREVIEW: ScalingPreview = {
  pending: null,
  opportunityHeldBecause: null,
  ladder: [],
  chosen: null,
  asks: null,
};

/**
 * What would happen if a node were needed, in one line.
 *
 * The search behind it has five rungs and, whenever it fails, five copies of
 * the same reason; reading them is a deliberate act and belongs behind a
 * button. On the page there is only the answer.
 */
@Component({
  selector: 'app-scaling-now-ladder',
  standalone: true,
  imports: [
    NgIcon,
    RouterLink,
    ScalingLadderDialogComponent,
    SectionFailureComponent,
    SectionSkeletonComponent,
  ],
  providers: [
    provideIcons({
      lucideBan,
      lucideBell,
      lucideCircleCheck,
      lucideCircleDashed,
      lucideEuro,
      lucideListOrdered,
      lucidePause,
      lucideSettings,
    }),
  ],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-2" data-testid="ladder">
      <h2 class="text-label m-0">If a node were needed now</h2>

      @if (loading()) {
        <app-section-skeleton
          variant="cards"
          [count]="1"
          label="the urgency ladder"
          testid="ladder"
        />
      } @else if (failed(); as message) {
        <app-section-failure
          [message]="message"
          testid="ladder"
          (retry)="store.reload()"
        />
      } @else if (unsearchable()) {
        <div
          class="card-surface flex flex-wrap items-center gap-x-4 gap-y-3 p-4"
          data-testid="ladder-unsearchable"
        >
          <span
            class="inline-flex items-center gap-1.5 text-[13px] font-medium text-amber-600 dark:text-amber-400"
          >
            <ng-icon name="lucideSettings" class="h-4 w-4 shrink-0" />
            Not set up
          </span>
          <span class="min-w-0 flex-1 text-[13px] leading-relaxed text-sub">
            No machines are chosen, so there is nothing Flui may buy and nothing
            for it to name when an app has nowhere to run.
          </span>
          <a
            routerLink="../group"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="ladder-choose-machines"
          >
            Choose machines
          </a>
        </div>
      } @else if (rows().length) {
        <div
          class="card-surface flex flex-wrap items-center gap-x-4 gap-y-3 p-4"
        >
          <span
            class="inline-flex items-center gap-1.5 text-[13px] font-medium"
            [class]="headline().tone"
            data-testid="ladder-verdict"
          >
            <ng-icon [name]="headline().icon" class="h-4 w-4 shrink-0" />
            {{ headline().verdict }}
          </span>

          <span
            class="min-w-0 flex-1 text-[13px] leading-relaxed text-sub"
            data-testid="ladder-why"
          >
            {{ headline().why }}
          </span>

          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="ladder-open-steps"
            (click)="stepping.set(true)"
          >
            <ng-icon name="lucideListOrdered" class="h-3.5 w-3.5" />
            See the {{ rows().length }} steps
          </button>
        </div>
      }

      @if (stepping()) {
        <app-scaling-ladder-dialog
          [rows]="rows()"
          [subtitle]="subtitle()"
          (closed)="stepping.set(false)"
        />
      }
    </section>
  `,
})
export class ScalingNowLadderComponent {
  protected readonly store = inject(ScalingGroupStore);

  readonly group = input.required<SectionGroup>();

  protected readonly stepping = signal(false);

  protected readonly loading = computed(() => this.store.preview().loading);
  protected readonly failed = computed(() => this.store.preview().failed);

  private readonly preview = computed<ScalingPreview>(
    () => this.store.preview().data ?? EMPTY_PREVIEW,
  );

  protected readonly rows = computed<LadderRow[]>(() =>
    ladderRows({
      group: this.group(),
      preview: this.preview(),
      outlook: this.store.outlook(),
      read: this.store.catalogue().data?.reading === 'read',
    }),
  );

  /**
   * The rung that decided, or — where none did — the first one, whose reason is
   * the whole story when every rung repeats it. Where they disagree, the line
   * says so rather than promoting one failure over the others.
   */
  protected readonly headline = computed<LadderRow>(() => {
    const rows = this.rows();
    const chosen = rows.find((r) => r.chosen);
    if (chosen) return this.withOffer(chosen);

    const first = rows[0];
    if (rowsAgree(rows)) return first;

    return {
      ...first,
      why: `Nothing this group may buy fits, each for its own reason. ${rows.length} steps were tried.`,
    };
  });

  /**
   * No rung ever named a machine, so no search happened and there is no ladder
   * to read — only a setup that was never finished. Derived from the rungs
   * rather than the group's own fields, so whatever leaves the engine with no
   * candidate to weigh lands here.
   */
  protected readonly unsearchable = computed(() => {
    const deciding = this.rows().filter((r) => r.rung.outcome !== 'alert');
    return deciding.length > 0 && deciding.every((r) => !r.rung.shape);
  });

  protected readonly subtitle = computed(() => {
    const waiting = this.preview().pending;
    return waiting
      ? `Measured against ${waiting.cpu} · ${waiting.memory}.`
      : 'Nothing is waiting — this is what the next stuck app would meet.';
  });

  /** A winning rung names a machine, and the machine is the point of the line. */
  private withOffer(row: LadderRow): LadderRow {
    if (!row.offer) return row;
    return { ...row, why: `${row.offer} — ${row.why}` };
  }
}
