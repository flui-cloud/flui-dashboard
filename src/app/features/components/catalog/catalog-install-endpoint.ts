import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink } from '@ng-icons/lucide';
import { EndpointReadiness } from '../../model/endpoint-readiness';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

@Component({
  selector: 'app-catalog-install-endpoint',
  imports: [RouterLink, FlKeyValue, FlKvItem, FlPanel, FlButton, FlIcon, FlStatus],
  providers: [provideIcons({ lucideExternalLink })],
  host: { class: 'block' },
  template: `
    <fl-panel title="Endpoint">
      @if (readiness().isReady) {
        <a
          panelActions
          flButton="primary"
          size="sm"
          [href]="openUrl()"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open app
          <fl-icon name="lucideExternalLink" [size]="14" />
        </a>
      } @else if (dnsAppId()) {
        <a panelActions flButton size="sm" [routerLink]="['/apps/applications', dnsAppId(), 'dns']"
          >DNS settings</a
        >
      }
      <fl-key-value>
        <fl-kv-item key="Address" [mono]="true">{{ fqdn() }}</fl-kv-item>
        <fl-kv-item key="State">
          <fl-status [tone]="tone()" [label]="readiness().isReady ? 'Ready' : readiness().label" />
          @if (!readiness().isReady && readiness().detail) {
            <span class="mt-1 block text-fl-caption text-fl-ink-muted">{{
              readiness().detail
            }}</span>
          }
        </fl-kv-item>
      </fl-key-value>
    </fl-panel>
  `,
})
export class CatalogInstallEndpoint {
  readonly fqdn = input.required<string>();
  readonly readiness = input.required<EndpointReadiness>();
  readonly openUrl = input<string | null>(null);
  readonly dnsAppId = input<string | null>(null);

  protected readonly tone = computed<StatusTone>(() => {
    const r = this.readiness();
    if (r.isReady) return 'success';
    return r.state === 'failed' ? 'error' : 'progress';
  });
}
