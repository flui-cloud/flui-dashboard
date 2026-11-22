import { Component, input, output } from '@angular/core';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import { SshTerminalComponent } from './ssh-terminal.component';

@Component({
  selector: 'app-instance-ssh-panel',
  imports: [FlPanel, FlAlert, FlButton, FlStatus, SshTerminalComponent],
  host: { class: 'fl-stack' },
  styles: `
    .instance-terminal {
      height: 500px;
    }
  `,
  template: `
    <fl-panel title="SSH terminal">
      <ng-container panelActions>
        @if (showBootstrapKey()) {
          <label
            class="fl-check"
            title="Uses the cluster bootstrap SSH key instead of ephemeral certificates. A fallback for when ephemeral certificates do not work."
          >
            <input
              type="checkbox"
              [checked]="useBootstrapKey()"
              (change)="toggleBootstrapKey.emit()"
            />
            <span>Bootstrap key</span>
          </label>
        }
        <button
          [flButton]="terminalVisible() ? 'secondary' : 'primary'"
          size="sm"
          type="button"
          [disabled]="!canConnect()"
          (click)="toggleTerminal.emit()"
        >
          {{ terminalVisible() ? 'Disconnect' : 'Connect' }}
        </button>
      </ng-container>

      <div class="fl-stack">
        @if (!canConnect()) {
          <fl-status tone="neutral" [label]="unavailableReason()" />
        } @else if (terminalVisible()) {
          <fl-status tone="success" label="Connected" />
        } @else {
          <fl-status tone="neutral" label="Ready to connect" />
        }

        @if (terminalVisible() && canConnect()) {
          @if (useBootstrapKey()) {
            <fl-alert tone="warning" title="Using the bootstrap key">
              Ephemeral certificates are bypassed for this session.
            </fl-alert>
          }
          <div class="instance-terminal">
            <app-ssh-terminal
              [serverId]="serverId()"
              [serverIp]="serverIp()"
              [useBootstrapKey]="useBootstrapKey()"
              [clusterId]="clusterId()"
            />
          </div>
        }
      </div>
    </fl-panel>
  `,
})
export class InstanceSshPanel {
  readonly canConnect = input.required<boolean>();
  readonly unavailableReason = input('');
  readonly terminalVisible = input.required<boolean>();
  readonly showBootstrapKey = input(false);
  readonly useBootstrapKey = input(false);
  readonly serverId = input.required<string>();
  readonly serverIp = input.required<string>();
  readonly clusterId = input<string | undefined>(undefined);
  readonly toggleTerminal = output<void>();
  readonly toggleBootstrapKey = output<void>();
}
