import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideChevronRight,
  lucideCopy,
  lucideDownload,
  lucideFile,
  lucideFolder,
  lucideLoader,
  lucideShare2,
  lucideTrash2,
  lucideTriangleAlert,
  lucideUpload,
} from '@ng-icons/lucide';
import { S3ObjectEntry } from '../../model/object-store-console.models';
import { ObjectStoreConsoleStateService } from './object-store-console-state.service';
import {
  folderName,
  formatDate,
  formatSize,
  objectName,
} from './object-store-format';

@Component({
  selector: 'app-object-store-object-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideCheck,
      lucideChevronRight,
      lucideCopy,
      lucideDownload,
      lucideFile,
      lucideFolder,
      lucideLoader,
      lucideShare2,
      lucideTrash2,
      lucideTriangleAlert,
      lucideUpload,
    }),
  ],
  template: `
    <div class="mb-2 flex flex-wrap items-center gap-1 text-sm">
      <button
        type="button"
        (click)="s.navigate('')"
        class="rounded px-1.5 py-0.5 font-medium text-foreground hover:bg-muted"
      >
        {{ s.selectedBucket() }}
      </button>
      @for (seg of s.breadcrumb(); track seg.prefix) {
        <ng-icon
          name="lucideChevronRight"
          class="h-3.5 w-3.5 text-muted-foreground"
        />
        <button
          type="button"
          (click)="s.navigate(seg.prefix)"
          class="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted"
        >
          {{ seg.name }}
        </button>
      }
    </div>

    @if (s.actionError(); as e) {
      <div
        class="mb-2 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
      >
        <ng-icon name="lucideTriangleAlert" class="h-3.5 w-3.5" />
        {{ e }}
      </div>
    }

    <div
      class="relative overflow-hidden rounded-md border border-border"
      [class.ring-2]="s.dragging()"
      [class.ring-primary]="s.dragging()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      @if (s.dragging()) {
        <div
          class="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-primary/10 text-sm font-medium text-primary backdrop-blur-[1px]"
        >
          <ng-icon name="lucideUpload" class="h-6 w-6" />
          Drop to upload to
          {{ s.prefix() ? s.prefix() : s.selectedBucket() }}
        </div>
      }
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">Name</th>
            <th class="w-28 px-3 py-2 font-medium">Size</th>
            <th class="w-44 px-3 py-2 font-medium">Modified</th>
            <th class="w-40 px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          @if (s.loading()) {
            <tr>
              <td
                colspan="4"
                class="px-3 py-6 text-center text-muted-foreground"
              >
                <ng-icon
                  name="lucideLoader"
                  class="inline h-4 w-4 animate-spin"
                />
              </td>
            </tr>
          } @else {
            @for (p of s.listing()?.prefixes ?? []; track p) {
              <tr class="border-t border-border hover:bg-muted/40">
                <td class="px-3 py-2">
                  <button
                    type="button"
                    (click)="s.navigate(p)"
                    class="flex items-center gap-2 text-foreground"
                  >
                    <ng-icon name="lucideFolder" class="h-4 w-4 text-primary" />
                    {{ folderLabel(p) }}
                  </button>
                </td>
                <td class="px-3 py-2 text-muted-foreground">—</td>
                <td class="px-3 py-2 text-muted-foreground">—</td>
                <td class="px-3 py-2 text-right">
                  <button
                    type="button"
                    (click)="deleteFolderRequest.emit(p)"
                    class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    title="Delete folder"
                  >
                    <ng-icon name="lucideTrash2" class="h-4 w-4" />
                  </button>
                </td>
              </tr>
            }
            @for (o of s.listing()?.objects ?? []; track o.key) {
              <tr class="border-t border-border hover:bg-muted/40">
                <td class="px-3 py-2">
                  <span class="flex items-center gap-2 text-foreground">
                    <ng-icon
                      name="lucideFile"
                      class="h-4 w-4 text-muted-foreground"
                    />
                    {{ objectLabel(o) }}
                  </span>
                </td>
                <td class="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {{ size(o.size) }}
                </td>
                <td class="px-3 py-2 text-xs text-muted-foreground">
                  {{ date(o.lastModified) }}
                </td>
                <td class="px-3 py-2">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      (click)="s.download(o)"
                      class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Download"
                    >
                      <ng-icon name="lucideDownload" class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      (click)="shareRequest.emit(o)"
                      class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Share link"
                    >
                      <ng-icon name="lucideShare2" class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      (click)="s.copyKey(o.key)"
                      class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Copy key"
                    >
                      <ng-icon
                        [name]="
                          s.copiedKey() === o.key ? 'lucideCheck' : 'lucideCopy'
                        "
                        class="h-4 w-4"
                      />
                    </button>
                    <button
                      type="button"
                      (click)="deleteObjectRequest.emit(o)"
                      class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                      title="Delete"
                    >
                      <ng-icon name="lucideTrash2" class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            }
            @if (
              (s.listing()?.prefixes?.length ?? 0) === 0 &&
              (s.listing()?.objects?.length ?? 0) === 0
            ) {
              <tr>
                <td
                  colspan="4"
                  class="px-3 py-10 text-center text-sm text-muted-foreground"
                >
                  This folder is empty. Drag files here, or use Upload.
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>

    <p class="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
      <ng-icon name="lucideUpload" class="h-3 w-3" />
      Drag files anywhere on the list to upload to this folder.
    </p>

    @if (s.listing()?.isTruncated) {
      <div class="mt-2 text-center">
        <button
          type="button"
          (click)="s.loadMore()"
          class="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          Load more
        </button>
      </div>
    }
  `,
})
export class ObjectStoreObjectTableComponent {
  protected readonly s = inject(ObjectStoreConsoleStateService);

  readonly deleteObjectRequest = output<S3ObjectEntry>();
  readonly deleteFolderRequest = output<string>();
  readonly shareRequest = output<S3ObjectEntry>();

  protected folderLabel(prefix: string): string {
    return folderName(prefix, this.s.prefix());
  }

  protected objectLabel(o: S3ObjectEntry): string {
    return objectName(o.key, this.s.prefix());
  }

  protected size(bytes: number): string {
    return formatSize(bytes);
  }

  protected date(iso?: string): string {
    return formatDate(iso);
  }

  onDragOver(event: DragEvent): void {
    if (!this.s.selectedBucket() || this.s.busy()) return;
    event.preventDefault();
    this.s.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    const related = event.relatedTarget as Node | null;
    const container = event.currentTarget as HTMLElement;
    if (related && container.contains(related)) return;
    this.s.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.s.dragging.set(false);
    if (!this.s.selectedBucket() || this.s.busy()) return;
    this.s.uploadFiles(Array.from(event.dataTransfer?.files ?? []));
  }
}
