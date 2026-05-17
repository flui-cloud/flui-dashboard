import { Component, OnInit, input, output, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideServer,
  lucideSearch,
  lucideLoader,
  lucideCircleAlert,
  lucideCheck,
  lucideX,
} from '@ng-icons/lucide';
import { VirtualInstancesService } from '../../../core/api/api/virtualInstances.service';
import { InstanceWithLabels } from '../../../features/model/instance.models';
import { InstanceStatusBadgeComponent } from '../../../features/components/compute/instance-status-badge.component';
import { firstValueFrom } from 'rxjs';

/**
 * Server Selector Component
 *
 * Reusable component for selecting servers/instances to attach to a subnet.
 *
 * Features:
 * - List available servers filtered by provider
 * - Search/filter servers by name
 * - Exclude already-attached servers
 * - Single or multi-select mode
 * - Loading states and error handling
 * - Shows server details (provider, status, IP, resources)
 */
@Component({
  selector: 'app-server-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, InstanceStatusBadgeComponent],
  providers: [
    provideIcons({
      lucideServer,
      lucideSearch,
      lucideLoader,
      lucideCircleAlert,
      lucideCheck,
      lucideX,
    }),
  ],
  template: `
    <div class="space-y-4">
      <!-- Search Bar -->
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <ng-icon name="lucideSearch" size="18" class="text-slate-400"></ng-icon>
        </div>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          (ngModelChange)="onSearchChange()"
          placeholder="Search servers by name..."
          class="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading()" class="flex items-center justify-center py-12">
        <ng-icon name="lucideLoader" size="32" class="animate-spin text-blue-500"></ng-icon>
      </div>

      <!-- Error State -->
      <div
        *ngIf="error() && !isLoading()"
        class="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg"
      >
        <ng-icon name="lucideCircleAlert" size="20"></ng-icon>
        <span>{{ error() }}</span>
      </div>

      <!-- Servers List -->
      <div *ngIf="!isLoading() && !error()" class="space-y-2 max-h-96 overflow-y-auto">
        <!-- Server Cards -->
        <div
          *ngFor="let server of filteredServers()"
          (click)="selectServer(server)"
          [class]="getServerCardClass(server)"
          class="p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <!-- Provider Icon -->
              <div class="flex-shrink-0 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                @if (server.provider === 'hetzner') {
                  <img src="/logos/hetzner.png" alt="Hetzner" class="w-6 h-6 object-contain" />
                } @else if (server.provider === 'contabo') {
                  <img src="/logos/contabo.png" alt="Contabo" class="w-6 h-6 object-contain" />
                } @else {
                  <ng-icon name="lucideServer" size="24" class="text-slate-500"></ng-icon>
                }
              </div>

              <!-- Server Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-slate-900 dark:text-white truncate">
                    {{ server.displayName || server.name }}
                  </h3>
                  <app-instance-status-badge [status]="server.status || 'unknown'" />
                </div>
                <div class="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                  <span *ngIf="server.ipConfig?.v4?.ip" class="font-mono">{{ server.ipConfig?.v4?.ip }}</span>
                  <span *ngIf="server.cpuCores">{{ server.cpuCores }} CPU</span>
                  <span *ngIf="server.ramMb">{{ formatMemory(server.ramMb) }}</span>
                  <span *ngIf="server.region" class="capitalize">{{ server.region }}</span>
                </div>
              </div>
            </div>

            <!-- Selection Indicator -->
            <ng-icon
              *ngIf="isSelected(server)"
              name="lucideCheck"
              size="24"
              class="flex-shrink-0 text-blue-600 dark:text-blue-400 ml-2"
            ></ng-icon>
          </div>
        </div>

        <!-- Empty State -->
        <div
          *ngIf="filteredServers().length === 0"
          class="text-center py-12 text-slate-500 dark:text-slate-400"
        >
          <ng-icon name="lucideServer" size="48" class="mx-auto mb-3 opacity-30"></ng-icon>
          <p *ngIf="searchQuery()">No servers found matching "{{ searchQuery() }}"</p>
          <p *ngIf="!searchQuery()">No servers available</p>
        </div>
      </div>

      <!-- Selected Count (Multi-select mode) -->
      <div
        *ngIf="multiSelect() && selectedServers().length > 0"
        class="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
      >
        <span class="text-sm font-medium text-blue-700 dark:text-blue-300">
          {{ selectedServers().length }} server(s) selected
        </span>
        <button
          (click)="clearSelection()"
          class="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          <ng-icon name="lucideX" size="16"></ng-icon>
          Clear
        </button>
      </div>
    </div>
  `,
})
export class ServerSelectorComponent implements OnInit {
  private readonly instancesApi = inject(VirtualInstancesService);

  // ===== INPUTS =====

  /**
   * Filter servers by provider (optional)
   */
  provider = input<string | undefined>(undefined);

  /**
   * Server IDs to exclude from the list (e.g., already attached)
   */
  excludeServerIds = input<string[]>([]);

  /**
   * Enable multi-select mode
   */
  multiSelect = input<boolean>(false);

  // ===== OUTPUTS =====

  /**
   * Emitted when a server is selected (single select mode)
   */
  serverSelected = output<InstanceWithLabels>();

  /**
   * Emitted when selection changes (multi-select mode)
   */
  serversSelected = output<InstanceWithLabels[]>();

  // ===== STATE SIGNALS =====

  availableServers = signal<InstanceWithLabels[]>([]);
  selectedServers = signal<InstanceWithLabels[]>([]);
  searchQuery = signal<string>('');
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  // ===== COMPUTED SIGNALS =====

  filteredServers = computed(() => {
    const servers = this.availableServers();
    const query = this.searchQuery().toLowerCase();
    const excluded = this.excludeServerIds();

    return servers
      .filter(server => {
        // Exclude servers in the exclude list
        if (excluded.includes(server.id || '')) {
          return false;
        }

        // Filter by search query
        if (query) {
          const name = (server.displayName || server.name || '').toLowerCase();
          return name.includes(query);
        }

        return true;
      });
  });

  // ===== LIFECYCLE =====

  constructor() {
    // Reload servers when provider changes
    effect(() => {
      const currentProvider = this.provider();
      this.loadServers();
    });
  }

  ngOnInit(): void {
    this.loadServers();
  }

  // ===== METHODS =====

  async loadServers(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const provider = this.provider();
      const response = await firstValueFrom(
        this.instancesApi.instancesControllerFindAll(
          undefined, // status
          undefined, // page
          undefined, // limit
          provider,  // provider filter
          undefined, // region
          undefined, // name
          undefined  // clusterId
        )
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
      // Multi-select mode: toggle selection
      this.selectedServers.update(selected => {
        const index = selected.findIndex(s => s.id === server.id);
        if (index === -1) {
          // Not selected, add it
          return [...selected, server];
        } else {
          // Already selected, remove it
          return selected.filter(s => s.id !== server.id);
        }
      });
      this.serversSelected.emit(this.selectedServers());
    } else {
      // Single select mode: replace selection
      this.selectedServers.set([server]);
      this.serverSelected.emit(server);
    }
  }

  isSelected(server: InstanceWithLabels): boolean {
    return this.selectedServers().some(s => s.id === server.id);
  }

  clearSelection(): void {
    this.selectedServers.set([]);
    this.serversSelected.emit([]);
  }

  onSearchChange(): void {
    // Search is reactive via signal, no action needed
  }

  getServerCardClass(server: InstanceWithLabels): string {
    const isSelected = this.isSelected(server);
    return isSelected
      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
      : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600';
  }

  formatMemory(mb: number | undefined): string {
    if (!mb) return '';
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(0)} GB`;
    }
    return `${mb} MB`;
  }
}
