import { NgTemplateOutlet } from '@angular/common';
import { Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown } from '@ng-icons/lucide';

import { formatMoney } from '../../../shared/utils/money';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { ClusterBilling, NodeGroups, billingDate, shown } from './cluster-pricing-view';

@Component({
  selector: 'app-cluster-pricing-machines',
  imports: [NgTemplateOutlet, RouterLink, MaskIdPipe, FlPanel, FlTable, FlIcon, FlStatus],
  providers: [provideIcons({ lucideChevronDown })],
  host: { class: 'fl-stack' },
  template: `
    @let b = billing();
    @let g = groups();
    <fl-panel title="Machines" [count]="g.active.length" [flush]="true">
      <a panelActions routerLink="/infrastructure/costs" class="fl-link text-fl-body-sm"
        >All costs</a
      >
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col" class="is-num">Billed</th>
              <th scope="col" class="is-num">Cost</th>
            </tr>
          </thead>
          <tbody>
            @for (node of g.active; track node.nodeId) {
              <ng-container *ngTemplateOutlet="nodeRows; context: { $implicit: node }" />
            }
            @if (g.removed.length) {
              <tr>
                <td colspan="5">
                  <button
                    type="button"
                    class="fl-link inline-flex items-center gap-1"
                    [attr.aria-expanded]="showRemoved()"
                    (click)="showRemoved.set(!showRemoved())"
                  >
                    {{ g.removed.length }} removed this month
                    <fl-icon
                      name="lucideChevronDown"
                      [size]="14"
                      [class.rotate-180]="showRemoved()"
                    />
                  </button>
                </td>
                <td class="is-num">{{ money(b.vat?.included ? g.removedGross : g.removedNet) }}</td>
              </tr>
              @if (showRemoved()) {
                @for (node of g.removed; track node.nodeId) {
                  <ng-container *ngTemplateOutlet="nodeRows; context: { $implicit: node }" />
                }
              }
            }
          </tbody>
        </table>
      </div>
    </fl-panel>

    <ng-template #nodeRows let-node>
      <tr>
        <td class="fl-mono">{{ node.serverName }}</td>
        <td>{{ node.nodeType }}</td>
        <td class="fl-mono">{{ node.currentServerType }}</td>
        <td>
          <fl-status
            [tone]="node.status === 'active' ? 'success' : 'neutral'"
            [label]="node.status === 'active' ? 'Running' : 'Removed'"
          />
        </td>
        <td class="is-num">{{ node.billableHours }}h</td>
        <td class="is-num">{{ money(shown(b, { gross: node.costGross, net: node.costNet })) }}</td>
      </tr>
      @if (node.segments.length > 1) {
        @for (seg of node.segments; track $index) {
          <tr>
            <td colspan="4" class="pl-8 text-fl-ink-muted">
              <span class="fl-mono">{{ seg.serverType }}</span>
              {{ date(seg.startedAt) }} to {{ seg.endedAt ? date(seg.endedAt) : 'now' }}
            </td>
            <td class="is-num text-fl-ink-muted">{{ seg.hours }}h</td>
            <td class="is-num text-fl-ink-muted">
              {{ money(shown(b, { gross: seg.costGross, net: seg.costNet })) }}
            </td>
          </tr>
        }
      }
    </ng-template>

    @if (b.monthToDate.volumes.length > 0) {
      <fl-panel title="Volumes" [count]="b.monthToDate.volumes.length" [flush]="true">
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Volume</th>
                <th scope="col">ID</th>
                <th scope="col">Status</th>
                <th scope="col" class="is-num">Size</th>
                <th scope="col" class="is-num">Cost</th>
              </tr>
            </thead>
            <tbody>
              @for (vol of b.monthToDate.volumes; track vol.volumeProviderId) {
                <tr>
                  <td>{{ vol.kind }}</td>
                  <td class="fl-mono">{{ vol.volumeProviderId | maskId }}</td>
                  <td>
                    <fl-status
                      [tone]="vol.status === 'active' ? 'success' : 'neutral'"
                      [label]="vol.status === 'active' ? 'In use' : 'Removed'"
                    />
                  </td>
                  <td class="is-num">{{ vol.currentSizeGb }} GB</td>
                  <td class="is-num">
                    {{ money(shown(b, { gross: vol.costGross, net: vol.costNet })) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </fl-panel>
    }
  `,
})
export class ClusterPricingMachines {
  readonly billing = input.required<ClusterBilling>();
  readonly groups = input.required<NodeGroups>();

  protected readonly showRemoved = signal(false);
  protected readonly shown = shown;
  protected readonly date = billingDate;

  protected money(value: string | number | null | undefined): string {
    return formatMoney(value, this.billing().currency ?? 'EUR');
  }
}
