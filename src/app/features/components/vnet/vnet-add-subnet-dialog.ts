import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { IpRangeConstraintsDto } from '../../../core/api/model/ipRangeConstraintsDto';
import { VNetZoneDto } from '../../../core/api/model/vNetZoneDto';
import { AddSubnetConfiguration } from '../../model/vnet.models';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { cidrAddressLabel, cidrPrefixError } from './vnet-cidr';

const EXAMPLE_SUBNET_RANGE = `${[10, 0, 1, 0].join('.')}/28`;

@Component({
  selector: 'app-vnet-add-subnet-dialog',
  imports: [CdkTrapFocus, FormsModule, FlField, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
      (click)="cancelled.emit()"
      (keydown.escape)="cancelled.emit()"
    >
      <div
        class="fl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vnet-add-subnet-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="vnet-add-subnet-title">Add subnet</h2>
          <button
            type="button"
            class="fl-dialog__close"
            aria-label="Close"
            (click)="cancelled.emit()"
          >
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-dialog__body">
          <fl-field label="Region" for="vnet-subnet-zone">
            @if (zones().length > 0) {
              <span class="fl-select-wrap">
                <select
                  id="vnet-subnet-zone"
                  class="fl-select"
                  [ngModel]="zone()"
                  (ngModelChange)="zone.set($event)"
                >
                  @for (z of zones(); track z.id) {
                    <option [value]="z.id">{{ z.displayName || z.id }}</option>
                  }
                </select>
              </span>
            } @else {
              <div class="fl-input fl-input--lg">
                <input
                  id="vnet-subnet-zone"
                  type="text"
                  autocomplete="off"
                  placeholder="eu-central"
                  [ngModel]="zone()"
                  (ngModelChange)="zone.set($event)"
                />
              </div>
            }
          </fl-field>

          <fl-field label="IP range" for="vnet-subnet-range" [error]="cidrError() || null">
            <div class="fl-input fl-input--lg fl-mono">
              <input
                id="vnet-subnet-range"
                type="text"
                autocomplete="off"
                spellcheck="false"
                [placeholder]="'10.0.1.0/' + suggestedPrefix()"
                [ngModel]="ipRange()"
                (ngModelChange)="ipRange.set($event)"
              />
            </div>
            <span class="fl-field__hint">
              {{ hint() }}.
              <button
                type="button"
                class="fl-link"
                (click)="ipRange.set('10.0.1.0/' + suggestedPrefix())"
              >
                Use /{{ suggestedPrefix() }}
              </button>
              @if (addressLabel()) {
                <span class="fl-mono"> · {{ addressLabel() }}</span>
              }
            </span>
          </fl-field>
        </div>
        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" [disabled]="busy()" (click)="cancelled.emit()">
            Cancel
          </button>
          <button
            flButton="primary"
            type="button"
            [disabled]="busy() || !zone()"
            (click)="submit()"
          >
            @if (busy()) {
              <fl-spinner label="Adding" />
              Adding…
            } @else {
              Add subnet
            }
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class VNetAddSubnetDialog {
  readonly zones = input<readonly VNetZoneDto[]>([]);
  readonly constraints = input<IpRangeConstraintsDto | null>(null);
  readonly busy = input(false);
  readonly cancelled = output<void>();
  readonly submitted = output<AddSubnetConfiguration>();

  protected readonly zone = linkedSignal(() => this.zones()[0]?.id ?? '');
  protected readonly ipRange = signal('');

  protected readonly suggestedPrefix = computed(() => {
    const c = this.constraints();
    if (!c) return 28;
    if (28 >= c.minPrefix && 28 <= c.maxPrefix) return 28;
    return Math.round((c.minPrefix + c.maxPrefix) / 2);
  });

  protected readonly hint = computed(() => {
    const c = this.constraints();
    if (!c) return 'Leave empty for auto /28 allocation';
    return `Allowed: /${c.minPrefix}–/${c.maxPrefix}`;
  });

  protected readonly addressLabel = computed(() => cidrAddressLabel(this.ipRange()));

  protected readonly cidrError = computed(() =>
    cidrPrefixError(this.ipRange(), this.constraints(), EXAMPLE_SUBNET_RANGE),
  );

  protected submit(): void {
    const networkZone = this.zone();
    if (!networkZone) return;
    this.submitted.emit({ networkZone, ipRange: this.ipRange() || undefined });
  }
}
