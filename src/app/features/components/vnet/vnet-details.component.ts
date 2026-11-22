import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';

import { VNetService } from '../../service/vnet.service';
import {
  AddSubnetConfiguration,
  SubnetInfo,
  getAllAttachedServerIds,
} from '../../model/vnet.models';
import { VirtualInstancesService } from '../../../core/api/api/virtualInstances.service';
import { InstanceWithLabels } from '../../model/instance.models';
import { ProviderWizardService } from '../../../shared/services/provider-wizard.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import {
  VNetDetailSurfaceInput,
  VNetDetailSurfaceRevision,
  buildVNetDetailSurface,
  presentedContent,
} from './vnet-details-surface';
import { vnetProviderLabel, vnetStatus } from './vnet-status';
import { AttachedServerRow, VNetSubnetsPanel } from './vnet-subnets-panel';
import { VNetAddSubnetDialog } from './vnet-add-subnet-dialog';

@Component({
  selector: 'vnet-details',
  imports: [
    DatePipe,
    MaskIdPipe,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlCopyId,
    FlKeyValue,
    FlKvItem,
    FlLoadingState,
    FlActionsMenu,
    FlStatus,
    FlTag,
    FlButton,
    FlIcon,
    VNetSubnetsPanel,
    VNetAddSubnetDialog,
  ],
  providers: [provideIcons({ lucideRefreshCw })],
  template: `
    <div class="fl-page">
      @if (vnet(); as v) {
        @let st = status();
        <fl-page-header [title]="v.name" [breadcrumb]="breadcrumb()">
          <fl-status headerStatus [tone]="st.tone" [label]="st.label" />
          <fl-copy-id headerMeta [value]="v.id" [display]="v.id | maskId" label="network ID" />
          <span headerMeta>{{ providerLabel() }}</span>
          <span headerMeta class="fl-mono">{{ v.ipRange }}</span>
          <ng-container headerActions>
            <button flButton type="button" [disabled]="isLoading()" (click)="syncVNet()">
              <fl-icon name="lucideRefreshCw" />
              Sync
            </button>
            <fl-actions-menu
              label="Actions"
              [items]="moreActions()"
              data-testid="vnet-more-actions"
              (action)="showDeleteConfirmation()"
            />
          </ng-container>
        </fl-page-header>
      } @else {
        <fl-page-header title="Network" [breadcrumb]="breadcrumb()" />
      }

      @if (errorMessage()) {
        <fl-alert tone="error" title="Could not complete the request">{{
          errorMessage()
        }}</fl-alert>
      }

      @if (isLoading() && !vnet()) {
        <fl-panel><fl-loading-state [rows]="6" /></fl-panel>
      }

      @if (vnet(); as v) {
        <div class="fl-stack">
          <fl-panel title="Details">
            <fl-key-value>
              <fl-kv-item key="Network ID">
                <fl-copy-id [value]="v.id" label="network ID" />
              </fl-kv-item>
              <fl-kv-item key="Provider resource ID">
                @if (v.providerResourceId) {
                  <fl-copy-id [value]="v.providerResourceId" label="provider resource ID" />
                } @else {
                  <span class="fl-muted">—</span>
                }
              </fl-kv-item>
              <fl-kv-item key="Provider">{{ providerLabel() }}</fl-kv-item>
              <fl-kv-item key="IP range" [mono]="true">{{ v.ipRange }}</fl-kv-item>
              <fl-kv-item key="Subnets">{{ v.subnets.length }}</fl-kv-item>
              <fl-kv-item key="Attached servers">{{ getAllAttachedServers() }}</fl-kv-item>
              <fl-kv-item key="Created">{{ v.createdAt | date: 'medium' }}</fl-kv-item>
              @if (v.labels.length > 0) {
                <fl-kv-item key="Labels">
                  <span class="fl-row">
                    @for (label of v.labels; track label.key) {
                      <fl-tag>{{ label.key }}: {{ label.value }}</fl-tag>
                    }
                  </span>
                </fl-kv-item>
              }
            </fl-key-value>
          </fl-panel>

          <app-vnet-subnets-panel
            [vnet]="v"
            [servers]="serversCache()"
            [busy]="isLoading()"
            [supportsSubnets]="supportsSubnets()"
            [attachingSubnetId]="showAttachServerForm()"
            (addSubnet)="showAddSubnetForm()"
            (deleteSubnet)="confirmDeleteSubnet($event)"
            (attach)="showAttachServerToSubnet($event)"
            (cancelAttach)="cancelAttachServer()"
            (serverSelected)="onServerSelected($event.subnet, $event.server)"
            (detach)="onDetach($event)"
          />
        </div>

        @if (showSubnetForm() && supportsSubnets()) {
          <app-vnet-add-subnet-dialog
            [zones]="vnetTopologyZones()"
            [constraints]="subnetIpConstraints()"
            [busy]="isLoading()"
            (cancelled)="cancelAddSubnet()"
            (submitted)="addSubnet($event)"
          />
        }
      }
    </div>
  `,
})
export class VNetDetailsComponent implements OnInit, OnDestroy {
  private readonly vnetService = inject(VNetService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly instancesApi = inject(VirtualInstancesService);
  private readonly providerWizardService = inject(ProviderWizardService);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly confirmService = inject(ConfirmService);
  private readonly surfaceRevision = new VNetDetailSurfaceRevision();

  readonly vnet = this.vnetService.selectedVNet;
  readonly isLoading = this.vnetService.loading;
  readonly errorMessage = this.vnetService.errorMessage;

  readonly surface = computed(() => {
    const input: VNetDetailSurfaceInput = {
      vnet: this.vnet(),
      totalAttachedServers: this.getAllAttachedServers(),
      attachedInstances: Array.from(this.serversCache().values()),
    };
    const content = presentedContent(input);
    if (!content) return null;
    return buildVNetDetailSurface(input, {
      revision: this.surfaceRevision.next(content),
      generatedAt: new Date().toISOString(),
    });
  });

  protected readonly status = computed(() => vnetStatus(this.vnet()?.status ?? ''));

  protected readonly providerLabel = computed(() => {
    const v = this.vnet();
    if (!v) return '';
    return vnetProviderLabel(
      v,
      (id) => this.providerWizardService.getProviderDefinition(id)?.displayName,
    );
  });

  protected readonly breadcrumb = computed<Crumb[]>(() => [
    { label: 'Networks', link: '/infrastructure/vnet' },
    { label: this.vnet()?.name ?? 'Network' },
  ]);

  protected readonly moreActions = computed<MenuAction[]>(() => [
    { id: 'delete', label: 'Delete network', danger: true, disabled: this.isLoading() },
  ]);

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  readonly vnetTopology = computed(() => {
    const provider = this.vnet()?.provider;
    if (!provider) return null;
    return (
      this.providerWizardService.getProviderDefinition(provider)?.capabilities?.vnetTopology ?? null
    );
  });

  readonly supportsSubnets = computed(() => this.vnetTopology()?.supportsSubnets ?? false);

  readonly vnetTopologyZones = computed(() => this.vnetTopology()?.zones ?? []);

  readonly subnetIpConstraints = computed(() => this.vnetTopology()?.subnetIpRange ?? null);

  showSubnetForm = signal(false);
  showDeleteModal = signal(false);
  deleteTarget = signal<'vnet' | 'subnet'>('vnet');
  deleteTargetSubnet = signal<SubnetInfo | null>(null);
  showAttachServerForm = signal<string | null>(null);
  serversCache = signal<Map<string, InstanceWithLabels>>(new Map());

  deleteConfirmMessage = computed(() => {
    const detached = (n: number) => {
      if (n <= 0) return '';
      const noun = n === 1 ? 'server' : 'servers';
      return ` ${n} attached ${noun} will be detached.`;
    };
    if (this.deleteTarget() === 'vnet') {
      const vnet = this.vnet();
      if (!vnet) return '';
      return `This deletes ${vnet.name} at the provider. It cannot be undone.${detached(
        getAllAttachedServerIds(vnet).length,
      )}`;
    }
    const subnet = this.deleteTargetSubnet();
    if (!subnet) return '';
    return `This deletes subnet ${subnet.ipRange}. It cannot be undone.${detached(
      subnet.attachedServerIds.length,
    )}`;
  });

  ngOnInit() {
    const vnetId = this.route.snapshot.paramMap.get('id');
    if (vnetId) {
      this.loadVNet(vnetId);
    } else {
      this.router.navigate(['/infrastructure/vnet']);
    }
  }

  async loadVNet(id: string) {
    try {
      await Promise.all([this.vnetService.getVNet(id), this.providerWizardService.loadProviders()]);
      await this.loadServers();
    } catch (error) {
      console.error('Failed to load VNet:', error);
    }
  }

  async loadServers() {
    const vnet = this.vnet();
    if (!vnet) return;

    try {
      const allServerIds = getAllAttachedServerIds(vnet);
      if (allServerIds.length === 0) return;

      const response = await firstValueFrom(
        this.instancesApi.instancesControllerFindAll(
          undefined,
          undefined,
          undefined,
          vnet.provider,
        ),
      );

      const servers = (response.data || []) as InstanceWithLabels[];
      const cache = new Map<string, InstanceWithLabels>();
      servers.forEach((server) => {
        if (server.id) {
          cache.set(server.id, server);
        }
      });
      this.serversCache.set(cache);
    } catch (error) {
      console.error('Failed to load servers:', error);
    }
  }

  async syncVNet() {
    const vnet = this.vnet();
    if (!vnet) return;

    try {
      await this.vnetService.syncVNet(vnet.id);
    } catch (error) {
      console.error('Failed to sync VNet:', error);
    }
  }

  goBack() {
    this.router.navigate(['/infrastructure/vnet']);
  }

  showAddSubnetForm() {
    this.showSubnetForm.set(true);
  }

  cancelAddSubnet() {
    this.showSubnetForm.set(false);
  }

  async addSubnet(config: AddSubnetConfiguration) {
    const vnet = this.vnet();
    if (!vnet || !config.networkZone) return;

    try {
      await this.vnetService.addSubnet(vnet.id, config);

      this.showSubnetForm.set(false);
    } catch (error) {
      console.error('Failed to add subnet:', error);
    }
  }

  async confirmDeleteSubnet(subnet: SubnetInfo) {
    this.deleteTarget.set('subnet');
    this.deleteTargetSubnet.set(subnet);
    await this.askDelete(`Delete subnet ${subnet.ipRange}`, 'Delete subnet');
  }

  async showDeleteConfirmation() {
    this.deleteTarget.set('vnet');
    this.deleteTargetSubnet.set(null);
    await this.askDelete(`Delete ${this.vnet()?.name ?? 'network'}`, 'Delete network');
  }

  private async askDelete(title: string, confirmLabel: string) {
    this.showDeleteModal.set(true);
    const confirmed = await this.confirmService.confirm({
      title,
      body: this.deleteConfirmMessage(),
      confirmLabel,
      destructive: true,
    });
    if (confirmed) await this.confirmDelete();
    else this.cancelDelete();
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
    this.deleteTarget.set('vnet');
    this.deleteTargetSubnet.set(null);
  }

  async confirmDelete() {
    if (this.deleteTarget() === 'vnet') {
      await this.deleteVNet();
    } else {
      await this.deleteSubnet();
    }
  }

  async deleteVNet() {
    const vnet = this.vnet();
    if (!vnet) return;

    try {
      await this.vnetService.deleteVNet(vnet.id);
      this.showDeleteModal.set(false);
      this.router.navigate(['/infrastructure/vnet']);
    } catch (error) {
      console.error('Failed to delete VNet:', error);
      this.showDeleteModal.set(false);
    }
  }

  async deleteSubnet() {
    const vnet = this.vnet();
    const subnet = this.deleteTargetSubnet();
    if (!vnet || !subnet?.providerSubnetId) return;

    try {
      await this.vnetService.deleteSubnet(vnet.id, subnet.providerSubnetId);
      this.showDeleteModal.set(false);
      this.deleteTargetSubnet.set(null);
    } catch (error) {
      console.error('Failed to delete subnet:', error);
      this.showDeleteModal.set(false);
    }
  }

  showAttachServerToSubnet(subnet: SubnetInfo) {
    this.showAttachServerForm.set(subnet.id);
  }

  cancelAttachServer() {
    this.showAttachServerForm.set(null);
  }

  async onServerSelected(subnet: SubnetInfo, server: InstanceWithLabels) {
    if (!server.id) return;

    try {
      await this.vnetService.attachServerToSubnet(subnet.id, {
        serverId: server.id,
      });

      await this.loadServers();

      this.showAttachServerForm.set(null);
    } catch (error) {
      console.error('Failed to attach server:', error);
    }
  }

  async detachServer(subnet: SubnetInfo, serverId: string) {
    try {
      await this.vnetService.detachServerFromSubnet(subnet.id, {
        serverId,
      });

      await this.loadServers();
    } catch (error) {
      console.error('Failed to detach server:', error);
    }
  }

  onDetach(row: AttachedServerRow) {
    void this.detachServer(row.subnet, row.serverId);
  }

  getServer(serverId: string): InstanceWithLabels | null {
    return this.serversCache().get(serverId) || null;
  }

  getServerName(serverId: string): string | null {
    const server = this.getServer(serverId);
    return server ? server.displayName || server.name || null : null;
  }

  getAllAttachedServers(): number {
    const vnet = this.vnet();
    return vnet ? getAllAttachedServerIds(vnet).length : 0;
  }
}
