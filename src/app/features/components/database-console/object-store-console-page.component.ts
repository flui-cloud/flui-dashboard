import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideFolderPlus, lucidePlus, lucideRefreshCw, lucideUpload } from '@ng-icons/lucide';
import { S3ObjectEntry, ShareRecord } from '../../model/object-store-console.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { NamePromptService } from './name-prompt-dialog';
import { ObjectStoreConsoleStateService } from './object-store-console-state.service';
import { ObjectStoreObjectTableComponent } from './object-store-object-table.component';
import { ObjectStoreSharesComponent } from './object-store-shares.component';
import { folderName, objectName } from './object-store-format';
import { StoreConsoleHeader } from './store-console-header';

@Component({
  selector: 'app-object-store-console-page',
  imports: [
    FlAlert,
    FlButton,
    FlEmptyState,
    FlIcon,
    FlLoadingState,
    StoreConsoleHeader,
    FlPanel,
    FlStatus,
    ObjectStoreObjectTableComponent,
    ObjectStoreSharesComponent,
  ],
  providers: [
    ObjectStoreConsoleStateService,
    provideIcons({ lucideFolderPlus, lucidePlus, lucideRefreshCw, lucideUpload }),
  ],
  template: `
    <div class="fl-page">
      <app-store-console-header
        title="Object storage"
        [appId]="applicationId()"
        [conn]="s.conn()"
        (retry)="s.connect()"
      >
        <ng-container consoleMeta>
          @if (s.info(); as i) {
            <span>{{ i.label }}</span>
          }
        </ng-container>
        <ng-container consoleActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            title="Refresh"
            (click)="s.connect()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
        </ng-container>
      </app-store-console-header>

      @if (s.conn() === 'connecting') {
        <fl-panel><fl-loading-state [rows]="4" /></fl-panel>
      } @else if (s.conn() === 'error') {
        <fl-alert tone="error" title="Could not connect">
          {{ s.errorMsg() || 'Failed to connect to the object store.' }}
        </fl-alert>
      } @else {
        <div class="flex flex-col items-start gap-5 lg:flex-row">
          <fl-panel
            class="w-full shrink-0 lg:w-64"
            title="Buckets"
            [count]="s.buckets().length"
            [flush]="true"
          >
            <button panelActions flButton="ghost" size="sm" type="button" (click)="createBucket()">
              <fl-icon name="lucidePlus" [size]="14" />
              New
            </button>
            @if (s.buckets().length === 0) {
              <fl-empty-state [compact]="true" title="No buckets yet" />
            } @else {
              <ul class="max-h-96 overflow-auto py-1">
                @for (b of s.buckets(); track b.name) {
                  <li>
                    <button
                      type="button"
                      class="flex w-full items-center px-4 py-2 text-left text-fl-body-sm hover:bg-fl-surface-hover"
                      [class.bg-fl-accent-soft]="s.selectedBucket() === b.name"
                      [attr.aria-current]="s.selectedBucket() === b.name ? 'true' : null"
                      (click)="s.onBucketChange(b.name)"
                    >
                      <span class="fl-mono min-w-0 flex-1 truncate">{{ b.name }}</span>
                    </button>
                  </li>
                }
              </ul>
            }
          </fl-panel>

          <div class="flex w-full min-w-0 flex-1 flex-col gap-5">
            <app-object-store-object-table
              (deleteObjectRequest)="onDeleteObject($event)"
              (deleteFolderRequest)="onDeleteFolder($event)"
              (shareRequest)="s.openShare($event)"
            >
              <ng-container objectActions>
                @if (s.bucketPolicy(); as p) {
                  <fl-status
                    [tone]="p.public ? 'warning' : 'neutral'"
                    [label]="p.public ? 'Public' : 'Private'"
                  />
                  <button
                    flButton="ghost"
                    size="sm"
                    type="button"
                    [disabled]="s.policyBusy()"
                    [title]="
                      p.public
                        ? 'Anyone can read objects anonymously.'
                        : 'Only S3 keys can read objects.'
                    "
                    (click)="togglePublic()"
                  >
                    {{ p.public ? 'Make private' : 'Make public' }}
                  </button>
                }
                <button
                  flButton
                  size="sm"
                  type="button"
                  [disabled]="!s.selectedBucket() || s.busy()"
                  (click)="createFolder()"
                >
                  <fl-icon name="lucideFolderPlus" [size]="14" />
                  Folder
                </button>
                <label
                  class="fl-btn fl-btn--primary fl-btn--sm cursor-pointer"
                  [class.pointer-events-none]="!s.selectedBucket() || s.busy()"
                  [class.opacity-50]="!s.selectedBucket() || s.busy()"
                >
                  <fl-icon name="lucideUpload" [size]="14" />
                  Upload
                  <input type="file" multiple class="fl-sr" (change)="onFilesPicked($event)" />
                </label>
              </ng-container>
            </app-object-store-object-table>
            <app-object-store-shares (revokeRequest)="onRevoke($event)" />
          </div>
        </div>
      }
    </div>
  `,
})
export class ObjectStoreConsolePageComponent implements OnInit {
  protected readonly s = inject(ObjectStoreConsoleStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirm = inject(ConfirmService);
  private readonly prompt = inject(NamePromptService);

  readonly applicationId = toSignal(this.route.paramMap.pipe(map((p) => p.get('applicationId'))), {
    initialValue: this.route.snapshot.paramMap.get('applicationId'),
  });

  ngOnInit(): void {
    this.s.appId.set(this.applicationId() ?? null);
    this.s.connect();
  }

  protected onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.s.uploadFiles(files);
  }

  protected async togglePublic(): Promise<void> {
    const current = this.s.bucketPolicy();
    if (!current) return;
    if (current.public) {
      this.s.applyPolicy(false);
      return;
    }
    const ok = await this.confirm.confirm({
      title: 'Make bucket public',
      body: 'Anyone with the URL will be able to read objects in this bucket anonymously, without a Flui account or S3 key. Only do this for assets meant to be public.',
      confirmLabel: 'Make public',
    });
    if (ok) this.s.applyPolicy(true);
  }

  protected async createBucket(): Promise<void> {
    const name = await this.prompt.ask({
      title: 'New bucket',
      label: 'Bucket name',
      hint: 'Lowercase letters, digits and hyphens.',
      placeholder: 'my-bucket',
      confirmLabel: 'Create',
    });
    if (name) this.s.createBucket(name);
  }

  protected async createFolder(): Promise<void> {
    const name = await this.prompt.ask({
      title: 'New folder',
      label: 'Folder name',
      placeholder: 'folder-name',
      confirmLabel: 'Create',
    });
    if (name) this.s.createFolder(name);
  }

  protected async onDeleteObject(o: S3ObjectEntry): Promise<void> {
    const name = objectName(o.key, this.s.prefix());
    const ok = await this.confirm.confirm({
      title: `Delete ${name}`,
      body: `This deletes ${o.key} from the bucket. It cannot be undone.`,
      confirmLabel: 'Delete object',
      destructive: true,
      typeToConfirm: name,
    });
    if (ok) this.s.deleteObject(o);
  }

  protected async onDeleteFolder(prefix: string): Promise<void> {
    const name = folderName(prefix, this.s.prefix());
    const ok = await this.confirm.confirm({
      title: `Delete folder ${name}`,
      body: `This deletes ${prefix} and everything in it. It cannot be undone.`,
      confirmLabel: 'Delete folder',
      destructive: true,
      typeToConfirm: name,
    });
    if (ok) this.s.deleteFolder(prefix);
  }

  protected async onRevoke(rec: ShareRecord): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Revoke share link',
      body: `The link to ${rec.key} stops working immediately, for anyone who has it.`,
      confirmLabel: 'Revoke',
      destructive: true,
    });
    if (ok) this.s.revokeShare(rec);
  }
}
