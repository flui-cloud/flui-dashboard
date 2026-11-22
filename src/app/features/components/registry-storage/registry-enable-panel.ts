import { Component, input, output } from '@angular/core';
import { RegistryStorageChoice } from '../../model/registry-storage.models';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-registry-enable-panel',
  imports: [ExplainComponent, FlAlert, FlPanel, FlButton, FlSpinner],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="New builds push to GitHub Container Registry" data-testid="registry-enable">
      <div class="flex flex-col gap-4">
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          Flui can keep them in its own registry instead. Running applications keep their images.
        </p>
        <fieldset class="fl-fieldset">
          <legend>Where the Flui registry keeps images</legend>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label class="fl-radiocard">
              <input
                type="radio"
                name="registry-enable-storage"
                data-testid="registry-enable-volume"
                [checked]="storage() === 'volume'"
                [disabled]="busy()"
                (change)="storageChange.emit('volume')"
              />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title">Volume</span>
                <span class="fl-radiocard__desc">One copy with a fixed size.</span>
              </span>
            </label>
            <label class="fl-radiocard">
              <input
                type="radio"
                name="registry-enable-storage"
                data-testid="registry-enable-s3"
                [checked]="storage() === 's3'"
                [disabled]="busy()"
                (change)="storageChange.emit('s3')"
              />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title">Bucket</span>
                <span class="fl-radiocard__desc">Never fills up; you pay for the space used.</span>
              </span>
            </label>
          </div>
        </fieldset>
        @if (storage() === 's3' && !bucketReady()) {
          <p
            class="m-0 text-fl-body-sm text-fl-ink-muted"
            data-testid="registry-enable-needs-bucket"
          >
            Connect a bucket below first.
          </p>
        }
        @if (error(); as message) {
          <fl-alert tone="error" title="Switch refused" data-testid="registry-switch-error">{{
            message
          }}</fl-alert>
        }
        <div class="flex flex-wrap items-center justify-between gap-3">
          <app-explain label="How this works" labelClass="text-fl-caption text-fl-ink-muted">
            The registry runs on the control cluster. On a volume it is one copy with a fixed size;
            a bucket never fills and you pay for the space used. New builds push to it, so
            connecting GitHub needs no container token. Applications already running keep their
            images until their build is set up again.
          </app-explain>
          <button
            flButton="primary"
            type="button"
            data-testid="registry-enable-submit"
            [disabled]="busy() || (storage() === 's3' && !bucketReady())"
            (click)="enable.emit()"
          >
            @if (enabling()) {
              <fl-spinner label="Switching" />
            }
            Use the Flui registry
          </button>
        </div>
      </div>
    </fl-panel>
  `,
})
export class RegistryEnablePanel {
  readonly storage = input.required<RegistryStorageChoice>();
  readonly busy = input(false);
  readonly enabling = input(false);
  readonly bucketReady = input(false);
  readonly error = input<string | null>(null);
  readonly storageChange = output<RegistryStorageChoice>();
  readonly enable = output<void>();
}
