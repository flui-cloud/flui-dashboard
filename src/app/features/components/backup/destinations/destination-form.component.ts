import { Component, inject, input, output, signal, ChangeDetectionStrategy } from '@angular/core';

import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlField } from '../../../../ui/patterns/field';
import { FlPageHeader } from '../../../../ui/patterns/page-header';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlStatus } from '../../../../ui/primitives/status';
import { BackupService } from '../../../service/backup.service';
import { StorageBackendProvider, EncryptionMode } from '../../../model/backup.models';
import { CreateBackupDestinationDto } from '../../../../core/api/model/createBackupDestinationDto';

@Component({
  selector: 'app-destination-form',
  imports: [
    FormsModule,
    RouterLink,
    NgTemplateOutlet,
    FlPageHeader,
    FlPanel,
    FlField,
    FlAlert,
    FlButton,
    FlIcon,
    FlStatus,
  ],
  providers: [provideIcons({ lucideX })],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { '[class]': 'embedded() ? "flex min-h-0 flex-col" : "block"' },
  template: `
    <form
      (ngSubmit)="onSubmit()"
      #f="ngForm"
      [class]="embedded() ? 'flex min-h-0 flex-col' : 'fl-page'"
    >
      <ng-template #bucketFields>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fl-field label="Name" for="dest-name">
            <div class="fl-input fl-input--lg">
              <input
                id="dest-name"
                required
                name="name"
                [(ngModel)]="form.name"
                maxlength="120"
                placeholder="my-s3-backup"
              />
            </div>
          </fl-field>
          <fl-field label="Region" for="dest-region">
            <div class="fl-input fl-input--lg">
              <input
                id="dest-region"
                required
                name="region"
                [(ngModel)]="form.region"
                placeholder="eu-central-1"
              />
            </div>
          </fl-field>
          <fl-field label="Endpoint" for="dest-endpoint" class="sm:col-span-2">
            <div class="fl-input fl-input--lg">
              <input
                id="dest-endpoint"
                required
                name="endpoint"
                type="url"
                [(ngModel)]="form.endpoint"
                placeholder="https://s3.example.com"
              />
            </div>
          </fl-field>
          <fl-field label="Bucket" for="dest-bucket">
            <div class="fl-input fl-input--lg">
              <input
                id="dest-bucket"
                class="fl-mono"
                required
                name="bucket"
                [(ngModel)]="form.bucket"
              />
            </div>
          </fl-field>
          <fl-field label="Path prefix" for="dest-prefix" hint="Optional">
            <div class="fl-input fl-input--lg">
              <input
                id="dest-prefix"
                class="fl-mono"
                name="pathPrefix"
                [(ngModel)]="form.pathPrefix"
              />
            </div>
          </fl-field>
        </div>
      </ng-template>

      <ng-template #credentialFields>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fl-field label="Access key" for="dest-access-key">
            <div class="fl-input fl-input--lg">
              <input
                id="dest-access-key"
                class="fl-mono"
                required
                name="accessKey"
                autocomplete="off"
                [(ngModel)]="form.accessKey"
              />
            </div>
          </fl-field>
          <fl-field label="Secret key" for="dest-secret-key">
            <div class="fl-input fl-input--lg">
              <input
                id="dest-secret-key"
                class="fl-mono"
                required
                name="secretKey"
                type="password"
                autocomplete="new-password"
                [(ngModel)]="form.secretKey"
              />
            </div>
          </fl-field>
        </div>
      </ng-template>

      <ng-template #optionFields>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fl-field label="Encryption" for="dest-encryption">
            <span class="fl-select-wrap">
              <select
                id="dest-encryption"
                class="fl-select"
                name="encryptionMode"
                [(ngModel)]="form.encryptionMode"
              >
                <option value="flui_managed">Flui-managed</option>
                <option value="byo_passphrase">Bring your own passphrase</option>
                <option value="none">None</option>
              </select>
            </span>
          </fl-field>
          <fl-field label="Cost in cents per GB per month" for="dest-cost" hint="Optional">
            <div class="fl-input fl-input--lg">
              <input
                id="dest-cost"
                type="number"
                name="costPerGbMonthCents"
                min="0"
                placeholder="595"
                [(ngModel)]="form.costPerGbMonthCents"
              />
            </div>
          </fl-field>
          @if (form.encryptionMode === 'byo_passphrase') {
            <fl-field label="Passphrase" for="dest-passphrase" class="sm:col-span-2">
              <div class="fl-input fl-input--lg">
                <input
                  id="dest-passphrase"
                  class="fl-mono"
                  required
                  type="password"
                  name="encryptionPassphrase"
                  autocomplete="new-password"
                  [(ngModel)]="form.encryptionPassphrase"
                />
              </div>
            </fl-field>
          }
        </div>
        <div class="flex flex-col gap-2">
          <label class="fl-check">
            <input type="checkbox" name="forcePathStyle" [(ngModel)]="form.forcePathStyle" />
            <span>Force path-style addressing</span>
          </label>
          <label class="fl-check">
            <input type="checkbox" name="useSse" [(ngModel)]="form.useSse" />
            <span>Use server-side encryption (SSE)</span>
          </label>
          <label class="fl-check">
            <input type="checkbox" name="usableForEtcdL1" [(ngModel)]="form.usableForEtcdL1" />
            <span>Usable for etcd L1 snapshots</span>
          </label>
        </div>
      </ng-template>

      <ng-template #outcome>
        @if (errorMsg()) {
          <fl-alert tone="error" title="Destination not created">{{ errorMsg() }}</fl-alert>
        }
        @if (testResult(); as r) {
          @if (r.healthy) {
            <fl-status tone="success" label="Connection successful" />
          } @else {
            <fl-alert tone="error" title="Connection failed">{{ r.error }}</fl-alert>
          }
        }
      </ng-template>

      @if (embedded()) {
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title">New backup destination</h2>
          <button
            type="button"
            class="fl-dialog__close"
            aria-label="Close"
            (click)="cancelled.emit()"
          >
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-dialog__body">
          <p class="text-fl-body-sm text-fl-ink-muted">
            An external S3-compatible bucket: AWS, Wasabi, Backblaze B2, Cloudflare R2, IDrive E2,
            MinIO or any endpoint that speaks the S3 API.
          </p>
          <ng-container [ngTemplateOutlet]="bucketFields" />
          <ng-container [ngTemplateOutlet]="credentialFields" />
          <ng-container [ngTemplateOutlet]="optionFields" />
          <ng-container [ngTemplateOutlet]="outcome" />
        </div>
        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="cancelled.emit()">Cancel</button>
          <button flButton="primary" type="submit" [disabled]="submitting() || !f.form.valid">
            {{ submitting() ? 'Creating…' : 'Create and test' }}
          </button>
        </footer>
      } @else {
        <fl-page-header title="New backup destination" [breadcrumb]="breadcrumb">
          <span headerMeta
            >An external S3-compatible bucket: AWS, Wasabi, Backblaze B2, Cloudflare R2, IDrive E2,
            MinIO or any endpoint that speaks the S3 API.</span
          >
        </fl-page-header>

        <fl-alert tone="info" title="Using Scaleway? Skip this form.">
          Flui sets up the destination, schedule and first backup for a cluster in one click, with
          no bucket or keys to copy.
          <a alertActions flButton size="sm" routerLink="/management/backup">Enable backups</a>
        </fl-alert>

        <div class="fl-stack">
          <fl-panel title="Bucket">
            <ng-container [ngTemplateOutlet]="bucketFields" />
          </fl-panel>
          <fl-panel title="Credentials">
            <ng-container [ngTemplateOutlet]="credentialFields" />
          </fl-panel>
          <fl-panel title="Encryption and options">
            <div class="flex flex-col gap-4">
              <ng-container [ngTemplateOutlet]="optionFields" />
            </div>
          </fl-panel>
          <ng-container [ngTemplateOutlet]="outcome" />
          <div class="fl-row justify-end">
            <a flButton="ghost" routerLink="/management/backup/destinations">Cancel</a>
            <button flButton="primary" type="submit" [disabled]="submitting() || !f.form.valid">
              {{ submitting() ? 'Creating…' : 'Create and test' }}
            </button>
          </div>
        </div>
      }
    </form>
  `,
})
export class DestinationFormComponent {
  private readonly backup = inject(BackupService);
  private readonly router = inject(Router);

  readonly embedded = input(false);
  readonly created = output<string>();
  readonly cancelled = output<void>();

  readonly submitting = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly testResult = signal<{ healthy: boolean; error?: string } | null>(null);

  protected readonly breadcrumb = [
    { label: 'Backups', link: '/management/backup' },
    { label: 'Destinations', link: '/management/backup/destinations' },
    { label: 'New' },
  ];

  form: CreateBackupDestinationDto = {
    name: '',
    provider: 'generic_s3' as StorageBackendProvider,
    endpoint: '',
    region: '',
    bucket: '',
    pathPrefix: '',
    accessKey: '',
    secretKey: '',
    encryptionMode: 'flui_managed' as EncryptionMode,
    forcePathStyle: true,
    useSse: false,
    usableForEtcdL1: false,
  };

  async onSubmit(): Promise<void> {
    this.submitting.set(true);
    this.errorMsg.set(null);
    this.testResult.set(null);
    const dto = { ...this.form };
    if (!dto.pathPrefix) delete dto.pathPrefix;
    if (dto.encryptionMode !== 'byo_passphrase') delete dto.encryptionPassphrase;
    const created = await this.backup.createDestination(dto);
    if (!created) {
      this.errorMsg.set(this.backup.error() ?? 'Creation failed');
      this.submitting.set(false);
      return;
    }
    const test = await this.backup.testDestination(created.id);
    this.testResult.set(test);
    this.submitting.set(false);
    if (this.embedded()) {
      if (test?.healthy) this.created.emit(created.id);
      return;
    }
    setTimeout(() => this.router.navigate(['/management/backup/destinations', created.id]), 1500);
  }
}
