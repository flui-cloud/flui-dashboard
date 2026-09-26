import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import {
  AvailabilityOutlook,
  ScalingDecision,
  ScalingPreview,
} from '../../model/scaling-group.models';
import {
  ClusterScalingRow,
  FleetHistory,
  FleetReading,
  SectionGroup,
  ShapeCatalogue,
} from '../../model/scaling-section.models';
import { HistoryWindow, HistoryZoom, ScalingApiService } from '../../service/scaling-api.service';
import { loadedOf } from './section-reading';

@Injectable()
export class ScalingGroupStore {
  private readonly api = inject(ScalingApiService);

  private readonly id = signal<string | null>(null);

  setGroup(groupId: string | null): void {
    this.id.set(groupId);
  }

  readonly groupId = this.id.asReadonly();

  private readonly groupRes = rxResource({
    params: () => this.id() ?? undefined,
    stream: ({ params }) => this.api.group(params),
  });

  readonly group = loadedOf<SectionGroup>(this.groupRes, 'This scaling group');

  private readonly clusterId = computed(() => this.group().data?.clusterId);

  private readonly rowRes = rxResource({
    params: () => this.clusterId(),
    stream: ({ params }) => this.api.row(params),
  });

  readonly row = loadedOf<ClusterScalingRow>(this.rowRes, "The cluster's row");

  private readonly previewRes = rxResource({
    params: () => this.id() ?? undefined,
    stream: ({ params }) => this.api.preview(params),
  });

  readonly preview = loadedOf<ScalingPreview>(
    this.previewRes,
    'What this group would do now',
  );

  private readonly decisionsRes = rxResource({
    params: () => this.id() ?? undefined,
    stream: ({ params }) => this.api.decisions(params),
  });

  readonly decisions = loadedOf<ScalingDecision[]>(
    this.decisionsRes,
    'The decision log',
  );

  private readonly catalogueRes = rxResource({
    params: () => this.group().data?.id,
    stream: ({ params }) => {
      const group = this.group().data;
      return group?.capability.hasCatalogue
        ? this.api.outlook(params)
        : of(noMarket(group?.provider ?? 'this provider'));
    },
  });

  readonly catalogue = loadedOf<ShapeCatalogue>(
    this.catalogueRes,
    "The provider's catalogue",
  );

  readonly outlook = computed<Record<string, AvailabilityOutlook>>(() => {
    const byShape: Record<string, AvailabilityOutlook> = {};
    for (const entry of this.catalogue().data?.shapes ?? []) {
      if (entry.outlook) byShape[entry.shape] = entry.outlook;
    }
    return byShape;
  });

  /** The span the History tab reads; kept here so a reload keeps it. */
  readonly historyWindow = signal<HistoryWindow>('30d');
  /** A stretch picked on the chart; it wins over the window until it is reset. */
  readonly historyZoom = signal<HistoryZoom | null>(null);

  private readonly historyRes = rxResource({
    params: () => {
      const id = this.clusterId();
      return id ? { id, window: this.historyWindow(), zoom: this.historyZoom() } : undefined;
    },
    stream: ({ params }) => this.api.history(params.id, params.window, params.zoom),
  });

  readonly history = loadedOf<FleetHistory>(
    this.historyRes,
    'The fleet history',
  );

  private readonly fleetRes = rxResource({
    params: () => this.clusterId(),
    stream: ({ params }) => this.api.fleet(params),
  });

  readonly fleet = loadedOf<FleetReading>(this.fleetRes, 'The fleet');

  /** Seconds between live reads: fast while something is on its way, calm otherwise. */
  readonly refreshSeconds = computed(() => {
    const buying = this.group().data?.purchase?.state === 'buying';
    const waiting = (this.preview().data?.pending ?? null) !== null;
    return buying || waiting ? LIVE_FAST_SECONDS : LIVE_CALM_SECONDS;
  });

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect((onCleanup) => {
      if (!this.id()) return;
      const seconds = this.refreshSeconds();
      this.timer = setTimeout(() => this.refreshLive(), seconds * 1000);
      onCleanup(() => {
        if (this.timer) clearTimeout(this.timer);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
  }

  private refreshLive(): void {
    const visible = typeof document === 'undefined' || !document.hidden;
    if (visible) {
      this.groupRes.reload();
      this.rowRes.reload();
      this.previewRes.reload();
      this.decisionsRes.reload();
      this.fleetRes.reload();
    }
    this.timer = setTimeout(
      () => this.refreshLive(),
      untracked(() => this.refreshSeconds()) * 1000,
    );
  }

  reload(): void {
    this.groupRes.reload();
    this.rowRes.reload();
    this.previewRes.reload();
    this.decisionsRes.reload();
    this.catalogueRes.reload();
    this.historyRes.reload();
    this.fleetRes.reload();
  }
}

const LIVE_FAST_SECONDS = 5;
const LIVE_CALM_SECONDS = 30;

function noMarket(provider: string): ShapeCatalogue {
  return {
    provider,
    reading: 'no-market',
    ageSeconds: null,
    stale: false,
    says: `${provider} publishes no catalogue, so there is nothing to read — which is not the same as reading nothing.`,
    shapes: [],
  };
}
