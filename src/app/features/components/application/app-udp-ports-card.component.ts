import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationResponseDto } from '../../../core/api';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import {
  AppUdpPortsService,
  UDP_STATE_TEXT,
  UdpPortState,
  UdpPortsView,
  udpPortsAdvice,
  udpPortsOf,
} from '../../service/app-udp-ports.service';

const UDP_STATE_TONE: Record<UdpPortState, StatusTone> = {
  open: 'success',
  pending: 'progress',
  closed: 'warning',
  unmanaged: 'neutral',
  'not-published': 'neutral',
};

@Component({
  selector: 'app-udp-ports-card',
  imports: [RouterLink, FlPanel, FlTable, FlStatus],
  template: `
    @if (view(); as v) {
      @if (v.ports.length) {
        <fl-panel
          title="UDP ports"
          [count]="v.ports.length"
          [flush]="true"
          data-testid="app-udp-ports"
        >
          @if (showFirewallLink()) {
            <a
              panelActions
              class="fl-link text-fl-body-sm"
              [routerLink]="['/infrastructure/firewall', v.firewallId]"
              >Open cluster firewalls</a
            >
          }
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col" class="is-fit">Port</th>
                  <th scope="col">Name</th>
                  <th scope="col">Firewall</th>
                </tr>
              </thead>
              <tbody>
                @for (p of v.ports; track p.port) {
                  <tr>
                    <td class="fl-mono is-num">{{ p.port }}</td>
                    <td>{{ p.name }}</td>
                    <td>
                      <fl-status [tone]="stateTone[p.state]" [label]="stateText[p.state]" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (advice()) {
            <p
              class="border-t border-fl-border px-4 py-3 text-fl-body-sm text-fl-ink-muted whitespace-normal"
            >
              {{ advice() }}
            </p>
          }
        </fl-panel>
      }
    }
  `,
})
export class AppUdpPortsCardComponent {
  private readonly udpPorts = inject(AppUdpPortsService);

  readonly app = input.required<ApplicationResponseDto | null>();
  readonly view = signal<UdpPortsView | null>(null);
  readonly stateText = UDP_STATE_TEXT;
  readonly stateTone = UDP_STATE_TONE;

  readonly advice = computed(() => {
    const v = this.view();
    return v ? udpPortsAdvice(v) : null;
  });
  readonly showFirewallLink = computed(() => {
    const v = this.view();
    return !!v?.firewallId && v.ports.some((p) => p.state === 'closed' || p.state === 'pending');
  });

  constructor() {
    effect(() => {
      const app = this.app();
      if (!app || !udpPortsOf(app).length) {
        this.view.set(null);
        return;
      }
      this.udpPorts.forApp(app.id).subscribe({
        next: (v) => this.view.set(v),
        error: () => this.view.set(null),
      });
    });
  }
}
