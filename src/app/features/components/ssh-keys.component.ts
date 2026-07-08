import { Component, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideKey,
  lucideTrash2,
  lucideCopy,
  lucideDownload,
  lucideCalendar,
  lucideServer,
  lucideX,
  lucideTriangleAlert,
  lucideCheck,
  lucideBot,
  lucideRefreshCw,
  lucideLoader,
  lucideXCircle,
  lucideArrowDown,
  lucideArrowUp
} from '@ng-icons/lucide';
import { forkJoin, map } from 'rxjs';
import { SSHKeyDto, CreateSSHKeyDto, UpdateSSHKeyDto, AccessManagementService } from '../../core/api';

import { ProviderLogoService } from '../../shared/services/provider-logo.service';
import { ProvidersService } from '../service/providers.service';

type ProviderSlug = 'contabo' | 'hetzner' | 'scaleway';

@Component({
  selector: 'app-ssh-keys',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgIcon
  ],
  providers: [
    provideIcons({
      lucidePlus,
      lucideKey,
      lucideTrash2,
      lucideCopy,
      lucideDownload,
      lucideCalendar,
      lucideServer,
      lucideX,
      lucideTriangleAlert,
      lucideCheck,
      lucideBot,
      lucideRefreshCw,
      lucideLoader,
      lucideXCircle,
      lucideArrowDown,
      lucideArrowUp
    })
  ],
  template: `
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-foreground">SSH Keys</h1>
          <p class="text-muted-foreground mt-1">Manage SSH keys for secure server access</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            (click)="loadSshKeys()"
            [disabled]="isLoading()"
            class="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <ng-icon name="lucideRefreshCw" class="w-4 h-4" [class.animate-spin]="isLoading()"></ng-icon>
          </button>
          <button
            (click)="showAddModal = true"
            class="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <ng-icon name="lucidePlus" class="w-4 h-4 mr-2"></ng-icon>
            Add SSH Key
          </button>
        </div>
      </div>

      <div *ngIf="isLoading()" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="animate-pulse bg-muted rounded-lg h-20"></div>
          <div class="animate-pulse bg-muted rounded-lg h-20"></div>
          <div class="animate-pulse bg-muted rounded-lg h-20"></div>
          <div class="animate-pulse bg-muted rounded-lg h-20"></div>
        </div>
        <div class="animate-pulse">
          <div class="h-4 bg-muted rounded w-1/4 mb-4"></div>
          <div class="space-y-3">
            <div class="h-16 bg-muted rounded-lg"></div>
            <div class="h-16 bg-muted rounded-lg"></div>
            <div class="h-16 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>

      <div *ngIf="error()" class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
        <div class="flex items-center space-x-2">
          <ng-icon name="lucideTriangleAlert" class="w-5 h-5 text-destructive"></ng-icon>
          <span class="text-sm font-medium text-destructive">{{ error() }}</span>
        </div>
      </div>

      <div *ngIf="!isLoading()">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-card text-card-foreground rounded-lg border p-4">
            <div class="flex items-center">
              <div class="bg-primary/10 text-primary p-2 rounded-md">
                <ng-icon name="lucideKey" class="w-6 h-6"></ng-icon>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-muted-foreground">Total Keys</p>
                <p class="text-2xl font-semibold text-foreground">{{ sshKeys().length }}</p>
              </div>
            </div>
          </div>
          <div class="bg-card text-card-foreground rounded-lg border p-4">
            <div class="flex items-center">
              <div class="bg-green-500/10 text-green-600 p-2 rounded-md">
                <ng-icon name="lucideServer" class="w-6 h-6"></ng-icon>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-muted-foreground">Active Keys</p>
                <p class="text-2xl font-semibold text-foreground">{{ activeKeysCount() }}</p>
              </div>
            </div>
          </div>
          <div class="bg-card text-card-foreground rounded-lg border p-4">
            <div class="flex items-center">
              <div class="bg-purple-500/10 text-purple-600 p-2 rounded-md">
                <ng-icon name="lucideCalendar" class="w-6 h-6"></ng-icon>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-muted-foreground">Recent</p>
                <p class="text-2xl font-semibold text-foreground">{{ recentKeysCount() }}</p>
              </div>
            </div>
          </div>
          <div class="bg-card text-card-foreground rounded-lg border p-4">
            <div class="flex items-center">
              <div class="bg-blue-500/10 text-blue-600 p-2 rounded-md">
                <ng-icon name="lucideBot" class="w-6 h-6"></ng-icon>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-muted-foreground">Auto-generated</p>
                <p class="text-2xl font-semibold text-foreground">{{ autoGeneratedKeysCount() }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-card text-card-foreground rounded-lg border mt-4">
          <div class="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 class="text-lg font-semibold text-foreground">SSH Keys</h2>
            @if (selectedKeys().size > 0) {
              <div class="flex items-center gap-3">
                <span class="text-sm text-muted-foreground">{{ selectedKeys().size }} selected</span>
                <button
                  (click)="clearSelection()"
                  class="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Deselect all
                </button>
                <button
                  (click)="openBulkDeleteModal()"
                  class="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
                >
                  <ng-icon name="lucideTrash2" class="w-3.5 h-3.5"></ng-icon>
                  Delete selected
                </button>
              </div>
            }
          </div>

          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-muted/50">
                <tr>
                  <th class="px-4 py-3 w-10">
                    <input type="checkbox"
                      class="accent-primary w-4 h-4 cursor-pointer"
                      [checked]="isAllSelected()"
                      [indeterminate]="isIndeterminate()"
                      (change)="toggleSelectAll()"
                    >
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Fingerprint
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Providers
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <button (click)="toggleDateSort()" class="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                      Created
                      <ng-icon [name]="dateSort() === 'desc' ? 'lucideArrowDown' : 'lucideArrowUp'" class="w-3 h-3"></ng-icon>
                    </button>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr *ngFor="let key of sortedSshKeys(); trackBy: trackByKeyId"
                    class="hover:bg-muted/50 transition-colors"
                    [ngClass]="{'bg-primary/5': selectedKeys().has(key.id)}">
                  <td class="px-4 py-4 w-10">
                    <input type="checkbox"
                      class="accent-primary w-4 h-4 cursor-pointer"
                      [checked]="selectedKeys().has(key.id)"
                      (change)="toggleKeySelection(key.id)"
                    >
                  </td>
                  <td class="px-6 py-4 w-48 max-w-48">
                    <div class="flex items-center min-w-0">
                      <ng-icon name="lucideKey" class="w-5 h-5 text-muted-foreground mr-3 shrink-0"></ng-icon>
                      <div class="min-w-0">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="text-sm font-medium text-foreground truncate" [title]="key.name">{{ key.name }}</span>
                          <span *ngIf="key.autoGenerated"
                                class="inline-flex items-center shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20"
                                title="Auto-generated by system">
                            <ng-icon name="lucideBot" class="w-3 h-3 mr-1"></ng-icon>
                            Auto
                          </span>
                        </div>
                        <div class="text-sm text-muted-foreground">{{ key.type.toUpperCase() }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 w-56 max-w-56">
                    <div class="text-sm text-foreground font-mono bg-muted px-2 py-1 rounded truncate" [title]="getFingerprint(key)">
                      {{ getFingerprint(key) }}
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      @for (p of getProviderSyncStatus(key); track p.id) {
                        @if (!p.synced && !p.error) {
                          <button
                            (click)="syncKeyToProvider(key, p.id)"
                            [disabled]="isSyncing(key.id, p.id) || isUnsyncing(key.id, p.id)"
                            class="inline-flex items-center gap-1 px-2 py-1 rounded border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            [title]="'Sync to ' + p.displayName"
                          >
                            <img *ngIf="p.logoUrl" [src]="p.logoUrl" [alt]="p.displayName" class="w-4 h-4 object-contain opacity-40" />
                            <ng-icon *ngIf="!p.logoUrl" name="lucideServer" class="w-3 h-3"></ng-icon>
                            <ng-icon *ngIf="isSyncing(key.id, p.id)" name="lucideLoader" class="w-3 h-3 animate-spin"></ng-icon>
                            <ng-icon *ngIf="!isSyncing(key.id, p.id)" name="lucideRefreshCw" class="w-3 h-3"></ng-icon>
                          </button>
                        }
                        @if (p.error) {
                          <button
                            (click)="syncKeyToProvider(key, p.id)"
                            [disabled]="isSyncing(key.id, p.id)"
                            class="inline-flex items-center gap-1 px-2 py-1 rounded border border-orange-400/50 bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            [title]="p.error"
                          >
                            <img *ngIf="p.logoUrl" [src]="p.logoUrl" [alt]="p.displayName" class="w-4 h-4 object-contain opacity-70" />
                            <ng-icon *ngIf="!p.logoUrl" name="lucideServer" class="w-3 h-3"></ng-icon>
                            <ng-icon *ngIf="isSyncing(key.id, p.id)" name="lucideLoader" class="w-3 h-3 animate-spin"></ng-icon>
                            <ng-icon *ngIf="!isSyncing(key.id, p.id)" name="lucideTriangleAlert" class="w-3 h-3"></ng-icon>
                          </button>
                        }
                        @if (p.synced) {
                          <div class="inline-flex items-center rounded border border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400 overflow-hidden">
                            <span class="inline-flex items-center gap-1 px-2 py-1" [title]="p.displayName + ' — synced'">
                              <img *ngIf="p.logoUrl" [src]="p.logoUrl" [alt]="p.displayName" class="w-4 h-4 object-contain" />
                              <ng-icon *ngIf="!p.logoUrl" name="lucideServer" class="w-3 h-3"></ng-icon>
                              <ng-icon name="lucideCheck" class="w-3 h-3"></ng-icon>
                            </span>
                            <button
                              (click)="unsyncKeyFromProvider(key, p.id)"
                              [disabled]="isUnsyncing(key.id, p.id) || isSyncing(key.id, p.id)"
                              class="px-1 py-1 hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 transition-colors border-l border-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                              [title]="'Remove from ' + p.displayName"
                            >
                              <ng-icon *ngIf="isUnsyncing(key.id, p.id)" name="lucideLoader" class="w-3 h-3 animate-spin"></ng-icon>
                              <ng-icon *ngIf="!isUnsyncing(key.id, p.id)" name="lucideXCircle" class="w-3 h-3"></ng-icon>
                            </button>
                          </div>
                        }
                      }
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {{ formatDate(key.createdAt) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex items-center space-x-2">
                      <button
                        (click)="copyPublicKey(key)"
                        class="text-muted-foreground hover:text-primary p-1 rounded hover:bg-primary/10 transition-colors"
                        title="Copy public key"
                      >
                        <ng-icon name="lucideCopy" class="w-4 h-4"></ng-icon>
                      </button>
                      <button
                        (click)="downloadKey(key)"
                        class="text-muted-foreground hover:text-green-600 p-1 rounded hover:bg-green-600/10 transition-colors"
                        title="Download key"
                      >
                        <ng-icon name="lucideDownload" class="w-4 h-4"></ng-icon>
                      </button>
                      <button
                        (click)="deleteKey(key)"
                        class="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors"
                        title="Delete key"
                      >
                        <ng-icon name="lucideTrash2" class="w-4 h-4"></ng-icon>
                      </button>
                    </div>
                  </td>
                </tr>

                <tr *ngIf="!isLoading() && sshKeys().length === 0 && !error()">
                  <td colspan="6" class="px-6 py-12 text-center text-muted-foreground">
                    <div class="flex flex-col items-center">
                      <ng-icon name="lucideKey" class="w-12 h-12 text-muted-foreground/50 mb-4"></ng-icon>
                      <p class="text-lg font-medium">No SSH keys found</p>
                      <p class="mt-1">Add your first SSH key to get started</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div *ngIf="showBulkDeleteModal" class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-card text-card-foreground border rounded-lg shadow-lg w-full max-w-lg">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <div class="flex items-center space-x-3">
            <div class="bg-destructive/10 text-destructive p-2 rounded-md">
              <ng-icon name="lucideTrash2" class="w-5 h-5"></ng-icon>
            </div>
            <h3 class="text-lg font-semibold text-foreground">Delete {{ selectedKeys().size }} keys</h3>
          </div>
          <button (click)="closeBulkDeleteModal()" [disabled]="isBulkDeleting()"
            class="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors disabled:opacity-50">
            <ng-icon name="lucideX" class="w-5 h-5"></ng-icon>
          </button>
        </div>

        <div class="p-6 space-y-4">
          @if (isBulkDeleting()) {
            <div class="space-y-2">
              <div class="flex justify-between text-sm text-muted-foreground">
                <span>Deleting...</span>
                <span>{{ bulkDeleteProgress() }} / {{ selectedKeys().size }}</span>
              </div>
              <div class="w-full bg-muted rounded-full h-1.5">
                <div class="bg-primary h-1.5 rounded-full transition-all duration-300"
                     [style.width.%]="(bulkDeleteProgress() / selectedKeys().size) * 100"></div>
              </div>
            </div>
          }

          @if (bulkDeleteError()) {
            <div class="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <ng-icon name="lucideXCircle" class="w-4 h-4 shrink-0"></ng-icon>
              {{ bulkDeleteError() }}
            </div>
          }
          @if (bulkDeleteSuccess()) {
            <div class="flex items-center gap-2 px-3 py-2 rounded-md bg-green-500/10 border border-green-500/20 text-sm text-green-600">
              <ng-icon name="lucideCheck" class="w-4 h-4 shrink-0"></ng-icon>
              {{ bulkDeleteSuccessMessage() }}
            </div>
          }

          @if (!isBulkDeleting() && !bulkDeleteSuccess()) {
            <div>
              <p class="text-sm font-medium text-foreground mb-2">Remove from</p>
              <select
                [value]="bulkDeleteScope()"
                (change)="bulkDeleteScope.set($any($event.target).value)"
                class="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">DB + all synced providers</option>
                <option value="db-only">Local database only</option>
                @for (p of activeBulkProviders(); track p.id) {
                  <option [value]="p.id">DB + {{ p.displayName }} only</option>
                }
              </select>
            </div>
            <p class="text-sm text-destructive">This action cannot be undone.</p>
          }
        </div>

        <div class="flex justify-end space-x-3 p-6 pt-0">
          <button (click)="closeBulkDeleteModal()" [disabled]="isBulkDeleting()"
            class="px-4 py-2 text-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors disabled:opacity-50">
            {{ bulkDeleteSuccess() ? 'Close' : 'Cancel' }}
          </button>
          @if (!bulkDeleteSuccess()) {
            <button (click)="confirmBulkDelete()" [disabled]="isBulkDeleting()"
              class="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors inline-flex items-center gap-2 disabled:opacity-70"
              [class.animate-pulse]="isBulkDeleting()">
              @if (isBulkDeleting()) {
                <ng-icon name="lucideLoader" class="w-4 h-4 animate-spin"></ng-icon>
                Deleting...
              } @else {
                <ng-icon name="lucideTrash2" class="w-4 h-4"></ng-icon>
                Delete {{ selectedKeys().size }} keys
              }
            </button>
          }
        </div>
      </div>
    </div>

    <div *ngIf="showDeleteModal" class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-card text-card-foreground border rounded-lg shadow-lg w-full max-w-lg">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <div class="flex items-center space-x-3">
            <div class="bg-destructive/10 text-destructive p-2 rounded-md">
              <ng-icon name="lucideTriangleAlert" class="w-5 h-5"></ng-icon>
            </div>
            <h3 class="text-lg font-semibold text-foreground">Delete SSH Key</h3>
          </div>
          <button
            (click)="cancelDelete()"
            class="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
          >
            <ng-icon name="lucideX" class="w-5 h-5"></ng-icon>
          </button>
        </div>

        <div class="p-6 space-y-4">
          <div class="bg-muted rounded-md p-3">
            <div class="flex items-center space-x-2 mb-1">
              <ng-icon name="lucideKey" class="w-4 h-4 text-muted-foreground shrink-0"></ng-icon>
              <span class="font-medium text-foreground truncate" [title]="keyToDelete?.name">{{ keyToDelete?.name }}</span>
            </div>
            <div class="text-sm text-muted-foreground font-mono truncate" [title]="keyToDelete?.fingerprint">
              {{ keyToDelete?.fingerprint }}
            </div>
          </div>

          <div>
            <p class="text-sm font-medium text-foreground mb-2">Remove from</p>
            @if (keyToDelete?.syncedFromProvider) {
              <div class="px-3 py-2 text-sm bg-muted border border-border rounded-md text-muted-foreground">
                Provider: <span class="font-medium text-foreground capitalize">{{ keyToDelete?.source }}</span>
                <span class="ml-2 text-xs">(key not stored locally)</span>
              </div>
            } @else {
              <select
                [value]="deleteScope()"
                (change)="deleteScope.set($any($event.target).value)"
                class="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">DB + all synced providers</option>
                <option value="db-only">Local database only</option>
                @for (p of deleteSyncedProviders(); track p.id) {
                  <option [value]="p.id">DB + {{ p.displayName }} only</option>
                }
              </select>
            }
          </div>

          @if (!deleteSuccess()) {
            <p class="text-sm text-destructive">This action cannot be undone.</p>
          }

          @if (deleteError()) {
            <div class="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <ng-icon name="lucideXCircle" class="w-4 h-4 shrink-0"></ng-icon>
              {{ deleteError() }}
            </div>
          }

          @if (deleteSuccess()) {
            <div class="flex items-center gap-2 px-3 py-2 rounded-md bg-green-500/10 border border-green-500/20 text-sm text-green-600">
              <ng-icon name="lucideCheck" class="w-4 h-4 shrink-0"></ng-icon>
              Key deleted successfully.
            </div>
          }
        </div>

        <div class="flex justify-end space-x-3 p-6 pt-0">
          <button
            (click)="cancelDelete()"
            [disabled]="isDeleting()"
            class="px-4 py-2 text-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors disabled:opacity-50"
          >
            {{ deleteSuccess() ? 'Close' : 'Cancel' }}
          </button>
          @if (!deleteSuccess()) {
            <button
              (click)="confirmDelete()"
              [disabled]="isDeleting()"
              class="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors inline-flex items-center gap-2 disabled:opacity-70"
              [class.animate-pulse]="isDeleting()"
            >
              @if (isDeleting()) {
                <ng-icon name="lucideLoader" class="w-4 h-4 animate-spin"></ng-icon>
                Deleting...
              } @else {
                <ng-icon name="lucideTrash2" class="w-4 h-4"></ng-icon>
                Delete Key
              }
            </button>
          }
        </div>
      </div>
    </div>

    <div *ngIf="showAddModal" class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-card text-card-foreground border rounded-lg shadow-lg w-full max-w-2xl">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 class="text-lg font-semibold text-foreground">Add SSH Key</h3>
            <p class="text-muted-foreground mt-1">Add a new SSH key for server access</p>
          </div>
          <button
            (click)="showAddModal = false"
            class="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
          >
            <ng-icon name="lucideX" class="w-5 h-5"></ng-icon>
          </button>
        </div>

        <form [formGroup]="addKeyForm" (ngSubmit)="onSubmitNewKey()" class="p-6">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">
                Key Name *
              </label>
              <input
                type="text"
                formControlName="name"
                class="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="My SSH Key"
              />
              <p *ngIf="addKeyForm.get('name')?.invalid && addKeyForm.get('name')?.touched" class="text-sm text-destructive mt-1">
                Name is required (min 3 characters)
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground mb-2">
                User Name *
              </label>
              <input
                type="text"
                formControlName="userName"
                class="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="e.g. admin, root"
              />
              <p *ngIf="addKeyForm.get('userName')?.invalid && addKeyForm.get('userName')?.touched" class="text-sm text-destructive mt-1">
                User name is required
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground mb-2">
                Method
              </label>
              <div class="space-y-2">
                <label class="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    formControlName="generateNew"
                    [value]="true"
                    class="mr-3 text-primary"
                  />
                  <span class="text-sm text-foreground">Generate new key pair</span>
                </label>
                <label class="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    formControlName="generateNew"
                    [value]="false"
                    class="mr-3 text-primary"
                  />
                  <span class="text-sm text-foreground">Import existing public key</span>
                </label>
              </div>
            </div>

            <div *ngIf="!addKeyForm.get('generateNew')?.value">
              <label class="block text-sm font-medium text-foreground mb-2">
                Public Key *
              </label>
              <textarea
                formControlName="publicKey"
                rows="4"
                class="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent font-mono text-sm resize-none"
                placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAA..."
              ></textarea>
              <p class="text-xs text-muted-foreground mt-1">
                Paste your SSH public key here
              </p>
              <p *ngIf="addKeyForm.get('publicKey')?.invalid && addKeyForm.get('publicKey')?.touched" class="text-sm text-destructive mt-1">
                Public key is required
              </p>
            </div>

            <div *ngIf="addKeyForm.get('generateNew')?.value" class="bg-primary/10 border border-primary/20 rounded-md p-4">
              <div class="flex">
                <ng-icon name="lucideKey" class="w-5 h-5 text-primary mr-2 mt-0.5 flex-shrink-0"></ng-icon>
                <div class="text-sm">
                  <p class="font-medium text-foreground">New Key Generation</p>
                  <p class="text-muted-foreground mt-1">
                    A new SSH key pair will be generated by the server.
                    The private key will be available for download after creation.
                  </p>
                </div>
              </div>
            </div>

            <div *ngIf="!addKeyForm.get('generateNew')?.value" class="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-4">
              <div class="flex">
                <ng-icon name="lucideTriangleAlert" class="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0"></ng-icon>
                <div class="text-sm">
                  <p class="font-medium text-foreground">Import Not Yet Supported</p>
                  <p class="text-muted-foreground mt-1">
                    The API currently only supports generating new keys. Importing existing public keys will be available in a future update.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground mb-1">
                Sync to Providers
              </label>
              <p class="text-xs text-muted-foreground mb-2">
                Leave empty to sync to all configured providers automatically.
              </p>
              <div class="flex flex-wrap gap-2">
                @for (p of enabledProviders(); track p.provider) {
                  <button
                    type="button"
                    (click)="toggleProvider(p.provider)"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 transition-all text-sm font-medium"
                    [class]="isProviderSelected(p.provider)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'"
                  >
                    <ng-icon *ngIf="isProviderSelected(p.provider)" name="lucideCheck" class="w-3 h-3"></ng-icon>
                    {{ p.provider }}
                  </button>
                }
              </div>
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-6 pt-4 border-t border-border">
            <button
              type="button"
              (click)="showAddModal = false"
              class="px-4 py-2 text-muted-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              [disabled]="addKeyForm.invalid || !addKeyForm.get('generateNew')?.value"
              class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center"
            >
              <ng-icon name="lucideKey" class="w-4 h-4 mr-2"></ng-icon>
              Generate Key
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class SshKeysComponent {
  showAddModal = false;
  showDeleteModal = false;
  keyToDelete: SSHKeyDto | null = null;
  deleteScope = signal<string>('all');
  deleteSyncedProviders = signal<{ id: string; displayName: string; logoUrl: string | null }[]>([]);
  isDeleting = signal(false);
  deleteError = signal<string | null>(null);
  deleteSuccess = signal(false);

  selectedKeys = signal<Set<string>>(new Set());
  showBulkDeleteModal = false;
  bulkDeleteScope = signal<string>('all');
  isBulkDeleting = signal(false);
  bulkDeleteProgress = signal(0);
  bulkDeleteError = signal<string | null>(null);
  bulkDeleteSuccess = signal(false);
  bulkDeleteSuccessMessage = signal('');
  addKeyForm: FormGroup;
  protected readonly accessManagementService = inject(AccessManagementService);

  private readonly providerLogo = inject(ProviderLogoService);
  private readonly providersService = inject(ProvidersService);

  private readonly providerLogos = signal<Record<string, string | null>>({});

  sshKeys = signal<SSHKeyDto[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  selectedProviders = signal<string[]>([]);
  dateSort = signal<'desc' | 'asc'>('desc');

  readonly sortedSshKeys = computed(() => {
    const dir = this.dateSort();
    return [...this.sshKeys()].sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return dir === 'desc' ? -diff : diff;
    });
  });
  private readonly syncingSet = signal<Set<string>>(new Set());
  private readonly unsyncingSet = signal<Set<string>>(new Set());

  readonly enabledProviders = computed(() =>
    this.providersService.activeProviders()
  );

  activeKeysCount = computed(() =>
    this.sshKeys().filter(key => key.isActive).length
  );

  recentKeysCount = computed(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return this.sshKeys().filter(key =>
      new Date(key.createdAt) > oneWeekAgo
    ).length;
  });

  autoGeneratedKeysCount = computed(() =>
    this.sshKeys().filter(key => key.autoGenerated).length
  );

  constructor(private readonly fb: FormBuilder) {
    effect(() => {
      for (const def of this.providersService.availableProviders()) {
        if (!def.id) continue;
        const id = def.id;
        this.providerLogo.resolveUrl(def.logoUrl).then((url) => {
          this.providerLogos.update((map) => ({ ...map, [id]: url }));
        });
      }
    });

    this.addKeyForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      userName: ['', [Validators.required]],
      publicKey: [''],
      generateNew: [true]
    });

    this.addKeyForm.get('generateNew')?.valueChanges.subscribe(generateNew => {
      const publicKeyControl = this.addKeyForm.get('publicKey');
      if (generateNew) {
        publicKeyControl?.clearValidators();
        publicKeyControl?.setValue('');
      } else {
        publicKeyControl?.setValidators([Validators.required]);
      }
      publicKeyControl?.updateValueAndValidity();
    });

    this.providersService.loadProviders();
    this.providersService.loadConfigurations$().subscribe(() => {
      this.loadSshKeys();
    });
  }

  isProviderSelected(providerId: string): boolean {
    return this.selectedProviders().includes(providerId);
  }

  toggleProvider(providerId: string): void {
    this.selectedProviders.update(current =>
      current.includes(providerId)
        ? current.filter(id => id !== providerId)
        : [...current, providerId]
    );
  }

  getProviderSyncStatus(key: SSHKeyDto): { id: string; displayName: string; logoUrl: string | null; synced: boolean; error: string | null }[] {
    const mappings = key.providerKeyMappings as Record<string, string> | undefined;
    const errors = key.syncErrors as Record<string, string> | undefined;
    const definitions = this.providersService.availableProviders();
    const logos = this.providerLogos();
    return this.providersService.activeProviders().map(config => {
      const def = definitions.find(d => d.id === config.provider);
      const logoUrl = logos[config.provider] ?? null;
      const synced = !!mappings?.[config.provider];
      const error = (!synced && errors?.[config.provider]) ? errors[config.provider] : null;
      return { id: config.provider, displayName: def?.displayName ?? config.provider, logoUrl, synced, error };
    });
  }

  isSyncing(keyId: string, providerId: string): boolean {
    return this.syncingSet().has(`${keyId}:${providerId}`);
  }

  isUnsyncing(keyId: string, providerId: string): boolean {
    return this.unsyncingSet().has(`${keyId}:${providerId}`);
  }

  syncKeyToProvider(key: SSHKeyDto, providerId: string): void {
    const token = `${key.id}:${providerId}`;
    this.syncingSet.update(s => { const n = new Set(s); n.add(token); return n; });

    const dto: UpdateSSHKeyDto = {
      syncProviders: [providerId as UpdateSSHKeyDto.SyncProvidersEnum],
    };

    this.accessManagementService.accessControllerUpdateSSHKey(key.id, dto, 'response').subscribe({
      next: (response) => {
        this.sshKeys.update(keys => keys.map(k => k.id === response.body?.id ? response.body : k));
        this.syncingSet.update(s => { const n = new Set(s); n.delete(token); return n; });
      },
      error: (err) => {
        console.error('Failed to sync key to provider:', err);
        this.syncingSet.update(s => { const n = new Set(s); n.delete(token); return n; });
      },
    });
  }

  unsyncKeyFromProvider(key: SSHKeyDto, providerId: string): void {
    const token = `${key.id}:${providerId}`;
    this.unsyncingSet.update(s => { const n = new Set(s); n.add(token); return n; });

    const dto: UpdateSSHKeyDto = {
      unsyncProviders: [providerId as UpdateSSHKeyDto.UnsyncProvidersEnum],
    };

    this.accessManagementService.accessControllerUpdateSSHKey(key.id, dto, 'response').subscribe({
      next: (response) => {
        this.sshKeys.update(keys => keys.map(k => k.id === response.body?.id ? response.body : k));
        this.unsyncingSet.update(s => { const n = new Set(s); n.delete(token); return n; });
      },
      error: (err) => {
        console.error('Failed to unsync key from provider:', err);
        this.unsyncingSet.update(s => { const n = new Set(s); n.delete(token); return n; });
      },
    });
  }

  loadSshKeys(): void {
    this.isLoading.set(true);
    this.error.set(null);

    const activeProviders = this.providersService.activeProviders()
      .map(c => c.provider.toLowerCase() as ProviderSlug);

    const calls = activeProviders.length > 0
      ? activeProviders.map(p => this.accessManagementService.accessControllerListSSHKeys(undefined, undefined, undefined, p))
      : [this.accessManagementService.accessControllerListSSHKeys()];

    forkJoin(calls).pipe(
      map(results => {
        const seen = new Set<string>();
        return results.flat().filter(k => {
          if (seen.has(k.fingerprint)) return false;
          seen.add(k.fingerprint);
          return true;
        });
      })
    ).subscribe({
      next: (keys) => {
        this.sshKeys.set(keys);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading SSH keys:', err);
        this.error.set('Failed to load SSH keys. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  toggleDateSort(): void {
    this.dateSort.update(d => d === 'desc' ? 'asc' : 'desc');
  }

  readonly isAllSelected = computed(() =>
    this.sortedSshKeys().length > 0 && this.sortedSshKeys().every(k => this.selectedKeys().has(k.id))
  );

  readonly isIndeterminate = computed(() =>
    this.selectedKeys().size > 0 && !this.isAllSelected()
  );

  readonly activeBulkProviders = computed(() => {
    const defs = this.providersService.availableProviders();
    return this.providersService.activeProviders().map(c => {
      const def = defs.find(d => d.id === c.provider);
      return { id: c.provider, displayName: def?.displayName ?? c.provider };
    });
  });

  toggleKeySelection(id: string): void {
    this.selectedKeys.update(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.selectedKeys.set(new Set());
    } else {
      this.selectedKeys.set(new Set(this.sortedSshKeys().map(k => k.id)));
    }
  }

  clearSelection(): void {
    this.selectedKeys.set(new Set());
  }

  openBulkDeleteModal(): void {
    this.bulkDeleteScope.set('all');
    this.bulkDeleteError.set(null);
    this.bulkDeleteSuccess.set(false);
    this.bulkDeleteProgress.set(0);
    this.showBulkDeleteModal = true;
  }

  closeBulkDeleteModal(): void {
    this.showBulkDeleteModal = false;
    this.isBulkDeleting.set(false);
    this.bulkDeleteError.set(null);
    this.bulkDeleteSuccess.set(false);
    this.bulkDeleteProgress.set(0);
  }

  confirmBulkDelete(): void {
    const keys = this.sshKeys().filter(k => this.selectedKeys().has(k.id));
    if (keys.length === 0) return;

    const scope = this.bulkDeleteScope();

    this.isBulkDeleting.set(true);
    this.bulkDeleteError.set(null);
    this.bulkDeleteProgress.set(0);

    const deleteNext = (index: number, failed: number): void => {
      if (index >= keys.length) {
        this.isBulkDeleting.set(false);
        const deleted = keys.length - failed;
        let bulkDeleteMessage: string;
        if (failed === 0) {
          const plural = deleted > 1 ? 's' : '';
          bulkDeleteMessage = `${deleted} key${plural} deleted successfully.`;
        } else {
          bulkDeleteMessage = `${deleted} deleted, ${failed} failed.`;
        }
        this.bulkDeleteSuccessMessage.set(bulkDeleteMessage);
        this.bulkDeleteSuccess.set(true);
        this.clearSelection();
        setTimeout(() => this.closeBulkDeleteModal(), 2000);
        return;
      }

      const key = keys[index];
      let removeFromProviders: boolean;
      let provider: ProviderSlug | undefined;

      if (
        key.syncedFromProvider &&
        key.source !== 'local' &&
        key.source !== 'byos'
      ) {
        removeFromProviders = true;
        provider = key.source;
      } else {
        removeFromProviders = scope !== 'db-only';
        provider = (scope !== 'all' && scope !== 'db-only')
          ? scope as ProviderSlug
          : undefined;
      }

      this.accessManagementService.accessControllerRemoveSSHKey(key.id, removeFromProviders, provider).subscribe({
        next: () => {
          this.removeKeyFromState(key.id);
          this.bulkDeleteProgress.update(p => p + 1);
          deleteNext(index + 1, failed);
        },
        error: () => {
          this.bulkDeleteProgress.update(p => p + 1);
          deleteNext(index + 1, failed + 1);
        }
      });
    };

    deleteNext(0, 0);
  }

  private removeKeyFromState(id: string): void {
    this.sshKeys.update(ks => ks.filter(k => k.id !== id));
  }

  trackByKeyId(_index: number, key: SSHKeyDto): string {
    return key.id;
  }

  getFingerprint(key: SSHKeyDto): string {
    return key.fingerprint;
  }

  getUsageInfo(key: SSHKeyDto): string {
    if (!key.lastUsed) {
      return 'Never used';
    }

    const lastUsed = new Date(key.lastUsed);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Used today';
    if (diffDays === 1) return 'Used yesterday';
    if (diffDays < 7) return `Used ${diffDays} days ago`;
    if (diffDays < 30) return `Used ${Math.floor(diffDays / 7)} weeks ago`;
    return 'Not recently used';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  copyPublicKey(key: SSHKeyDto): void {
    navigator.clipboard.writeText(key.publicKey);
  }

  downloadKey(key: SSHKeyDto): void {
    const blob = new Blob([key.publicKey], { type: 'text/plain' });
    const url = globalThis.window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${key.name.replaceAll(/\s+/g, '_')}.pub`;
    a.click();
    globalThis.window.URL.revokeObjectURL(url);
  }

  deleteKey(key: SSHKeyDto): void {
    this.keyToDelete = key;
    if (key.syncedFromProvider && key.source !== 'local') {
      this.deleteScope.set(key.source as string);
    } else {
      this.deleteScope.set('all');
    }
    const synced = this.getProviderSyncStatus(key).filter(p => p.synced);
    this.deleteSyncedProviders.set(synced.map(p => ({ id: p.id, displayName: p.displayName, logoUrl: p.logoUrl })));
    this.showDeleteModal = true;
  }

  confirmDelete(): void {
    if (!this.keyToDelete) return;

    const scope = this.deleteScope();
    const removeFromProviders = scope !== 'db-only';
    const provider = (scope !== 'all' && scope !== 'db-only')
      ? scope as ProviderSlug
      : undefined;

    this.isDeleting.set(true);
    this.deleteError.set(null);

    this.accessManagementService.accessControllerRemoveSSHKey(this.keyToDelete.id, removeFromProviders, provider).subscribe({
      next: () => {
        this.sshKeys.update(keys => keys.filter(k => k.id !== this.keyToDelete!.id));
        this.isDeleting.set(false);
        this.deleteSuccess.set(true);
        setTimeout(() => this.cancelDelete(), 1500);
      },
      error: (err) => {
        console.error('Error deleting SSH key:', err);
        this.deleteError.set(err?.error?.message ?? 'Failed to delete SSH key. Please try again.');
        this.isDeleting.set(false);
      }
    });
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.keyToDelete = null;
    this.deleteScope.set('all');
    this.deleteSyncedProviders.set([]);
    this.isDeleting.set(false);
    this.deleteError.set(null);
    this.deleteSuccess.set(false);
  }

  onSubmitNewKey(): void {
    if (this.addKeyForm.valid) {
      const formValue = this.addKeyForm.value;
      const providers = this.selectedProviders();

      const createDto: CreateSSHKeyDto = {
        name: formValue.name,
        userName: formValue.userName,
        ...(providers.length > 0 && { providers: providers as CreateSSHKeyDto.ProvidersEnum[] }),
      };

      this.isLoading.set(true);
      this.error.set(null);

      this.accessManagementService.accessControllerAddSSHKey(createDto).subscribe({
        next: () => {
          this.showAddModal = false;
          this.addKeyForm.reset({ generateNew: true });
          this.selectedProviders.set([]);
          this.loadSshKeys();
        },
        error: (err) => {
          console.error('Error creating SSH key:', err);
          this.error.set('Failed to create SSH key. Please try again.');
          this.isLoading.set(false);
        }
      });
    }
  }

  refreshKeys(): void {
    this.loadSshKeys();
  }
}
