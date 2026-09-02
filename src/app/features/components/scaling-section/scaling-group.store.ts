import { Injectable, computed, inject, signal } from '@angular/core';
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
import { ScalingApiService } from '../../service/scaling-api.service';
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

  private readonly historyRes = rxResource({
    params: () => this.clusterId(),
    stream: ({ params }) => this.api.history(params),
  });

  readonly history = loadedOf<FleetHistory>(this.historyRes, 'The fleet history');

  private readonly fleetRes = rxResource({
    params: () => this.clusterId(),
    stream: ({ params }) => this.api.fleet(params),
  });

  readonly fleet = loadedOf<FleetReading>(this.fleetRes, 'The fleet');

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
