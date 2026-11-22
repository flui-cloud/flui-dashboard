import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OWN_BUCKET_PROVIDERS, registryProviderLabel } from '../../model/registry-storage.models';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { OwnBucketForm } from './registry-storage-view';

@Component({
  selector: 'app-registry-own-bucket-form',
  imports: [FormsModule, FlField, FlButton, FlSpinner],
  host: { class: 'block' },
  template: `
    <form
      #ownBucket="ngForm"
      class="flex flex-col gap-4"
      data-testid="registry-own-form"
      (ngSubmit)="submitted.emit()"
    >
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <fl-field label="Provider" for="registry-own-provider">
          <span class="fl-select-wrap">
            <select
              id="registry-own-provider"
              class="fl-select"
              name="provider"
              required
              [(ngModel)]="value().provider"
              [disabled]="busy()"
            >
              @for (p of providers; track p) {
                <option [value]="p">{{ providerLabel(p) }}</option>
              }
            </select>
          </span>
        </fl-field>
        <fl-field label="Region" for="registry-own-region">
          <div class="fl-input fl-input--lg">
            <input
              id="registry-own-region"
              name="region"
              required
              maxlength="64"
              placeholder="e.g. gra"
              [(ngModel)]="value().region"
              [disabled]="busy()"
            />
          </div>
        </fl-field>
      </div>
      <fl-field label="Endpoint" for="registry-own-endpoint">
        <div class="fl-input fl-input--lg">
          <input
            id="registry-own-endpoint"
            name="endpoint"
            type="url"
            required
            placeholder="https://s3.example.com"
            [(ngModel)]="value().endpoint"
            [disabled]="busy()"
          />
        </div>
      </fl-field>
      <fl-field label="Bucket" for="registry-own-bucket">
        <div class="fl-input fl-input--lg fl-mono">
          <input
            id="registry-own-bucket"
            name="bucket"
            required
            pattern="[a-z0-9][a-z0-9.&#92;-]{1,61}[a-z0-9]"
            [(ngModel)]="value().bucket"
            [disabled]="busy()"
          />
        </div>
      </fl-field>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <fl-field label="Access key" for="registry-own-access-key">
          <div class="fl-input fl-input--lg fl-mono">
            <input
              id="registry-own-access-key"
              name="accessKey"
              required
              autocomplete="off"
              [(ngModel)]="value().accessKey"
              [disabled]="busy()"
            />
          </div>
        </fl-field>
        <fl-field
          label="Secret key"
          for="registry-own-secret-key"
          hint="Use a key that reaches this bucket only, not an account key."
        >
          <div class="fl-input fl-input--lg fl-mono">
            <input
              id="registry-own-secret-key"
              name="secretKey"
              type="password"
              required
              autocomplete="new-password"
              data-testid="registry-secret"
              [(ngModel)]="value().secretKey"
              [disabled]="busy()"
            />
          </div>
        </fl-field>
      </div>

      <button
        flButton="ghost"
        size="sm"
        type="button"
        class="self-start"
        [attr.aria-expanded]="advancedOpen()"
        (click)="advancedToggle.emit()"
      >
        {{ advancedOpen() ? 'Hide advanced' : 'Advanced' }}
      </button>
      @if (advancedOpen()) {
        <div class="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
          <fl-field label="Folder in the bucket" for="registry-own-prefix">
            <div class="fl-input fl-input--lg">
              <input
                id="registry-own-prefix"
                name="prefix"
                pattern="[A-Za-z0-9._/&#92;-]{1,200}"
                placeholder="Default"
                [(ngModel)]="value().prefix"
                [disabled]="busy()"
              />
            </div>
          </fl-field>
          <label class="fl-check pb-2">
            <input
              name="forcePathStyle"
              type="checkbox"
              [(ngModel)]="value().forcePathStyle"
              [disabled]="busy()"
            />
            Path-style addresses
          </label>
        </div>
      }

      <div class="flex justify-end gap-2">
        @if (cancellable()) {
          <button flButton="ghost" type="button" [disabled]="busy()" (click)="cancelled.emit()">
            Keep the current bucket
          </button>
        }
        <button
          flButton="primary"
          type="submit"
          data-testid="registry-own-submit"
          [disabled]="busy() || ownBucket.invalid"
        >
          @if (connecting()) {
            <fl-spinner label="Connecting" />
          }
          Connect bucket
        </button>
      </div>
    </form>
  `,
})
export class RegistryOwnBucketForm {
  readonly value = input.required<OwnBucketForm>();
  readonly busy = input(false);
  readonly connecting = input(false);
  readonly advancedOpen = input(false);
  readonly cancellable = input(false);
  readonly submitted = output<void>();
  readonly advancedToggle = output<void>();
  readonly cancelled = output<void>();

  protected readonly providers = OWN_BUCKET_PROVIDERS;

  protected providerLabel(provider: string): string {
    return registryProviderLabel(provider);
  }
}
