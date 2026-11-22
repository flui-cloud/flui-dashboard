import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  RegistryStorageStatus,
  SCALEWAY_REGION_LABELS,
  SCALEWAY_REGISTRY_REGIONS,
  ScalewayRegistryRegion,
  registryProviderLabel,
} from '../../model/registry-storage.models';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { RegistryConnectOption } from './registry-storage-surface';
import { RegistryOwnBucketForm } from './registry-own-bucket-form';
import { OwnBucketForm } from './registry-storage-view';

@Component({
  selector: 'app-registry-bucket-panel',
  imports: [
    DatePipe,
    FormsModule,
    ExplainComponent,
    FlAlert,
    FlField,
    FlKeyValue,
    FlKvItem,
    FlPanel,
    FlButton,
    FlSpinner,
    FlStatus,
    RegistryOwnBucketForm,
  ],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Bucket" data-testid="registry-bucket">
      @if (status().connected && !connectOpen()) {
        <button
          panelActions
          flButton
          size="sm"
          type="button"
          data-testid="registry-replace"
          (click)="replace.emit()"
        >
          Replace bucket
        </button>
      }
      <div class="flex flex-col gap-4">
        @if (!status().connected) {
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">
            @if (onGhcr()) {
              Connect a bucket, then use the Flui registry with it. A bucket never fills up; you pay
              for the space used.
            } @else if (status().backend === 's3') {
              The registry waits for a bucket. A bucket never fills up; you pay for the space used.
            } @else {
              This installation keeps images on a volume. A bucket connected here is used once the
              installation is set to object storage.
            }
          </p>
        } @else {
          <fl-key-value data-testid="registry-connected">
            <fl-kv-item key="Provider">{{ providerLabel(status().provider) }}</fl-kv-item>
            <fl-kv-item key="Region">{{ status().region || '—' }}</fl-kv-item>
            <fl-kv-item key="Bucket" [mono]="true">{{ status().bucket || '—' }}</fl-kv-item>
            @if (status().connectedAt) {
              <fl-kv-item key="Connected">{{
                status().connectedAt | date: 'd MMM y, HH:mm'
              }}</fl-kv-item>
            }
          </fl-key-value>
          @if (status().backend === 'filesystem' && !onGhcr()) {
            <fl-alert tone="info" title="Not in use yet" data-testid="registry-not-in-use">
              This bucket is connected but not in use yet. The registry moves to it once the
              installation is set to object storage.
            </fl-alert>
          }
        }

        @if (!status().connected || connectOpen()) {
          <div
            class="flex flex-col gap-4"
            [class.border-t]="status().connected"
            [class.border-fl-border]="status().connected"
            [class.pt-4]="status().connected"
            data-testid="registry-connect"
          >
            <fieldset class="fl-fieldset">
              <legend>{{ status().connected ? 'New bucket' : 'Connect a bucket' }}</legend>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label class="fl-radiocard">
                  <input
                    type="radio"
                    name="registry-connect-option"
                    data-testid="registry-option-scaleway"
                    [checked]="option() === 'scaleway'"
                    [disabled]="busy()"
                    (change)="optionChange.emit('scaleway')"
                  />
                  <span class="fl-radiocard__text">
                    <span class="fl-radiocard__title">Create on Scaleway</span>
                    <span class="fl-radiocard__desc">Flui creates and owns the bucket.</span>
                  </span>
                </label>
                <label class="fl-radiocard">
                  <input
                    type="radio"
                    name="registry-connect-option"
                    data-testid="registry-option-own"
                    [checked]="option() === 'own'"
                    [disabled]="busy()"
                    (change)="optionChange.emit('own')"
                  />
                  <span class="fl-radiocard__text">
                    <span class="fl-radiocard__title">Use a bucket of your own</span>
                    <span class="fl-radiocard__desc">Any S3-compatible bucket and key.</span>
                  </span>
                </label>
              </div>
            </fieldset>

            @if (option() === 'scaleway') {
              <div class="flex flex-col gap-4">
                <fl-field label="Region" for="registry-scaleway-region" class="max-w-xs">
                  <span class="fl-select-wrap">
                    <select
                      id="registry-scaleway-region"
                      class="fl-select"
                      name="scalewayRegion"
                      data-testid="registry-scaleway-region"
                      [ngModel]="scalewayRegion()"
                      (ngModelChange)="regionChange.emit($event)"
                      [disabled]="busy()"
                    >
                      @for (region of regions; track region) {
                        <option [value]="region">{{ regionLabels[region] }}</option>
                      }
                    </select>
                  </span>
                </fl-field>
                @if (connecting() === 'scaleway') {
                  <fl-status
                    tone="progress"
                    data-testid="registry-scaleway-busy"
                    label="Creating the bucket. This can take up to five minutes; keep this page open."
                  />
                }
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <app-explain
                    label="How this works"
                    labelClass="text-fl-caption text-fl-ink-muted"
                  >
                    Flui creates the bucket in a Scaleway project of its own, with a key that
                    reaches only Object Storage there, using the Scaleway connection this
                    installation already has. It can take up to five minutes.
                  </app-explain>
                  <div class="flex gap-2">
                    @if (status().connected) {
                      <button
                        flButton="ghost"
                        type="button"
                        [disabled]="busy()"
                        (click)="keep.emit()"
                      >
                        Keep the current bucket
                      </button>
                    }
                    <button
                      flButton="primary"
                      type="button"
                      data-testid="registry-scaleway-submit"
                      [disabled]="busy()"
                      (click)="request.emit('scaleway')"
                    >
                      @if (connecting() === 'scaleway') {
                        <fl-spinner label="Creating" />
                      }
                      Create bucket
                    </button>
                  </div>
                </div>
              </div>
            } @else {
              <app-registry-own-bucket-form
                [value]="own()"
                [busy]="busy()"
                [connecting]="connecting() === 'own'"
                [advancedOpen]="advancedOpen()"
                [cancellable]="status().connected"
                (submitted)="request.emit('own')"
                (advancedToggle)="advancedToggle.emit()"
                (cancelled)="keep.emit()"
              />
            }

            @if (connectError(); as message) {
              <fl-alert
                tone="error"
                title="Bucket not connected"
                data-testid="registry-connect-error"
                >{{ message }}</fl-alert
              >
            }
          </div>
        }
      </div>
    </fl-panel>
  `,
})
export class RegistryBucketPanel {
  readonly status = input.required<RegistryStorageStatus>();
  readonly onGhcr = input(false);
  readonly connectOpen = input(false);
  readonly option = input.required<RegistryConnectOption>();
  readonly scalewayRegion = input.required<ScalewayRegistryRegion>();
  readonly busy = input(false);
  readonly connecting = input<string | null>(null);
  readonly connectError = input<string | null>(null);
  readonly own = input.required<OwnBucketForm>();
  readonly advancedOpen = input(false);
  readonly replace = output<void>();
  readonly optionChange = output<RegistryConnectOption>();
  readonly regionChange = output<ScalewayRegistryRegion>();
  readonly request = output<RegistryConnectOption>();
  readonly advancedToggle = output<void>();
  readonly keep = output<void>();

  protected readonly regions = SCALEWAY_REGISTRY_REGIONS;
  protected readonly regionLabels = SCALEWAY_REGION_LABELS;

  protected providerLabel(provider: string | undefined): string {
    return registryProviderLabel(provider);
  }
}
