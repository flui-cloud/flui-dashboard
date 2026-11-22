import { SandboxService } from '../../../core/services/sandbox.service';
import {
  Component,
  OnDestroy,
  OnInit,
  effect,
  inject,
  input,
  signal,
  computed,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { DashboardDnsService, AppDnsInfo } from '../../service/dashboard-dns.service';
import { DnsSetupWizardComponent } from './dns-setup-wizard.component';
import { NotificationService } from '../../../core/services/notification.service';

export const CERT_ACTION_KEY = 'open-cert-wizard';

interface AppRow {
  label: string;
  key: 'fluiApi' | 'fluiWeb' | 'zitadel';
}

const ALL_APP_ROWS: AppRow[] = [
  { label: 'Flui API', key: 'fluiApi' },
  { label: 'Flui Web', key: 'fluiWeb' },
  { label: 'Zitadel', key: 'zitadel' },
];

@Component({
  selector: 'app-dashboard-certs',
  imports: [
    NgTemplateOutlet,
    DnsSetupWizardComponent,
    FlPanel,
    FlTable,
    FlStatus,
    FlAlert,
    FlButton,
    FlActionsMenu,
    FlLoadingState,
    FlEmptyState,
  ],
  template: `
    @if (showWizard()) {
      <app-dns-setup-wizard (closed)="showWizard.set(false)" />
    }

    @if (firstStep() && dnsService.hasStatus() && dnsService.needsSetup()) {
      <fl-panel title="Endpoints and certificates" [flush]="true" data-testid="certs-first-step">
        <div class="p-4">
          <fl-alert tone="warning" title="DNS not configured">
            Set up DNS zones and certificates to make your apps reachable from the internet. This is
            the first step of a new installation.
            <button
              alertActions
              flButton="primary"
              size="sm"
              type="button"
              (click)="showWizard.set(true)"
            >
              Set up DNS and certificates
            </button>
          </fl-alert>
        </div>
        <ng-container *ngTemplateOutlet="endpoints" />
      </fl-panel>
    } @else {
      <fl-panel
        title="Endpoints and certificates"
        [flush]="dnsService.hasStatus() && !dnsService.needsSetup() && !dnsService.loading()"
        data-testid="certs-card"
      >
        <ng-container panelActions>
          @if (dnsService.hasStatus() && !dnsService.needsSetup()) {
            <span class="fl-toolbar__info" data-testid="certs-subtitle">{{ subtitle() }}</span>
          }
          <fl-actions-menu
            label="Endpoint actions"
            [compact]="true"
            [items]="menuItems()"
            (action)="onAction($event)"
          />
        </ng-container>

        @if (dnsService.loading()) {
          <fl-loading-state [rows]="3" />
        } @else if (!dnsService.hasStatus()) {
          <fl-empty-state
            [compact]="true"
            title="No cluster available"
            body="Create a cluster to configure DNS."
          />
        } @else if (dnsService.needsSetup()) {
          <fl-alert tone="warning" title="DNS not configured">
            Set up DNS zones and certificates to make your apps reachable from the internet.
            <button alertActions flButton size="sm" type="button" (click)="showWizard.set(true)">
              Set up DNS and certificates
            </button>
          </fl-alert>
        } @else {
          <ng-container *ngTemplateOutlet="endpoints" />
        }
      </fl-panel>
    }

    <ng-template #endpoints>
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Endpoint</th>
              <th scope="col" class="is-fit">Certificate</th>
            </tr>
          </thead>
          <tbody>
            @for (row of appRows(); track row.key) {
              @let app = dnsService.status()?.[row.key] ?? null;
              <tr data-testid="certs-row">
                <td class="whitespace-normal">
                  <div class="flex flex-col">
                    <span>{{ row.label }}</span>
                    <span class="fl-mono break-all text-fl-ink-muted">{{
                      app?.domain || '—'
                    }}</span>
                  </div>
                </td>
                <td>
                  <fl-status
                    [tone]="certTone(app)"
                    [label]="certLabel(app)"
                    [attr.title]="app?.certMessage || null"
                  />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </ng-template>
  `,
})
export class DashboardCertsComponent implements OnInit, OnDestroy {
  readonly firstStep = input(false);

  protected dnsService = inject(DashboardDnsService);
  private readonly notifService = inject(NotificationService);
  private readonly sandbox = inject(SandboxService);
  protected showWizard = signal(false);
  protected appRows = computed(() =>
    ALL_APP_ROWS.filter(
      (row) => row.key !== 'zitadel' || this.dnsService.status()?.zitadel !== null,
    ),
  );

  protected readonly subtitle = computed(() => {
    if (!this.dnsService.hasStatus() || this.dnsService.needsSetup()) return '';
    const status = this.dnsService.status()!;
    const rows = this.appRows();
    const synced = rows.filter((row) => status[row.key]?.isComplete).length;
    return `${synced} of ${rows.length} synced`;
  });

  constructor() {
    // Watch cert status — add notification when incomplete, remove when fully configured
    effect(() => {
      const hasStatus = this.dnsService.hasStatus();
      const fullyConfigured = this.dnsService.isFullyConfigured();

      // The platform's own names are not a demo guest's to configure.
      if (!hasStatus || this.sandbox.inSandbox()) return;

      if (fullyConfigured) {
        // Fully configured — remove the pending notification
        this.notifService.removeByCategory('cert-setup');
      } else if (!this.notifService.hasCategory('cert-setup')) {
        this.notifService.add({
          title: 'SSL certificates not configured',
          body: 'DNS and SSL certificates are not yet set up. Your apps are not publicly accessible.',
          category: 'cert-setup',
          type: 'warning',
          source: 'system',
          ttl: null, // permanent until resolved
          action: { label: 'Configure now', key: CERT_ACTION_KEY },
        });
      }
    });
  }

  ngOnInit(): void {
    this.notifService.registerAction(CERT_ACTION_KEY, () => {
      this.showWizard.set(true);
    });
  }

  ngOnDestroy(): void {
    this.notifService.unregisterAction(CERT_ACTION_KEY);
  }

  protected refresh(): void {
    this.dnsService.refresh();
  }

  private readonly router = inject(Router);

  protected readonly menuItems = computed<MenuAction[]>(() => {
    const ready = this.dnsService.hasStatus() && !this.dnsService.needsSetup();
    return [
      ...(ready ? [{ id: 'manage', label: 'Manage DNS' }] : []),
      { id: 'configure', label: 'Configure DNS and certificates' },
      {
        id: 'refresh',
        label: 'Refresh',
        disabled: this.dnsService.loading(),
        separatorBefore: true,
      },
    ];
  });

  protected onAction(id: string): void {
    if (id === 'manage')
      void this.router.navigate(['/cluster', this.dnsService.targetClusterId(), 'dns']);
    if (id === 'configure') this.showWizard.set(true);
    if (id === 'refresh') this.refresh();
  }

  protected certTone(app: AppDnsInfo | null): StatusTone {
    if (!app?.endpointId) return 'neutral';
    if (app.isComplete) return 'success';
    if (app.certStatus === 'failed' || app.certStatus === 'expired') return 'error';
    return 'progress';
  }

  protected certLabel(app: AppDnsInfo | null): string {
    if (!app?.endpointId) return 'Not configured';
    if (app.isComplete) return 'Valid';
    if (!app.synced && !app.lastSyncedAt) return 'Pending sync';
    if (app.synced && app.syncedDomain !== app.domain) return 'Domain changed';
    if (app.prodCertConfigured) return 'Certificate issued';
    if (app.stagingCertConfigured) return 'Staging certificate';
    if (app.certStatus === 'issuing') return 'Issuing';
    if (app.certStatus === 'failed') return 'Failed';
    if (app.certStatus === 'expired') return 'Expired';
    return 'In progress';
  }
}
