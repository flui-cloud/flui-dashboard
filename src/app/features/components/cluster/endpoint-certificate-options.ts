import { Component, input, model, output } from '@angular/core';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-endpoint-certificate-options',
  imports: [FlAlert, FlButton, FlStatus],
  host: { class: 'flex flex-col gap-3' },
  template: `
    <label class="fl-check">
      <input
        type="checkbox"
        [checked]="certificateRequired()"
        (change)="certificateRequired.set(!certificateRequired())"
      />
      Provision a TLS certificate (HTTPS)
    </label>

    @if (certificateRequired()) {
      @if (!zoned()) {
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          Single-domain certificate only. A wildcard needs a managed DNS zone.
        </p>
      }

      @if (!issuersReady()) {
        <fl-alert tone="error" title="No certificate issuer ready">
          TLS provisioning will fail until an issuer is configured.
          <button alertActions flButton size="sm" type="button" (click)="configureIssuers.emit()">
            Configure issuers
          </button>
        </fl-alert>
      }

      @if (!editMode()) {
        @switch (certificateMode()) {
          @case ('staging') {
            <fl-alert tone="info" title="Staging certificate">
              Let's Encrypt staging issues it, and browsers do not trust it. It is not promoted to
              production on its own.
            </fl-alert>
          }
          @case ('preflight') {
            <fl-alert tone="info" title="Preflight">
              A staging certificate is issued first. Once it is valid, promote it to production from
              the endpoint.
            </fl-alert>
          }
          @default {
            <p class="m-0 text-fl-body-sm text-fl-ink-muted">
              A production certificate from Let's Encrypt is issued, trusted by browsers.
            </p>
          }
        }
      }

      @if (editMode() && stagingCert()) {
        @if (stagingValid()) {
          <label class="fl-check items-start">
            <input
              type="checkbox"
              [checked]="promoteToProd()"
              (change)="promoteToProd.set(!promoteToProd())"
            />
            <span class="flex flex-col gap-0.5">
              Promote to production
              <span class="text-fl-caption text-fl-ink-muted">
                The staging certificate is valid. Switch to a production Let's Encrypt certificate
                that browsers trust.
              </span>
            </span>
          </label>
        } @else {
          <fl-alert tone="warning" title="Staging certificate">
            This endpoint uses Let's Encrypt staging. Promote it to production once the staging
            certificate is valid.
          </fl-alert>
        }
      }

      @if (editMode() && prodCert()) {
        <fl-status tone="success" label="Production certificate from Let's Encrypt" />
      }
    }
  `,
})
export class EndpointCertificateOptions {
  readonly certificateRequired = model.required<boolean>();
  readonly promoteToProd = model.required<boolean>();
  readonly zoned = input.required<boolean>();
  readonly issuersReady = input.required<boolean>();
  readonly editMode = input.required<boolean>();
  readonly certificateMode = input.required<string>();
  readonly stagingCert = input.required<boolean>();
  readonly stagingValid = input.required<boolean>();
  readonly prodCert = input.required<boolean>();
  readonly configureIssuers = output<void>();
}
