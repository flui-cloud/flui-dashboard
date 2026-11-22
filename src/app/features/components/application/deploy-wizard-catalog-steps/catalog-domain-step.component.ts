import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { CatalogService } from '../../../service/catalog.service';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlField } from '../../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlStatus } from '../../../../ui/primitives/status';

type DomainMode = 'auto' | 'custom' | 'skip';

@Component({
  selector: 'app-catalog-domain-step',
  imports: [FormsModule, FlAlert, FlField, FlKeyValue, FlKvItem, FlStatus],
  host: { class: 'flex flex-col gap-5' },
  template: `
    <p class="m-0 text-fl-body-sm text-fl-ink-muted">
      How people reach the app. Flui sets up DNS and TLS once the cluster is ready.
    </p>

    @if (catalog.capabilitiesLoading()) {
      <fl-status tone="progress" label="Checking cluster capabilities" />
    } @else if (catalog.capabilitiesError()) {
      <fl-alert tone="error" title="Could not check the cluster">{{
        catalog.capabilitiesError()
      }}</fl-alert>
    } @else {
      @let caps = catalog.capabilities();

      @if (domainLocked()) {
        <fl-alert tone="info" title="Endpoint set by the app">
          The app manifest fixes the hostname, so it cannot be changed here. Flui creates the
          endpoint during install.
        </fl-alert>
        @if (autoFqdnPreview()) {
          <fl-key-value>
            <fl-kv-item key="Address" [mono]="true">https://{{ autoFqdnPreview() }}</fl-kv-item>
          </fl-key-value>
        }
      } @else {
        <fieldset class="fl-fieldset">
          <legend>Endpoint</legend>
          <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
            @for (option of modes(); track option.value) {
              <label class="fl-radiocard" [class.is-checked]="state.domainMode() === option.value">
                <input
                  type="radio"
                  name="catalog-domain-mode"
                  [value]="option.value"
                  [checked]="state.domainMode() === option.value"
                  (change)="setMode(option.value)"
                />
                <span class="fl-radiocard__text">
                  <span class="fl-radiocard__title">{{ option.title }}</span>
                  <span class="fl-radiocard__desc">{{ option.description }}</span>
                </span>
              </label>
            }
          </div>
        </fieldset>

        @if (state.domainMode() === 'auto') {
          <div class="flex flex-col gap-2">
            <fl-key-value>
              <fl-kv-item key="Address" [mono]="true">https://{{ autoFqdnPreview() }}</fl-kv-item>
            </fl-key-value>
            <p class="m-0 text-fl-caption text-fl-ink-muted">
              @if (caps?.canAutoAssignDomain) {
                The final name may carry a short random suffix to avoid collisions.
              } @else {
                No domain is connected, so Flui creates a test address that points to the cluster.
              }
              @if (caps?.certificateProvider === 'lets_encrypt_staging') {
                The certificate is in test mode, so browsers show a warning.
              }
            </p>
          </div>
        }

        @if (state.domainMode() === 'custom') {
          <fl-field
            label="Domain"
            for="catalog-domain"
            hint="Point a DNS record for this hostname to the cluster before the install ends, or the certificate cannot be issued."
            [error]="
              !state.catalogDomainValid() && state.requestedDomain().length > 0
                ? 'Enter a fully qualified domain name, such as app.example.com.'
                : null
            "
          >
            <div class="fl-input fl-input--lg">
              <input
                id="catalog-domain"
                type="text"
                inputmode="url"
                [ngModel]="state.requestedDomain()"
                (ngModelChange)="state.requestedDomain.set($event)"
                placeholder="app.example.com"
              />
            </div>
          </fl-field>
        }

        @if (state.domainMode() === 'skip') {
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">
            No endpoint is created. Once the app runs, add a domain from its DNS section.
          </p>
        }

        @if (state.domainMode() !== 'skip') {
          <div class="flex flex-col gap-1">
            <label class="fl-check">
              <input
                type="checkbox"
                [ngModel]="state.enableTls()"
                (ngModelChange)="state.enableTls.set($event)"
                name="enable-tls"
              />
              <span class="font-medium">Provision an HTTPS certificate</span>
            </label>
            <p class="m-0 pl-6 text-fl-caption text-fl-ink-muted">
              Turn off to serve plain HTTP with DNS only, for example to avoid certificate rate
              limits or when TLS ends upstream.
            </p>
          </div>
        }
      }
    }
  `,
})
export class CatalogDomainStepComponent {
  protected readonly state = inject(DeployWizardStateService);
  protected readonly catalog = inject(CatalogService);

  protected readonly clusterId = computed(() => this.state.clusterId() || null);

  protected readonly autoFqdnPreview = computed(() => {
    const caps = this.catalog.capabilities();
    const slug = this.state.catalogDetail()?.slug ?? 'your-app';
    const template = caps?.autoFqdnTemplate;
    if (template?.includes('{install-slug}')) {
      return template.replace('{install-slug}', `${slug}-xxxx`);
    }
    const zone = caps?.zoneName;
    if (zone) return `${slug}-xxxx.${zone}`;
    return `${slug}-xxxx.<cluster-ip>.nip.io`;
  });

  protected readonly domainLocked = computed(
    () => this.state.catalogDetail()?.domain?.userCustomizable === false,
  );

  protected readonly autoModeLabel = computed(() =>
    this.catalog.capabilities()?.canAutoAssignDomain ? 'Auto-assigned' : 'Test address',
  );

  protected readonly autoModeDescription = computed(() =>
    this.catalog.capabilities()?.canAutoAssignDomain
      ? "Flui picks a subdomain of the cluster's domain, with a free certificate."
      : 'An address derived from the cluster IP, with no DNS setup.',
  );

  protected readonly modes = computed<{ value: DomainMode; title: string; description: string }[]>(
    () => [
      { value: 'auto', title: this.autoModeLabel(), description: this.autoModeDescription() },
      {
        value: 'custom',
        title: 'Custom domain',
        description: 'Bring your own hostname and point its DNS to the cluster.',
      },
      {
        value: 'skip',
        title: 'Configure later',
        description: 'Install without an endpoint and add DNS and TLS from the app later.',
      },
    ],
  );

  setMode(mode: DomainMode): void {
    this.state.domainMode.set(mode);
    if (mode !== 'custom') this.state.requestedDomain.set('');
  }
}
