import { Component, computed, input, output } from '@angular/core';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { Tone, statusToneOf } from '../dashboard/home-state';
import { ComponentCard, ComponentTrend } from './app-recap-bundle';
import { AppRecapComponentCardComponent } from './app-recap-component-card.component';
import { RunState } from './app-recap-view';
import { AppAvailability } from '../../service/fleet.service';

@Component({
  selector: 'app-recap-topology',
  imports: [FlPanel, FlTable, FlStatus, AppRecapComponentCardComponent],
  host: { class: 'block' },
  template: `
    <fl-panel
      title="Components"
      [count]="cards().length"
      [flush]="true"
      data-testid="recap-topology"
    >
      <span panelActions class="text-fl-body-sm text-fl-ink-muted">{{ summary() }}</span>
      @if (endpointHost()) {
        <div
          panelToolbar
          class="fl-row border-b border-fl-border-subtle px-4 py-3 text-fl-body-sm"
          data-testid="recap-endpoint"
        >
          <span class="text-fl-ink-muted">Public endpoint</span>
          <span class="fl-mono">{{ endpointHost() }}</span>
          @if (health().label) {
            <fl-status [tone]="tone(health().tone)" [label]="health().label" />
          }
        </div>
      }
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Component</th>
              <th scope="col">Kind</th>
              <th scope="col">Status</th>
              <th scope="col">Endpoint</th>
              <th scope="col">Replicas</th>
              <th scope="col">CPU</th>
              <th scope="col">Memory</th>
              <th scope="col">Disk</th>
              <th scope="col">If a node is lost</th>
              <th scope="col">Backup</th>
              <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (c of cards(); track c.app.id) {
              <tr
                app-recap-component-card
                [card]="c"
                [recapPath]="recapPath()"
                [protectionLoaded]="protectionLoaded()"
                [availability]="availability()[c.app.id] ?? null"
                [runState]="runState()"
                [trend]="trends()[c.app.id] ?? null"
                [address]="c === front()[0] ? endpointHost() : ''"
                (backUp)="backUp.emit($event)"
              ></tr>
            }
          </tbody>
        </table>
      </div>
      @if (note()) {
        <p class="border-t border-fl-border-subtle px-4 py-3 text-fl-body-sm text-fl-ink-muted">
          {{ note() }}
        </p>
      }
    </fl-panel>
  `,
})
export class AppRecapTopologyComponent {
  readonly recapPath = input('');
  readonly endpointHost = input('');
  readonly health = input.required<{ label: string; tone: Tone }>();
  readonly front = input.required<ComponentCard[]>();
  readonly back = input.required<ComponentCard[]>();
  readonly summary = input.required<string>();
  readonly note = input('');
  readonly protectionLoaded = input.required<boolean>();
  readonly availability = input<Record<string, AppAvailability>>({});
  readonly runState = input.required<Record<string, RunState>>();
  readonly trends = input<Record<string, ComponentTrend>>({});
  readonly backUp = output<string>();

  protected readonly cards = computed(() => [...this.front(), ...this.back()]);

  protected tone(tone: Tone): StatusTone {
    return statusToneOf(tone);
  }
}
