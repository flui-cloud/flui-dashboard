import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import {
  StorageBackendProvider,
  EncryptionMode,
} from '../../../model/backup.models';
import { CreateBackupDestinationDto } from '../../../../core/api/model/createBackupDestinationDto';

@Component({
  selector: 'app-destination-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-6 max-w-2xl space-y-6">
      <header class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold">New backup destination</h1>
        <a routerLink="/management/backup/destinations" class="text-sm text-muted-foreground hover:underline">
          Cancel
        </a>
      </header>

      <p class="text-sm text-muted-foreground">
        Add an <strong class="text-foreground">external</strong> S3-compatible bucket as a backup
        destination — AWS, Wasabi, Backblaze B2, Cloudflare R2, IDrive E2, MinIO, or any other
        endpoint that speaks the S3 API. On Scaleway you don't need this form.
      </p>

      <div class="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="text-sm">
          <p class="font-medium">⚡ Using Scaleway? Skip this form.</p>
          <p class="text-xs text-muted-foreground mt-0.5">
            Flui sets up the destination, schedule and first backup for a cluster in one click —
            no bucket or keys to copy.
          </p>
        </div>
        <a
          routerLink="/management/backup"
          class="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 text-center"
        >
          Enable backups →
        </a>
      </div>

      <form (ngSubmit)="onSubmit()" #f="ngForm" class="space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="block">
            <span class="text-sm font-medium">Name *</span>
            <input
              required
              name="name"
              [(ngModel)]="form.name"
              maxlength="120"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="my-s3-backup"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium">Region *</span>
            <input
              required
              name="region"
              [(ngModel)]="form.region"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g. eu-central-1"
            />
          </label>
        </div>

        <label class="block">
          <span class="text-sm font-medium">Endpoint *</span>
          <input
            required
            name="endpoint"
            type="url"
            [(ngModel)]="form.endpoint"
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="https://s3.example.com"
          />
        </label>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="block">
            <span class="text-sm font-medium">Bucket *</span>
            <input
              required
              name="bucket"
              [(ngModel)]="form.bucket"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium">Path prefix</span>
            <input
              name="pathPrefix"
              [(ngModel)]="form.pathPrefix"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="optional"
            />
          </label>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="block">
            <span class="text-sm font-medium">Access key *</span>
            <input
              required
              name="accessKey"
              [(ngModel)]="form.accessKey"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium">Secret key *</span>
            <input
              required
              name="secretKey"
              type="password"
              [(ngModel)]="form.secretKey"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
            />
          </label>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="block">
            <span class="text-sm font-medium">Encryption mode</span>
            <select
              name="encryptionMode"
              [(ngModel)]="form.encryptionMode"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="flui_managed">Flui-managed</option>
              <option value="byo_passphrase">Bring your own passphrase</option>
              <option value="none">None</option>
            </select>
          </label>
          <label class="block">
            <span class="text-sm font-medium">Cost (cents per GB / month)</span>
            <input
              type="number"
              name="costPerGbMonthCents"
              [(ngModel)]="form.costPerGbMonthCents"
              min="0"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="optional, e.g. 595"
            />
          </label>
        </div>

        @if (form.encryptionMode === 'byo_passphrase') {
        <label class="block">
          <span class="text-sm font-medium">Passphrase *</span>
          <input
            required
            type="password"
            name="encryptionPassphrase"
            [(ngModel)]="form.encryptionPassphrase"
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
          />
        </label>
        }

        <div class="flex flex-wrap gap-4">
          <label class="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="forcePathStyle"
              [(ngModel)]="form.forcePathStyle"
            />
            Force path-style addressing
          </label>
          <label class="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="useSse" [(ngModel)]="form.useSse" />
            Use server-side encryption (SSE)
          </label>
          <label class="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="usableForEtcdL1"
              [(ngModel)]="form.usableForEtcdL1"
            />
            Usable for etcd L1 snapshots
          </label>
        </div>

        @if (errorMsg()) {
        <div class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {{ errorMsg() }}
        </div>
        } @if (testResult(); as r) {
        <div
          class="rounded border px-3 py-2 text-sm"
          [class]="r.healthy ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'"
        >
          @if (r.healthy) { Connection successful. } @else { Connection failed: {{ r.error }} }
        </div>
        }

        <div class="flex gap-2">
          <button
            type="submit"
            class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            [disabled]="submitting() || !f.form.valid"
          >
            {{ submitting() ? 'Creating…' : 'Create &amp; test' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class DestinationFormComponent {
  private readonly backup = inject(BackupService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly testResult = signal<{ healthy: boolean; error?: string } | null>(null);

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
    setTimeout(() => this.router.navigate(['/management/backup/destinations', created.id]), 1500);
  }
}
