import { Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-gateway-add-route-dialog',
  imports: [FormsModule, FlAlert, FlField, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="cancelled.emit()"
    >
      <div
        class="fl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gateway-add-route-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="gateway-add-route-title">Add route</h2>
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
          <fl-field
            label="Host"
            for="gateway-route-host"
            hint="A domain in a cluster DNS zone gets its record automatically. Otherwise point your DNS at the cluster."
          >
            <div class="fl-input fl-input--lg">
              <input
                id="gateway-route-host"
                class="fl-mono"
                placeholder="api.example.com"
                [ngModel]="host()"
                (ngModelChange)="host.set($event)"
              />
            </div>
          </fl-field>

          <fl-field label="Path prefix" for="gateway-route-path">
            <div class="fl-input fl-input--lg">
              <input
                id="gateway-route-path"
                class="fl-mono"
                placeholder="/"
                [ngModel]="path()"
                (ngModelChange)="path.set($event)"
              />
            </div>
          </fl-field>

          <fieldset class="fl-fieldset">
            <legend>Protocol</legend>
            <label class="fl-radiocard">
              <input
                type="radio"
                name="gateway-route-tls"
                [value]="true"
                [ngModel]="tls()"
                (ngModelChange)="tls.set($event)"
              />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title">HTTPS</span>
                <span class="fl-radiocard__desc">Issue a TLS certificate for the host.</span>
              </span>
            </label>
            <label class="fl-radiocard">
              <input
                type="radio"
                name="gateway-route-tls"
                [value]="false"
                [ngModel]="tls()"
                (ngModelChange)="tls.set($event)"
              />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title">HTTP only</span>
                <span class="fl-radiocard__desc">No certificate.</span>
              </span>
            </label>
          </fieldset>

          @if (formError()) {
            <fl-alert tone="error" title="Check the route">{{ formError() }}</fl-alert>
          }
        </div>

        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="cancelled.emit()">Cancel</button>
          <button flButton="primary" type="button" [disabled]="saving()" (click)="submitted.emit()">
            @if (saving()) {
              <fl-spinner label="Adding route" />
            }
            Add route
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class GatewayAddRouteDialog {
  readonly host = model('');
  readonly path = model('');
  readonly tls = model(true);
  readonly formError = input<string | null>(null);
  readonly saving = input(false);
  readonly cancelled = output<void>();
  readonly submitted = output<void>();
}
