import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideCircleAlert,
  lucideLoader,
  lucideLock,
  lucideNetwork,
  lucidePlus,
  lucideRefreshCw,
  lucideTrash2,
} from '@ng-icons/lucide';

import { ApplicationService } from '../../service/application.service';
import { ApplicationGatewayService } from '../../service/application-gateway.service';
import {
  GatewayMinRole,
  GatewayRoute,
} from '../../model/gateway-route.models';

@Component({
  selector: 'app-gateway-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideNetwork,
      lucidePlus,
      lucideTrash2,
      lucideRefreshCw,
      lucideLoader,
      lucideCircleAlert,
      lucideLock,
      lucideChevronDown,
      lucideChevronRight,
    }),
  ],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Gateway</h2>
          <p class="text-sm text-muted-foreground">
            Routes into this app and their edge policies: SSO, rate limit, IP
            filter.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted"
            (click)="refresh()"
          >
            <ng-icon name="lucideRefreshCw" class="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
            (click)="openAdd()"
          >
            <ng-icon name="lucidePlus" class="h-4 w-4" />
            Add route
          </button>
        </div>
      </div>

      @if (error()) {
        <div
          class="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300"
        >
          <ng-icon name="lucideCircleAlert" class="h-4 w-4 mt-0.5" />
          <span>{{ error() }}</span>
        </div>
      }

      @if (loading()) {
        <div class="card-inner p-4 space-y-2">
          <div class="skeleton h-6 w-full"></div>
          <div class="skeleton h-6 w-full"></div>
        </div>
      } @else if (routes().length === 0) {
        <div class="card-inner p-8 text-center">
          <ng-icon
            name="lucideNetwork"
            class="h-8 w-8 mx-auto text-muted-foreground"
          />
          <p class="mt-2 text-sm font-medium">No routes yet</p>
          <p class="text-sm text-muted-foreground">
            Add a route to expose this application on a hostname with edge
            policies.
          </p>
        </div>
      } @else {
        <div class="card-inner overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr
                class="text-left text-muted-foreground border-b border-border"
              >
                <th class="py-2 px-3 font-medium w-8"></th>
                <th class="py-2 px-3 font-medium">Host</th>
                <th class="py-2 px-3 font-medium">Path</th>
                <th class="py-2 px-3 font-medium">TLS</th>
                <th class="py-2 px-3 font-medium">Policies</th>
                <th class="py-2 px-3 font-medium">Status</th>
                <th class="py-2 px-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (route of routes(); track route.endpointId) {
                <tr
                  class="border-b border-border/60 cursor-pointer hover:bg-muted/30"
                  (click)="toggleExpand(route)"
                >
                  <td class="py-2 px-3">
                    <ng-icon
                      [name]="
                        expandedId() === route.endpointId
                          ? 'lucideChevronDown'
                          : 'lucideChevronRight'
                      "
                      class="h-4 w-4 text-muted-foreground"
                    />
                  </td>
                  <td class="py-2 px-3 font-mono text-xs font-medium">
                    {{ route.host }}
                  </td>
                  <td class="py-2 px-3 font-mono text-xs">{{ route.path }}</td>
                  <td class="py-2 px-3">
                    <span
                      class="text-xs px-2 py-0.5 rounded-full"
                      [class]="
                        route.tlsEnabled
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-muted text-muted-foreground'
                      "
                    >
                      {{ route.tlsEnabled ? 'https' : (route.certificateStatus || 'http') }}
                    </span>
                  </td>
                  <td class="py-2 px-3">
                    <div class="flex items-center gap-1 flex-wrap">
                      @if (route.auth?.sso) {
                        <span
                          class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        >
                          <ng-icon name="lucideLock" class="h-3 w-3" />
                          SSO{{ route.auth?.minRole ? ' · ' + route.auth?.minRole : '' }}
                        </span>
                      }
                      @if (route.rateLimit?.average) {
                        <span
                          class="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                        >
                          {{ route.rateLimit?.average }} req/{{ route.rateLimit?.period || '1s' }}
                        </span>
                      }
                      @if (route.allowIps?.length) {
                        <span
                          class="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        >
                          {{ route.allowIps?.length }} IP range(s)
                        </span>
                      }
                      @if (!route.auth?.sso && !route.rateLimit?.average && !route.allowIps?.length) {
                        <span class="text-xs text-muted-foreground">public · no policies</span>
                      }
                    </div>
                  </td>
                  <td class="py-2 px-3">
                    <span
                      class="text-xs px-2 py-0.5 rounded-full"
                      [class]="statusClass(route)"
                    >
                      {{ statusLabel(route) }}
                    </span>
                  </td>
                  <td class="py-2 px-3">
                    <div
                      class="flex items-center justify-end gap-1"
                      (click)="$event.stopPropagation()"
                    >
                      <button
                        type="button"
                        class="px-2 py-1 text-xs rounded-md hover:bg-muted"
                        title="Reconcile now"
                        (click)="reconcile(route)"
                      >
                        Reconcile
                      </button>
                      <button
                        type="button"
                        class="p-1.5 rounded-md hover:bg-muted text-red-600"
                        title="Remove route"
                        (click)="confirmDelete(route)"
                      >
                        <ng-icon name="lucideTrash2" class="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                @if (expandedId() === route.endpointId) {
                  <tr class="border-b border-border/60 bg-muted/20">
                    <td colspan="7" class="p-4">
                      @if (route.errorMessage) {
                        <div
                          class="mb-3 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-2 text-xs text-red-700 dark:text-red-300"
                        >
                          {{ route.errorMessage }}
                        </div>
                      }
                      <div class="grid gap-4 md:grid-cols-3">
                        <!-- Authentication -->
                        <div class="rounded-md border border-border bg-background p-4 space-y-3">
                          <h4 class="text-sm font-semibold flex items-center gap-2">
                            <ng-icon name="lucideLock" class="h-4 w-4" />
                            Authentication
                          </h4>
                          <label class="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              [ngModel]="fSso()"
                              (ngModelChange)="fSso.set($event)"
                            />
                            Require Flui SSO login
                          </label>
                          <label class="block space-y-1">
                            <span class="text-xs text-muted-foreground">Minimum role</span>
                            <select
                              class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-50"
                              [disabled]="!fSso()"
                              [ngModel]="fMinRole()"
                              (ngModelChange)="fMinRole.set($event)"
                            >
                              <option value="">Any authenticated user</option>
                              <option value="viewer">Viewer</option>
                              <option value="editor">Editor</option>
                              <option value="manager">Manager</option>
                            </select>
                          </label>
                        </div>

                        <!-- Rate limit -->
                        <div class="rounded-md border border-border bg-background p-4 space-y-3">
                          <h4 class="text-sm font-semibold">Rate limit</h4>
                          <label class="block space-y-1">
                            <span class="text-xs text-muted-foreground">Requests per period (0 = off)</span>
                            <input
                              type="number"
                              min="0"
                              class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                              [ngModel]="fAverage()"
                              (ngModelChange)="fAverage.set($event)"
                            />
                          </label>
                          <div class="grid grid-cols-2 gap-2">
                            <label class="block space-y-1">
                              <span class="text-xs text-muted-foreground">Burst</span>
                              <input
                                type="number"
                                min="0"
                                class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                [ngModel]="fBurst()"
                                (ngModelChange)="fBurst.set($event)"
                              />
                            </label>
                            <label class="block space-y-1">
                              <span class="text-xs text-muted-foreground">Period</span>
                              <select
                                class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                [ngModel]="fPeriod()"
                                (ngModelChange)="fPeriod.set($event)"
                              >
                                <option value="1s">1s</option>
                                <option value="1m">1m</option>
                                <option value="1h">1h</option>
                              </select>
                            </label>
                          </div>
                        </div>

                        <!-- IP filtering -->
                        <div class="rounded-md border border-border bg-background p-4 space-y-3">
                          <h4 class="text-sm font-semibold">IP filtering</h4>
                          <label class="block space-y-1">
                            <span class="text-xs text-muted-foreground">
                              Allowed CIDR ranges, one per line (empty = allow all)
                            </span>
                            <textarea
                              rows="4"
                              class="w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono"
                              placeholder="203.0.113.0/24"
                              [ngModel]="fAllowIps()"
                              (ngModelChange)="fAllowIps.set($event)"
                            ></textarea>
                          </label>
                        </div>
                      </div>

                      <div class="flex items-center justify-between mt-4">
                        <p class="text-xs text-muted-foreground">
                          Changes are applied to the cluster in the background
                          after saving.
                        </p>
                        <button
                          type="button"
                          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                          [disabled]="saving()"
                          (click)="savePolicies(route)"
                        >
                          @if (saving()) {
                            <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                          }
                          Save policies
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- Add route dialog -->
    @if (addOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <div
          class="bg-background rounded-lg border border-border shadow-xl max-w-md w-full p-6 space-y-4"
        >
          <h3 class="text-base font-semibold">Add route</h3>

          <label class="block space-y-1">
            <span class="text-sm font-medium">Host</span>
            <input
              class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-mono"
              placeholder="api.example.com"
              [ngModel]="fHost()"
              (ngModelChange)="fHost.set($event)"
            />
            <span class="text-xs text-muted-foreground">
              If the domain belongs to a cluster DNS zone, the record is
              created automatically; otherwise point your DNS at the cluster.
            </span>
          </label>

          <label class="block space-y-1">
            <span class="text-sm font-medium">Path prefix</span>
            <input
              class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-mono"
              placeholder="/"
              [ngModel]="fPath()"
              (ngModelChange)="fPath.set($event)"
            />
          </label>

          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              [ngModel]="fTls()"
              (ngModelChange)="fTls.set($event)"
            />
            Issue a TLS certificate (HTTPS)
          </label>

          @if (formError()) {
            <p class="text-sm text-red-600">{{ formError() }}</p>
          }

          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted"
              (click)="addOpen.set(false)"
            >
              Cancel
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              [disabled]="saving()"
              (click)="submitAdd()"
            >
              @if (saving()) {
                <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
              }
              Add route
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Delete confirm -->
    @if (pendingDelete()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <div
          class="bg-background rounded-lg border border-border shadow-xl max-w-md w-full p-6 space-y-4"
        >
          <h3 class="text-base font-semibold">Remove route</h3>
          <p class="text-sm text-muted-foreground">
            Remove "{{ pendingDelete()?.host }}"? Its DNS record, TLS
            certificate and edge policies are cleaned up and the hostname stops
            serving this app.
          </p>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted"
              (click)="pendingDelete.set(null)"
            >
              Cancel
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
              (click)="executeDelete()"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AppGatewayTabComponent implements OnInit, OnDestroy {
  private readonly appService = inject(ApplicationService);
  private readonly gatewayService = inject(ApplicationGatewayService);

  readonly routes = this.gatewayService.routes;
  readonly loading = this.gatewayService.loading;
  readonly saving = this.gatewayService.saving;
  readonly error = this.gatewayService.error;

  readonly expandedId = signal<string | null>(null);
  readonly addOpen = signal(false);
  readonly pendingDelete = signal<GatewayRoute | null>(null);
  readonly formError = signal<string | null>(null);

  // Policy editor state (bound to the expanded route)
  readonly fSso = signal(false);
  readonly fMinRole = signal<'' | GatewayMinRole>('');
  readonly fAverage = signal(0);
  readonly fBurst = signal(0);
  readonly fPeriod = signal('1s');
  readonly fAllowIps = signal('');

  // Add-route form state
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
    const allowIps = this.fAllowIps()
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const average = Number(this.fAverage()) || 0;
    const burst = Number(this.fBurst()) || 0;
    const updated = await this.gatewayService.setPolicy(id, route.endpointId, {
      auth: this.fSso()
        ? { sso: true, minRole: this.fMinRole() || undefined }
        : null,
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
    if (!host || !host.includes('.')) {
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

  confirmDelete(route: GatewayRoute): void {
    this.pendingDelete.set(route);
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
    if (status === 'in_sync') return 'synced';
    if (status === 'error') return 'error';
    return 'reconciling';
  }

  statusClass(route: GatewayRoute): string {
    const status = (route.reconciliationStatus || '').toLowerCase();
    if (status === 'in_sync') {
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    }
    if (status === 'error') {
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    }
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  }
}
