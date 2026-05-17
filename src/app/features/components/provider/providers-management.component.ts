import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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

type ViewMode = 'overview' | 'configure';

@Component({
  selector: 'providers-management',
  standalone: true,
  imports: [
    CommonModule,
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
export class ProvidersManagementComponent implements OnInit {
  private readonly providersService = inject(ProvidersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected currentView = signal<ViewMode>('overview');
  protected selectedProviderId = signal<string>('');
  protected showSuccessMessage = signal<boolean>(false);
  protected successMessage = signal<string>('');

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

  ngOnInit(): void {
    const configureId = this.route.snapshot.queryParamMap.get('configure');
    if (configureId) {
      this.startConfiguration(configureId);
    }
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
