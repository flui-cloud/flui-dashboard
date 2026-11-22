import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClusterDnsZoneService } from '../../service/cluster-dns-zone.service';
import { ConfigureSystemIngressDto } from '../../../core/api/model/configureSystemIngressDto';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlField } from '../../../ui/patterns/field';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-cluster-system-ingress-form',
  imports: [FormsModule, FlPanel, FlField, FlAlert, FlStatus, FlButton, FlSpinner],
  template: `
    <fl-panel title="System ingress">
      <ng-container panelActions>
        <button
          flButton="ghost"
          size="sm"
          type="button"
          [attr.aria-expanded]="showForm()"
          (click)="toggleForm()"
        >
          {{ showForm() ? 'Hide' : 'Configure' }}
        </button>
      </ng-container>

      <div class="flex flex-col gap-4">
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          Ingress routes for the Flui API and web app domains.
        </p>

        @if (showForm()) {
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <fl-field label="API domain" for="system-ingress-api">
              <div class="fl-input fl-input--lg">
                <input
                  id="system-ingress-api"
                  type="text"
                  class="fl-mono"
                  required
                  [(ngModel)]="apiDomain"
                  [placeholder]="'api.' + (zoneName() || 'example.com')"
                />
              </div>
            </fl-field>
            <fl-field label="App domain" for="system-ingress-app">
              <div class="fl-input fl-input--lg">
                <input
                  id="system-ingress-app"
                  type="text"
                  class="fl-mono"
                  required
                  [(ngModel)]="appDomain"
                  [placeholder]="'app.' + (zoneName() || 'example.com')"
                />
              </div>
            </fl-field>
          </div>

          <fl-field label="Certificate issuer" for="system-ingress-issuer">
            <span class="fl-select-wrap">
              <select id="system-ingress-issuer" class="fl-select" [(ngModel)]="issuer">
                <option value="lets_encrypt_staging">Let's Encrypt staging</option>
                <option value="lets_encrypt">Let's Encrypt production</option>
              </select>
            </span>
          </fl-field>

          @if (error()) {
            <fl-alert tone="error" title="Could not configure system ingress">
              {{ error() }}
            </fl-alert>
          }

          <div class="fl-row">
            <button
              flButton="primary"
              type="button"
              [disabled]="saving() || !apiDomain().trim() || !appDomain().trim()"
              (click)="submit()"
            >
              @if (saving()) {
                <fl-spinner label="Applying" />
                Applying…
              } @else {
                Apply
              }
            </button>
            <button
              flButton="ghost"
              type="button"
              [disabled]="saving()"
              (click)="showForm.set(false)"
            >
              Cancel
            </button>
            @if (success()) {
              <fl-status tone="success" label="System ingress configured" />
            }
          </div>
        }
      </div>
    </fl-panel>
  `,
})
export class ClusterSystemIngressFormComponent {
  private readonly dnsZoneService = inject(ClusterDnsZoneService);

  clusterId = input.required<string>();
  zoneName = input<string>('');

  protected showForm = signal(false);
  protected saving = signal(false);
  protected error = signal<string | null>(null);
  protected success = signal(false);

  protected apiDomain = signal('');
  protected appDomain = signal('');
  protected issuer = signal<ConfigureSystemIngressDto.IssuerEnum>(
    ConfigureSystemIngressDto.IssuerEnum.LetsEncryptStaging,
  );

  protected toggleForm(): void {
    this.showForm.update((v) => !v);
  }

  protected async submit(): Promise<void> {
    const apiDomain = this.apiDomain().trim();
    const appDomain = this.appDomain().trim();
    if (!apiDomain || !appDomain) return;

    this.saving.set(true);
    this.error.set(null);
    this.success.set(false);

    const ok = await this.dnsZoneService.configureSystemIngress(this.clusterId(), {
      apiDomain,
      appDomain,
      issuer: this.issuer(),
    });

    this.saving.set(false);
    if (ok) {
      this.success.set(true);
      setTimeout(() => {
        this.success.set(false);
        this.showForm.set(false);
      }, 2000);
    } else {
      this.error.set(this.dnsZoneService.error() ?? 'Failed to configure system ingress');
    }
  }
}
