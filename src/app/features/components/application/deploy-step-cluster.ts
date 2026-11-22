import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideServer } from '@ng-icons/lucide';
import { CreateApplicationDto } from '../../../core/api/model/createApplicationDto';
import { ResourceAvailabilityResponseDto } from '../../../core/api/model/resourceAvailabilityResponseDto';
import { ClusterInfo, ClusterStatus } from '../../model/cluster.models';
import { ProjectPickerComponent } from '../projects/project-picker.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { DeployCapacity } from './deploy-capacity';

type ExposureMode = CreateApplicationDto.ExposureEnum;

const STATUS_TONE: Partial<Record<ClusterStatus, StatusTone>> = {
  [ClusterStatus.ACTIVE]: 'success',
  [ClusterStatus.CREATING]: 'progress',
  [ClusterStatus.SCALING]: 'progress',
  [ClusterStatus.UPDATING]: 'progress',
  [ClusterStatus.ERROR]: 'error',
};

@Component({
  selector: 'app-deploy-step-cluster',
  imports: [
    ProjectPickerComponent,
    FlAlert,
    FlField,
    FlEmptyState,
    FlLoadingState,
    FlTable,
    FlButton,
    FlStatus,
    DeployCapacity,
  ],
  providers: [provideIcons({ lucideServer })],
  host: { class: 'fl-stack' },
  template: `
    @if (loading()) {
      <fl-loading-state [rows]="3" />
    } @else if (clusters().length === 0) {
      <fl-empty-state
        icon="lucideServer"
        title="No active clusters"
        body="Create a cluster to deploy your application."
      >
        <button flButton size="sm" type="button" (click)="createCluster.emit()">
          Create cluster
        </button>
      </fl-empty-state>
    } @else {
      <div class="fl-table-wrap rounded-fl-lg border border-fl-border">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col" class="is-fit"><span class="fl-sr">Selected</span></th>
              <th scope="col">Cluster</th>
              <th scope="col">Provider</th>
              <th scope="col">Region</th>
              <th scope="col" class="is-num">Nodes</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            @for (cluster of clusters(); track cluster.id) {
              <tr
                class="cursor-pointer"
                [class.is-selected]="selectedId() === cluster.id"
                (click)="clusterSelect.emit(cluster)"
              >
                <td class="is-fit">
                  <input
                    type="radio"
                    name="deploy-cluster"
                    [checked]="selectedId() === cluster.id"
                    [attr.aria-label]="'Deploy to ' + cluster.name"
                  />
                </td>
                <td class="font-medium">{{ cluster.name }}</td>
                <td>{{ cluster.provider }}</td>
                <td class="fl-mono">{{ cluster.region }}</td>
                <td class="is-num">{{ cluster.nodeCount || 0 }}</td>
                <td>
                  <fl-status [tone]="tone(cluster.status)" [label]="statusLabel(cluster.status)" />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <app-project-picker
        class="block max-w-sm"
        [value]="projectId()"
        (valueChange)="projectChange.emit($event)"
      />

      <ng-content />

      @if (showCapacity()) {
        @if (checking()) {
          <fl-status tone="progress" label="Checking resource availability" />
        } @else if (availability(); as av) {
          <app-deploy-capacity
            [availability]="av"
            [message]="availabilityMessage()"
            (smallerProfile)="smallerProfile.emit()"
          />
        }
      }

      @if (showExposure()) {
        <fieldset class="fl-fieldset">
          <legend>Exposure</legend>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label class="fl-radiocard">
              <input
                type="radio"
                name="exposure-mode"
                value="public"
                [checked]="exposureMode() === 'public'"
                (change)="exposureChange.emit('public')"
              />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title">Public</span>
                <span class="fl-radiocard__desc"
                  >Reachable from the internet on a custom domain, with Ingress and a TLS
                  certificate.</span
                >
              </span>
            </label>
            @if (capabilitiesLoading()) {
              <fl-status tone="progress" label="Checking cluster capabilities" />
            } @else if (canUseInternal()) {
              <label class="fl-radiocard">
                <input
                  type="radio"
                  name="exposure-mode"
                  value="internal"
                  [checked]="exposureMode() === 'internal'"
                  (change)="exposureChange.emit('internal')"
                />
                <span class="fl-radiocard__text">
                  <span class="fl-radiocard__title">Internal</span>
                  <span class="fl-radiocard__desc"
                    >A private URL on the cluster's internal domain, behind Flui sign-in.</span
                  >
                </span>
              </label>
            }
          </div>
          @if (!capabilitiesLoading() && !canUseInternal()) {
            <fl-alert tone="warning" title="Internal apps are not available on this cluster">
              Missing: {{ internalMissingLabel() }}.
              <button
                alertActions
                flButton="ghost"
                size="sm"
                type="button"
                (click)="configureDns.emit()"
              >
                Configure DNS
              </button>
            </fl-alert>
          }
        </fieldset>
      }

      @if (showOverrides()) {
        <fieldset class="fl-fieldset">
          <legend>Install overrides</legend>
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">
            Leave these empty to use <span class="fl-mono">flui.yaml</span> as it is. What you
            change here is kept for this install and wins over the manifest on later deploys.
          </p>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <fl-field label="Release name" for="deploy-override-name">
              <div class="fl-input fl-input--lg">
                <input
                  id="deploy-override-name"
                  type="text"
                  class="fl-mono"
                  [value]="overrideName()"
                  (input)="overrideNameChange.emit($any($event.target).value)"
                />
              </div>
            </fl-field>
            <fl-field
              label="Custom domain"
              for="deploy-override-fqdn"
              hint="Empty: the cluster's DNS zone assigns one. The TLS certificate follows it."
            >
              <div class="fl-input fl-input--lg">
                <input
                  id="deploy-override-fqdn"
                  type="text"
                  class="fl-mono"
                  placeholder="app.example.com"
                  [value]="overrideFqdn()"
                  (input)="overrideFqdnChange.emit($any($event.target).value)"
                />
              </div>
            </fl-field>
          </div>
          @if (nameChanged()) {
            <fl-alert tone="info" title="This installs the repository a second time">
              A different name installs it next to
              <span class="fl-mono">{{ declaredName() }}</span>.
            </fl-alert>
          }
        </fieldset>
      }
    }
  `,
})
export class DeployStepCluster {
  readonly loading = input(false);
  readonly clusters = input<readonly ClusterInfo[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly projectId = input<string | null>(null);
  readonly showCapacity = input(false);
  readonly checking = input(false);
  readonly availability = input<ResourceAvailabilityResponseDto | null>(null);
  readonly availabilityMessage = input('');
  readonly showExposure = input(false);
  readonly exposureMode = input<ExposureMode>('public');
  readonly capabilitiesLoading = input(false);
  readonly canUseInternal = input(false);
  readonly internalMissingLabel = input('');
  readonly showOverrides = input(false);
  readonly overrideName = input('');
  readonly overrideFqdn = input('');
  readonly declaredName = input('');
  readonly nameChanged = input(false);
  readonly clusterSelect = output<ClusterInfo>();
  readonly projectChange = output<string | null>();
  readonly createCluster = output<void>();
  readonly smallerProfile = output<void>();
  readonly exposureChange = output<ExposureMode>();
  readonly configureDns = output<void>();
  readonly overrideNameChange = output<string>();
  readonly overrideFqdnChange = output<string>();

  protected tone(status: ClusterStatus): StatusTone {
    return STATUS_TONE[status] ?? 'neutral';
  }

  protected statusLabel(status: ClusterStatus): string {
    const text = String(status ?? '').replaceAll('_', ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
