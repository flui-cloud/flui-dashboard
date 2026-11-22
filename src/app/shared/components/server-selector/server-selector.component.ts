import { Component, OnInit, input, output, signal, computed, inject, effect } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideServer, lucideX } from '@ng-icons/lucide';
import { VirtualInstancesService } from '../../../core/api/api/virtualInstances.service';
import { InstanceWithLabels } from '../../../features/model/instance.models';
import { InstanceStatusBadgeComponent } from '../../../features/components/compute/instance-status-badge.component';
import { firstValueFrom } from 'rxjs';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-server-selector',
  imports: [
    FormsModule,
    InstanceStatusBadgeComponent,
    FlAlert,
    FlEmptyState,
    FlLoadingState,
    FlTable,
    FlButton,
    FlIcon,
  ],
  providers: [provideIcons({ lucideSearch, lucideServer, lucideX })],
  host: { class: 'flex flex-col gap-3' },
  template: `
    <div class="fl-input fl-input--lg">
      <fl-icon name="lucideSearch" />
      <input
        type="text"
        aria-label="Search servers by name"
        placeholder="Search servers by name"
        [(ngModel)]="searchQuery"
      />
    </div>

    @if (isLoading()) {
      <fl-loading-state [rows]="3" />
    } @else if (error()) {
      <fl-alert tone="error" title="Could not load servers">{{ error() }}</fl-alert>
    } @else if (filteredServers().length === 0) {
      <fl-empty-state
        icon="lucideServer"
        [compact]="true"
        [title]="
          searchQuery() ? 'No servers match “' + searchQuery() + '”' : 'No servers available'
        "
      />
    } @else {
      <div class="fl-table-wrap max-h-96 overflow-y-auto rounded-fl-lg border border-fl-border">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col" class="is-fit"><span class="fl-sr">Selected</span></th>
              <th scope="col">Server</th>
              <th scope="col">Status</th>
              <th scope="col">IP</th>
              <th scope="col" class="is-num">CPU</th>
              <th scope="col" class="is-num">Memory</th>
              <th scope="col">Region</th>
            </tr>
          </thead>
          <tbody>
            @for (server of filteredServers(); track server.id) {
              <tr
                class="cursor-pointer"
                [class.is-selected]="isSelected(server)"
                (click)="selectServer(server)"
              >
                <td class="is-fit">
                  <input
                    [type]="multiSelect() ? 'checkbox' : 'radio'"
                    name="server-selector"
                    [checked]="isSelected(server)"
                    [attr.aria-label]="'Select ' + (server.displayName || server.name)"
                  />
                </td>
                <td class="font-medium">{{ server.displayName || server.name }}</td>
                <td><app-instance-status-badge [status]="server.status || 'unknown'" /></td>
                <td class="fl-mono">{{ server.ipConfig?.v4?.ip || '-' }}</td>
                <td class="is-num">{{ server.cpuCores || '-' }}</td>
                <td class="is-num">{{ formatMemory(server.ramMb) || '-' }}</td>
                <td class="fl-mono">{{ server.region || '-' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (multiSelect() && selectedServers().length > 0) {
      <div class="fl-row justify-between">
        <span class="fl-num text-fl-body-sm">{{ selectedServers().length }} selected</span>
        <button flButton="ghost" size="sm" type="button" (click)="clearSelection()">
          <fl-icon name="lucideX" />
          Clear
        </button>
      </div>
    }
  `,
})
export class ServerSelectorComponent implements OnInit {
  private readonly instancesApi = inject(VirtualInstancesService);

  provider = input<string | undefined>(undefined);

  excludeServerIds = input<string[]>([]);

  multiSelect = input<boolean>(false);

  serverSelected = output<InstanceWithLabels>();

  serversSelected = output<InstanceWithLabels[]>();

  availableServers = signal<InstanceWithLabels[]>([]);
  selectedServers = signal<InstanceWithLabels[]>([]);
  searchQuery = signal<string>('');
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  filteredServers = computed(() => {
    const servers = this.availableServers();
    const query = this.searchQuery().toLowerCase();
    const excluded = this.excludeServerIds();

    return servers.filter((server) => {
      if (excluded.includes(server.id || '')) {
        return false;
      }

      if (query) {
        const name = (server.displayName || server.name || '').toLowerCase();
        return name.includes(query);
      }

      return true;
    });
  });

  constructor() {
    effect(() => {
      this.provider();
      this.loadServers();
    });
  }

  ngOnInit(): void {
    this.loadServers();
  }

  async loadServers(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const provider = this.provider();
      const response = await firstValueFrom(
        this.instancesApi.instancesControllerFindAll(undefined, undefined, undefined, provider),
      );

      this.availableServers.set((response.data || []) as InstanceWithLabels[]);
    } catch (error: any) {
      const errorMsg = error?.error?.message || 'Failed to load servers';
      this.error.set(errorMsg);
      console.error('Failed to load servers:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  selectServer(server: InstanceWithLabels): void {
    if (this.multiSelect()) {
      this.selectedServers.update((selected) => {
        const index = selected.findIndex((s) => s.id === server.id);
        if (index === -1) {
          return [...selected, server];
        } else {
          return selected.filter((s) => s.id !== server.id);
        }
      });
      this.serversSelected.emit(this.selectedServers());
    } else {
      this.selectedServers.set([server]);
      this.serverSelected.emit(server);
    }
  }

  isSelected(server: InstanceWithLabels): boolean {
    return this.selectedServers().some((s) => s.id === server.id);
  }

  clearSelection(): void {
    this.selectedServers.set([]);
    this.serversSelected.emit([]);
  }

  formatMemory(mb: number | undefined): string {
    if (!mb) return '';
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(0)} GB`;
    }
    return `${mb} MB`;
  }
}
