import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProvidersOverviewComponent } from './providers-overview.component';
import {
  ConfigurationResult,
  ProviderConfigurationWizardComponent,
} from './provider-configuration-wizard.component';
import { ProvidersService } from '../../service/providers.service';
import { ProviderDefinitionDto } from '../../../core/api';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlToast } from '../../../ui/overlays/toast';
import {
  ProvidersSurfaceInput,
  ProvidersSurfaceRevision,
  buildProvidersSurface,
  presentedContent,
} from './providers-list-surface';
import type { ProviderListRow } from './providers-list-surface';

type ViewMode = 'overview' | 'configure';

@Component({
  selector: 'providers-management',
  imports: [ProvidersOverviewComponent, ProviderConfigurationWizardComponent, FlToast],
  template: `
    <div class="fl-page">
      @switch (currentView()) {
        @case ('overview') {
          <providers-overview (startConfiguration)="startConfiguration($event)" />
        }
        @case ('configure') {
          @if (selectedProvider()) {
            <provider-configuration-wizard
              [provider]="selectedProvider()!"
              (completeOutput)="onConfigurationComplete($event)"
              (cancelled)="backToOverview()"
            />
          }
        }
      }
    </div>
    @if (showSuccessMessage()) {
      <div class="fl-toasts" aria-live="polite">
        <fl-toast tone="success" [title]="successMessage()" (dismiss)="dismissToast()" />
      </div>
    }
  `,
})
export class ProvidersManagementComponent implements OnInit, OnDestroy {
  private readonly providersService = inject(ProvidersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected currentView = signal<ViewMode>('overview');
  protected selectedProviderId = signal<string>('');
  protected showSuccessMessage = signal<boolean>(false);
  protected successMessage = signal<string>('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  private readonly overview = viewChild(ProvidersOverviewComponent);

  readonly selectedProvider = computed((): ProviderDefinitionDto | null => {
    const providerId = this.selectedProviderId();
    if (!providerId) return null;

    const availableProvider = this.providersService
      .availableProviders()
      .find((p) => p.id === providerId);
    if (availableProvider) return availableProvider;

    const configuredProvider = this.providersService
      .configuredProviders()
      .find((c) => c.provider === providerId);
    if (configuredProvider) {
      return this.providersService.getProviderById(configuredProvider.provider) || null;
    }
    return null;
  });

  private readonly surfaceRevision = new ProvidersSurfaceRevision();

  readonly surface = computed(() => {
    const overview = this.overview();
    const filteredRows: ProviderListRow[] = overview
      ? overview.filteredProviders().map((item) => {
          const definition = overview.getProviderDefinition(item);
          const providerId = overview.getProviderId(item);
          const status = item.type === 'available' ? 'not_configured' : String(item.data.status);
          return { providerId, displayName: definition?.displayName ?? providerId, status };
        })
      : [];
    const input: ProvidersSurfaceInput = {
      filteredRows,
      totalProvidersCount: this.providersService.availableProviders().length,
      searchTerm: overview?.searchTerm() ?? '',
      statusFilter: overview?.statusFilter() ?? '',
      credentialTypeFilter: overview?.credentialTypeFilter() ?? '',
      isLoading: this.providersService.isLoading(),
      configuringProvider: this.currentView() === 'configure' ? this.selectedProvider() : null,
    };
    const content = presentedContent(input);
    return buildProvidersSurface(input, {
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
    const configureId = this.route.snapshot.queryParamMap.get('configure');
    if (configureId) {
      this.startConfiguration(configureId);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.toastTimer);
    this.currentSurface.set(null);
  }

  startConfiguration(providerId: string): void {
    this.selectedProviderId.set(providerId);
    this.currentView.set('configure');
  }

  backToOverview(): void {
    this.currentView.set('overview');
    this.selectedProviderId.set('');
    if (this.route.snapshot.queryParamMap.has('configure')) {
      this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    }
  }

  onConfigurationComplete(event: ConfigurationResult): void {
    if (event.success) {
      this.showSuccess('Provider connected');
      this.backToOverview();
      this.providersService.loadConfigurations();
    } else {
      this.showError(event.error || 'Failed to configure provider. Please try again.');
    }
  }

  private showSuccess(message: string): void {
    this.successMessage.set(message);
    this.showSuccessMessage.set(true);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.showSuccessMessage.set(false), 3000);
  }

  protected dismissToast(): void {
    clearTimeout(this.toastTimer);
    this.showSuccessMessage.set(false);
  }

  private showError(message: string): void {
    console.error(message);
  }
}
