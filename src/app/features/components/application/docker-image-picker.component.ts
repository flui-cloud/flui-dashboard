import { Component, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideLoader,
  lucideChevronLeft,
  lucideChevronRight,
  lucideStar,
  lucideShield,
  lucidePackage,
  lucideCheck,
  lucideAlertCircle,
  lucideArrowLeft,
  lucideTag,
  lucideRefreshCw,
  lucideTriangleAlert,
  lucideInfo,
} from '@ng-icons/lucide';
import { ImagesService } from '../../../core/api/api/images.service';
import { DockerHubSearchResultDto } from '../../../core/api/model/dockerHubSearchResultDto';
import { DockerHubTagDto } from '../../../core/api/model/dockerHubTagDto';
import { ImageVerifyResponseDto } from '../../../core/api/model/imageVerifyResponseDto';

type PickerPhase = 'search' | 'tags' | 'verify';

@Component({
  selector: 'app-docker-image-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideSearch, lucideLoader, lucideChevronLeft, lucideChevronRight,
      lucideStar, lucideShield, lucidePackage, lucideCheck, lucideAlertCircle,
      lucideArrowLeft, lucideTag, lucideRefreshCw, lucideTriangleAlert, lucideInfo,
    }),
  ],
  template: `
    <div class="flex flex-col gap-4">

      <!-- Phase: Search -->
      @if (phase() === 'search') {
        <div class="flex flex-col gap-3">
          <div class="relative">
            <ng-icon name="lucideSearch" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              class="w-full pl-9 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search image (e.g. nginx, postgres, node…)"
              [(ngModel)]="searchQuery"
              (ngModelChange)="onQueryChange($event)"
            />
          </div>

          @if (searching()) {
            <div class="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <ng-icon name="lucideLoader" class="w-4 h-4 animate-spin" />
              <span>Searching…</span>
            </div>
          }

          @if (!searching() && searchResults().length > 0) {
            <div class="flex flex-col divide-y divide-border rounded-md border border-border overflow-hidden">
              @for (result of searchResults(); track result.name) {
                <button
                  type="button"
                  class="flex items-start gap-3 px-4 py-3 hover:bg-accent text-left transition-colors"
                  (click)="selectImage(result)"
                >
                  <ng-icon name="lucidePackage" class="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div class="flex flex-col gap-0.5 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium">{{ result.name }}</span>
                      @if (result.isOfficial) {
                        <span class="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">Official</span>
                      }
                    </div>
                    @if (result.description) {
                      <span class="text-xs text-muted-foreground truncate">{{ result.description }}</span>
                    }
                    <div class="flex items-center gap-3 mt-1">
                      <span class="flex items-center gap-1 text-xs text-muted-foreground">
                        <ng-icon name="lucideStar" class="w-3 h-3" />
                        {{ formatCount(result.starCount) }}
                      </span>
                      <span class="text-xs text-muted-foreground">
                        {{ formatCount(result.pullCount) }} pull
                      </span>
                    </div>
                  </div>
                </button>
              }
            </div>
          }

          @if (!searching() && searchQuery.length > 1 && searchResults().length === 0 && !searchError()) {
            <p class="text-sm text-muted-foreground text-center py-4">No results for "{{ searchQuery }}"</p>
          }

          @if (searchError()) {
            <div class="flex items-center gap-2 text-sm text-destructive py-2">
              <ng-icon name="lucideAlertCircle" class="w-4 h-4 shrink-0" />
              <span>{{ searchError() }}</span>
            </div>
          }
        </div>
      }

      <!-- Phase: Tags -->
      @if (phase() === 'tags') {
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <button type="button" (click)="backToSearch()" class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ng-icon name="lucideArrowLeft" class="w-4 h-4" />
              Back
            </button>
            <span class="text-sm font-medium text-foreground">{{ selectedImageName() }}</span>
          </div>

          @if (loadingTags()) {
            <div class="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <ng-icon name="lucideLoader" class="w-4 h-4 animate-spin" />
              <span>Loading tags…</span>
            </div>
          }

          @if (!loadingTags() && tags().length > 0) {
            <div class="flex flex-col divide-y divide-border rounded-md border border-border overflow-hidden">
              @for (tag of tags(); track tag.name) {
                <button
                  type="button"
                  class="flex items-center justify-between px-4 py-2.5 hover:bg-accent text-left transition-colors"
                  (click)="selectTag(tag)"
                >
                  <div class="flex flex-col gap-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <ng-icon name="lucideTag" class="w-4 h-4 text-muted-foreground shrink-0" />
                      <span class="text-sm font-mono font-medium">{{ tag.name }}</span>
                      <span class="text-xs text-muted-foreground">{{ tag.architecture }}</span>
                      @if (tag.deployHint !== 'deployable') {
                        <span
                          class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium"
                          [class]="getDeployHintBadgeClass(tag.deployHint)"
                          [title]="tag.deployHintReason ?? ''"
                        >
                          <ng-icon
                            [name]="tag.deployHint === 'needs-sidecar' ? 'lucideTriangleAlert' : 'lucideInfo'"
                            class="w-3 h-3"
                          />
                          {{ getDeployHintLabel(tag.deployHint) }}
                        </span>
                      }
                    </div>
                    @if (tag.deployHintReason) {
                      <span class="text-xs text-muted-foreground pl-6 truncate max-w-xs">{{ tag.deployHintReason }}</span>
                    }
                  </div>
                  <div class="flex flex-col items-end gap-0.5 shrink-0 ml-2">
                    <span class="text-xs text-muted-foreground">{{ formatSize(tag.size) }}</span>
                    <span class="text-xs text-muted-foreground">{{ formatDate(tag.lastUpdated) }}</span>
                  </div>
                </button>
              }
            </div>

            <!-- Pagination -->
            @if (tagsCount() > tagsPerPage) {
              <div class="flex items-center justify-between text-sm text-muted-foreground">
                <span>{{ tags().length }} of {{ tagsCount() }} tags</span>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    [disabled]="currentTagPage() <= 1"
                    (click)="loadTagsPage(currentTagPage() - 1)"
                    class="p-1 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ng-icon name="lucideChevronLeft" class="w-4 h-4" />
                  </button>
                  <span>Page {{ currentTagPage() }}</span>
                  <button
                    type="button"
                    [disabled]="!hasNextTagPage()"
                    (click)="loadTagsPage(currentTagPage() + 1)"
                    class="p-1 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ng-icon name="lucideChevronRight" class="w-4 h-4" />
                  </button>
                </div>
              </div>
            }
          }

          @if (tagsError()) {
            <div class="flex items-center gap-2 text-sm text-destructive py-2">
              <ng-icon name="lucideAlertCircle" class="w-4 h-4 shrink-0" />
              <span>{{ tagsError() }}</span>
            </div>
          }
        </div>
      }

      <!-- Phase: Verify -->
      @if (phase() === 'verify') {
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <button type="button" (click)="backToTags()" class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ng-icon name="lucideArrowLeft" class="w-4 h-4" />
              Back
            </button>
          </div>

          @if (verifying()) {
            <div class="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <ng-icon name="lucideLoader" class="w-4 h-4 animate-spin" />
              <span>Verifying image on DockerHub…</span>
            </div>
          }

          @if (!verifying() && verifyResult()) {
            @if (verifyResult()!.exists) {
              <div class="flex flex-col gap-3 p-4 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10">
                <div class="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <ng-icon name="lucideCheck" class="w-5 h-5" />
                  <span class="font-medium text-sm">Image verified</span>
                </div>
                <div class="flex flex-col gap-1 text-sm">
                  <div class="flex items-center justify-between">
                    <span class="text-muted-foreground">Reference</span>
                    <span class="font-mono font-medium">{{ pendingImageRef() }}</span>
                  </div>
                  @if (verifyResult()!.digest) {
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Digest</span>
                      <span class="font-mono text-xs truncate max-w-48">{{ verifyResult()!.digest }}</span>
                    </div>
                  }
                  @if (verifyResult()!.size) {
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Size</span>
                      <span>{{ formatSize(verifyResult()!.size!) }}</span>
                    </div>
                  }
                  @if (verifyResult()!.lastUpdated) {
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Last updated</span>
                      <span>{{ formatDate(verifyResult()!.lastUpdated!) }}</span>
                    </div>
                  }
                </div>
                <button
                  type="button"
                  class="w-full mt-1 py-2 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  (click)="confirmSelection()"
                >
                  Use this image
                </button>
              </div>
            } @else {
              <div class="flex flex-col gap-2 p-4 rounded-md border border-destructive/30 bg-destructive/5">
                <div class="flex items-center gap-2 text-destructive">
                  <ng-icon name="lucideAlertCircle" class="w-5 h-5" />
                  <span class="font-medium text-sm">Image not found</span>
                </div>
                <p class="text-sm text-muted-foreground">The image <span class="font-mono">{{ pendingImageRef() }}</span> does not exist on DockerHub.</p>
                <button type="button" class="text-sm text-muted-foreground hover:text-foreground underline" (click)="backToTags()">
                  Choose a different tag
                </button>
              </div>
            }
          }

          @if (verifyError()) {
            <div class="flex items-center gap-2 text-sm text-destructive py-2">
              <ng-icon name="lucideAlertCircle" class="w-4 h-4 shrink-0" />
              <span>{{ verifyError() }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class DockerImagePickerComponent {
  @Output() imageSelected = new EventEmitter<string>();

  private readonly imagesApi = inject(ImagesService);

  readonly tagsPerPage = 25;

  searchQuery = '';
  phase = signal<PickerPhase>('search');
  searching = signal(false);
  searchResults = signal<DockerHubSearchResultDto[]>([]);
  searchError = signal<string | null>(null);

  selectedImageName = signal<string>('');
  loadingTags = signal(false);
  tags = signal<DockerHubTagDto[]>([]);
  tagsCount = signal(0);
  currentTagPage = signal(1);
  hasNextTagPage = signal(false);
  tagsError = signal<string | null>(null);

  pendingImageRef = signal<string>('');
  verifying = signal(false);
  verifyResult = signal<ImageVerifyResponseDto | null>(null);
  verifyError = signal<string | null>(null);

  private readonly searchSubject = new Subject<string>();

  constructor() {
    this.searchSubject.pipe(debounceTime(350), distinctUntilChanged()).subscribe(q => {
      if (q.length > 1) this.doSearch(q);
      else this.searchResults.set([]);
    });
  }

  onQueryChange(q: string): void {
    this.searchSubject.next(q);
  }

  private async doSearch(q: string): Promise<void> {
    this.searching.set(true);
    this.searchError.set(null);
    try {
      const res = await firstValueFrom(this.imagesApi.imagesControllerSearch(q, 15));
      this.searchResults.set(res.results);
    } catch {
      this.searchError.set('Search failed. Please try again.');
    } finally {
      this.searching.set(false);
    }
  }

  selectImage(image: DockerHubSearchResultDto): void {
    this.selectedImageName.set(image.name);
    this.tags.set([]);
    this.currentTagPage.set(1);
    this.tagsError.set(null);
    this.phase.set('tags');
    this.loadTagsPage(1);
  }

  async loadTagsPage(page: number): Promise<void> {
    this.loadingTags.set(true);
    this.tagsError.set(null);
    try {
      const res = await firstValueFrom(
        this.imagesApi.imagesControllerListTags(this.selectedImageName(), page, this.tagsPerPage)
      );
      this.tags.set(res.tags);
      this.tagsCount.set(res.count);
      this.currentTagPage.set(page);
      this.hasNextTagPage.set(!!res.nextPage);
    } catch {
      this.tagsError.set('Failed to load tags. Please try again.');
    } finally {
      this.loadingTags.set(false);
    }
  }

  selectTag(tag: DockerHubTagDto): void {
    const ref = `${this.selectedImageName()}:${tag.name}`;
    this.pendingImageRef.set(ref);
    this.verifyResult.set(null);
    this.verifyError.set(null);
    this.phase.set('verify');
    this.doVerify(ref);
  }

  private async doVerify(imageRef: string): Promise<void> {
    this.verifying.set(true);
    this.verifyError.set(null);
    try {
      const res = await firstValueFrom(this.imagesApi.imagesControllerVerify(imageRef));
      this.verifyResult.set(res);
    } catch {
      this.verifyError.set('Verification failed. Please try again.');
    } finally {
      this.verifying.set(false);
    }
  }

  confirmSelection(): void {
    this.imageSelected.emit(this.pendingImageRef());
  }

  backToSearch(): void {
    this.phase.set('search');
  }

  backToTags(): void {
    this.phase.set('tags');
    this.verifyResult.set(null);
  }

  formatCount(n: number): string {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  formatSize(bytes: number): string {
    if (bytes >= 1_073_741_824) return (bytes / 1_073_741_824).toFixed(1) + ' GB';
    if (bytes >= 1_048_576) return (bytes / 1_048_576).toFixed(1) + ' MB';
    return (bytes / 1_024).toFixed(1) + ' KB';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getDeployHintLabel(hint: DockerHubTagDto['deployHint']): string {
    switch (hint) {
      case 'needs-sidecar': return 'Requires reverse proxy';
      case 'cli-tool':      return 'CLI tool only';
      case 'build-image':   return 'Build image only';
      case 'base-os':       return 'Base image';
      default:              return hint;
    }
  }

  getDeployHintBadgeClass(hint: DockerHubTagDto['deployHint']): string {
    if (hint === 'needs-sidecar') {
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    }
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  }
}
