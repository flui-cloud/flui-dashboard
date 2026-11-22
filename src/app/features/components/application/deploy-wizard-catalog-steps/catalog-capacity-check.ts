import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ResourceAvailabilityResponseDto } from '../../../../core/api/model/resourceAvailabilityResponseDto';
import { ResourceAmountStringDto } from '../../../../core/api/model/resourceAmountStringDto';
import { parseCpuToMillicores, parseMemoryToMi } from '../../../model/k8s-quantities';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlUsageBar } from '../../../../ui/patterns/usage-bar';
import { FlButton } from '../../../../ui/primitives/button';
import { FlStatus } from '../../../../ui/primitives/status';

interface UsageRow {
  label: string;
  percent: number;
  aside: string;
}

function ratio(used: number, total: number): number | null {
  return total > 0 ? (used / total) * 100 : null;
}

@Component({
  selector: 'app-catalog-capacity-check',
  imports: [RouterLink, FlAlert, FlKeyValue, FlKvItem, FlUsageBar, FlButton, FlStatus],
  host: { class: 'flex flex-col gap-4' },
  template: `
    @let av = availability();
    @if (av.canDeploy && !av.reason) {
      <fl-status tone="success" label="Fits on this cluster" />
    } @else if (av.reason === 'autoscaling_pending') {
      <fl-alert tone="info" [title]="pendingTitle()">
        {{ av.reasonMessage }} The app waits for room until the new node joins.
        @if (av.placement?.groupId; as groupId) {
          <a alertActions class="fl-link" [routerLink]="['/scaling', groupId]">Open scaling</a>
        }
      </fl-alert>
    } @else {
      <fl-alert tone="error" [title]="blockedTitle()">
        @if (av.reasonMessage) {
          <span class="block">{{ av.reasonMessage }}</span>
        }
        @if (whyOpen() && av.placement?.why) {
          <span class="mt-1 block">{{ av.placement?.why }}</span>
        }
        <span class="mt-1 block">
          @if (overridesSupported()) {
            Shrink the override below, pick another cluster, or select Install anyway.
          } @else {
            Pick a cluster with more room, free some up, or select Install anyway.
          }
        </span>
        @if (av.reasonMessage && av.placement?.why) {
          <button
            alertActions
            flButton="ghost"
            size="sm"
            type="button"
            [attr.aria-expanded]="whyOpen()"
            (click)="whyOpen.set(!whyOpen())"
          >
            {{ whyOpen() ? 'Hide' : 'Why' }}
          </button>
        }
        @if (av.placement?.groupId; as groupId) {
          <a alertActions class="fl-link" [routerLink]="['/scaling', groupId]">Open scaling</a>
        }
      </fl-alert>
    }

    <fl-key-value class="fl-kv--compact">
      <fl-kv-item key="Required" [mono]="true">{{ amount(av.required) }}</fl-kv-item>
      <fl-kv-item key="Available after 10% reserve" [mono]="true">{{
        amount(av.available)
      }}</fl-kv-item>
      @if (!av.canDeploy) {
        <fl-kv-item key="In use" [mono]="true">{{ amount(av.used) }}</fl-kv-item>
        <fl-kv-item key="Cluster total" [mono]="true">{{ amount(av.total) }}</fl-kv-item>
      }
    </fl-key-value>

    @if (usage().length > 0) {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        @for (u of usage(); track u.label) {
          <fl-usage-bar [percent]="u.percent" [label]="u.label" [aside]="u.aside" />
        }
      </div>
    }
  `,
})
export class CatalogCapacityCheck {
  readonly availability = input.required<ResourceAvailabilityResponseDto>();
  readonly overridesSupported = input(false);

  protected readonly whyOpen = signal(false);

  protected readonly pendingTitle = computed(() => {
    const placement = this.availability().placement;
    return placement?.verdict === 'buys'
      ? `Flui adds a ${placement.shape} in ${placement.region} to fit this`
      : 'A node is added to fit this';
  });

  protected readonly blockedTitle = computed(() => {
    const placement = this.availability().placement;
    switch (placement?.verdict) {
      case 'nothing-hosts':
        return 'No machine can take this yet, so it would wait for room';
      case 'proposes':
        return `The scaling group is manual, so it would only propose a ${placement.shape}`;
      default:
        return 'Not enough cluster capacity';
    }
  });

  protected readonly usage = computed<UsageRow[]>(() => {
    const { used, total } = this.availability();
    const rows: UsageRow[] = [];
    const cpu = ratio(parseCpuToMillicores(used.cpu), parseCpuToMillicores(total.cpu));
    if (cpu !== null) {
      rows.push({
        label: 'Cluster CPU in use',
        percent: cpu,
        aside: `${used.cpu} of ${total.cpu}`,
      });
    }
    const memory = ratio(parseMemoryToMi(used.memory), parseMemoryToMi(total.memory));
    if (memory !== null) {
      rows.push({
        label: 'Cluster memory in use',
        percent: memory,
        aside: `${used.memory} of ${total.memory}`,
      });
    }
    return rows;
  });

  protected amount(value: ResourceAmountStringDto): string {
    return `${value.cpu} CPU · ${value.memory}`;
  }
}
