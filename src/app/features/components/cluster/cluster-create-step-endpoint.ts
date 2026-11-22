import { Component, computed, input, output } from '@angular/core';
import { DnsZoneResponseDto } from '../../../core/api/model/dnsZoneResponseDto';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlStatus } from '../../../ui/primitives/status';

export type EndpointHostnameMode = 'ip' | 'domain';

@Component({
  selector: 'app-cluster-create-step-endpoint',
  imports: [FlAlert, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    <fieldset class="fl-fieldset">
      <legend>How apps are reached</legend>
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        The default for this cluster. Each app can change it later.
      </p>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label class="fl-radiocard">
          <input
            type="radio"
            name="cluster-endpoint-mode"
            [checked]="mode() === 'ip'"
            (change)="modeChange.emit('ip')"
          />
          <span class="fl-radiocard__text">
            <span class="fl-radiocard__title">Test addresses</span>
            <span class="fl-radiocard__desc">
              Each app gets an instant address derived from the cluster IP, with a free Let's
              Encrypt certificate. Good for tests and demos, no DNS setup.
            </span>
          </span>
        </label>
        <label class="fl-radiocard">
          <input
            type="radio"
            name="cluster-endpoint-mode"
            [checked]="mode() === 'domain'"
            (change)="modeChange.emit('domain')"
          />
          <span class="fl-radiocard__text">
            <span class="fl-radiocard__title">Custom domains</span>
            <span class="fl-radiocard__desc">
              Addresses under a DNS zone registered in Flui, such as
              <span class="fl-mono">example.com</span>, with a wildcard certificate.
            </span>
          </span>
        </label>
      </div>
    </fieldset>

    @if (mode() === 'domain') {
      @if (zonesLoading()) {
        <fl-status tone="progress" label="Loading your DNS zones" />
      } @else if (zones().length === 0) {
        <fl-alert tone="warning" title="No DNS zones yet">
          Register one under Infrastructure, Domains, then create this cluster. Or pick Test
          addresses now and attach a domain later.
        </fl-alert>
      } @else {
        <fieldset class="fl-fieldset border-t border-fl-border pt-4">
          <legend>DNS zone</legend>
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">
            Apps deployed to this cluster get their addresses under this zone.
          </p>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            @for (zone of zones(); track zone.id) {
              <label class="fl-radiocard">
                <input
                  type="radio"
                  name="cluster-dns-zone"
                  [checked]="selectedZoneId() === zone.id"
                  (change)="zoneSelect.emit(zone.id)"
                />
                <span class="fl-radiocard__text">
                  <span class="fl-radiocard__title fl-mono">{{ zone.zoneName }}</span>
                  <span class="fl-radiocard__desc">{{ zone.dnsProvider }}</span>
                </span>
              </label>
            }
          </div>
        </fieldset>

        @if (selectedZoneName(); as zoneName) {
          <div class="flex flex-col gap-2">
            <span class="text-fl-body-sm font-medium">Apps will be reachable at</span>
            <ul class="m-0 flex list-none flex-col gap-1 p-0">
              @for (host of preview(); track host) {
                <li class="fl-mono">{{ host }}</li>
              }
            </ul>
            <span class="text-fl-body-sm text-fl-ink-muted">
              Flui creates each record in <span class="fl-mono">{{ zoneName }}</span> when you
              deploy the app.
            </span>
          </div>
        }
      }
    }
  `,
})
export class ClusterCreateStepEndpoint {
  readonly mode = input<EndpointHostnameMode>('ip');
  readonly zonesLoading = input(false);
  readonly zones = input<readonly DnsZoneResponseDto[]>([]);
  readonly selectedZoneId = input<string | null>(null);
  readonly selectedZoneName = input<string | null>(null);
  readonly clusterName = input('');
  readonly modeChange = output<EndpointHostnameMode>();
  readonly zoneSelect = output<string>();

  protected readonly preview = computed(() => {
    const zone = this.selectedZoneName();
    if (!zone) return [];
    const cluster = this.clusterName() || '<cluster-name>';
    return ['myapp', 'docs'].map((slug) => `${slug}.${cluster}.${zone}`);
  });
}
