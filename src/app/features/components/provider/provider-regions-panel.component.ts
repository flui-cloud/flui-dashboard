import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ProvidersService } from '../../service/providers.service';
import {
  ProviderConfigurationDto,
  ProviderDefinitionDto,
  ProviderRegionDto,
} from '../../../core/api';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'provider-regions-panel',
  imports: [FlPanel, FlTable, FlEmptyState, FlLoadingState, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Enabled regions" [count]="enabledRegionObjects().length" [flush]="true">
      @if (isLoadingRegions()) {
        <fl-loading-state [rows]="3" />
      } @else if (configuration().enabledRegions.length > 0) {
        <div class="fl-table-wrap">
          <table flTable density="dense" data-testid="provider-regions-table">
            <thead>
              <tr>
                <th scope="col">Region</th>
                <th scope="col">Code</th>
                <th scope="col">Location</th>
                <th scope="col">Availability</th>
              </tr>
            </thead>
            <tbody>
              @for (region of enabledRegionObjects(); track region.id) {
                <tr [attr.data-testid]="'provider-region-' + region.id">
                  <td>{{ region.displayName || region.name || region.id }}</td>
                  <td class="fl-mono">{{ region.id }}</td>
                  <td>{{ region.location || region.country || '—' }}</td>
                  <td>
                    <fl-status
                      [tone]="region.available === false ? 'warning' : 'success'"
                      [label]="region.available === false ? 'Unavailable' : 'Available'"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <fl-empty-state
          [compact]="true"
          title="No regions enabled"
          body="New machines on this provider have nowhere to go until a region is enabled."
        />
      }
    </fl-panel>
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
    return this.configuration()
      .enabledRegions.map((id) => supportedById.get(id))
      .filter((r): r is ProviderRegionDto => r !== undefined);
  });

  constructor() {
    effect(() => {
      const id = this.provider().id;
      const fromCapabilities = this.provider().capabilities?.supportedRegions ?? [];
      if (
        !id ||
        fromCapabilities.length ||
        this.fetchedRegions() !== null ||
        this.isLoadingRegions()
      )
        return;
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
