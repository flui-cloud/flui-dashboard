import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideNetwork, lucidePlus, lucideServer } from '@ng-icons/lucide';
import { SubnetInfo, VNetInfo } from '../../model/vnet.models';
import { InstanceWithLabels } from '../../model/instance.models';
import { ServerSelectorComponent } from '../../../shared/components/server-selector/server-selector.component';
import { InstanceStatusBadgeComponent } from '../compute/instance-status-badge.component';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

export interface AttachedServerRow {
  readonly subnet: SubnetInfo;
  readonly serverId: string;
}

@Component({
  selector: 'app-vnet-subnets-panel',
  imports: [
    ServerSelectorComponent,
    InstanceStatusBadgeComponent,
    FlPanel,
    FlTable,
    FlCopyId,
    FlEmptyState,
    FlActionsMenu,
    FlButton,
    FlIcon,
  ],
  providers: [provideIcons({ lucideNetwork, lucidePlus, lucideServer })],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Subnets" [count]="vnet().subnets.length" [flush]="true">
      @if (supportsSubnets()) {
        <button
          panelActions
          flButton
          size="sm"
          type="button"
          [disabled]="busy()"
          (click)="addSubnet.emit()"
        >
          <fl-icon name="lucidePlus" />
          Add subnet
        </button>
      }
      @if (vnet().subnets.length === 0) {
        <fl-empty-state icon="lucideNetwork" title="No subnets yet" [compact]="true" />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense" data-testid="vnet-subnets">
            <thead>
              <tr>
                <th scope="col">IP range</th>
                <th scope="col">Zone</th>
                <th scope="col">Gateway</th>
                <th scope="col">Provider subnet ID</th>
                <th scope="col" class="is-num">Servers</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (subnet of vnet().subnets; track subnet.id) {
                <tr [class.is-selected]="attachingSubnetId() === subnet.id">
                  <td class="fl-mono font-medium">{{ subnet.ipRange }}</td>
                  <td class="fl-mono">{{ subnet.networkZone }}</td>
                  <td class="fl-mono">{{ subnet.gateway || '—' }}</td>
                  <td>
                    @if (subnet.providerSubnetId) {
                      <fl-copy-id [value]="subnet.providerSubnetId" label="provider subnet ID" />
                    } @else {
                      <span class="fl-muted">—</span>
                    }
                  </td>
                  <td class="is-num">{{ subnet.attachedServerIds.length }}</td>
                  <td class="is-fit">
                    <fl-actions-menu
                      label="Subnet actions"
                      [compact]="true"
                      [items]="subnetActions()"
                      (action)="onSubnetAction($event, subnet)"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      @if (attachingSubnet(); as subnet) {
        <div class="fl-panel__body flex flex-col gap-3 border-t border-fl-border">
          <div class="flex items-center justify-between gap-3">
            <h3 class="m-0 text-fl-body-sm font-semibold">
              Attach a server to <span class="fl-mono">{{ subnet.ipRange }}</span>
            </h3>
            <button flButton="ghost" size="sm" type="button" (click)="cancelAttach.emit()">
              Cancel
            </button>
          </div>
          <app-server-selector
            [provider]="vnet().provider"
            [excludeServerIds]="subnet.attachedServerIds"
            [multiSelect]="false"
            (serverSelected)="serverSelected.emit({ subnet, server: $event })"
          />
        </div>
      }
    </fl-panel>

    <fl-panel title="Attached servers" [count]="attached().length" [flush]="true">
      @if (attached().length === 0) {
        <fl-empty-state
          icon="lucideServer"
          title="No servers attached"
          [body]="vnet().subnets.length ? 'Attach one from the subnet actions.' : undefined"
          [compact]="true"
        />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense" data-testid="vnet-attached-servers">
            <thead>
              <tr>
                <th scope="col">Server</th>
                <th scope="col">Server ID</th>
                <th scope="col">Subnet</th>
                <th scope="col">Status</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (row of attached(); track row.subnet.id + row.serverId) {
                @let server = servers().get(row.serverId);
                <tr>
                  <td class="fl-cell-name font-medium">
                    {{ server?.displayName || server?.name || row.serverId }}
                  </td>
                  <td><fl-copy-id [value]="row.serverId" label="server ID" /></td>
                  <td class="fl-mono">{{ row.subnet.ipRange }}</td>
                  <td>
                    @if (server) {
                      <app-instance-status-badge [status]="server.status || 'unknown'" />
                    } @else {
                      <span class="fl-muted">—</span>
                    }
                  </td>
                  <td class="is-fit">
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      [disabled]="busy()"
                      [attr.aria-label]="'Detach ' + (server?.name || row.serverId)"
                      (click)="detach.emit(row)"
                    >
                      Detach
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>
  `,
})
export class VNetSubnetsPanel {
  readonly vnet = input.required<VNetInfo>();
  readonly servers = input<ReadonlyMap<string, InstanceWithLabels>>(new Map());
  readonly busy = input(false);
  readonly supportsSubnets = input(false);
  readonly attachingSubnetId = input<string | null>(null);

  readonly addSubnet = output<void>();
  readonly deleteSubnet = output<SubnetInfo>();
  readonly attach = output<SubnetInfo>();
  readonly cancelAttach = output<void>();
  readonly serverSelected = output<{ subnet: SubnetInfo; server: InstanceWithLabels }>();
  readonly detach = output<AttachedServerRow>();

  protected readonly subnetActions = computed<MenuAction[]>(() => [
    { id: 'attach', label: 'Attach server', disabled: this.busy() },
    {
      id: 'delete',
      label: 'Delete subnet',
      danger: true,
      disabled: this.busy(),
      separatorBefore: true,
    },
  ]);

  protected readonly attachingSubnet = computed(
    () => this.vnet().subnets.find((s) => s.id === this.attachingSubnetId()) ?? null,
  );

  protected readonly attached = computed<AttachedServerRow[]>(() =>
    this.vnet().subnets.flatMap((subnet) =>
      subnet.attachedServerIds.map((serverId) => ({ subnet, serverId })),
    ),
  );

  protected onSubnetAction(id: string, subnet: SubnetInfo): void {
    if (id === 'attach') this.attach.emit(subnet);
    if (id === 'delete') this.deleteSubnet.emit(subnet);
  }
}
