import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideNetwork,
  lucidePlus,
  lucideRefreshCw,
} from '@ng-icons/lucide';

import { ApplicationService } from '../../service/application.service';
import { ApplicationGatewayService } from '../../service/application-gateway.service';
import { GatewayMinRole, GatewayRoute } from '../../model/gateway-route.models';
import { isAddressOrCidr } from '../../../shared/utils/cidr-validator';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { GatewayRoutePolicies } from './gateway-route-policies';
import { GatewayAddRouteDialog } from './gateway-add-route-dialog';

const ROUTE_ACTIONS: MenuAction[] = [{ id: 'remove', label: 'Remove route', danger: true }];

@Component({
  selector: 'app-gateway-tab',
  imports: [
    FlPanel,
    FlTable,
    FlAlert,
    FlEmptyState,
    FlLoadingState,
    FlStatus,
    FlButton,
    FlIcon,
    FlActionsMenu,
    GatewayRoutePolicies,
    GatewayAddRouteDialog,
  ],
  providers: [
    provideIcons({
      lucideNetwork,
      lucidePlus,
      lucideRefreshCw,
      lucideChevronDown,
      lucideChevronRight,
    }),
  ],
  host: { class: 'fl-stack' },
  template: `
    @if (error()) {
      <fl-alert tone="error" title="Gateway request failed">{{ error() }}</fl-alert>
    }

    <fl-panel title="Routes" [count]="loading() ? null : routes().length" [flush]="true">
      <ng-container panelActions>
        <button flButton size="sm" type="button" (click)="refresh()">
          <fl-icon name="lucideRefreshCw" />
          Refresh
        </button>
        <button flButton="primary" size="sm" type="button" (click)="openAdd()">
          <fl-icon name="lucidePlus" />
          Add route
        </button>
      </ng-container>

      @if (loading()) {
        <fl-loading-state [rows]="2" />
      } @else if (routes().length === 0) {
        <fl-empty-state
          icon="lucideNetwork"
          title="No routes yet"
          body="Add a route to expose this application on a hostname with SSO, rate limit and IP filter policies."
        />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col" class="is-fit"><span class="fl-sr">Details</span></th>
                <th scope="col">Host</th>
                <th scope="col">Path</th>
                <th scope="col">TLS</th>
                <th scope="col">Policies</th>
                <th scope="col">Status</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (route of routes(); track route.endpointId) {
                @let open = expandedId() === route.endpointId;
                <tr class="cursor-pointer" [class.is-selected]="open" (click)="toggleExpand(route)">
                  <td class="is-fit">
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      [iconOnly]="true"
                      [attr.aria-expanded]="open"
                      [attr.aria-label]="
                        (open ? 'Hide policies for ' : 'Edit policies for ') + route.host
                      "
                      (click)="$event.stopPropagation(); toggleExpand(route)"
                    >
                      <fl-icon [name]="open ? 'lucideChevronDown' : 'lucideChevronRight'" />
                    </button>
                  </td>
                  <td class="fl-mono">{{ route.host }}</td>
                  <td class="fl-mono">{{ route.path }}</td>
                  <td>
                    <fl-status
                      [tone]="route.tlsEnabled ? 'success' : 'neutral'"
                      [label]="route.tlsEnabled ? 'HTTPS' : route.certificateStatus || 'HTTP'"
                    />
                  </td>
                  <td class="text-fl-ink-secondary">{{ policySummary(route) }}</td>
                  <td>
                    <fl-status [tone]="statusTone(route)" [label]="statusLabel(route)" />
                  </td>
                  <td class="is-fit" (click)="$event.stopPropagation()">
                    <div class="flex items-center justify-end gap-1">
                      <button
                        flButton
                        size="sm"
                        type="button"
                        title="Reconcile now"
                        (click)="reconcile(route)"
                      >
                        Reconcile
                      </button>
                      <fl-actions-menu
                        label="Route actions"
                        [compact]="true"
                        [items]="routeActions"
                        (action)="confirmDelete(route)"
                      />
                    </div>
                  </td>
                </tr>
                @if (open) {
                  <tr>
                    <td colspan="7" class="whitespace-normal">
                      <app-gateway-route-policies
                        [(sso)]="fSso"
                        [(minRole)]="fMinRole"
                        [(average)]="fAverage"
                        [(burst)]="fBurst"
                        [(period)]="fPeriod"
                        [(allowIps)]="fAllowIps"
                        [invalidAllowIps]="invalidAllowIps()"
                        [saving]="saving()"
                        [errorMessage]="route.errorMessage"
                        (save)="savePolicies(route)"
                      />
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>

    @if (addOpen()) {
      <app-gateway-add-route-dialog
        [(host)]="fHost"
        [(path)]="fPath"
        [(tls)]="fTls"
        [formError]="formError()"
        [saving]="saving()"
        (cancelled)="addOpen.set(false)"
        (submitted)="submitAdd()"
      />
    }
  `,
})
export class AppGatewayTabComponent implements OnInit, OnDestroy {
  private readonly appService = inject(ApplicationService);
  private readonly gatewayService = inject(ApplicationGatewayService);
  private readonly confirmService = inject(ConfirmService);

  readonly routes = this.gatewayService.routes;
  readonly loading = this.gatewayService.loading;
  readonly saving = this.gatewayService.saving;
  readonly error = this.gatewayService.error;

  readonly expandedId = signal<string | null>(null);
  readonly addOpen = signal(false);
  readonly pendingDelete = signal<GatewayRoute | null>(null);
  readonly formError = signal<string | null>(null);
  readonly routeActions = ROUTE_ACTIONS;

  readonly fSso = signal(false);
  readonly fMinRole = signal<'' | GatewayMinRole>('');
  readonly fAverage = signal(0);
  readonly fBurst = signal(0);
  readonly fPeriod = signal('1s');
  readonly fAllowIps = signal('');
  readonly invalidAllowIps = computed(() =>
    this.allowIpLines().filter((ip) => !isAddressOrCidr(ip)),
  );

  readonly fHost = signal('');
  readonly fPath = signal('');
  readonly fTls = signal(true);

  private appId(): string | null {
    return this.appService.selectedApplication()?.id ?? null;
  }

  ngOnInit(): void {
    void (async () => {
      const id = this.appId();
      if (id) await this.gatewayService.loadForApp(id);
    })();
  }

  ngOnDestroy(): void {
    this.gatewayService.reset();
  }

  async refresh(): Promise<void> {
    const id = this.appId();
    if (id) await this.gatewayService.loadForApp(id);
  }

  toggleExpand(route: GatewayRoute): void {
    if (this.expandedId() === route.endpointId) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(route.endpointId);
    this.fSso.set(!!route.auth?.sso);
    this.fMinRole.set(route.auth?.minRole ?? '');
    this.fAverage.set(route.rateLimit?.average ?? 0);
    this.fBurst.set(route.rateLimit?.burst ?? 0);
    this.fPeriod.set(route.rateLimit?.period ?? '1s');
    this.fAllowIps.set((route.allowIps ?? []).join('\n'));
  }

  async savePolicies(route: GatewayRoute): Promise<void> {
    const id = this.appId();
    if (!id) return;
    const allowIps = this.allowIpLines();
    if (allowIps.some((ip) => !isAddressOrCidr(ip))) return;
    const average = Number(this.fAverage()) || 0;
    const burst = Number(this.fBurst()) || 0;
    const updated = await this.gatewayService.setPolicy(id, route.endpointId, {
      auth: this.fSso() ? { sso: true, minRole: this.fMinRole() || undefined } : null,
      rateLimit:
        average > 0
          ? {
              average,
              burst: burst > 0 ? burst : undefined,
              period: this.fPeriod(),
            }
          : null,
      allowIps: allowIps.length ? allowIps : null,
    });
    if (updated) this.expandedId.set(null);
  }

  private allowIpLines(): string[] {
    return this.fAllowIps()
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  openAdd(): void {
    this.formError.set(null);
    this.fHost.set('');
    this.fPath.set('');
    this.fTls.set(true);
    this.addOpen.set(true);
  }

  async submitAdd(): Promise<void> {
    const id = this.appId();
    if (!id) return;
    const host = this.fHost().trim().toLowerCase();
    if (!host?.includes('.')) {
      this.formError.set('A fully-qualified hostname is required.');
      return;
    }
    const path = this.fPath().trim();
    if (path && !path.startsWith('/')) {
      this.formError.set('Path must start with "/".');
      return;
    }
    this.formError.set(null);
    const created = await this.gatewayService.addRoute(id, {
      host,
      path: path || undefined,
      certificateRequired: this.fTls(),
    });
    if (created) this.addOpen.set(false);
  }

  async confirmDelete(route: GatewayRoute): Promise<void> {
    this.pendingDelete.set(route);
    const ok = await this.confirmService.confirm({
      title: `Remove ${route.host}?`,
      body: 'Its DNS record, TLS certificate and edge policies are cleaned up and the hostname stops serving this app.',
      confirmLabel: 'Remove route',
      destructive: true,
    });
    if (ok) await this.executeDelete();
    this.pendingDelete.set(null);
  }

  async executeDelete(): Promise<void> {
    const id = this.appId();
    const route = this.pendingDelete();
    if (!id || !route) return;
    const ok = await this.gatewayService.removeRoute(id, route.endpointId);
    if (ok) this.pendingDelete.set(null);
  }

  async reconcile(route: GatewayRoute): Promise<void> {
    const id = this.appId();
    if (id) await this.gatewayService.reconcile(id, route.endpointId);
  }

  statusLabel(route: GatewayRoute): string {
    const status = (route.reconciliationStatus || '').toLowerCase();
    if (status === 'in_sync') return 'Synced';
    if (status === 'error') return 'Failed';
    return 'Reconciling';
  }

  statusTone(route: GatewayRoute): StatusTone {
    const status = (route.reconciliationStatus || '').toLowerCase();
    if (status === 'in_sync') return 'success';
    if (status === 'error') return 'error';
    return 'progress';
  }

  policySummary(route: GatewayRoute): string {
    const parts: string[] = [];
    if (route.auth?.sso) {
      const role = route.auth.minRole ? ', ' + route.auth.minRole : '';
      parts.push(`SSO${role}`);
    }
    if (route.rateLimit?.average) {
      parts.push(`${route.rateLimit.average} req/${route.rateLimit.period || '1s'}`);
    }
    if (route.allowIps?.length) parts.push(`${route.allowIps.length} IP ranges`);
    return parts.length ? parts.join(' · ') : 'Public, no policies';
  }
}
