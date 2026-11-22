import { Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GatewayMinRole } from '../../model/gateway-route.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';

let nextId = 0;

@Component({
  selector: 'app-gateway-route-policies',
  imports: [FormsModule, FlAlert, FlField, FlButton, FlSpinner],
  host: { class: 'flex flex-col gap-4 py-2' },
  template: `
    @if (errorMessage()) {
      <fl-alert tone="error" title="Route not applied">{{ errorMessage() }}</fl-alert>
    }
    <div class="grid gap-6 md:grid-cols-3">
      <fieldset class="fl-fieldset">
        <legend>Authentication</legend>
        <label class="fl-check">
          <input type="checkbox" [ngModel]="sso()" (ngModelChange)="sso.set($event)" />
          Require Flui SSO login
        </label>
        <fl-field label="Minimum role" [for]="id + '-role'">
          <span class="fl-select-wrap">
            <select
              class="fl-select"
              [id]="id + '-role'"
              [disabled]="!sso()"
              [ngModel]="minRole()"
              (ngModelChange)="minRole.set($event)"
            >
              <option value="">Any authenticated user</option>
              <option value="viewer">Viewer</option>
              <option value="operator">Operator</option>
              <option value="maintainer">Maintainer</option>
            </select>
          </span>
        </fl-field>
      </fieldset>

      <fieldset class="fl-fieldset">
        <legend>Rate limit</legend>
        <fl-field label="Requests per period" [for]="id + '-average'" hint="0 turns it off.">
          <div class="fl-input fl-input--lg">
            <input
              type="number"
              min="0"
              [id]="id + '-average'"
              [ngModel]="average()"
              (ngModelChange)="average.set($event)"
            />
          </div>
        </fl-field>
        <div class="grid grid-cols-2 gap-3">
          <fl-field label="Burst" [for]="id + '-burst'">
            <div class="fl-input fl-input--lg">
              <input
                type="number"
                min="0"
                [id]="id + '-burst'"
                [ngModel]="burst()"
                (ngModelChange)="burst.set($event)"
              />
            </div>
          </fl-field>
          <fl-field label="Period" [for]="id + '-period'">
            <span class="fl-select-wrap">
              <select
                class="fl-select"
                [id]="id + '-period'"
                [ngModel]="period()"
                (ngModelChange)="period.set($event)"
              >
                <option value="1s">1s</option>
                <option value="1m">1m</option>
                <option value="1h">1h</option>
              </select>
            </span>
          </fl-field>
        </div>
      </fieldset>

      <fieldset class="fl-fieldset">
        <legend>IP filtering</legend>
        <fl-field
          label="Allowed ranges"
          [for]="id + '-ips'"
          hint="One CIDR per line, empty allows all. Anyone else gets a 403 Forbidden page."
          [error]="
            invalidAllowIps().length
              ? 'Not an IP address or range: ' + invalidAllowIps().join(', ')
              : null
          "
        >
          <textarea
            rows="4"
            class="fl-textarea fl-mono"
            placeholder="203.0.113.0/24"
            [id]="id + '-ips'"
            [ngModel]="allowIps()"
            (ngModelChange)="allowIps.set($event)"
          ></textarea>
        </fl-field>
      </fieldset>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-fl-body-sm text-fl-ink-muted">
        Changes are applied to the cluster in the background after saving.
      </p>
      <button
        flButton="primary"
        size="sm"
        type="button"
        [disabled]="saving() || invalidAllowIps().length > 0"
        (click)="save.emit()"
      >
        @if (saving()) {
          <fl-spinner label="Saving" />
        }
        Save policies
      </button>
    </div>
  `,
})
export class GatewayRoutePolicies {
  readonly sso = model(false);
  readonly minRole = model<'' | GatewayMinRole>('');
  readonly average = model(0);
  readonly burst = model(0);
  readonly period = model('1s');
  readonly allowIps = model('');
  readonly invalidAllowIps = input<string[]>([]);
  readonly saving = input(false);
  readonly errorMessage = input<string | null | undefined>(null);
  readonly save = output<void>();

  protected readonly id = `gateway-policy-${nextId++}`;
}
