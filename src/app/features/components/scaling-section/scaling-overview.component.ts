import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { ClusterScalingRow } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { OverviewClusterTableComponent } from './overview-cluster-table.component';
import { OverviewSituationComponent } from './overview-situation.component';
import { loadedOf } from './section-reading';
import {
  SectionFailureComponent,
  SectionSkeletonComponent,
} from './section-states.component';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  ScalingSurfaceInput,
  ScalingSurfaceRevision,
  buildScalingSurface,
  presentedContent,
} from './scaling-surface';

@Component({
  selector: 'app-scaling-overview',
  standalone: true,
  imports: [
    ExplainComponent,
    OverviewSituationComponent,
    OverviewClusterTableComponent,
    SectionFailureComponent,
    SectionSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-7xl space-y-4 p-6" data-testid="scaling-overview">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <h1 class="m-0 text-2xl font-semibold tracking-tight text-foreground">Scaling</h1>
          <p class="m-0 max-w-prose text-sm text-muted-foreground">
            Every cluster in the installation, whether or not it can scale itself. Nothing
            is filtered out.
          </p>
        </div>

      </header>

      @if (loading()) {
        <app-section-skeleton
          variant="cards"
          [count]="3"
          label="the situation across every cluster"
          testid="situation"
        />
        <app-section-skeleton
          variant="table"
          [count]="5"
          label="every cluster"
          testid="clusters"
        />
      } @else if (failed()) {
        <app-section-failure [message]="failed() ?? ''" testid="overview" (retry)="rowsRes.reload()" />
      } @else if (absent()) {
        <app-section-failure
          message="This installation's API does not serve scaling groups: it is running a build without them."
          testid="unserved"
          (retry)="rowsRes.reload()"
        />
      } @else {
        <app-overview-situation [rows]="rows()" />
        <app-overview-cluster-table [rows]="rows()" />
      }

      <section class="flex flex-wrap gap-x-6 gap-y-2" data-testid="legend">
        <app-explain
          label="Nodes reads floor · target · ceiling"
          labelClass="text-[13px] font-medium text-foreground"
          testid="bounds-why"
        >
          Three roles, not three numbers. The floor is held now — below it the
          installation is broken. The target is where the fleet would like to
          sit, approached only when the market allows, and nothing waits on it.
          The ceiling is what urgency may reach right now; on a cluster Flui
          cannot buy for, a person can still walk past it by attaching a machine
          by hand, and then this page says that they have.
        </app-explain>

        <app-explain
          label="An open alarm is a purchase in flight, by hand"
          labelClass="text-[13px] font-medium text-foreground"
          testid="alarm-why"
        >
          Where Flui cannot buy, the ladder still runs and still decides what to
          ask for — only the last step changes, from a purchase into a sentence
          addressed to a person. It is the group's latest decision rather than an
          item in a queue: it goes when the group decides something else, which
          includes the pass after somebody attaches a machine by hand. Nothing
          clears it because time passed, so its age is worth as much as its
          existence. What each one is asking for is on the cluster's own screen.
        </app-explain>
      </section>
    </div>
  `,
})
export class ScalingOverviewComponent implements OnDestroy {
  private readonly api = inject(ScalingApiService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly rowsRes = rxResource({
    stream: () => this.api.rows(),
  });

  private readonly loaded = loadedOf<ClusterScalingRow[]>(
    this.rowsRes,
    'The clusters of this installation',
  );

  protected readonly loading = computed(() => this.loaded().loading);
  protected readonly failed = computed(() => this.loaded().failed);

  protected readonly absent = computed(() => this.loaded().absent);

  protected readonly rows = computed(() => this.loaded().data ?? []);

  private readonly surfaceRevision = new ScalingSurfaceRevision();

  readonly surface = computed(() => {
    const input: ScalingSurfaceInput = {
      rows: this.rows(),
      loading: this.loading(),
      absent: this.absent(),
      failed: this.failed() !== null,
    };
    const content = presentedContent(input);
    return buildScalingSurface(input, {
      revision: this.surfaceRevision.next(content),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    // Publish this page's own Semantic Surface snapshot into the shared registry
    // whenever it changes. ngOnDestroy clears it, so the snapshot never outlives this
    // page — same discipline as every other producer in this repo.
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }
}
