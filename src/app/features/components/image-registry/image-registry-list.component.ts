import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, OnDestroy, OnInit, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideImage, lucideRefreshCw, lucideSearch, lucideTag, lucideX } from '@ng-icons/lucide';
import { ImageRegistryFeatureService } from '../../service/image-registry.service';
import { ApplicationService } from '../../service/application.service';
import { ImageResponseDto } from '../../../core/api/model/imageResponseDto';
import { FluiTagManagerComponent } from './flui-tag-manager.component';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { formatBytes } from '../../../shared/utils/metric-format';
import {
  ImageRegistrySurfaceInput,
  ImageRegistrySurfaceRevision,
  buildImageRegistrySurface,
  presentedContent as imageRegistryPresentedContent,
} from './image-registry-surface';

const VISIBLE_TAGS = 3;

interface PendingAction {
  kind: 'deploy' | 'delete';
  imageId: string;
  imageLabel: string;
  title: string;
  message: string;
  typeToConfirm?: string;
  action: () => Promise<void>;
}

@Component({
  selector: 'app-image-registry-list',
  imports: [
    CdkTrapFocus,
    FormsModule,
    RouterLink,
    FluiTagManagerComponent,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlTable,
    FlEmptyState,
    FlLoadingState,
    FlActionsMenu,
    FlButton,
    FlIcon,
    FlStatus,
    FlTag,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideSearch, lucideImage, lucideTag, lucideX })],
  host: { '(document:keydown.escape)': 'tagImageId.set(null)' },
  templateUrl: './image-registry-list.component.html',
})
export class ImageRegistryListComponent implements OnInit, OnDestroy {
  service = inject(ImageRegistryFeatureService);
  private readonly applications = inject(ApplicationService);
  private readonly confirmService = inject(ConfirmService);

  searchQuery = signal('');
  tagFilter = signal('');
  actionBusy = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly tagImageId = signal<string | null>(null);
  confirmAction = signal<PendingAction | null>(null);

  filteredImages = computed(() => {
    let images = this.service.images();
    const search = this.searchQuery().toLowerCase();
    const tag = this.tagFilter().trim().toLowerCase();

    if (search) {
      images = images.filter(
        (i) =>
          i.imageRef.toLowerCase().includes(search) ||
          i.branch.toLowerCase().includes(search) ||
          i.commitSha?.toLowerCase().includes(search),
      );
    }
    if (tag) {
      images = images.filter((i) => i.fluiTags.some((t) => t.toLowerCase().includes(tag)));
    }
    return images;
  });

  protected readonly hasFilters = computed(
    () => this.searchQuery().trim() !== '' || this.tagFilter().trim() !== '',
  );

  protected readonly tagImage = computed(() => {
    const id = this.tagImageId();
    return id ? (this.service.images().find((i) => i.id === id) ?? null) : null;
  });

  private readonly appNames = computed(
    () => new Map(this.applications.applications().map((a) => [a.id, a.name])),
  );

  protected readonly visibleTags = VISIBLE_TAGS;

  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new ImageRegistrySurfaceRevision();

  private readonly surfaceInput = computed<ImageRegistrySurfaceInput>(() => {
    const confirm = this.confirmAction();
    return {
      rows: this.filteredImages().map((img) => ({
        id: img.id,
        displayRef: this.truncateRef(img.imageRef),
        commitShortSha: img.commitSha?.slice(0, 7) ?? '',
        branch: img.branch,
        tagCount: img.fluiTags.length,
        isCurrentlyDeployed: img.isCurrentlyDeployed,
        createdAt: img.createdAt,
      })),
      totalCount: this.service.images().length,
      hasSearch: this.searchQuery().trim() !== '',
      hasTagFilter: this.tagFilter().trim() !== '',
      isLoading: this.service.loading(),
      refused: this.service.refused(),
      hasError: Boolean(this.service.errorMessage()),
      confirm: confirm
        ? { kind: confirm.kind, imageId: confirm.imageId, label: confirm.imageLabel }
        : null,
      actionBusy: this.actionBusy(),
    };
  });

  readonly surface = computed(() => {
    const input = this.surfaceInput();
    return buildImageRegistrySurface(input, {
      revision: this.surfaceRevision.next(imageRegistryPresentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  ngOnInit(): void {
    void (async () => {
      await this.refresh();
    })();
  }

  async refresh(): Promise<void> {
    try {
      await this.service.loadImages();
    } catch {
      return;
    }
  }

  truncateRef(ref: string): string {
    const parts = ref.split('/');
    const last = parts.at(-1)!;
    return last.length > 40 ? last.slice(0, 37) + '...' : last;
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected formatSize(bytes: number | undefined): string {
    return formatBytes(bytes);
  }

  protected appName(appId: string): string {
    return this.appNames().get(appId) ?? appId.slice(0, 8);
  }

  protected rowActions(img: ImageResponseDto): MenuAction[] {
    return [
      { id: 'deploy', label: 'Deploy this image', disabled: this.actionBusy() },
      { id: 'tags', label: 'Manage tags' },
      {
        id: 'delete',
        label: img.isCurrentlyDeployed ? 'Cannot delete a deployed image' : 'Delete image',
        danger: true,
        separatorBefore: true,
        disabled: this.actionBusy() || img.isCurrentlyDeployed,
      },
    ];
  }

  protected onRowAction(img: ImageResponseDto, id: string): void {
    if (id === 'deploy') this.onDeploy(img);
    else if (id === 'tags') this.tagImageId.set(img.id);
    else if (id === 'delete') this.onDelete(img);
  }

  async onAddTag(imageId: string, tag: string): Promise<void> {
    try {
      await this.service.addTag(imageId, tag);
    } catch {
      return;
    }
  }

  async onRemoveTag(imageId: string, tag: string): Promise<void> {
    try {
      await this.service.removeTag(imageId, tag);
    } catch {
      return;
    }
  }

  onDeploy(img: ImageResponseDto): void {
    void this.ask(
      {
        kind: 'deploy',
        imageId: img.id,
        imageLabel: this.truncateRef(img.imageRef),
        title: 'Deploy image',
        message: `Deploy ${this.truncateRef(img.imageRef)} (${img.commitSha?.slice(0, 7)})? This replaces the version running now.`,
        action: async () => {
          await this.service.deployImage(img.id);
          await this.refresh();
        },
      },
      'Deploy',
      false,
    );
  }

  onDelete(img: ImageResponseDto): void {
    if (img.isCurrentlyDeployed) return;
    void this.ask(
      {
        kind: 'delete',
        imageId: img.id,
        imageLabel: this.truncateRef(img.imageRef),
        title: 'Delete image',
        message: `Permanently delete ${this.truncateRef(img.imageRef)}? This cannot be undone.`,
        typeToConfirm: img.imageRef.split('/').at(-1),
        action: async () => {
          await this.service.deleteImage(img.id);
        },
      },
      'Delete image',
      true,
    );
  }

  private async ask(pending: PendingAction, confirmLabel: string, destructive: boolean) {
    this.confirmAction.set(pending);
    const ok = await this.confirmService.confirm({
      title: pending.title,
      body: pending.message,
      confirmLabel,
      destructive,
      typeToConfirm: pending.typeToConfirm,
    });
    if (ok) await this.executeConfirmed();
    else this.confirmAction.set(null);
  }

  async executeConfirmed(): Promise<void> {
    const action = this.confirmAction();
    if (!action) return;
    this.actionBusy.set(true);
    this.actionError.set(null);
    try {
      await action.action();
    } catch (e: unknown) {
      const server = (e as { error?: { message?: string } })?.error?.message;
      this.actionError.set(
        server ?? (action.kind === 'deploy' ? 'Deploy failed.' : 'Delete failed.'),
      );
    } finally {
      this.confirmAction.set(null);
      this.actionBusy.set(false);
    }
  }
}
