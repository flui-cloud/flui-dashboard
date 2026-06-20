import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ObjectStoreConsoleService } from '../../service/object-store-console.service';
import {
  BucketPolicy,
  ObjectStoreConnectionInfo,
  S3Bucket,
  S3Listing,
  S3ObjectEntry,
  ShareLink,
  ShareRecord,
} from '../../model/object-store-console.models';
import { consoleError, objectName, saveBlob } from './object-store-format';

type ConnState = 'connecting' | 'connected' | 'error';

export const SHARE_TTLS = [
  { label: '1 hour', seconds: 3600 },
  { label: '24 hours', seconds: 86400 },
  { label: '7 days', seconds: 604800 },
];

@Injectable()
export class ObjectStoreConsoleStateService {
  private readonly api = inject(ObjectStoreConsoleService);
  private readonly router = inject(Router);

  readonly ttls = SHARE_TTLS;
  readonly appId = signal<string | null>(null);

  readonly conn = signal<ConnState>('connecting');
  readonly errorMsg = signal('');
  readonly actionError = signal('');
  readonly info = signal<ObjectStoreConnectionInfo | null>(null);
  readonly buckets = signal<S3Bucket[]>([]);
  readonly selectedBucket = signal<string | null>(null);
  readonly bucketPolicy = signal<BucketPolicy | null>(null);
  readonly policyBusy = signal(false);
  readonly shares = signal<ShareRecord[]>([]);
  readonly showShares = signal(false);
  readonly prefix = signal('');
  readonly listing = signal<S3Listing | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly dragging = signal(false);
  readonly copiedKey = signal('');

  readonly shareFor = signal<string | null>(null);
  readonly shareTtl = signal(3600);
  readonly shareLink = signal<string | null>(null);
  readonly shareCopied = signal(false);

  readonly breadcrumb = computed(() => {
    const parts = this.prefix().split('/').filter(Boolean);
    let acc = '';
    return parts.map((name) => {
      acc += `${name}/`;
      return { name, prefix: acc };
    });
  });

  connect(): void {
    const id = this.appId();
    if (!id) return;
    this.conn.set('connecting');
    this.api.getConnectionInfo(id).subscribe({
      next: (info) => {
        this.info.set(info);
        this.api.listBuckets(id).subscribe({
          next: (buckets) => {
            this.buckets.set(buckets);
            const initial =
              this.selectedBucket() ??
              info.defaultBucket ??
              buckets[0]?.name ??
              null;
            this.selectedBucket.set(initial);
            this.conn.set('connected');
            this.loadShares();
            if (initial) {
              this.navigate('');
              this.loadPolicy();
            }
          },
          error: (e) => this.fail(e),
        });
      },
      error: (e) => this.fail(e),
    });
  }

  private fail(e: unknown): void {
    this.errorMsg.set(consoleError(e));
    this.conn.set('error');
  }

  onBucketChange(bucket: string): void {
    this.selectedBucket.set(bucket);
    this.navigate('');
    this.loadPolicy();
  }

  loadPolicy(): void {
    const id = this.appId();
    const bucket = this.selectedBucket();
    this.bucketPolicy.set(null);
    if (!id || !bucket) return;
    this.api.getBucketPolicy(id, bucket).subscribe({
      next: (p) => this.bucketPolicy.set(p),
      error: () => this.bucketPolicy.set(null),
    });
  }

  applyPolicy(isPublic: boolean): void {
    const id = this.appId();
    const bucket = this.selectedBucket();
    if (!id || !bucket) return;
    this.policyBusy.set(true);
    this.api.setBucketPolicy(id, bucket, isPublic).subscribe({
      next: (p) => {
        this.bucketPolicy.set(p);
        this.policyBusy.set(false);
      },
      error: (e) => {
        this.actionError.set(consoleError(e));
        this.policyBusy.set(false);
      },
    });
  }

  toggleShares(): void {
    const open = !this.showShares();
    this.showShares.set(open);
    if (open) this.loadShares();
  }

  loadShares(): void {
    const id = this.appId();
    if (!id) return;
    this.api.listShares(id).subscribe({
      next: (s) => this.shares.set(s),
      error: () => this.shares.set([]),
    });
  }

  revokeShare(s: ShareRecord): void {
    const id = this.appId();
    if (!id) return;
    this.api.revokeShare(id, s.id).subscribe({
      next: () => this.loadShares(),
      error: (e) => this.actionError.set(consoleError(e)),
    });
  }

  navigate(prefix: string): void {
    this.prefix.set(prefix);
    this.load();
  }

  load(append = false): void {
    const id = this.appId();
    const bucket = this.selectedBucket();
    if (!id || !bucket) return;
    this.actionError.set('');
    this.loading.set(!append);
    this.api
      .listObjects(id, {
        bucket,
        prefix: this.prefix(),
        delimiter: '/',
        continuationToken: append
          ? (this.listing()?.continuationToken ?? undefined)
          : undefined,
      })
      .subscribe({
        next: (page) => {
          if (append && this.listing()) {
            const prev = this.listing()!;
            this.listing.set({
              ...page,
              prefixes: [...prev.prefixes, ...page.prefixes],
              objects: [...prev.objects, ...page.objects],
            });
          } else {
            this.listing.set(page);
          }
          this.loading.set(false);
        },
        error: (e) => {
          this.actionError.set(consoleError(e));
          this.loading.set(false);
        },
      });
  }

  loadMore(): void {
    this.load(true);
  }

  uploadFiles(files: File[]): void {
    if (!files.length) return;
    const id = this.appId();
    const bucket = this.selectedBucket();
    if (!id || !bucket) return;
    this.busy.set(true);
    this.actionError.set('');
    let remaining = files.length;
    for (const file of files) {
      const key = `${this.prefix()}${file.name}`;
      this.api.upload(id, bucket, key, file).subscribe({
        next: () => {
          if (--remaining === 0) {
            this.busy.set(false);
            this.load();
          }
        },
        error: (e) => {
          this.actionError.set(consoleError(e));
          this.busy.set(false);
        },
      });
    }
  }

  download(o: S3ObjectEntry): void {
    const id = this.appId();
    const bucket = this.selectedBucket();
    if (!id || !bucket) return;
    this.api.download(id, bucket, o.key).subscribe({
      next: (blob) => saveBlob(blob, objectName(o.key, this.prefix())),
      error: (e) => this.actionError.set(consoleError(e)),
    });
  }

  deleteObject(o: S3ObjectEntry): void {
    const id = this.appId();
    const bucket = this.selectedBucket();
    if (!id || !bucket) return;
    this.api.deleteObject(id, bucket, o.key).subscribe({
      next: () => this.load(),
      error: (e) => this.actionError.set(consoleError(e)),
    });
  }

  deleteFolder(prefix: string): void {
    const id = this.appId();
    const bucket = this.selectedBucket();
    if (!id || !bucket) return;
    this.busy.set(true);
    this.api.deletePrefix(id, bucket, prefix).subscribe({
      next: () => {
        this.busy.set(false);
        this.load();
      },
      error: (e) => {
        this.actionError.set(consoleError(e));
        this.busy.set(false);
      },
    });
  }

  createBucket(name: string): void {
    const id = this.appId();
    if (!id) return;
    this.api.createBucket(id, name).subscribe({
      next: () => this.connect(),
      error: (e) => this.actionError.set(consoleError(e)),
    });
  }

  createFolder(name: string): void {
    const id = this.appId();
    const bucket = this.selectedBucket();
    if (!id || !bucket) return;
    let clean = name;
    while (clean.endsWith('/')) clean = clean.slice(0, -1);
    if (!clean) return;
    const marker = new File([], `${clean}/`);
    this.busy.set(true);
    this.api
      .upload(id, bucket, `${this.prefix()}${clean}/`, marker)
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.load();
        },
        error: (e) => {
          this.actionError.set(consoleError(e));
          this.busy.set(false);
        },
      });
  }

  openShare(o: S3ObjectEntry): void {
    this.shareFor.set(o.key);
    this.shareLink.set(null);
    this.shareCopied.set(false);
    this.shareTtl.set(3600);
  }

  closeShare(): void {
    this.shareFor.set(null);
  }

  generateShare(): void {
    const id = this.appId();
    const bucket = this.selectedBucket();
    const key = this.shareFor();
    if (!id || !bucket || !key) return;
    this.busy.set(true);
    this.api.share(id, bucket, key, this.shareTtl()).subscribe({
      next: (link: ShareLink) => {
        this.shareLink.set(this.api.shareUrl(link.path));
        this.busy.set(false);
        this.loadShares();
      },
      error: (e) => {
        this.actionError.set(consoleError(e));
        this.busy.set(false);
      },
    });
  }

  copyShareLink(link: string): void {
    void navigator.clipboard?.writeText(link);
    this.shareCopied.set(true);
  }

  copyKey(key: string): void {
    void navigator.clipboard?.writeText(key);
    this.copiedKey.set(key);
    setTimeout(() => {
      if (this.copiedKey() === key) this.copiedKey.set('');
    }, 1500);
  }

  back(): void {
    void this.router.navigate(['/apps/applications', this.appId()]);
  }
}
