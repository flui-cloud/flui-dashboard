import { Component, computed, input, output } from '@angular/core';
import { ResourceAmountStringDto } from '../../../core/api/model/resourceAmountStringDto';
import { ResourceAvailabilityResponseDto } from '../../../core/api/model/resourceAvailabilityResponseDto';
import { parseCpuToMillicores, parseMemoryToMi } from '../../model/k8s-quantities';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';

interface UsageRow {
  readonly label: string;
  readonly percent: number;
  readonly aside: string;
}

function ratio(used: number, total: number): number | null {
  return total > 0 ? (used / total) * 100 : null;
}

@Component({
  selector: 'app-deploy-capacity',
  imports: [FlAlert, FlKeyValue, FlKvItem, FlUsageBar, FlButton, FlStatus],
  host: { class: 'flex flex-col gap-4' },
  template: `
    @let av = availability();
    @if (!av.canDeploy) {
      <fl-alert
        tone="error"
        [title]="review() ? 'Deploy blocked: not enough resources' : 'Not enough resources'"
      >
        {{ message() }}
        <button
          alertActions
          flButton="ghost"
          size="sm"
          type="button"
          (click)="smallerProfile.emit()"
        >
          Choose a smaller profile
        </button>
      </fl-alert>
    } @else if (av.reason) {
      <fl-alert tone="warning" [title]="review() ? 'Resource notice' : 'Resources are tight'">
        {{ message() }}
      </fl-alert>
    } @else {
      <fl-status tone="success" label="Enough resources on this cluster" />
    }

    <fl-key-value class="fl-kv--compact">
      <fl-kv-item key="Required" [mono]="true">{{ amount(av.required) }}</fl-kv-item>
      <fl-kv-item key="Available after 10% reserve" [mono]="true">{{
        amount(av.available)
      }}</fl-kv-item>
      @if (!av.reason || !av.canDeploy) {
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

    @if (av.canDeploy && !av.reason) {
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        Flui keeps 10% of cluster capacity in reserve.
      </p>
    }
  `,
})
export class DeployCapacity {
  readonly availability = input.required<ResourceAvailabilityResponseDto>();
  readonly message = input('');
  readonly review = input(false);
  readonly smallerProfile = output<void>();

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
    return `${value.cpu} CPU · ${value.memory} RAM`;
  }
}
