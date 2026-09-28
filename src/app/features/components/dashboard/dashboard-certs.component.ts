import { Component, OnDestroy, OnInit, effect, inject, input, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideShieldCheck,
  lucideShieldAlert,
  lucideGlobe,
  lucideArrowRight,
  lucideSettings,
  lucideCheckCircle,
  lucideAlertCircle,
  lucideCircleDashed,
  lucideRefreshCw,
} from '@ng-icons/lucide';
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
  standalone: true,
  imports: [RouterLink, NgIconComponent, DnsSetupWizardComponent],
  providers: [
    provideIcons({
      lucideShieldCheck,
      lucideShieldAlert,
      lucideGlobe,
      lucideArrowRight,
      lucideSettings,
      lucideCheckCircle,
      lucideAlertCircle,
      lucideCircleDashed,
      lucideRefreshCw,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (showWizard()) {
      <app-dns-setup-wizard (closed)="showWizard.set(false)" />
    }

    @if (firstStep() && dnsService.hasStatus() && dnsService.needsSetup()) {
      <section class="card-surface p-6 grid grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6 items-center" data-testid="certs-first-step">
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2.5">
            <div class="icon-chip icon-chip-sm chip-warn">
              <ng-icon name="lucideShieldAlert" class="h-4 w-4" />
            </div>
            <span class="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Certificates &amp; DNS · first step</span>
          </div>
          <h2 class="text-xl font-semibold text-foreground">DNS not configured</h2>
          <p class="text-sm text-muted-foreground">Set up DNS zones and certificates to make your apps publicly accessible.</p>
          <div>
            <button
              type="button"
              (click)="showWizard.set(true)"
              class="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <ng-icon name="lucideSettings" class="h-4 w-4" />
              Set up DNS &amp; Certificates
            </button>
          </div>
        </div>
        <div class="flex flex-col rounded-lg bg-muted/50 px-4 py-1">
          @for (row of appRows(); track row.key) {
            <div class="flex items-center gap-2.5 py-2.5 border-b border-border last:border-0">
              <ng-icon name="lucideCircleDashed" class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/60" />
              <span class="text-sm font-medium text-foreground flex-1">{{ row.label }}</span>
              <span class="text-xs text-muted-foreground">not set up</span>
            </div>
          }
        </div>
      </section>
    } @else {
    <div class="card-surface p-5 h-full flex flex-col" data-testid="certs-card">
      <!-- Header -->
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2.5">
          <div class="icon-chip icon-chip-sm" [class]="headerChip()">
            <ng-icon [name]="headerIcon()" class="h-4 w-4" />
          </div>
          <div class="flex flex-col">
            <div class="flex items-center gap-1.5">
              <h2 class="font-semibold text-foreground">Certificates &amp; DNS</h2>
              @if (dnsService.hasStatus() && !dnsService.isFullyConfigured()) {
                <span class="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0"></span>
              }
            </div>
            <p class="text-xs text-muted-foreground" data-testid="certs-subtitle">{{ subtitle() }}</p>
          </div>
        </div>
        <button
          type="button"
          (click)="refresh()"
          [disabled]="dnsService.loading()"
          class="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
          title="Refresh"
          aria-label="Refresh"
        >
          <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" [class.animate-spin]="dnsService.loading()" />
        </button>
      </div>

      <!-- Body -->
      @if (dnsService.loading()) {
        <div class="flex flex-col gap-2.5 flex-1">
          @for (_ of [1, 2, 3]; track _) {
            <div class="flex items-center gap-2.5 py-1.5">
              <div class="h-3 w-3 rounded-full bg-muted animate-pulse flex-shrink-0"></div>
              <div class="flex-1 h-3 w-20 rounded bg-muted animate-pulse"></div>
              <div class="h-3 w-16 rounded bg-muted animate-pulse"></div>
              <div class="h-5 w-14 rounded-full bg-muted animate-pulse"></div>
            </div>
          }
        </div>
      } @else if (!dnsService.hasStatus()) {
        <div class="flex flex-col items-center justify-center flex-1 gap-3 py-2">
          <div class="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <ng-icon name="lucideGlobe" class="h-7 w-7 text-muted-foreground/50" />
          </div>
          <div class="text-center">
            <p class="text-sm font-semibold text-foreground">No cluster available</p>
            <p class="text-xs text-muted-foreground mt-0.5">Create a cluster to configure DNS</p>
          </div>
        </div>
      } @else if (dnsService.needsSetup()) {
        <div class="flex flex-col items-center justify-center flex-1 gap-3 py-2">
          <div class="h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <ng-icon name="lucideShieldAlert" class="h-7 w-7 text-amber-500" />
          </div>
          <div class="text-center">
            <p class="text-sm font-semibold text-foreground">DNS not configured</p>
            <p class="text-xs text-muted-foreground mt-0.5">
              Set up DNS zones and certificates to make your apps publicly accessible.
            </p>
          </div>
          <button
            (click)="showWizard.set(true)"
            class="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ng-icon name="lucideSettings" class="h-3.5 w-3.5 animate-pulse" />
            Set up DNS & Certificates
          </button>
        </div>
      } @else {
        <div class="flex flex-col flex-1">
          @for (row of appRows(); track row.key) {
            @let app = dnsService.status()![row.key]!;
            <div class="flex items-center gap-3 py-2.5 border-t border-border">
              <ng-icon
                [name]="appStatusIcon(app)"
                class="h-4 w-4 flex-shrink-0"
                [class]="appStatusIconColor(app)"
              />
              <span class="text-sm font-medium text-foreground w-20 flex-shrink-0">{{ row.label }}</span>
              <span class="text-xs text-muted-foreground font-mono truncate flex-1 min-w-0">
                {{ app.domain || '—' }}
              </span>
              <span
                class="flex-shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium cursor-default"
                [class]="certStatusClass(app)"
                [title]="app.certMessage || ''"
              >
                {{ certStatusLabel(app) }}
              </span>
            </div>
          }
        </div>

      }

      @if (dnsService.hasStatus() && !dnsService.needsSetup()) {
        <div class="pt-3 border-t border-border mt-auto flex items-center justify-between gap-2">
          <a
            [routerLink]="['/cluster', dnsService.targetClusterId(), 'dns']"
            class="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <ng-icon name="lucideGlobe" class="h-3 w-3" />
            Manage cluster DNS
            <ng-icon name="lucideArrowRight" class="h-3 w-3" />
          </a>
          <button
            (click)="showWizard.set(true)"
            class="group flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
            title="Configure DNS & Certificates"
          >
            <ng-icon name="lucideSettings" class="h-3 w-3" />
            Configure
          </button>
        </div>
      }
    </div>
    }
  `,
})
export class DashboardCertsComponent implements OnInit, OnDestroy {
  readonly firstStep = input(false);

  protected dnsService = inject(DashboardDnsService);
  private readonly notifService = inject(NotificationService);
  protected showWizard = signal(false);
  protected appRows = computed(() =>
    ALL_APP_ROWS.filter(row => row.key !== 'zitadel' || this.dnsService.status()?.zitadel !== null)
  );

  protected readonly subtitle = computed(() => {
    if (!this.dnsService.hasStatus() || this.dnsService.needsSetup()) return 'Security posture';
    const status = this.dnsService.status()!;
    const rows = this.appRows();
    const synced = rows.filter((row) => status[row.key]?.isComplete).length;
    return `Security posture \u00b7 ${synced} of ${rows.length} synced`;
  });

  constructor() {
    // Watch cert status — add notification when incomplete, remove when fully configured
    effect(() => {
      const hasStatus = this.dnsService.hasStatus();
      const fullyConfigured = this.dnsService.isFullyConfigured();

      if (!hasStatus) return;

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

  protected headerIcon(): string {
    if (!this.dnsService.hasStatus() || this.dnsService.needsSetup()) return 'lucideShieldAlert';
    if (this.dnsService.isFullyConfigured()) return 'lucideShieldCheck';
    return 'lucideShieldAlert';
  }

  protected headerChip(): string {
    return this.dnsService.hasStatus() && !this.dnsService.needsSetup() && this.dnsService.isFullyConfigured()
      ? 'chip-ok'
      : 'chip-warn';
  }

  protected appStatusIcon(app: AppDnsInfo): string {
    if (!app.endpointId) return 'lucideCircleDashed';
    if (app.isComplete) return 'lucideCheckCircle';
    if (app.certStatus === 'failed' || app.certStatus === 'expired') return 'lucideAlertCircle';
    return 'lucideCircleDashed';
  }

  protected appStatusIconColor(app: AppDnsInfo): string {
    if (!app.endpointId) return 'text-muted-foreground/40';
    if (app.isComplete) return 'text-emerald-500';
    if (app.certStatus === 'failed' || app.certStatus === 'expired') return 'text-destructive';
    return 'text-muted-foreground/40';
  }

  protected certStatusLabel(app: AppDnsInfo): string {
    if (!app.endpointId) return 'not set up';
    if (app.isComplete) return 'synced';
    if (!app.synced && !app.lastSyncedAt) return 'pending sync';
    if (app.synced && app.syncedDomain !== app.domain) return 'domain changed';
    if (app.prodCertConfigured) return 'cert ok';
    if (app.stagingCertConfigured) return 'staging cert';
    if (app.certStatus === 'issuing') return 'issuing';
    if (app.certStatus === 'failed') return 'failed';
    if (app.certStatus === 'expired') return 'expired';
    return 'in progress';
  }

  protected certStatusClass(app: AppDnsInfo): string {
    if (!app.endpointId) return 'bg-muted text-muted-foreground';
    if (app.isComplete) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (app.certStatus === 'failed' || app.certStatus === 'expired')
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  }
}
