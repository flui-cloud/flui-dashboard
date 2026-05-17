import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCloud,
  lucideArrowRight,
  lucidePlusCircle,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { DashboardService } from '../../service/dashboard.service';
import { ProviderConfigurationDto } from '../../../core/api';

const PROVIDER_COLORS: Record<string, { bg: string; text: string }> = {
  hetzner:  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  contabo:  { bg: 'bg-blue-100 dark:bg-blue-900/30',     text: 'text-blue-700 dark:text-blue-300' },
  ovh:      { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300' },
  scaleway: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
};

const DEFAULT_PROVIDER_COLOR = {
  bg: 'bg-muted',
  text: 'text-muted-foreground',
};

const WARN_DAYS = 14;

interface ExpiryAlert {
  provider: string;
  daysLeft: number;
  expired: boolean;
  id: string;
}

@Component({
  selector: 'app-dashboard-providers',
  standalone: true,
  imports: [RouterLink, NgIconComponent],
  providers: [
    provideIcons({ lucideCloud, lucideArrowRight, lucidePlusCircle, lucideTriangleAlert }),
  ],
  template: `
    <div class="bg-card border border-border rounded-lg p-5 h-full flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
            <ng-icon name="lucideCloud" class="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h2 class="font-semibold text-foreground text-sm">Cloud Providers</h2>
            <p class="text-xs text-muted-foreground">{{ activeCount() }} of {{ providers().length }} active</p>
          </div>
        </div>
        <a
          routerLink="/management/providers"
          class="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          Manage
          <ng-icon name="lucideArrowRight" class="h-3 w-3" />
        </a>
      </div>

      <!-- Expiry alerts -->
      @for (alert of expiryAlerts(); track alert.id) {
        <a
          [routerLink]="['/management/providers', alert.id]"
          class="flex items-start gap-2 px-3 py-2 mb-2 rounded-lg border text-xs font-medium transition-colors"
          [class]="alert.expired
            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400/80 hover:bg-red-100 dark:hover:bg-red-950/30'
            : 'bg-yellow-50 dark:bg-amber-950/20 border-yellow-200 dark:border-amber-900/50 text-yellow-700 dark:text-amber-400/70 hover:bg-yellow-100 dark:hover:bg-amber-950/30'"
        >
          <ng-icon name="lucideTriangleAlert" class="h-3.5 w-3.5 flex-shrink-0 mt-px" />
          <span>
            <span class="capitalize">{{ alert.provider }}</span>
            @if (alert.expired) {
              — credentials expired. Rotate now to restore access.
            } @else {
              — credentials expire in {{ alert.daysLeft }} day{{ alert.daysLeft === 1 ? '' : 's' }}. Rotate soon.
            }
          </span>
        </a>
      }

      @if (isEmpty()) {
        <!-- Empty state -->
        <div class="flex flex-col items-center justify-center flex-1 gap-3 py-4">
          <div class="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <ng-icon name="lucideCloud" class="h-6 w-6 text-muted-foreground" />
          </div>
          <div class="text-center">
            <p class="text-sm font-medium text-foreground">No providers configured</p>
            <p class="text-xs text-muted-foreground mt-0.5">Add a cloud provider to start deploying</p>
          </div>
          <a
            routerLink="/management/providers"
            class="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ng-icon name="lucidePlusCircle" class="h-3.5 w-3.5" />
            Add provider
          </a>
        </div>
      } @else {
        <!-- Provider list -->
        <div class="space-y-2.5 flex-1">
          @for (p of providers(); track p.id) {
            <div class="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-background/50">

              <!-- Provider monogram chip -->
              <div
                class="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0
                       text-sm font-bold uppercase tracking-wide"
                [class]="getColors(p.provider).bg + ' ' + getColors(p.provider).text"
              >
                {{ p.provider.substring(0, 2) }}
              </div>

              <!-- Name + regions -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-foreground capitalize leading-tight">{{ p.provider }}</p>
                <p class="text-xs text-muted-foreground mt-0.5">
                  {{ p.enabledRegions.length }} region{{ p.enabledRegions.length === 1 ? '' : 's' }}
                </p>
              </div>

              <!-- Status + expiry indicator -->
              <div class="flex items-center gap-1.5 flex-shrink-0">
                @if (isExpiringSoon(p)) {
                  <ng-icon
                    name="lucideTriangleAlert"
                    class="h-3.5 w-3.5"
                    [class]="isExpired(p) ? 'text-red-500' : 'text-yellow-500'"
                  />
                }
                <span
                  class="h-2 w-2 rounded-full"
                  [class]="p.status === 'active' ? 'bg-green-500' : 'bg-red-400'"
                ></span>
                <span
                  class="text-xs font-medium"
                  [class]="p.status === 'active'
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'"
                >
                  {{ p.status }}
                </span>
              </div>

            </div>
          }
        </div>
      }
    </div>
  `,
})
export class DashboardProvidersComponent {
  private readonly dashboardService = inject(DashboardService);

  providers = this.dashboardService.configuredProviders;
  isEmpty = computed(() => this.providers().length === 0);
  activeCount = this.dashboardService.activeProvidersCount;

  readonly expiryAlerts = computed<ExpiryAlert[]>(() =>
    this.providers()
      .filter(p => !!p.credentialsExpiresAt)
      .map(p => {
        const msLeft = new Date(p.credentialsExpiresAt!).getTime() - Date.now();
        const daysLeft = Math.ceil(msLeft / 86_400_000);
        return { provider: p.provider, daysLeft, expired: daysLeft <= 0, id: p.id };
      })
      .filter(a => a.expired || a.daysLeft <= WARN_DAYS)
      .sort((a, b) => a.daysLeft - b.daysLeft)
  );

  isExpiringSoon(p: ProviderConfigurationDto): boolean {
    if (!p.credentialsExpiresAt) return false;
    const daysLeft = Math.ceil((new Date(p.credentialsExpiresAt).getTime() - Date.now()) / 86_400_000);
    return daysLeft <= WARN_DAYS;
  }

  isExpired(p: ProviderConfigurationDto): boolean {
    if (!p.credentialsExpiresAt) return false;
    return new Date(p.credentialsExpiresAt).getTime() <= Date.now();
  }

  getColors(provider: string): { bg: string; text: string } {
    return PROVIDER_COLORS[provider?.toLowerCase()] ?? DEFAULT_PROVIDER_COLOR;
  }
}
