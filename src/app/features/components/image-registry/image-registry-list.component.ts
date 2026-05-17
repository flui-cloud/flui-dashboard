import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideRefreshCw, lucideLoader, lucideSearch, lucideRocket,
  lucideTrash, lucideCircleCheck, lucideTriangleAlert, lucideImage,
} from '@ng-icons/lucide';
import { ImageRegistryFeatureService } from '../../service/image-registry.service';
import { ImageResponseDto } from '../../../core/api/model/imageResponseDto';
import { FluiTagManagerComponent } from './flui-tag-manager.component';

@Component({
  selector: 'app-image-registry-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon, FluiTagManagerComponent],
  providers: [provideIcons({
    lucideRefreshCw, lucideLoader, lucideSearch, lucideRocket,
    lucideTrash, lucideCircleCheck, lucideTriangleAlert, lucideImage,
  })],
  template: `
    <div class="space-y-6 p-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold">Image Registry</h1>
          <p class="text-sm text-muted-foreground mt-1">Manage container images built by Flui</p>
        </div>
        <button (click)="refresh()" [disabled]="service.loading()"
          class="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-md text-sm hover:bg-accent transition-colors disabled:opacity-50">
          <ng-icon name="lucideRefreshCw" class="h-4 w-4" [class.animate-spin]="service.loading()" />
          Refresh
        </button>
      </div>

      <!-- Filters -->
      <div class="flex gap-3">
        <div class="relative flex-1 max-w-sm">
          <ng-icon name="lucideSearch" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" [(ngModel)]="searchQuery" placeholder="Filter by image ref or branch..."
            class="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background text-sm" />
        </div>
        <input type="text" [(ngModel)]="tagFilter" placeholder="Filter by tag..."
          class="w-40 px-3 py-2 border border-input rounded-md bg-background text-sm" />
      </div>

      <!-- Loading -->
      @if (service.loading()) {
        <div class="flex items-center justify-center py-12">
          <ng-icon name="lucideLoader" class="h-6 w-6 animate-spin text-primary" />
          <span class="ml-2 text-sm text-muted-foreground">Loading images...</span>
        </div>
      }

      <!-- Table -->
      @if (!service.loading()) {
        @if (filteredImages().length === 0) {
          <div class="text-center py-12">
            <ng-icon name="lucideImage" class="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 class="font-medium mb-1">No images found</h3>
            <p class="text-sm text-muted-foreground">Images will appear here after your first build.</p>
          </div>
        } @else {
          <div class="border border-border rounded-lg overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-muted/50 text-left">
                <tr>
                  <th class="px-4 py-3 font-medium">Image</th>
                  <th class="px-4 py-3 font-medium">Commit</th>
                  <th class="px-4 py-3 font-medium">Branch</th>
                  <th class="px-4 py-3 font-medium">Tags</th>
                  <th class="px-4 py-3 font-medium">Date</th>
                  <th class="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                @for (img of filteredImages(); track img.id) {
                  <tr [class]="img.isCurrentlyDeployed ? 'bg-green-50/50 dark:bg-green-900/5' : ''">
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        @if (img.isCurrentlyDeployed) {
                          <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            <ng-icon name="lucideCircleCheck" class="h-3 w-3" /> Live
                          </span>
                        }                          
                        <span class="font-mono text-xs truncate max-w-[200px]" [title]="img.imageRef">
                          {{ truncateRef(img.imageRef) }}
                        </span>
                      </div>
                    </td>
                    <td class="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {{ img.commitSha.slice(0, 7) }}
                    </td>
                    <td class="px-4 py-3 text-xs">{{ img.branch }}</td>
                    <td class="px-4 py-3">
                      <app-flui-tag-manager
                        [tags]="img.fluiTags"
                        (addTag)="onAddTag(img.id, $event)"
                        (removeTag)="onRemoveTag(img.id, $event)"
                      />
                    </td>
                    <td class="px-4 py-3 text-xs text-muted-foreground">
                      {{ formatDate(img.createdAt) }}
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-1">
                        <button (click)="onDeploy(img)" [disabled]="actionBusy()"
                          class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-accent transition-colors disabled:opacity-50"
                          title="Deploy this image">
                          <ng-icon name="lucideRocket" class="h-3 w-3" /> Deploy
                        </button>
                        <button (click)="onDelete(img)" [disabled]="actionBusy() || img.isCurrentlyDeployed"
                          class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-50"
                          [title]="img.isCurrentlyDeployed ? 'Cannot delete deployed image' : 'Delete image'">
                          <ng-icon name="lucideTrash" class="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

      <!-- Error -->
      @if (service.errorMessage()) {
        <div class="p-3 rounded-md border border-destructive/20 bg-destructive/5 text-sm text-destructive">
          {{ service.errorMessage() }}
        </div>
      }

      <!-- Confirm Dialog -->
      @if (confirmAction()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 class="font-semibold">{{ confirmAction()!.title }}</h3>
            <p class="text-sm text-muted-foreground">{{ confirmAction()!.message }}</p>
            <div class="flex justify-end gap-2">
              <button (click)="confirmAction.set(null)"
                class="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent">Cancel</button>
              <button (click)="executeConfirmed()" [disabled]="actionBusy()"
                class="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                @if (actionBusy()) {
                  <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin inline mr-1" />
                }
                Confirm
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ImageRegistryListComponent implements OnInit {
  service = inject(ImageRegistryFeatureService);

  searchQuery = signal('');
  tagFilter = signal('');
  actionBusy = signal(false);
  confirmAction = signal<{ title: string; message: string; action: () => Promise<void> } | null>(null);

  filteredImages = computed(() => {
    let images = this.service.images();
    const search = this.searchQuery().toLowerCase();
    const tag = this.tagFilter().trim().toLowerCase();

    if (search) {
      images = images.filter(i =>
        i.imageRef.toLowerCase().includes(search) ||
        i.branch.toLowerCase().includes(search) ||
        i.commitSha?.toLowerCase().includes(search)
      );
    }
    if (tag) {
      images = images.filter(i => i.fluiTags.some(t => t.toLowerCase().includes(tag)));
    }
    return images;
  });

  ngOnInit(): void {
    void (async () => {
      await this.refresh();
    })();
  }

  async refresh(): Promise<void> {
    try {
      await this.service.loadImages();
    } catch { /* error in service signal */ }
  }

  truncateRef(ref: string): string {
    const parts = ref.split('/');
    const last = parts.at(-1)!;
    return last.length > 40 ? last.slice(0, 37) + '...' : last;
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  async onAddTag(imageId: string, tag: string): Promise<void> {
    try { await this.service.addTag(imageId, tag); } catch { /* ignore */ }
  }

  async onRemoveTag(imageId: string, tag: string): Promise<void> {
    try { await this.service.removeTag(imageId, tag); } catch { /* ignore */ }
  }

  onDeploy(img: ImageResponseDto): void {
    this.confirmAction.set({
      title: 'Deploy Image',
      message: `Deploy ${this.truncateRef(img.imageRef)} (${img.commitSha?.slice(0, 7)})? This will replace the currently running version.`,
      action: async () => {
        await this.service.deployImage(img.id);
        await this.refresh();
      },
    });
  }

  onDelete(img: ImageResponseDto): void {
    if (img.isCurrentlyDeployed) return;
    this.confirmAction.set({
      title: 'Delete Image',
      message: `Permanently delete ${this.truncateRef(img.imageRef)}? This cannot be undone.`,
      action: async () => {
        await this.service.deleteImage(img.id);
      },
    });
  }

  async executeConfirmed(): Promise<void> {
    const action = this.confirmAction();
    if (!action) return;
    this.actionBusy.set(true);
    try {
      await action.action();
      this.confirmAction.set(null);
    } catch { /* error in service */ } finally {
      this.actionBusy.set(false);
    }
  }
}
