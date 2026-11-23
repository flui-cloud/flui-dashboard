import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink } from '@ng-icons/lucide';
import { DnsSetupWizardService } from './dns-setup-wizard.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-dns-wizard-done-step',
  imports: [RouterLink, FlAlert, FlCopyId, FlTable, FlButton, FlIcon, FlStatus],
  providers: [provideIcons({ lucideExternalLink })],
  host: { class: 'fl-stack' },
  template: `
    <fl-status tone="success" label="All apps are live with active certificates" />

    <div class="fl-table-wrap">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col">App</th>
            <th scope="col">Address</th>
            <th scope="col" class="is-fit"><span class="fl-sr">Open</span></th>
          </tr>
        </thead>
        <tbody>
          @for (app of wiz.appEndpoints(); track app.key) {
            <tr>
              <td>{{ app.label }}</td>
              <td>
                <fl-copy-id [value]="'https://' + app.fqdn" label="address" [display]="app.fqdn" />
              </td>
              <td class="is-fit">
                <a
                  flButton="ghost"
                  size="sm"
                  [iconOnly]="true"
                  href="https://{{ app.fqdn }}"
                  target="_blank"
                  rel="noopener noreferrer"
                  [attr.aria-label]="'Open ' + app.fqdn"
                >
                  <fl-icon name="lucideExternalLink" />
                </a>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (wiz.requiresRelogin()) {
      <fl-alert tone="warning" title="Session moved to the new domain">
        The dashboard is now served from the custom domain. Continue there to sign in.
        @if (webUrl(); as url) {
          <span class="fl-mono block truncate">{{ url }}</span>
        }
        @if (webUrl()) {
          <button alertActions flButton size="sm" type="button" (click)="onRelogin()">
            Continue on the new domain
          </button>
        }
      </fl-alert>
    } @else {
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        Monitor and configure advanced options in the
        <a [routerLink]="['/cluster', clusterId(), 'dns']" class="fl-link">cluster DNS section</a>.
      </p>
    }
  `,
})
export class DnsWizardDoneStepComponent {
  protected wiz = inject(DnsSetupWizardService);
  readonly clusterId = input.required<string>();

  protected webUrl(): string | null {
    const fqdn = this.wiz.appEndpoints().find((a) => a.key === 'flui-web')?.fqdn;
    return fqdn ? `https://${fqdn}` : null;
  }

  onRelogin(): void {
    const url = this.webUrl();
    if (url) {
      globalThis.window.location.href = url;
    }
  }
}
