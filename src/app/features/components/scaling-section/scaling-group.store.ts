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
    request: () => this.id() ?? undefined,
    loader: ({ request }) => this.api.group(request),
  });

  readonly group = loadedOf<SectionGroup>(this.groupRes, 'This scaling group');

  private readonly clusterId = computed(() => this.group().data?.clusterId);

  private readonly rowRes = rxResource({
    request: () => this.clusterId(),
    loader: ({ request }) => this.api.row(request),
  });

  readonly row = loadedOf<ClusterScalingRow>(this.rowRes, "The cluster's row");

  private readonly previewRes = rxResource({
    request: () => this.id() ?? undefined,
    loader: ({ request }) => this.api.preview(request),
  });

  readonly preview = loadedOf<ScalingPreview>(
    this.previewRes,
    'What this group would do now',
  );

  private readonly decisionsRes = rxResource({
    request: () => this.id() ?? undefined,
    loader: ({ request }) => this.api.decisions(request),
  });

  readonly decisions = loadedOf<ScalingDecision[]>(
    this.decisionsRes,
    'The decision log',
  );

  private readonly catalogueRes = rxResource({
    request: () => this.group().data?.id,
    loader: ({ request }) => {
      const group = this.group().data;
      return group?.capability.hasCatalogue
        ? this.api.outlook(request)
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
    request: () => this.clusterId(),
    loader: ({ request }) => this.api.history(request),
  });

  readonly history = loadedOf<FleetHistory>(this.historyRes, 'The fleet history');

  private readonly fleetRes = rxResource({
    request: () => this.clusterId(),
    loader: ({ request }) => this.api.fleet(request),
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
