import { Component, computed, input, output } from '@angular/core';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { MailConnection } from '../../model/mail-console.models';
import { MailConnectionSetupComponent } from './mail-connection-setup.component';
import { MailDomainPickerComponent } from './mail-domain-picker.component';
import { MailTestSendComponent } from './mail-test-send.component';
import { blindSpotOf, providerLabel, pushes } from './mail-providers-helpers';

@Component({
  selector: 'app-mail-connection-details',
  imports: [
    FlAlert,
    FlButton,
    ReadOnlySectionDirective,
    MailConnectionSetupComponent,
    MailDomainPickerComponent,
    MailTestSendComponent,
  ],
  host: { class: 'flex flex-col gap-3 py-1' },
  template: `
    @let row = connection();
    @if (row.credentialNote || (row.implicit && !row.sendingDomain) || blindSpot()) {
      <div class="flex flex-col gap-1 text-fl-body-sm text-fl-ink-muted">
        @if (row.credentialNote) {
          <span>{{ row.credentialNote }}</span>
        }
        @if (row.implicit && !row.sendingDomain) {
          @if (verifiedDomains().length) {
            <span
              >Sending from <span class="fl-mono">{{ verifiedDomains().join(', ') }}</span>,
              verified at the provider.</span
            >
          } @else {
            <span>No verified domain yet. Mail is refused until one is set up.</span>
          }
        }
        @if (blindSpot()) {
          <span>{{ blindSpot() }}</span>
        }
      </div>
    }

    @if (!row.implicit) {
      <app-mail-connection-setup [connectionId]="row.id" [providerName]="provider()" />
    }

    @if (!row.webhookRegistered && reportsByWebhook()) {
      <fl-alert tone="warning" title="Delivered, bounced and marked-as-spam are not being reported">
        {{ row.webhookNote }}
        <button
          alertActions
          appReadOnlySection="mail"
          flButton
          size="sm"
          type="button"
          [disabled]="retrying()"
          (click)="retry.emit()"
        >
          {{ retrying() ? 'Trying…' : 'Try again' }}
        </button>
      </fl-alert>
    }

    @if (adding()) {
      <div class="flex flex-col gap-3 rounded-fl-md border border-fl-border p-3">
        <span class="text-fl-body-sm text-fl-ink-muted">
          Registers the domain with this {{ provider() }} account and writes the records it asks
          for. An account may send from several domains.
        </span>
        <div class="flex flex-wrap items-end gap-3">
          <div class="min-w-72 flex-1">
            <app-mail-domain-picker
              label=""
              suggestedPrefix="mail"
              (domainChange)="domainChange.emit($event)"
            />
          </div>
          <button
            appReadOnlySection="mail"
            flButton
            type="button"
            [disabled]="registering() || !newDomain().trim()"
            (click)="register.emit()"
          >
            {{ registering() ? 'Registering…' : 'Register with ' + provider() }}
          </button>
        </div>
        @if (addError(); as failed) {
          <fl-alert tone="error" title="Could not register the domain">{{ failed }}</fl-alert>
        }
        @if (added(); as done) {
          <fl-alert tone="info" title="Domain registered">{{ done }}</fl-alert>
        }
      </div>
    }

    @if (testing()) {
      <app-mail-test-send [connectionId]="row.id" />
    }
  `,
})
export class MailConnectionDetails {
  readonly connection = input.required<MailConnection>();
  readonly verifiedDomains = input<string[]>([]);
  readonly retrying = input(false);
  readonly testing = input(false);
  readonly adding = input(false);
  readonly newDomain = input('');
  readonly registering = input(false);
  readonly added = input<string | null>(null);
  readonly addError = input<string | null>(null);

  readonly retry = output<void>();
  readonly domainChange = output<string>();
  readonly register = output<void>();

  protected readonly provider = computed(() => providerLabel(this.connection().provider));
  protected readonly blindSpot = computed(() => blindSpotOf(this.connection().provider));
  protected readonly reportsByWebhook = computed(() => pushes(this.connection().provider));
}
