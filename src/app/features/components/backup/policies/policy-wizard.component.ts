import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { ClusterService } from '../../../service/cluster.service';
import {
  BackupPolicyProfile,
  BackupScope,
  inferProfile,
  validatePolicyDestinations,
} from '../../../model/backup.models';
import { CreateBackupPolicyDto } from '../../../../core/api/model/createBackupPolicyDto';
import { PolicyDestinationInputDto } from '../../../../core/api/model/policyDestinationInputDto';

interface WizardDestination {
  destinationId: string;
  role: 'primary' | 'replica';
  priority: number;
}

@Component({
  selector: 'app-policy-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-6 max-w-3xl space-y-5">
      <header class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold">New backup policy</h1>
        <a routerLink="/management/backup/policies" class="text-sm text-muted-foreground hover:underline">
          Cancel
        </a>
      </header>

      <ol class="flex gap-2 text-xs">
        @for (s of [1,2,3,4]; track s) {
        <li
          class="rounded-full px-3 py-1 border"
          [class.bg-primary]="step() === s"
          [class.text-primary-foreground]="step() === s"
          [class.border-primary]="step() === s"
          [class.border-border]="step() !== s"
        >
          Step {{ s }}
        </li>
        }
      </ol>

      <!-- Step 1: cluster + scope -->
      @if (step() === 1) {
      <section class="space-y-4">
        <label class="block">
          <span class="text-sm font-medium">Policy name *</span>
          <input
            [(ngModel)]="form.name"
            required
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="prod-daily"
          />
        </label>
        <label class="block">
          <span class="text-sm font-medium">Cluster *</span>
          <select
            [(ngModel)]="form.clusterId"
            required
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">— Select cluster —</option>
            @for (c of clusters(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        </label>
        <label class="block">
          <span class="text-sm font-medium">Scope</span>
          <select
            [(ngModel)]="form.scope"
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="cluster_all">Entire cluster</option>
            <option value="namespaces">Specific namespaces</option>
            <option value="applications">Specific applications</option>
            <option value="label_selector">Label selector</option>
          </select>
        </label>
        @if (form.scope === 'namespaces') {
        <label class="block">
          <span class="text-sm font-medium">Namespaces (comma-separated)</span>
          <input
            [(ngModel)]="namespacesText"
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="prod, app-prod"
          />
        </label>
        } @if (form.scope === 'label_selector') {
        <label class="block">
          <span class="text-sm font-medium">Label selector</span>
          <input
            [(ngModel)]="labelSelector"
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="tier=prod"
          />
        </label>
        }
        <label class="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" [(ngModel)]="form.includePvcs" />
          Include PVC data
        </label>
      </section>
      }

      <!-- Step 2: schedule + retention -->
      @if (step() === 2) {
      <section class="space-y-4">
        <label class="block">
          <span class="text-sm font-medium">Cron schedule</span>
          <input
            [(ngModel)]="form.cronSchedule"
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
            placeholder="0 2 * * *  (leave empty for on-demand only)"
          />
        </label>
        <div class="grid grid-cols-2 gap-4">
          <label class="block">
            <span class="text-sm font-medium">Retention (days)</span>
            <input
              type="number"
              min="1"
              [(ngModel)]="form.retentionDays"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium">Max copies</span>
            <input
              type="number"
              min="1"
              [(ngModel)]="form.retentionMaxCopies"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>
      }

      <!-- Step 3: profile + destinations -->
      @if (step() === 3) {
      <section class="space-y-4">
        <div class="grid grid-cols-3 gap-2">
          @for (p of profiles; track p) {
          <button
            type="button"
            (click)="form.profile = p"
            class="rounded-md border px-3 py-3 text-left transition-colors"
            [class.border-primary]="form.profile === p"
            [class.border-border]="form.profile !== p"
          >
            <div class="text-sm font-medium capitalize">{{ p }}</div>
            <div class="text-xs text-muted-foreground">{{ profileDescription(p) }}</div>
          </button>
          }
        </div>

        <div class="space-y-2">
          @for (d of destinations(); track d.destinationId; let i = $index) {
          <div class="flex items-center gap-2 rounded-md border border-border p-2">
            <select
              [(ngModel)]="d.destinationId"
              class="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="">— Select destination —</option>
              @for (dst of backup.destinations(); track dst.id) {
              <option [value]="dst.id">{{ dst.name }} ({{ dst.provider }})</option>
              }
            </select>
            <select
              [(ngModel)]="d.role"
              class="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="primary">Primary</option>
              <option value="replica">Replica</option>
            </select>
            <button type="button" class="text-xs text-red-600 hover:underline" (click)="removeDestination(i)">
              Remove
            </button>
          </div>
          }
          <button
            type="button"
            class="text-sm text-primary hover:underline"
            (click)="addDestination()"
          >
            + Add destination
          </button>
        </div>

        @if (validationError(); as v) {
        <div class="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {{ v }}
        </div>
        }
      </section>
      }

      <!-- Step 4: review -->
      @if (step() === 4) {
      <section class="space-y-3 text-sm">
        <h3 class="text-base font-semibold">Review</h3>
        <div class="rounded-md border border-border p-3 space-y-1">
          <div><span class="text-muted-foreground">Name:</span> {{ form.name }}</div>
          <div><span class="text-muted-foreground">Cluster:</span> {{ clusterName(form.clusterId) }}</div>
          <div><span class="text-muted-foreground">Scope:</span> {{ form.scope }}</div>
          <div><span class="text-muted-foreground">Schedule:</span> {{ form.cronSchedule || 'on-demand' }}</div>
          <div><span class="text-muted-foreground">Retention:</span> {{ form.retentionDays }}d / {{ form.retentionMaxCopies || '∞' }} copies</div>
          <div><span class="text-muted-foreground">Profile:</span> {{ inferredProfile() }}</div>
          <div><span class="text-muted-foreground">Destinations:</span></div>
          <ul class="ml-4 list-disc">
            @for (d of destinations(); track d.destinationId) {
            <li>{{ destName(d.destinationId) }} — {{ d.role }}</li>
            }
          </ul>
        </div>
        @if (submitError()) {
        <div class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {{ submitError() }}
        </div>
        }
      </section>
      }

      <div class="flex justify-between">
        <button
          type="button"
          class="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          [disabled]="step() === 1"
          (click)="prev()"
        >
          Back
        </button>
        @if (step() < 4) {
        <button
          type="button"
          class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          [disabled]="!canAdvance()"
          (click)="next()"
        >
          Next
        </button>
        } @else {
        <button
          type="button"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          [disabled]="submitting() || !!validationError()"
          (click)="onSubmit()"
        >
          {{ submitting() ? 'Creating…' : 'Create policy' }}
        </button>
        }
      </div>
    </div>
  `,
})
export class PolicyWizardComponent implements OnInit {
  protected readonly backup = inject(BackupService);
  private readonly clusterService = inject(ClusterService);
  private readonly router = inject(Router);

  readonly clusters = this.clusterService.clusters;
  readonly profiles: BackupPolicyProfile[] = ['single', 'mirrored', 'custom'];

  readonly step = signal(1);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly destinations = signal<WizardDestination[]>([
    { destinationId: '', role: 'primary', priority: 0 },
  ]);

  namespacesText = '';
  labelSelector = '';
  applicationIds = '';

  form: CreateBackupPolicyDto = {
    name: '',
    clusterId: '',
    scope: 'cluster_all' as BackupScope,
    includePvcs: true,
    includeEtcdL1: false,
    cronSchedule: '',
    retentionDays: 30,
    retentionMaxCopies: 14,
    profile: 'mirrored' as BackupPolicyProfile,
    destinations: [],
  };

  readonly inferredProfile = computed(() => inferProfile(this.destinations()));
  readonly validationError = computed(() => {
    const list = this.destinations()
      .filter((d) => d.destinationId)
      .map<PolicyDestinationInputDto>((d, i) => ({
        destinationId: d.destinationId,
        role: d.role,
        priority: i,
      }));
    return validatePolicyDestinations(list);
  });

  ngOnInit(): void {
    void (async () => {
      await Promise.all([this.clusterService.loadClusters(), this.backup.loadDestinations()]);
    })();
  }

  profileDescription(p: BackupPolicyProfile): string {
    switch (p) {
      case 'single':
        return 'Primary only. 1× storage cost.';
      case 'mirrored':
        return 'Primary + 1 replica cross-provider. 2× cost. Recommended.';
      case 'custom':
        return 'Multiple destinations with custom retention.';
    }
  }

  canAdvance(): boolean {
    if (this.step() === 1) return !!this.form.name && !!this.form.clusterId;
    if (this.step() === 3) return !this.validationError();
    return true;
  }

  next(): void {
    this.step.update((s) => Math.min(4, s + 1));
  }
  prev(): void {
    this.step.update((s) => Math.max(1, s - 1));
  }

  addDestination(): void {
    this.destinations.update((list) => [
      ...list,
      { destinationId: '', role: 'replica', priority: list.length },
    ]);
  }

  removeDestination(i: number): void {
    this.destinations.update((list) => list.filter((_, idx) => idx !== i));
  }

  destName(id: string): string {
    return this.backup.destinations().find((d) => d.id === id)?.name ?? '—';
  }

  clusterName(id: string): string {
    return this.clusters().find((c) => c.id === id)?.name ?? id;
  }

  async onSubmit(): Promise<void> {
    this.submitError.set(null);
    this.submitting.set(true);

    const dto: CreateBackupPolicyDto = {
      ...this.form,
      profile: this.inferredProfile(),
      destinations: this.destinations()
        .filter((d) => d.destinationId)
        .map((d, i) => ({
          destinationId: d.destinationId,
          role: d.role,
          priority: i,
        })),
    };

    if (!dto.cronSchedule) delete (dto as any).cronSchedule;

    if (this.form.scope === 'namespaces') {
      const ns = this.namespacesText.split(',').map((s) => s.trim()).filter(Boolean);
      dto.scopeSelector = { namespaces: ns };
    } else if (this.form.scope === 'label_selector') {
      dto.scopeSelector = { labelSelector: this.labelSelector };
    } else if (this.form.scope === 'applications') {
      const ids = this.applicationIds.split(',').map((s) => s.trim()).filter(Boolean);
      dto.scopeSelector = { applicationIds: ids };
    }

    const created = await this.backup.createPolicy(dto);
    this.submitting.set(false);
    if (!created) {
      this.submitError.set(this.backup.error() ?? 'Creation failed');
      return;
    }
    this.router.navigate(['/management/backup/policies', created.id]);
  }
}
