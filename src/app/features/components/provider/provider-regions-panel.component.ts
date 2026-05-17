import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideGlobe, lucideLoader } from '@ng-icons/lucide';
import { ProvidersService } from '../../service/providers.service';
import { ProviderConfigurationDto, ProviderDefinitionDto, ProviderRegionDto } from '../../../core/api';

@Component({
  selector: 'provider-regions-panel',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [provideIcons({ lucideGlobe, lucideLoader })],
  template: `
    <section class="bg-card border border-border rounded-xl overflow-hidden">
      <header class="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
        <ng-icon name="lucideGlobe" class="h-4 w-4 text-muted-foreground" />
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Enabled regions</h2>
        <span class="ml-auto text-xs text-muted-foreground">
          {{ enabledRegionObjects().length }} active
        </span>
      </header>

      <div class="p-6">
        @if (isLoadingRegions()) {
          <div class="flex items-center justify-center py-4">
            <ng-icon name="lucideLoader" class="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        } @else if (configuration().enabledRegions.length > 0) {
          <div class="flex flex-wrap gap-2">
            @for (region of enabledRegionObjects(); track region.id) {
              <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-sm font-medium">
                @if (region.flagEmoji) { <span>{{ region.flagEmoji }}</span> }
                @else { <ng-icon name="lucideGlobe" class="h-3.5 w-3.5 text-muted-foreground" /> }
                {{ region.displayName || region.id }}
              </span>
            }
          </div>
        } @else {
          <p class="text-sm text-muted-foreground">No regions enabled.</p>
        }
      </div>
    </section>
  `,
})
export class ProviderRegionsPanelComponent {
  private readonly providersService = inject(ProvidersService);

  provider = input.required<ProviderDefinitionDto>();
  configuration = input.required<ProviderConfigurationDto>();

  protected isLoadingRegions = signal(false);
  private readonly fetchedRegions = signal<ProviderRegionDto[] | null>(null);

  protected supportedRegions = computed<ProviderRegionDto[]>(() => {
    const fetched = this.fetchedRegions();
    if (fetched?.length) return fetched;
    return this.provider().capabilities?.supportedRegions ?? [];
  });

  protected enabledRegionObjects = computed<ProviderRegionDto[]>(() => {
    const supported = this.supportedRegions();
    const supportedById = new Map(supported.map((r) => [r.id, r]));
    return this.configuration().enabledRegions
      .map((id) => supportedById.get(id))
      .filter((r): r is ProviderRegionDto => r !== undefined);
  });

  constructor() {
    effect(() => {
      const id = this.provider().id;
      const fromCapabilities = this.provider().capabilities?.supportedRegions ?? [];
      if (!id || fromCapabilities.length || this.fetchedRegions() !== null || this.isLoadingRegions()) return;
      this.loadRegions(id);
    });
  }

  private async loadRegions(id: string): Promise<void> {
    this.isLoadingRegions.set(true);
    try {
      const regions = await this.providersService.getProviderRegions(id);
      this.fetchedRegions.set(regions as ProviderRegionDto[]);
    } catch {
      this.fetchedRegions.set([]);
    } finally {
      this.isLoadingRegions.set(false);
    }
  }
}
