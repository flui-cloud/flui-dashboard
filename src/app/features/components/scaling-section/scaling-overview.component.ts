import { Component, OnDestroy, computed, effect, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { ClusterScalingRow } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { OverviewClusterTableComponent } from './overview-cluster-table.component';
import { OverviewSituationComponent } from './overview-situation.component';
import { loadedOf } from './section-reading';
import { SectionFailureComponent, SectionSkeletonComponent } from './section-states.component';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  ScalingSurfaceInput,
  ScalingSurfaceRevision,
  buildScalingSurface,
  presentedContent,
} from './scaling-surface';

@Component({
  selector: 'app-scaling-overview',
  imports: [
    ExplainComponent,
    FlPageHeader,
    FlPanel,
    FlButton,
    FlIcon,
    OverviewSituationComponent,
    OverviewClusterTableComponent,
    SectionFailureComponent,
    SectionSkeletonComponent,
  ],
  providers: [provideIcons({ lucideRefreshCw })],
  template: `
    <div class="fl-page" data-testid="scaling-overview">
      <fl-page-header title="Scaling">
        <span headerMeta
          >Every cluster in the installation, whether or not it can scale itself</span
        >
        <button
          headerActions
          flButton
          type="button"
          [iconOnly]="true"
          aria-label="Refresh"
          title="Refresh"
          [disabled]="rowsRes.isLoading()"
          (click)="rowsRes.reload()"
        >
          <fl-icon name="lucideRefreshCw" />
        </button>
      </fl-page-header>

      @if (loading()) {
        <fl-panel>
          <app-section-skeleton
            variant="cards"
            [count]="2"
            label="the situation across every cluster"
            testid="situation"
          />
        </fl-panel>
        <fl-panel title="Clusters" [flush]="true">
          <app-section-skeleton
            variant="table"
            [count]="5"
            label="every cluster"
            testid="clusters"
          />
        </fl-panel>
      } @else if (failed()) {
        <app-section-failure
          [message]="failed() ?? ''"
          testid="overview"
          (retry)="rowsRes.reload()"
        />
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

      <section class="flex flex-wrap gap-x-6 gap-y-2" data-testid="legend" aria-label="Legend">
        <app-explain
          [floating]="true"
          label="Nodes reads floor · target · ceiling"
          labelClass="text-fl-body-sm text-fl-ink-muted"
          testid="bounds-why"
        >
          The floor is held now. The target is only approached. The ceiling is as far as it may go.
        </app-explain>

        <app-explain
          [floating]="true"
          label="An open alarm is a node waiting to be added by hand"
          labelClass="text-fl-body-sm text-fl-ink-muted"
          testid="alarm-why"
        >
          It clears when the group decides something else, never because time passed. What it asks
          for is on the cluster's own screen.
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
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }
}
