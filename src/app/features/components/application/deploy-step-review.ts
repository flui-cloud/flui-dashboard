import { Component, input, output } from '@angular/core';
import { ManifestCheckDto } from '../../../core/api/model/manifestCheckDto';
import { ResourceAvailabilityResponseDto } from '../../../core/api/model/resourceAvailabilityResponseDto';
import { ClusterInfo } from '../../model/cluster.models';
import { FlowSubtype } from '../../service/deploy-wizard-state.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { DeployCapacity } from './deploy-capacity';
import { DeployReviewGroup } from './deploy-review-group';

const CHECK_TONE: Record<ManifestCheckDto.StatusEnum, StatusTone> = {
  pass: 'success',
  warn: 'warning',
  fail: 'error',
  unknown: 'neutral',
};

@Component({
  selector: 'app-deploy-step-review',
  imports: [FlAlert, FlKeyValue, FlKvItem, FlButton, FlStatus, DeployCapacity, DeployReviewGroup],
  host: { class: 'fl-stack' },
  template: `
    @if (blockedReason(); as reason) {
      <fl-alert tone="error" title="Install blocked">
        {{ reason }}
        <button alertActions flButton="ghost" size="sm" type="button" (click)="configureDns.emit()">
          Configure DNS
        </button>
      </fl-alert>
    }
    @if (authzNotReady()) {
      <fl-alert tone="warning" title="Auth Proxy is not installed">
        <span class="block">
          This is a private app. Without Auth Proxy, access control falls back to a less reliable
          external mechanism. Install it on this cluster for faster, sturdier protection.
        </span>
        @if (authzError()) {
          <span class="mt-1 block">{{ authzError() }}</span>
        }
        <ng-container alertActions>
          @if (authzInstalling()) {
            <fl-status tone="progress" label="Installing" />
          } @else {
            <button flButton size="sm" type="button" (click)="installAuthProxy.emit()">
              Install now
            </button>
          }
          <button flButton="ghost" size="sm" type="button" (click)="authProxySettings.emit()">
            Auth Proxy settings
          </button>
        </ng-container>
      </fl-alert>
    }
    @if (error(); as err) {
      <fl-alert tone="error" title="Could not deploy">{{ err }}</fl-alert>
    }

    <ng-content select="[reviewSource]" />

    @if (flow() === 'existing-repo') {
      <app-deploy-review-group title="Installation checks">
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          What only this installation can say about the manifest: target cluster, connected
          repository, build credentials and live capacity. Unknown means Flui could not answer here,
          not that the manifest is wrong.
        </p>
        @if (checksLoading()) {
          <fl-status tone="progress" label="Running checks" />
        } @else if (checksError()) {
          <fl-alert tone="warning" title="Could not run the checks">{{ checksError() }}</fl-alert>
        } @else if (checks(); as list) {
          @if (list.length === 0) {
            <p class="m-0 text-fl-body-sm text-fl-ink-muted">No checks reported.</p>
          } @else {
            <ul class="m-0 flex list-none flex-col gap-3 p-0">
              @for (check of list; track check.id) {
                <li class="flex flex-col gap-1">
                  <fl-status [tone]="checkTone(check.status)" [label]="check.title" />
                  <span class="text-fl-body-sm text-fl-ink-muted">
                    {{ check.detail }}
                    @if (check.status === 'unknown') {
                      Not answered here, not a failure.
                    }
                  </span>
                </li>
              }
            </ul>
          }
        }
      </app-deploy-review-group>
    }

    <ng-content />

    @if (flow() === 'marketplace') {
      <app-deploy-review-group
        title="App inputs"
        [step]="inputsStep()"
        [editable]="editable()"
        (edit)="edit.emit($event)"
      >
        <fl-key-value class="fl-kv--compact">
          <fl-kv-item key="User inputs">{{ catalogInputs() }} provided</fl-kv-item>
          <fl-kv-item key="Environment overrides">{{ catalogOverrides() }}</fl-kv-item>
          @if (catalogSecrets() > 0) {
            <fl-kv-item key="Secret values">{{ catalogSecrets() }}</fl-kv-item>
          }
        </fl-key-value>
      </app-deploy-review-group>
    } @else {
      <app-deploy-review-group
        title="Environment"
        step="environment"
        [editable]="editable()"
        (edit)="edit.emit($event)"
      >
        <fl-key-value class="fl-kv--compact">
          <fl-kv-item key="Variables">{{ envCount() }} configured</fl-kv-item>
          @if (envCount() > 0) {
            <fl-kv-item key="Secrets">{{ secretCount() }}</fl-kv-item>
          }
        </fl-key-value>
      </app-deploy-review-group>
    }

    <app-deploy-review-group
      title="Target cluster"
      step="cluster"
      [editable]="editable()"
      (edit)="edit.emit($event)"
    >
      <fl-key-value class="fl-kv--compact">
        <fl-kv-item key="Cluster">{{ cluster()?.name }}</fl-kv-item>
        <fl-kv-item key="Region" [mono]="true">{{ cluster()?.region }}</fl-kv-item>
        <fl-kv-item key="Nodes">{{ cluster()?.nodeCount }}</fl-kv-item>
      </fl-key-value>
      @if (checking()) {
        <fl-status tone="progress" label="Checking cluster resource availability" />
      } @else if (availability(); as av) {
        <app-deploy-capacity
          [availability]="av"
          [message]="availabilityMessage()"
          [review]="true"
          (smallerProfile)="smallerProfile.emit()"
        />
      }
    </app-deploy-review-group>

    <app-deploy-review-group title="Deployment">
      <fl-key-value class="fl-kv--compact">
        <fl-kv-item key="Application name" [mono]="true">{{ appName() }}</fl-kv-item>
        <fl-kv-item key="Estimated time">
          @if (roomWait()) {
            <fl-status tone="warning" label="Starts when a node with room joins" />
          } @else {
            2 to 5 minutes
          }
        </fl-kv-item>
      </fl-key-value>
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        The deployment starts right away and you can follow it live.
      </p>
    </app-deploy-review-group>
  `,
})
export class DeployStepReview {
  readonly blockedReason = input<string | null>(null);
  readonly authzNotReady = input(false);
  readonly authzInstalling = input(false);
  readonly authzError = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly flow = input<FlowSubtype>(null);
  readonly checksLoading = input(false);
  readonly checksError = input<string | null>(null);
  readonly checks = input<readonly ManifestCheckDto[] | null>(null);
  readonly envCount = input(0);
  readonly secretCount = input(0);
  readonly catalogInputs = input(0);
  readonly catalogOverrides = input(0);
  readonly catalogSecrets = input(0);
  readonly inputsStep = input<string | null>(null);
  readonly cluster = input<ClusterInfo | null>(null);
  readonly checking = input(false);
  readonly availability = input<ResourceAvailabilityResponseDto | null>(null);
  readonly availabilityMessage = input('');
  readonly appName = input('');
  readonly roomWait = input(false);
  readonly editable = input<readonly string[]>([]);
  readonly edit = output<string>();
  readonly configureDns = output<void>();
  readonly installAuthProxy = output<void>();
  readonly authProxySettings = output<void>();
  readonly smallerProfile = output<void>();

  protected checkTone(status: ManifestCheckDto.StatusEnum): StatusTone {
    return CHECK_TONE[status] ?? 'neutral';
  }
}
