import { Component, OnDestroy, computed, effect, inject, signal, viewChild, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideSettings,
  lucideCheck
} from '@ng-icons/lucide';
import { ProvidersOverviewComponent } from './providers-overview.component';
import { ProviderConfigurationWizardComponent } from './provider-configuration-wizard.component';
import { ProvidersService } from '../../service/providers.service';
import { ProviderDefinitionDto } from '../../../core/api';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
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
  standalone: true,
  imports: [
    NgIcon,
    ProvidersOverviewComponent,
    ProviderConfigurationWizardComponent
],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideSettings,
      lucideCheck
    })
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="container mx-auto px-4 py-8">
      @switch (currentView()) {
        @case ('overview') {
          <providers-overview
            (startConfiguration)="startConfiguration($event)"
          />
        }

        @case ('configure') {
          @if (selectedProvider()) {
            <div class="mb-6">
              <button
                (click)="backToOverview()"
                class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ng-icon name="lucideArrowLeft" class="h-4 w-4 mr-2" />
                Back to Providers
              </button>
            </div>

            <provider-configuration-wizard
              [provider]="selectedProvider()!"
              (completeOutput)="onConfigurationComplete($event)"
              (cancelled)="backToOverview()"
            />
          }
        }
      }

      @if (showSuccessMessage()) {
        <div class="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg transition-all">
          <div class="flex items-center space-x-2">
            <ng-icon name="lucideCheck" class="h-5 w-5" />
            <span>{{ successMessage() }}</span>
          </div>
        </div>
      }
    </div>
  `
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

  // The overview grid owns its own search/status/credential-type filters and its own
  // `filteredProviders` computed — the Semantic Surface reads those directly (via this
  // view query) rather than re-deriving them, per the anti-drift rule (§3.4 of the
  // producer playbook): it is undefined while the configure wizard is open, which is
  // exactly when there is no filtered list on screen to describe.
  private readonly overview = viewChild(ProvidersOverviewComponent);

  readonly selectedProvider = computed((): ProviderDefinitionDto | null => {
    const providerId = this.selectedProviderId();
    if (!providerId) return null;

    const availableProvider = this.providersService.availableProviders()
      .find(p => p.id === providerId);
    if (availableProvider) return availableProvider;

    const configuredProvider = this.providersService.configuredProviders()
      .find(c => c.provider === providerId);
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
    // Publish this page's own Semantic Surface snapshot into the shared registry
    // whenever it changes — same pattern as ApplicationDetailComponent.
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

  onConfigurationComplete(event: { success: boolean; configuration?: any; error?: string }): void {
    if (event.success) {
      this.showSuccess('Provider configured successfully!');
      this.backToOverview();
      this.providersService.loadConfigurations();
    } else {
      this.showError(event.error || 'Failed to configure provider. Please try again.');
    }
  }

  private showSuccess(message: string): void {
    this.successMessage.set(message);
    this.showSuccessMessage.set(true);
    setTimeout(() => this.showSuccessMessage.set(false), 3000);
  }

  private showError(message: string): void {
    console.error(message);
  }
}
