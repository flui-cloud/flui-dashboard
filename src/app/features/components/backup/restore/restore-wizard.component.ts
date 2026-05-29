import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { ClusterService } from '../../../service/cluster.service';
import { RestorePreviewResult, formatBytes } from '../../../model/backup.models';
import { CreateRestoreJobDto } from '../../../../core/api/model/createRestoreJobDto';

interface MappingEntry {
  from: string;
  to: string;
}

@Component({
  selector: 'app-restore-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-6 max-w-3xl space-y-5">
      <header class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold">New restore</h1>
        <a routerLink="/management/backup/restore" class="text-sm text-muted-foreground hover:underline">
          Cancel
        </a>
      </header>

      <section class="space-y-3">
        <label class="block">
          <span class="text-sm font-medium">Artifact ID *</span>
          <input
            [(ngModel)]="form.artifactId"
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
            placeholder="UUID of the BackupArtifact"
          />
          <span class="text-xs text-muted-foreground">
            Pick the artifact UUID from a backup job's detail page.
          </span>
        </label>

        <label class="block">
          <span class="text-sm font-medium">Source destination *</span>
          <select
            [(ngModel)]="form.sourceDestinationId"
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">— Select destination —</option>
            @for (d of backup.destinations(); track d.id) {
            <option [value]="d.id">{{ d.name }} ({{ d.provider }})</option>
            }
          </select>
        </label>

        <button
          type="button"
          class="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          [disabled]="!form.artifactId || !form.sourceDestinationId || previewing()"
          (click)="onPreview()"
        >
          {{ previewing() ? 'Loading preview…' : 'Preview restore' }}
        </button>

        @if (preview(); as p) {
        <div class="rounded-lg border border-border bg-card p-4 text-sm space-y-1">
          <div><span class="text-muted-foreground">Velero backup:</span> {{ p.veleroBackupName }}</div>
          <div><span class="text-muted-foreground">Size:</span> {{ formatBytes(p.sizeBytes) }}</div>
          <div><span class="text-muted-foreground">Items:</span> {{ p.itemCount || '—' }}</div>
          <div><span class="text-muted-foreground">Objects at prefix:</span> {{ p.objectsAtPrefix || '—' }}</div>
        </div>
        }
      </section>

      <section class="space-y-3">
        <h3 class="text-base font-semibold">Target</h3>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-sm font-medium">Target cluster *</span>
            <select
              [(ngModel)]="form.targetClusterId"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">— Select cluster —</option>
              @for (c of clusters(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </label>
          <label class="block">
            <span class="text-sm font-medium">Target kind</span>
            <select
              [(ngModel)]="form.targetKind"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="cluster">Whole cluster</option>
              <option value="namespace">Namespace</option>
              <option value="application">Application</option>
              <option value="control">Control</option>
            </select>
          </label>
        </div>

        @if (form.targetKind === 'namespace') {
        <div class="space-y-2">
          <span class="text-sm font-medium">Namespace mapping</span>
          @for (m of mappings(); track $index; let i = $index) {
          <div class="flex gap-2">
            <input
              [(ngModel)]="m.from"
              placeholder="source ns"
              class="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <span class="self-center text-muted-foreground">→</span>
            <input
              [(ngModel)]="m.to"
              placeholder="target ns"
              class="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <button type="button" class="text-xs text-red-600" (click)="removeMapping(i)">Remove</button>
          </div>
          }
          <button type="button" class="text-sm text-primary hover:underline" (click)="addMapping()">
            + Add mapping
          </button>
        </div>
        }
      </section>

      @if (submitError()) {
      <div class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
        {{ submitError() }}
      </div>
      }

      <div class="flex justify-end">
        <button
          type="button"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          [disabled]="!canSubmit() || submitting()"
          (click)="onSubmit()"
        >
          {{ submitting() ? 'Starting…' : 'Start restore' }}
        </button>
      </div>
    </div>
  `,
})
export class RestoreWizardComponent implements OnInit {
  protected readonly backup = inject(BackupService);
  private readonly clusterService = inject(ClusterService);
  private readonly router = inject(Router);

  readonly clusters = this.clusterService.clusters;
  readonly previewing = signal(false);
  readonly preview = signal<RestorePreviewResult | null>(null);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly mappings = signal<MappingEntry[]>([]);
  readonly formatBytes = formatBytes;

  form: CreateRestoreJobDto = {
    artifactId: '',
    sourceDestinationId: '',
    targetClusterId: '',
    targetKind: 'namespace' as CreateRestoreJobDto.TargetKindEnum,
  };

  ngOnInit(): void {
    void (async () => {
      await Promise.all([this.backup.loadDestinations(), this.clusterService.loadClusters()]);
    })();
  }

  canSubmit(): boolean {
    return !!this.form.artifactId && !!this.form.sourceDestinationId && !!this.form.targetClusterId;
  }

  addMapping(): void {
    this.mappings.update((list) => [...list, { from: '', to: '' }]);
  }

  removeMapping(i: number): void {
    this.mappings.update((list) => list.filter((_, idx) => idx !== i));
  }

  async onPreview(): Promise<void> {
    this.previewing.set(true);
    this.preview.set(
      await this.backup.previewRestore({
        artifactId: this.form.artifactId,
        sourceDestinationId: this.form.sourceDestinationId,
      })
    );
    this.previewing.set(false);
  }

  async onSubmit(): Promise<void> {
    this.submitting.set(true);
    this.submitError.set(null);
    const dto: CreateRestoreJobDto = { ...this.form };
    if (this.form.targetKind === 'namespace') {
      const mapping: Record<string, string> = {};
      for (const m of this.mappings()) {
        if (m.from && m.to) mapping[m.from] = m.to;
      }
      dto.targetSelector = {
        namespaceMapping: Object.keys(mapping).length ? mapping : undefined,
      };
    }
    const result = await this.backup.createRestore(dto);
    this.submitting.set(false);
    if (!result) {
      this.submitError.set(this.backup.error() ?? 'Restore failed to start');
      return;
    }
    this.router.navigate(['/management/backup/restore', result.restore.id]);
  }
}
