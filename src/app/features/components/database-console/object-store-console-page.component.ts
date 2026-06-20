import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogVariant,
} from '../../../shared/components/confirmation-dialog.component';
import { InputDialogComponent } from '../../../shared/components/input-dialog.component';
import {
  lucideArrowLeft,
  lucideBox,
  lucideFolderPlus,
  lucideGlobe,
  lucideHardDrive,
  lucideLoader,
  lucideLock,
  lucidePlus,
  lucideRotateCcw,
  lucideTriangleAlert,
  lucideUpload,
} from '@ng-icons/lucide';
import {
  S3ObjectEntry,
  ShareRecord,
} from '../../model/object-store-console.models';
import { ObjectStoreConsoleStateService } from './object-store-console-state.service';
import { ObjectStoreObjectTableComponent } from './object-store-object-table.component';
import { ObjectStoreSharesComponent } from './object-store-shares.component';

@Component({
  selector: 'app-object-store-console-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    ConfirmationDialogComponent,
    InputDialogComponent,
    ObjectStoreObjectTableComponent,
    ObjectStoreSharesComponent,
  ],
  providers: [
    ObjectStoreConsoleStateService,
    provideIcons({
      lucideArrowLeft,
      lucideBox,
      lucideFolderPlus,
      lucideGlobe,
      lucideHardDrive,
      lucideLoader,
      lucideLock,
      lucidePlus,
      lucideRotateCcw,
      lucideTriangleAlert,
      lucideUpload,
    }),
  ],
  template: `
    <div class="p-4 md:p-6">
      <div class="mb-4 flex items-center gap-3">
        <button
          type="button"
          (click)="s.back()"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          title="Back"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
        </button>
        <ng-icon name="lucideHardDrive" class="h-5 w-5 text-primary" />
        <div class="min-w-0">
          <h1 class="text-base font-semibold text-foreground">
            Object Storage
            @if (s.info(); as i) {
              <span class="text-muted-foreground font-normal">· {{ i.label }}</span>
            }
          </h1>
          <p class="truncate font-mono text-xs text-muted-foreground">
            {{ applicationId() }}
          </p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <button
            type="button"
            (click)="s.connect()"
            class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted"
            title="Refresh"
          >
            <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      @if (s.conn() === 'connecting') {
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Connecting…
        </div>
      } @else if (s.conn() === 'error') {
        <div
          class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{
            s.errorMsg() || 'Failed to connect to the object store.'
          }}</span>
        </div>
      } @else {
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideBox" class="h-4 w-4 text-muted-foreground" />
            <select
              [value]="s.selectedBucket() ?? ''"
              (change)="s.onBucketChange($any($event.target).value)"
              class="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            >
              @for (b of s.buckets(); track b.name) {
                <option [value]="b.name">{{ b.name }}</option>
              }
            </select>
            <button
              type="button"
              (click)="createBucket()"
              class="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-muted"
              title="New bucket"
            >
              <ng-icon name="lucidePlus" class="h-3.5 w-3.5" /> Bucket
            </button>
            @if (s.bucketPolicy(); as p) {
              <button
                type="button"
                (click)="togglePublic()"
                [disabled]="s.policyBusy()"
                [title]="
                  p.public
                    ? 'Public: anyone can read objects anonymously. Click to make private.'
                    : 'Private: key-only access. Click to make public.'
                "
                class="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs disabled:opacity-50"
                [class.border-amber-500]="p.public"
                [class.text-amber-600]="p.public"
                [class.border-border]="!p.public"
                [class.text-muted-foreground]="!p.public"
              >
                <ng-icon
                  [name]="p.public ? 'lucideGlobe' : 'lucideLock'"
                  class="h-3.5 w-3.5"
                />
                {{ p.public ? 'Public' : 'Private' }}
              </button>
            }
          </div>

          <div class="ml-auto flex items-center gap-2">
            <label
              class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
              [class.pointer-events-none]="!s.selectedBucket() || s.busy()"
              [class.opacity-50]="!s.selectedBucket() || s.busy()"
            >
              <ng-icon name="lucideUpload" class="h-3.5 w-3.5" /> Upload
              <input
                type="file"
                multiple
                class="hidden"
                (change)="onFilesPicked($event)"
              />
            </label>
            <button
              type="button"
              (click)="createFolder()"
              [disabled]="!s.selectedBucket() || s.busy()"
              class="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <ng-icon name="lucideFolderPlus" class="h-3.5 w-3.5" /> Folder
            </button>
          </div>
        </div>

        <app-object-store-object-table
          (deleteObjectRequest)="onDeleteObject($event)"
          (deleteFolderRequest)="onDeleteFolder($event)"
          (shareRequest)="s.openShare($event)"
        />
        <app-object-store-shares (revokeRequest)="onRevoke($event)" />
      }
    </div>

    <app-confirmation-dialog
      #confirmDialog
      [variant]="confirmVariant()"
      [confirmText]="confirmCta()"
      [title]="confirmTitle()"
      [message]="confirmMessage()"
      (confirmed)="onConfirmed()"
      (cancelled)="confirmDialog.close()"
    />
    <app-input-dialog
      #inputDialog
      confirmText="Create"
      [title]="inputTitle()"
      [message]="inputMessage()"
      [placeholder]="inputPlaceholder()"
      (confirmed)="onInputConfirmed($event)"
    />
  `,
})
export class ObjectStoreConsolePageComponent implements OnInit {
  protected readonly s = inject(ObjectStoreConsoleStateService);
  private readonly route = inject(ActivatedRoute);

  readonly applicationId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('applicationId'))),
    { initialValue: this.route.snapshot.paramMap.get('applicationId') },
  );

  @ViewChild('confirmDialog')
  private readonly confirmDialog!: ConfirmationDialogComponent;
  @ViewChild('inputDialog') private readonly inputDialog!: InputDialogComponent;

  protected readonly confirmTitle = signal('');
  protected readonly confirmMessage = signal('');
  protected readonly confirmVariant = signal<ConfirmationDialogVariant>('danger');
  protected readonly confirmCta = signal('Delete');
  protected readonly inputTitle = signal('');
  protected readonly inputMessage = signal('');
  protected readonly inputPlaceholder = signal('');
  private pendingConfirm: (() => void) | null = null;
  private pendingInput: ((value: string) => void) | null = null;

  ngOnInit(): void {
    this.s.appId.set(this.applicationId() ?? null);
    this.s.connect();
  }

  private askConfirm(
    title: string,
    message: string,
    action: () => void,
    opts: { variant?: ConfirmationDialogVariant; cta?: string } = {},
  ): void {
    this.confirmTitle.set(title);
    this.confirmMessage.set(message);
    this.confirmVariant.set(opts.variant ?? 'danger');
    this.confirmCta.set(opts.cta ?? 'Delete');
    this.pendingConfirm = action;
    this.confirmDialog.open();
  }

  protected onConfirmed(): void {
    const action = this.pendingConfirm;
    this.pendingConfirm = null;
    this.confirmDialog.close();
    action?.();
  }

  private askInput(
    title: string,
    message: string,
    placeholder: string,
    action: (value: string) => void,
  ): void {
    this.inputTitle.set(title);
    this.inputMessage.set(message);
    this.inputPlaceholder.set(placeholder);
    this.pendingInput = action;
    this.inputDialog.open();
  }

  protected onInputConfirmed(value: string): void {
    const action = this.pendingInput;
    this.pendingInput = null;
    this.inputDialog.close();
    action?.(value);
  }

  protected onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.s.uploadFiles(files);
  }

  protected togglePublic(): void {
    const current = this.s.bucketPolicy();
    if (!current) return;
    if (current.public) {
      this.s.applyPolicy(false);
      return;
    }
    this.askConfirm(
      'Make bucket public',
      'Anyone with the URL will be able to read objects in this bucket anonymously, without a Flui account or S3 key. Only do this for assets meant to be public.',
      () => this.s.applyPolicy(true),
      { variant: 'warning', cta: 'Make public' },
    );
  }

  protected createBucket(): void {
    this.askInput(
      'New bucket',
      'Lowercase letters, digits and hyphens.',
      'my-bucket',
      (name) => this.s.createBucket(name),
    );
  }

  protected createFolder(): void {
    this.askInput('New folder', '', 'folder-name', (name) =>
      this.s.createFolder(name),
    );
  }

  protected onDeleteObject(o: S3ObjectEntry): void {
    this.askConfirm(
      'Delete object',
      `Delete "${o.key}"? This cannot be undone.`,
      () => this.s.deleteObject(o),
    );
  }

  protected onDeleteFolder(prefix: string): void {
    this.askConfirm(
      'Delete folder',
      `Delete folder "${prefix}" and everything in it? This cannot be undone.`,
      () => this.s.deleteFolder(prefix),
    );
  }

  protected onRevoke(rec: ShareRecord): void {
    this.askConfirm(
      'Revoke share link',
      `The link to "${rec.key}" will stop working immediately, for anyone who has it.`,
      () => this.s.revokeShare(rec),
      { variant: 'warning', cta: 'Revoke' },
    );
  }
}
