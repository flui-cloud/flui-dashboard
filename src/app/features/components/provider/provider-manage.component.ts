import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideArrowLeft,
  lucideCircleCheck,
  lucideCircleX,
  lucideExternalLink,
  lucideGlobe,
  lucideLoader,
  lucidePower,
  lucideRefreshCw,
  lucideShieldCheck,
  lucideTrash2,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { ProvidersService } from '../../service/providers.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import { ProviderConfigurationDto, ProviderDefinitionDto } from '../../../core/api';
import { HealthStatus } from '../../model/provider.models';
import { ProviderCredentialsPanelComponent } from './provider-credentials-panel.component';
import { ProviderRegionsPanelComponent } from './provider-regions-panel.component';
import { ProviderInferencePanelComponent } from './provider-inference-panel.component';

@Component({
  selector: 'provider-manage',
  standalone: true,
  imports: [CommonModule, RouterLink, NgIcon, ProviderCredentialsPanelComponent, ProviderRegionsPanelComponent, ProviderInferencePanelComponent],
  providers: [
    provideIcons({
      lucideActivity,
      lucideArrowLeft,
      lucideCircleCheck,
      lucideCircleX,
      lucideExternalLink,
      lucideGlobe,
      lucideLoader,
      lucidePower,
      lucideRefreshCw,
      lucideShieldCheck,
      lucideTrash2,
      lucideTriangleAlert,
    }),
  ],
  template: `
    <div class="container mx-auto px-4 py-8 max-w-6xl">
      <a
        routerLink="/management/providers"
        class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ng-icon name="lucideArrowLeft" class="h-4 w-4 mr-2" />
        Back to providers
      </a>

      @if (isLoading()) {
        <div class="flex items-center justify-center py-24">
          <ng-icon name="lucideLoader" class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      } @else if (!provider()) {
        <div class="bg-card border border-border rounded-lg p-12 text-center">
          <ng-icon name="lucideTriangleAlert" class="h-10 w-10 mx-auto text-yellow-500 mb-4" />
          <h2 class="text-lg font-semibold mb-2">Provider not found</h2>
          <p class="text-sm text-muted-foreground">The provider <span class="font-mono">{{ providerId() }}</span> doesn't exist.</p>
        </div>
      } @else {
        <!-- Hero -->
        <div class="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-6 md:p-8 mb-6">
          <div class="flex flex-col md:flex-row md:items-center gap-5">
            <div class="flex items-center justify-center h-16 w-16 rounded-xl bg-background border border-border shadow-sm shrink-0">
              @if (logoUrl()) {
                <img [src]="logoUrl()" [alt]="provider()!.displayName" class="h-10 w-10 object-contain" />
              } @else {
                <ng-icon name="lucideGlobe" class="h-8 w-8 text-muted-foreground" />
              }
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-2xl md:text-3xl font-bold tracking-tight">{{ provider()!.displayName }}</h1>
                <span [class]="statusBadgeClass()">
                  <ng-icon
                    [name]="statusIcon()"
                    [class]="'h-3.5 w-3.5 mr-1.5 ' + (isStatusSpinning() ? 'animate-spin' : '')"
                  />
                  {{ statusLabel() }}
                </span>
              </div>
              <p class="text-sm text-muted-foreground mt-1">{{ provider()!.description }}</p>
              <div class="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <a [href]="provider()!.websiteUrl" target="_blank" class="inline-flex items-center hover:text-foreground transition-colors">
                  <ng-icon name="lucideExternalLink" class="h-3 w-3 mr-1" /> Website
                </a>
                <a [href]="provider()!.documentationUrl" target="_blank" class="inline-flex items-center hover:text-foreground transition-colors">
                  <ng-icon name="lucideExternalLink" class="h-3 w-3 mr-1" /> Docs
                </a>
              </div>
            </div>
          </div>
        </div>

        @if (errorMessage()) {
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3 mb-6">
            <ng-icon name="lucideTriangleAlert" class="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <p class="text-sm text-red-800 dark:text-red-200">{{ errorMessage() }}</p>
          </div>
        }

        @if (!configuration()) {
          <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
            <p class="text-sm text-yellow-800 dark:text-yellow-200 mb-4">This provider isn't configured yet.</p>
            <a routerLink="/management/providers" class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Go to providers list
            </a>
          </div>
        } @else {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Main column -->
            <div class="lg:col-span-2 space-y-6">
              <provider-credentials-panel
                [provider]="provider()!"
                [configuration]="configuration()!"
                (updated)="onConfigUpdated($event)"
              />

              <provider-regions-panel
                [provider]="provider()!"
                [configuration]="configuration()!"
              />

              <provider-inference-panel [providerId]="providerId()" />

              <!-- Health card -->
              <section class="bg-card border border-border rounded-xl overflow-hidden">
                <header class="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
                  <ng-icon name="lucideShieldCheck" class="h-4 w-4 text-muted-foreground" />
                  <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Health</h2>
                  <button
                    type="button"
                    (click)="refreshHealth()"
                    [disabled]="isCheckingHealth()"
                    class="ml-auto inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <ng-icon name="lucideRefreshCw" [class]="'h-3.5 w-3.5 mr-1 ' + (isCheckingHealth() ? 'animate-spin' : '')" />
                    Refresh
                  </button>
                </header>
                <div class="p-6">
                  @if (health(); as h) {
                    <div class="flex items-start gap-4">
                      <div [class]="healthIconWrapClass(h.status)">
                        <ng-icon [name]="healthIcon(h.status)" class="h-5 w-5" />
                      </div>
                      <div class="flex-1">
                        <p [class]="'font-semibold capitalize ' + healthTextClass(h.status)">{{ h.status }}</p>
                        <p class="text-xs text-muted-foreground mt-0.5">
                          Checked {{ formatDate(h.lastCheck.toISOString()) }}
                          @if (h.responseTime !== undefined) { · {{ h.responseTime }}ms }
                        </p>
                        @if (h.errors?.length) {
                          <p class="text-sm text-red-600 dark:text-red-400 mt-2">{{ h.errors![0] }}</p>
                        }
                      </div>
                    </div>
                  } @else {
                    <p class="text-sm text-muted-foreground">
                      {{ isCheckingHealth() ? 'Checking…' : 'No health data yet.' }}
                    </p>
                  }
                </div>
              </section>
            </div>

            <!-- Sidebar -->
            <aside class="space-y-6">
              <section class="bg-card border border-border rounded-xl overflow-hidden">
                <header class="px-6 py-4 border-b border-border bg-muted/30">
                  <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Quick actions</h2>
                </header>
                <div class="p-3 space-y-1">
                  <button
                    type="button"
                    (click)="toggleEnabled()"
                    [disabled]="isToggling()"
                    class="w-full inline-flex items-center px-3 py-2.5 rounded-md text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    @if (isToggling()) {
                      <ng-icon name="lucideLoader" class="h-4 w-4 mr-3 text-muted-foreground animate-spin" />
                    } @else {
                      <ng-icon name="lucidePower" [class]="'h-4 w-4 mr-3 ' + (configuration()!.isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')" />
                    }
                    {{ configuration()!.isActive ? 'Disable provider' : 'Enable provider' }}
                  </button>
                  <button
                    type="button"
                    (click)="refreshHealth()"
                    [disabled]="isCheckingHealth()"
                    class="w-full inline-flex items-center px-3 py-2.5 rounded-md text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    <ng-icon name="lucideRefreshCw" [class]="'h-4 w-4 mr-3 text-muted-foreground ' + (isCheckingHealth() ? 'animate-spin' : '')" />
                    Run health check
                  </button>
                </div>
                <div class="p-3 pt-0 border-t border-border mt-1">
                  <button
                    type="button"
                    (click)="confirmRemove.set(true)"
                    class="w-full inline-flex items-center px-3 py-2.5 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <ng-icon name="lucideTrash2" class="h-4 w-4 mr-3" />
                    Remove configuration
                  </button>
                </div>
              </section>

              <!-- Metadata -->
              <section class="bg-card border border-border rounded-xl overflow-hidden">
                <header class="px-6 py-4 border-b border-border bg-muted/30">
                  <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Metadata</h2>
                </header>
                <dl class="p-6 space-y-3 text-sm">
                  <div class="flex justify-between gap-4">
                    <dt class="text-muted-foreground shrink-0">ID</dt>
                    <dd class="font-mono text-xs truncate" [title]="configuration()!.id">{{ configuration()!.id }}</dd>
                  </div>
                  <div class="flex justify-between gap-4">
                    <dt class="text-muted-foreground">Active</dt>
                    <dd class="font-medium">{{ configuration()!.isActive ? 'Yes' : 'No' }}</dd>
                  </div>
                  <div class="flex justify-between gap-4">
                    <dt class="text-muted-foreground">Last update</dt>
                    <dd class="font-medium text-right">{{ formatDate(configuration()!.updatedAt) }}</dd>
                  </div>
                  @if (configuration()!.lastHealthCheck) {
                    <div class="flex justify-between gap-4">
                      <dt class="text-muted-foreground">Last check</dt>
                      <dd class="font-medium text-right">{{ formatDate(configuration()!.lastHealthCheck) }}</dd>
                    </div>
                  }
                </dl>
              </section>
            </aside>
          </div>
        }

        <!-- Remove confirm dialog -->
        @if (confirmRemove()) {
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="confirmRemove.set(false)">
            <div class="bg-card border border-border rounded-lg p-6 max-w-md w-full space-y-4" (click)="$event.stopPropagation()">
              <div class="flex items-start gap-3">
                <div class="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <ng-icon name="lucideTriangleAlert" class="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold">Remove {{ provider()!.displayName }}?</h3>
                  <p class="text-sm text-muted-foreground mt-1">
                    This removes the saved credentials and configuration. Resources already provisioned on this provider are not affected.
                  </p>
                </div>
              </div>
              <div class="flex justify-end gap-2 pt-2">
                <button type="button" (click)="confirmRemove.set(false)" [disabled]="isRemoving()"
                  class="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" (click)="remove()" [disabled]="isRemoving()"
                  class="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                  @if (isRemoving()) { <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" /> }
                  Remove
                </button>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class ProviderManageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly providersService = inject(ProvidersService);
  private readonly appConfig = inject(AppConfigService);

  protected providerId = signal<string>('');
  protected isLoading = signal<boolean>(true);
  protected health = signal<HealthStatus | null>(null);
  protected isCheckingHealth = signal<boolean>(false);
  protected isToggling = signal<boolean>(false);
  protected isRemoving = signal<boolean>(false);
  protected confirmRemove = signal<boolean>(false);
  protected errorMessage = signal<string>('');

  protected provider = computed<ProviderDefinitionDto | undefined>(() =>
    this.providersService.availableProviders().find((p) => p.id === this.providerId()),
  );

  protected configuration = computed<ProviderConfigurationDto | undefined>(() =>
    this.providersService.configuredProviders().find((c) => c.provider === this.providerId()),
  );

  protected logoUrl = computed(() => {
    const url = this.provider()?.logoUrl;
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${this.appConfig.apiBaseUrl}${url}`;
  });

  protected statusLabel = computed(() =>
    (this.configuration()?.status ?? 'not_configured').replaceAll('_',  ' '),
  );

  protected statusIcon = computed(() => {
    switch (this.configuration()?.status) {
      case 'active': return 'lucideCircleCheck';
      case 'error': return 'lucideCircleX';
      case 'configuring':
      case 'validating': return 'lucideLoader';
      default: return 'lucideActivity';
    }
  });

  protected isStatusSpinning = computed(() => {
    const s = this.configuration()?.status;
    return s === 'configuring' || s === 'validating';
  });

  protected statusBadgeClass = computed(() => {
    const base = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize';
    switch (this.configuration()?.status) {
      case 'active': return `${base} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`;
      case 'error': return `${base} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`;
      case 'disabled': return `${base} bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300`;
      case 'configuring':
      case 'validating': return `${base} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`;
      default: return `${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300`;
    }
  });

  ngOnInit(): void {
    this.providerId.set(this.route.snapshot.paramMap.get('id') ?? '');
    if (!this.providersService.availableProviders().length) this.providersService.loadProviders();
    if (!this.providersService.configuredProviders().length) this.providersService.loadConfigurations();
    queueMicrotask(() => {
      this.isLoading.set(false);
      if (this.configuration()) this.refreshHealth();
    });
  }

  onConfigUpdated(_config: ProviderConfigurationDto): void {
    // ProvidersService already updated state; signal computed will re-derive automatically
  }

  async refreshHealth(): Promise<void> {
    if (this.isCheckingHealth() || !this.configuration()) return;
    this.isCheckingHealth.set(true);
    this.errorMessage.set('');
    try {
      this.health.set(await this.providersService.getProviderHealth(this.providerId()));
    } catch (e: unknown) {
      this.errorMessage.set(this.extractError(e, 'Failed to fetch provider health.'));
    } finally {
      this.isCheckingHealth.set(false);
    }
  }

  async toggleEnabled(): Promise<void> {
    const config = this.configuration();
    if (!config || this.isToggling()) return;
    this.isToggling.set(true);
    this.errorMessage.set('');
    try {
      await this.providersService.toggleProvider(this.providerId(), { enabled: !config.isActive });
    } catch (e: unknown) {
      this.errorMessage.set(this.extractError(e, 'Failed to update provider state.'));
    } finally {
      this.isToggling.set(false);
    }
  }

  async remove(): Promise<void> {
    if (this.isRemoving()) return;
    this.isRemoving.set(true);
    this.errorMessage.set('');
    try {
      await this.providersService.removeProvider(this.providerId());
      this.router.navigate(['/management/providers']);
    } catch (e: unknown) {
      this.errorMessage.set(this.extractError(e, 'Failed to remove provider configuration.'));
    } finally {
      this.isRemoving.set(false);
    }
  }

  protected formatDate(value: string | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }

  protected healthIcon(status: string): string {
    switch (status) {
      case 'healthy': return 'lucideCircleCheck';
      case 'degraded': return 'lucideTriangleAlert';
      case 'unhealthy': return 'lucideCircleX';
      default: return 'lucideActivity';
    }
  }

  protected healthTextClass(status: string): string {
    switch (status) {
      case 'healthy': return 'text-green-600 dark:text-green-400';
      case 'degraded': return 'text-yellow-600 dark:text-yellow-400';
      case 'unhealthy': return 'text-red-600 dark:text-red-400';
      default: return '';
    }
  }

  protected healthIconWrapClass(status: string): string {
    const base = 'h-10 w-10 rounded-full flex items-center justify-center shrink-0';
    switch (status) {
      case 'healthy': return `${base} bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400`;
      case 'degraded': return `${base} bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400`;
      case 'unhealthy': return `${base} bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400`;
      default: return `${base} bg-muted text-muted-foreground`;
    }
  }

  private extractError(error: unknown, fallback: string): string {
    const e = error as { error?: { message?: string }; message?: string } | undefined;
    return e?.error?.message ?? e?.message ?? fallback;
  }
}
