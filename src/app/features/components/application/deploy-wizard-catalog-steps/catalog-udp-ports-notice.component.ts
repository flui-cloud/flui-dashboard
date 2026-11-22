import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { UDP_STATE_TEXT, udpPortsAdvice } from '../../../service/app-udp-ports.service';
import { AlertTone, FlAlert } from '../../../../ui/patterns/alert';

@Component({
  selector: 'app-catalog-udp-ports-notice',
  imports: [FlAlert, RouterLink],
  template: `
    @if (state.catalogUdpPorts(); as v) {
      <fl-alert
        [tone]="tone()"
        title="This app needs public UDP ports"
        data-testid="catalog-udp-ports"
      >
        @for (p of v.ports; track p.port) {
          <span class="block">
            <span class="fl-mono">{{ p.port }}</span>
            {{ p.name }}:
            @if (p.takenBy) {
              Already used by {{ p.takenBy }} on this cluster
            } @else {
              {{ stateText[p.state] }}
            }
          </span>
        }
        @if (taken()) {
          <span class="mt-1 block">
            Two apps cannot share a UDP port on one cluster. Pick another cluster, or remove the
            other app first.
          </span>
        } @else if (advice()) {
          <span class="mt-1 block">{{ advice() }} The app installs either way.</span>
        }
        @if (!taken() && v.firewallId && !allOpen()) {
          <a
            alertActions
            class="fl-link"
            [routerLink]="['/infrastructure/firewall', v.firewallId]"
            target="_blank"
          >
            Open cluster firewall
          </a>
        }
      </fl-alert>
    }
  `,
})
export class CatalogUdpPortsNoticeComponent {
  protected readonly state = inject(DeployWizardStateService);
  protected readonly stateText = UDP_STATE_TEXT;

  protected readonly taken = computed(
    () => this.state.catalogUdpPorts()?.ports.some((p) => !!p.takenBy) ?? false,
  );
  protected readonly allOpen = computed(
    () => this.state.catalogUdpPorts()?.ports.every((p) => p.state === 'open') ?? true,
  );
  protected readonly advice = computed(() => {
    const v = this.state.catalogUdpPorts();
    return v ? udpPortsAdvice(v) : null;
  });

  protected readonly tone = computed<AlertTone>(() => {
    if (this.taken()) return 'error';
    return this.allOpen() ? 'info' : 'warning';
  });
}
