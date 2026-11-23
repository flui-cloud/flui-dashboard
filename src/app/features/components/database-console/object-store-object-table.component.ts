import { Component, inject, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideFile, lucideFolder, lucideUpload } from '@ng-icons/lucide';
import { S3ObjectEntry } from '../../model/object-store-console.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { ObjectStoreConsoleStateService } from './object-store-console-state.service';
import { folderName, formatDate, formatSize, objectName } from './object-store-format';

const FOLDER_ACTIONS: readonly MenuAction[] = [
  { id: 'delete', label: 'Delete folder', danger: true },
];

const OBJECT_ACTIONS: readonly MenuAction[] = [
  { id: 'download', label: 'Download' },
  { id: 'share', label: 'Share link' },
  { id: 'delete', label: 'Delete', danger: true, separatorBefore: true },
];

@Component({
  selector: 'app-object-store-object-table',
  imports: [
    FlActionsMenu,
    FlAlert,
    FlButton,
    FlCopyId,
    FlEmptyState,
    FlIcon,
    FlLoadingState,
    FlPanel,
    FlTable,
  ],
  providers: [provideIcons({ lucideFile, lucideFolder, lucideUpload })],
  host: { class: 'block' },
  template: `
    <fl-panel [title]="s.selectedBucket() ?? 'Objects'" [flush]="true">
      <div panelActions class="fl-row">
        <ng-content select="[objectActions]" />
      </div>

      <div panelToolbar class="fl-toolbar">
        <nav class="fl-toolbar__group text-fl-body-sm" aria-label="Folder path">
          <button type="button" class="fl-link fl-mono" (click)="s.navigate('')">
            {{ s.selectedBucket() }}
          </button>
          @for (seg of s.breadcrumb(); track seg.prefix; let last = $last) {
            <span class="text-fl-ink-muted" aria-hidden="true">/</span>
            <button
              type="button"
              class="fl-link fl-mono"
              [attr.aria-current]="last ? 'page' : null"
              (click)="s.navigate(seg.prefix)"
            >
              {{ seg.name }}
            </button>
          }
        </nav>
        <span class="fl-toolbar__info">Drop files on the list to upload them here.</span>
      </div>

      @if (s.actionError(); as e) {
        <div class="p-4">
          <fl-alert tone="error" title="Action failed">{{ e }}</fl-alert>
        </div>
      }

      <div
        class="relative"
        [class.bg-fl-accent-row]="s.dragging()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
      >
        @if (s.dragging()) {
          <div
            class="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 border border-fl-accent bg-fl-accent-soft text-fl-body-sm text-fl-accent"
          >
            <fl-icon name="lucideUpload" [size]="20" />
            Drop to upload to
            <span class="fl-mono">{{ s.prefix() ? s.prefix() : s.selectedBucket() }}</span>
          </div>
        }

        @if (s.loading()) {
          <fl-loading-state [rows]="4" />
        } @else if (isEmpty()) {
          <fl-empty-state
            [compact]="true"
            icon="lucideFolder"
            title="This folder is empty"
            body="Drag files here, or use Upload."
          />
        } @else {
          <div class="fl-table-wrap relative">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col" class="is-num">Size</th>
                  <th scope="col">Modified</th>
                  <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (p of s.listing()?.prefixes ?? []; track p) {
                  <tr>
                    <td class="fl-cell-name">
                      <button
                        type="button"
                        class="fl-link inline-flex items-center gap-2"
                        (click)="s.navigate(p)"
                      >
                        <fl-icon name="lucideFolder" [size]="14" />
                        <span class="fl-mono">{{ folderLabel(p) }}/</span>
                      </button>
                    </td>
                    <td class="is-num text-fl-ink-muted">—</td>
                    <td class="text-fl-ink-muted">—</td>
                    <td class="is-fit">
                      <fl-actions-menu
                        [compact]="true"
                        [items]="folderActions"
                        [label]="'Actions for ' + folderLabel(p)"
                        (action)="deleteFolderRequest.emit(p)"
                      />
                    </td>
                  </tr>
                }
                @for (o of s.listing()?.objects ?? []; track o.key) {
                  <tr>
                    <td class="fl-cell-name">
                      <span class="inline-flex items-center gap-2">
                        <fl-icon class="text-fl-ink-muted" name="lucideFile" [size]="14" />
                        <fl-copy-id [value]="o.key" [display]="objectLabel(o)" label="key" />
                      </span>
                    </td>
                    <td class="is-num fl-mono">{{ size(o.size) }}</td>
                    <td class="fl-mono text-fl-ink-muted">{{ date(o.lastModified) }}</td>
                    <td class="is-fit">
                      <fl-actions-menu
                        [compact]="true"
                        [items]="objectActions"
                        [label]="'Actions for ' + objectLabel(o)"
                        (action)="onObjectAction($event, o)"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      @if (s.listing()?.isTruncated) {
        <div class="flex justify-center border-t border-fl-border p-3">
          <button flButton="ghost" size="sm" type="button" (click)="s.loadMore()">Load more</button>
        </div>
      }
    </fl-panel>
  `,
})
export class ObjectStoreObjectTableComponent {
  protected readonly s = inject(ObjectStoreConsoleStateService);

  readonly deleteObjectRequest = output<S3ObjectEntry>();
  readonly deleteFolderRequest = output<string>();
  readonly shareRequest = output<S3ObjectEntry>();

  protected readonly folderActions = FOLDER_ACTIONS;
  protected readonly objectActions = OBJECT_ACTIONS;

  protected isEmpty(): boolean {
    const listing = this.s.listing();
    return (listing?.prefixes?.length ?? 0) === 0 && (listing?.objects?.length ?? 0) === 0;
  }

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

  protected onObjectAction(action: string, o: S3ObjectEntry): void {
    if (action === 'download') this.s.download(o);
    else if (action === 'share') this.shareRequest.emit(o);
    else if (action === 'delete') this.deleteObjectRequest.emit(o);
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
