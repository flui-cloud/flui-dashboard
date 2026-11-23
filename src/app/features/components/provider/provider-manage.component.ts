import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProvidersService } from '../../service/providers.service';
import { ProviderMarkComponent } from '../../../shared/components/provider-mark.component';
import { ProviderConfigurationDto, ProviderDefinitionDto } from '../../../core/api';
import { HealthStatus } from '../../model/provider.models';
import { ProviderCredentialsPanelComponent } from './provider-credentials-panel.component';
import { ProviderRegionsPanelComponent } from './provider-regions-panel.component';
import { ProviderInferencePanelComponent } from './provider-inference-panel.component';
import { ProviderHealthPanel } from './provider-health-panel';
import { ProviderDetailsPanel } from './provider-details-panel';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  ProviderSurfaceInput,
  ProviderSurfaceRevision,
  buildProviderSurface,
  presentedContent,
} from './provider-surface';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';
import { Crumb, FlBreadcrumb } from '../../../ui/patterns/breadcrumb';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import { PROVIDER_STATUS, providerState } from './provider-presentation';
import { errorMessageOf } from './provider-credentials';

@Component({
  selector: 'provider-manage',
  imports: [
    ProviderMarkComponent,
    MaskIdPipe,
    ReadOnlySectionDirective,
    RouterLink,
    ProviderCredentialsPanelComponent,
    ProviderRegionsPanelComponent,
    ProviderInferencePanelComponent,
    ProviderHealthPanel,
    ProviderDetailsPanel,
    FlBreadcrumb,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlCopyId,
    FlEmptyState,
    FlLoadingState,
    FlActionsMenu,
    FlButton,
    FlStatus,
  ],
  template: `
    <div class="fl-page fl-stack">
      @if (isLoading()) {
        <fl-breadcrumb [items]="crumbs()" />
        <fl-panel><fl-loading-state [rows]="4" /></fl-panel>
      } @else if (!provider()) {
        <fl-page-header title="Provider not found" [breadcrumb]="crumbs()" />
        <fl-panel>
          <fl-empty-state
            title="Provider not found"
            [body]="'The provider ' + providerId() + ' does not exist.'"
          >
            <a flButton size="sm" routerLink="/management/providers">Back to providers</a>
          </fl-empty-state>
        </fl-panel>
      } @else {
        @let p = provider()!;
        <div class="flex flex-col gap-3">
          <fl-breadcrumb [items]="crumbs()" />
          <div class="fl-pagehead">
            <div class="fl-pagehead__main">
              <div class="fl-pagehead__line">
                <app-provider-mark [name]="p.displayName" [size]="28" />
                <h1 class="fl-pagehead__title">{{ p.displayName }}</h1>
                <fl-status
                  [tone]="status().tone"
                  [label]="status().label"
                  data-testid="provider-manage-status"
                />
              </div>
              <div class="fl-pagehead__meta">
                @if (configuration(); as c) {
                  <fl-copy-id [value]="c.id" [display]="c.id | maskId" label="configuration ID" />
                }
                @if (p.description) {
                  <span>{{ p.description }}</span>
                }
                @if (p.websiteUrl) {
                  <a class="fl-link" [href]="p.websiteUrl" target="_blank" rel="noopener"
                    >Website</a
                  >
                }
                @if (p.documentationUrl) {
                  <a class="fl-link" [href]="p.documentationUrl" target="_blank" rel="noopener"
                    >Docs</a
                  >
                }
              </div>
            </div>
            @if (configuration()) {
              <div class="fl-pagehead__actions">
                <button
                  flButton
                  type="button"
                  appReadOnlySection="providers"
                  [disabled]="isCheckingHealth()"
                  (click)="refreshHealth()"
                >
                  {{ isCheckingHealth() ? 'Checking…' : 'Run health check' }}
                </button>
                <fl-actions-menu
                  label="Actions"
                  appReadOnlySection="providers"
                  [items]="actions()"
                  data-testid="provider-manage-actions"
                  (action)="onAction($event)"
                />
              </div>
            }
          </div>
        </div>

        @if (errorMessage()) {
          <fl-alert tone="error" title="Something went wrong">{{ errorMessage() }}</fl-alert>
        }

        @if (!configuration()) {
          <fl-panel>
            <fl-empty-state
              title="Not connected"
              [body]="'Connect an account so Flui can create machines on ' + p.displayName + '.'"
            >
              <a
                flButton="primary"
                size="sm"
                routerLink="/management/providers"
                [queryParams]="{ configure: providerId() }"
              >
                Connect {{ p.displayName }}
              </a>
            </fl-empty-state>
          </fl-panel>
          <app-provider-details-panel [provider]="p" />
        } @else {
          <div class="fl-grid-2 items-start">
            <provider-credentials-panel
              [provider]="p"
              [configuration]="configuration()!"
              (updated)="onConfigUpdated($event)"
            />
            <app-provider-health-panel [health]="health()" [checking]="isCheckingHealth()" />
          </div>
          <provider-regions-panel [provider]="p" [configuration]="configuration()!" />
          <provider-inference-panel [providerId]="providerId()" />
          <app-provider-details-panel [provider]="p" [configuration]="configuration()!" />
        }
      }
    </div>
  `,
})
export class ProviderManageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly providersService = inject(ProvidersService);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly confirm = inject(ConfirmService);

  protected providerId = signal<string>('');
  protected isLoading = signal<boolean>(true);
  protected health = signal<HealthStatus | null>(null);
  protected isCheckingHealth = signal<boolean>(false);
  protected isToggling = signal<boolean>(false);
  protected isRemoving = signal<boolean>(false);
  protected errorMessage = signal<string>('');

  protected provider = computed<ProviderDefinitionDto | undefined>(() =>
    this.providersService.availableProviders().find((p) => p.id === this.providerId()),
  );

  protected configuration = computed<ProviderConfigurationDto | undefined>(() =>
    this.providersService.configuredProviders().find((c) => c.provider === this.providerId()),
  );

  protected readonly status = computed(() => {
    const state = providerState(this.configuration()?.status);
    return { label: state.label, tone: PROVIDER_STATUS[state.tone] };
  });

  protected readonly crumbs = computed<Crumb[]>(() => [
    { label: 'Providers', link: '/management/providers' },
    { label: this.provider()?.displayName ?? this.providerId() },
  ]);

  protected readonly actions = computed<MenuAction[]>(() => [
    {
      id: 'toggle',
      label: this.configuration()?.isActive ? 'Disable provider' : 'Enable provider',
      disabled: this.isToggling(),
    },
    {
      id: 'disconnect',
      label: 'Disconnect',
      danger: true,
      separatorBefore: true,
      disabled: this.isRemoving(),
    },
  ]);

  private readonly surfaceRevision = new ProviderSurfaceRevision();

  readonly surface = computed(() => {
    const input: ProviderSurfaceInput = {
      provider: this.provider(),
      configuration: this.configuration(),
      health: this.health(),
    };
    const content = presentedContent(input);
    if (!content) return null;
    return buildProviderSurface(input, {
      revision: this.surfaceRevision.next(content),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnInit(): void {
    this.providerId.set(this.route.snapshot.paramMap.get('id') ?? '');
    if (!this.providersService.availableProviders().length) this.providersService.loadProviders();
    if (!this.providersService.configuredProviders().length)
      this.providersService.loadConfigurations();
    queueMicrotask(() => {
      this.isLoading.set(false);
      if (this.configuration()) this.refreshHealth();
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  onConfigUpdated(_config: ProviderConfigurationDto): void {
    return;
  }

  protected onAction(id: string): void {
    if (id === 'toggle') void this.toggleEnabled();
    if (id === 'disconnect') void this.confirmDisconnect();
  }

  async confirmDisconnect(): Promise<void> {
    const provider = this.provider();
    if (!provider || this.isRemoving()) return;
    const confirmed = await this.confirm.confirm({
      title: `Disconnect ${provider.displayName}?`,
      body: 'This removes the saved credentials and configuration. Resources already provisioned on this provider are not affected.',
      confirmLabel: 'Disconnect',
      destructive: true,
      typeToConfirm: provider.id,
    });
    if (confirmed) await this.remove();
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

  private extractError(error: unknown, fallback: string): string {
    return errorMessageOf(error, fallback);
  }
}
