import { Component, signal, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideChevronLeft,
  lucideChevronRight,
  lucideSearch,
} from '@ng-icons/lucide';
import { ImagesService } from '../../../core/api/api/images.service';
import { DockerHubSearchResultDto } from '../../../core/api/model/dockerHubSearchResultDto';
import { DockerHubTagDto } from '../../../core/api/model/dockerHubTagDto';
import { ImageVerifyResponseDto } from '../../../core/api/model/imageVerifyResponseDto';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlField } from '../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import {
  deployHintLabel,
  deployHintTone,
  formatCount,
  formatDate,
  formatSize,
} from './docker-image-format';

type PickerPhase = 'search' | 'tags' | 'verify';

@Component({
  selector: 'app-docker-image-picker',
  imports: [
    FormsModule,
    FlAlert,
    FlEmptyState,
    FlLoadingState,
    FlField,
    FlKeyValue,
    FlKvItem,
    FlTable,
    FlButton,
    FlIcon,
    FlStatus,
    FlTag,
  ],
  providers: [
    provideIcons({ lucideArrowLeft, lucideChevronLeft, lucideChevronRight, lucideSearch }),
  ],
  host: { class: 'fl-stack' },
  template: `
    @if (phase() === 'search') {
      <fl-field label="Image" for="docker-image-search">
        <span class="fl-input fl-input--lg">
          <fl-icon name="lucideSearch" />
          <input
            id="docker-image-search"
            type="search"
            placeholder="Search Docker Hub, for example nginx or postgres"
            [ngModel]="searchQuery()"
            (ngModelChange)="onQueryChange($event)"
          />
        </span>
      </fl-field>

      @if (searching()) {
        <fl-loading-state />
      } @else if (searchError()) {
        <fl-alert tone="error" title="Search failed">{{ searchError() }}</fl-alert>
      } @else if (searchResults().length > 0) {
        <div class="fl-table-wrap rounded-fl-md border border-fl-border">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Image</th>
                <th scope="col">Description</th>
                <th scope="col" class="is-num">Stars</th>
                <th scope="col" class="is-num">Pulls</th>
              </tr>
            </thead>
            <tbody>
              @for (result of searchResults(); track result.name) {
                <tr class="cursor-pointer" (click)="selectImage(result)">
                  <td>
                    <button
                      type="button"
                      class="fl-link fl-mono"
                      (click)="$event.stopPropagation(); selectImage(result)"
                    >
                      {{ result.name }}
                    </button>
                    @if (result.isOfficial) {
                      <fl-tag class="ml-2">Official</fl-tag>
                    }
                  </td>
                  <td class="is-wrap text-fl-ink-muted">{{ result.description }}</td>
                  <td class="is-num">{{ fmtCount(result.starCount) }}</td>
                  <td class="is-num">{{ fmtCount(result.pullCount) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (searchQuery().length > 1) {
        <fl-empty-state [compact]="true" [title]="'No images match ' + searchQuery()" />
      }
    }

    @if (phase() === 'tags') {
      <div class="fl-row">
        <button flButton="ghost" size="sm" type="button" (click)="backToSearch()">
          <fl-icon name="lucideArrowLeft" />
          Back
        </button>
        <span class="fl-mono font-medium">{{ selectedImageName() }}</span>
      </div>

      @if (loadingTags()) {
        <fl-loading-state />
      } @else if (tagsError()) {
        <fl-alert tone="error" title="Could not load tags">{{ tagsError() }}</fl-alert>
      } @else if (tags().length > 0) {
        <div class="fl-table-wrap rounded-fl-md border border-fl-border">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Tag</th>
                <th scope="col">Architecture</th>
                <th scope="col">Deployability</th>
                <th scope="col" class="is-num">Size</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              @for (tag of tags(); track tag.name) {
                <tr class="cursor-pointer" (click)="selectTag(tag)">
                  <td>
                    <button
                      type="button"
                      class="fl-link fl-mono"
                      (click)="$event.stopPropagation(); selectTag(tag)"
                    >
                      {{ tag.name }}
                    </button>
                  </td>
                  <td class="fl-mono text-fl-ink-muted">{{ tag.architecture }}</td>
                  <td class="is-wrap">
                    @if (tag.deployHint !== 'deployable') {
                      <fl-status
                        [tone]="hintTone(tag.deployHint)"
                        [label]="hintLabel(tag.deployHint)"
                      />
                    }
                    @if (tag.deployHintReason) {
                      <span class="block text-fl-caption text-fl-ink-muted">{{
                        tag.deployHintReason
                      }}</span>
                    }
                  </td>
                  <td class="is-num">{{ fmtSize(tag.size) }}</td>
                  <td class="text-fl-ink-muted">{{ fmtDate(tag.lastUpdated) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (tagsCount() > tagsPerPage) {
          <div class="flex items-center justify-between">
            <span class="fl-toolbar__info">{{ tags().length }} of {{ tagsCount() }} tags</span>
            <div class="fl-row">
              <button
                flButton
                size="sm"
                type="button"
                [iconOnly]="true"
                aria-label="Previous page"
                [disabled]="currentTagPage() <= 1"
                (click)="loadTagsPage(currentTagPage() - 1)"
              >
                <fl-icon name="lucideChevronLeft" />
              </button>
              <span class="fl-toolbar__info">Page {{ currentTagPage() }}</span>
              <button
                flButton
                size="sm"
                type="button"
                [iconOnly]="true"
                aria-label="Next page"
                [disabled]="!hasNextTagPage()"
                (click)="loadTagsPage(currentTagPage() + 1)"
              >
                <fl-icon name="lucideChevronRight" />
              </button>
            </div>
          </div>
        }
      }
    }

    @if (phase() === 'verify') {
      <div class="fl-row">
        <button flButton="ghost" size="sm" type="button" (click)="backToTags()">
          <fl-icon name="lucideArrowLeft" />
          Back
        </button>
      </div>

      @if (verifying()) {
        <fl-loading-state />
      } @else if (verifyError()) {
        <fl-alert tone="error" title="Verification failed">{{ verifyError() }}</fl-alert>
      } @else if (verifyResult(); as result) {
        @if (result.exists) {
          <fl-status tone="success" label="Image verified" />
          <fl-key-value>
            <fl-kv-item key="Reference" [mono]="true">{{ pendingImageRef() }}</fl-kv-item>
            @if (result.digest) {
              <fl-kv-item key="Digest" [mono]="true">{{ result.digest }}</fl-kv-item>
            }
            @if (result.size) {
              <fl-kv-item key="Size">{{ fmtSize(result.size) }}</fl-kv-item>
            }
            @if (result.lastUpdated) {
              <fl-kv-item key="Last updated">{{ fmtDate(result.lastUpdated) }}</fl-kv-item>
            }
          </fl-key-value>
          <div class="fl-row">
            <button flButton="primary" type="button" (click)="confirmSelection()">
              Use this image
            </button>
          </div>
        } @else {
          <fl-alert tone="error" title="Image not found">
            <span class="fl-mono">{{ pendingImageRef() }}</span> does not exist on Docker Hub.
            <button alertActions flButton size="sm" type="button" (click)="backToTags()">
              Choose another tag
            </button>
          </fl-alert>
        }
      }
    }
  `,
})
export class DockerImagePickerComponent {
  readonly imageSelected = output<string>();

  private readonly imagesApi = inject(ImagesService);

  readonly tagsPerPage = 25;

  readonly searchQuery = signal('');
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
    this.searchSubject.pipe(debounceTime(350), distinctUntilChanged()).subscribe((q) => {
      if (q.length > 1) this.doSearch(q);
      else this.searchResults.set([]);
    });
  }

  onQueryChange(q: string): void {
    this.searchQuery.set(q);
    this.searchSubject.next(q);
  }

  private async doSearch(q: string): Promise<void> {
    this.searching.set(true);
    this.searchError.set(null);
    try {
      const res = await firstValueFrom(this.imagesApi.imagesControllerSearch(q, 15));
      this.searchResults.set(res.results);
    } catch {
      this.searchError.set('Docker Hub did not answer. Try again in a moment.');
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
        this.imagesApi.imagesControllerListTags(this.selectedImageName(), page, this.tagsPerPage),
      );
      this.tags.set(res.tags);
      this.tagsCount.set(res.count);
      this.currentTagPage.set(page);
      this.hasNextTagPage.set(!!res.nextPage);
    } catch {
      this.tagsError.set('Docker Hub did not answer. Try again in a moment.');
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
      this.verifyError.set('Docker Hub did not answer. Try again in a moment.');
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

  protected readonly fmtCount = formatCount;
  protected readonly fmtSize = formatSize;
  protected readonly fmtDate = formatDate;
  protected readonly hintLabel = deployHintLabel;
  protected readonly hintTone = deployHintTone;
}
