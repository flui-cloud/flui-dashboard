import { Component, OnInit, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideKey,
  lucidePlus,
  lucideLoader,
  lucideCircleAlert,
  lucideCheck,
} from '@ng-icons/lucide';
import { ProviderWizardService } from '../../services/provider-wizard.service';
import { SSHKeyDto } from '../../../core/api/model/models';

/**
 * SSH Key Selector Component
 *
 * Reusable component for selecting or creating SSH keys.
 * - List existing keys with provider availability badges
 * - Create new key with optional provider targeting
 * - Skip SSH key selection
 */
@Component({
  selector: 'app-ssh-key-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideKey,
      lucidePlus,
      lucideLoader,
      lucideCircleAlert,
      lucideCheck,
    }),
  ],
  template: `
    <div class="space-y-6">
      <!-- Description -->
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          SSH Key (Optional)
        </label>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Choose an SSH key for secure access to your resources. You can skip this step and add it later.
        </p>
      </div>

      <!-- Loading State -->
      <div *ngIf="wizardService.isSshKeyLoading()" class="flex items-center justify-center py-12">
        <ng-icon name="lucideLoader" size="32" class="animate-spin text-blue-500"></ng-icon>
      </div>

      <!-- Error State -->
      <div
        *ngIf="wizardService.sshKeyError() && !wizardService.isSshKeyLoading()"
        class="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg"
      >
        <ng-icon name="lucideCircleAlert" size="20"></ng-icon>
        <span>{{ wizardService.sshKeyError() }}</span>
      </div>

      <!-- SSH Keys List -->
      <div *ngIf="!wizardService.isSshKeyLoading() && !wizardService.sshKeyError()">
        <!-- No SSH Key Option -->
        <div
          (click)="selectKey(undefined)"
          [class]="getKeyCardClass(undefined)"
          class="p-4 mb-3 border-2 rounded-lg cursor-pointer transition-all"
        >
          <div class="flex items-center gap-3">
            <div class="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <ng-icon name="lucideKey" size="20" class="text-slate-500 dark:text-slate-400"></ng-icon>
            </div>
            <div>
              <h3 class="font-semibold text-slate-900 dark:text-white">No SSH Key</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">Skip SSH key configuration</p>
            </div>
          </div>
        </div>

        <!-- Existing SSH Keys -->
        <div
          *ngFor="let key of wizardService.sshKeysData()"
          (click)="selectKey(key.id)"
          [class]="getKeyCardClass(key.id)"
          class="p-4 mb-3 border-2 rounded-lg cursor-pointer transition-all"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0">
                <ng-icon name="lucideKey" size="20" class="text-green-600 dark:text-green-400"></ng-icon>
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-slate-900 dark:text-white">{{ key.name }}</h3>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  {{ key.type }} · {{ formatDate(key.createdAt) }}
                </p>
                <!-- Provider availability badges -->
                <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  @for (p of getProviderBadges(key); track p.id) {
                    <span [class]="p.available
                      ? 'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'">
                      {{ p.label }}
                    </span>
                  }
                </div>
              </div>
            </div>
            <ng-icon
              *ngIf="selectedKeyId() === key.id"
              name="lucideCheck"
              size="24"
              class="text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2"
            ></ng-icon>
          </div>
        </div>

        <!-- Empty State -->
        <div
          *ngIf="wizardService.sshKeysData().length === 0"
          class="text-center py-8 text-slate-500 dark:text-slate-400"
        >
          <ng-icon name="lucideKey" size="48" class="mx-auto mb-3 opacity-30"></ng-icon>
          <p>No SSH keys found. Create your first key below.</p>
        </div>

        <!-- Create New SSH Key -->
        <div class="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
          <button
            *ngIf="!showCreateForm()"
            (click)="showCreateForm.set(true)"
            class="flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <ng-icon name="lucidePlus" size="20"></ng-icon>
            <span>Create New SSH Key</span>
          </button>

          <!-- Create Form -->
          <div *ngIf="showCreateForm()" class="space-y-4">
            <h3 class="font-semibold text-slate-900 dark:text-white">Create New SSH Key</h3>

            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Key Name <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                [(ngModel)]="newKeyName"
                placeholder="e.g., production-key"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                User Name <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                [(ngModel)]="newKeyUserName"
                placeholder="e.g., admin"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>

            <!-- Create Error -->
            <div
              *ngIf="createError()"
              class="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm"
            >
              <ng-icon name="lucideCircleAlert" size="16"></ng-icon>
              <span>{{ createError() }}</span>
            </div>

            <div class="flex items-center gap-3">
              <button
                (click)="createKey()"
                [disabled]="!canCreateKey() || isCreating()"
                [class]="getCreateButtonClass()"
                class="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
              >
                <ng-icon
                  *ngIf="isCreating()"
                  name="lucideLoader"
                  size="16"
                  class="animate-spin"
                ></ng-icon>
                <ng-icon *ngIf="!isCreating()" name="lucidePlus" size="16"></ng-icon>
                <span>{{ isCreating() ? 'Creating...' : 'Create Key' }}</span>
              </button>

              <button
                (click)="cancelCreate()"
                [disabled]="isCreating()"
                class="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class SshKeySelectorComponent implements OnInit {
  readonly wizardService = inject(ProviderWizardService);

  // === Inputs ===
  readonly selectedKeyId = input<string | undefined>(undefined);

  // === Outputs ===
  readonly keySelected = output<string | undefined>();

  // === State ===
  readonly showCreateForm = signal<boolean>(false);
  readonly isCreating = signal<boolean>(false);
  readonly createError = signal<string | null>(null);
  newKeyName = '';
  newKeyUserName = '';

  // All known providers for badge display
  private readonly ALL_PROVIDERS = [
    { id: 'hetzner', label: 'Hetzner' },
    { id: 'contabo', label: 'Contabo' },
    { id: 'scaleway', label: 'Scaleway' },
  ];

  // === Lifecycle ===

  ngOnInit(): void {
    void (async () => {
      try {
        await this.wizardService.loadSshKeys();
      } catch (error) {
        console.error('Failed to load SSH key data:', error);
      }
    })();
  }

  // === Methods ===

  selectKey(keyId: string | undefined): void {
    this.keySelected.emit(keyId);
  }

  /**
   * Returns badges for all known providers indicating availability on each.
   * Green = key is synced there, grey = not synced.
   */
  getProviderBadges(key: SSHKeyDto): { id: string; label: string; available: boolean }[] {
    const mappings = key.providerKeyMappings as Record<string, string> | undefined;
    return this.ALL_PROVIDERS.map(p => ({
      id: p.id,
      label: p.label,
      available: !!mappings?.[p.id],
    }));
  }

  async createKey(): Promise<void> {
    if (!this.canCreateKey()) return;

    this.isCreating.set(true);
    this.createError.set(null);

    try {
      const newKey = await this.wizardService.createSshKey(
        this.newKeyName,
        this.newKeyUserName,
      );

      // Reset form
      this.newKeyName = '';
      this.newKeyUserName = '';
      this.showCreateForm.set(false);

      // Auto-select the new key
      this.selectKey(newKey.id);
    } catch (error: any) {
      console.error('Failed to create SSH key:', error);
      this.createError.set(error?.message || 'Failed to create SSH key. Please try again.');
    } finally {
      this.isCreating.set(false);
    }
  }

  cancelCreate(): void {
    this.newKeyName = '';
    this.newKeyUserName = '';
    this.showCreateForm.set(false);
    this.createError.set(null);
  }

  canCreateKey(): boolean {
    return this.newKeyName.trim().length > 0 && this.newKeyUserName.trim().length > 0;
  }

  formatDate(date: string | undefined): string {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString();
  }

  // === Styling Methods ===

  getKeyCardClass(keyId: string | undefined): string {
    const isSelected = this.selectedKeyId() === keyId;

    if (isSelected) {
      return 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20';
    }

    return 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800/50';
  }

  getCreateButtonClass(): string {
    if (!this.canCreateKey() || this.isCreating()) {
      return 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed';
    }

    return 'bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-600';
  }
}
