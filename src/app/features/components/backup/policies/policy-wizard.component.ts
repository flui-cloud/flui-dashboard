import { Component, OnInit, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { ClusterService } from '../../../service/cluster.service';
import {
  BackupPolicyProfile,
  BackupScope,
  inferProfile,
  validatePolicyDestinations,
} from '../../../model/backup.models';
import { policyEngineLabel } from '../../../model/backup-protection.models';
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
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
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
          <span class="text-sm font-medium">Engine</span>
          <select
            [(ngModel)]="form.engineClass"
            (ngModelChange)="onEngineClassChange($event)"
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="volume_copy">Volume backups — encrypted snapshots of one app's volumes</option>
            <option value="database">Database — continuous backup, or dumps, for one database</option>
            <option value="platform">Flui itself — the control-plane database</option>
          </select>
          @if (form.engineClass === 'database') {
          <p class="mt-1 text-xs text-muted-foreground">
            Continuous where the image allows, nightly dumps otherwise. One destination, no replicas.
          </p>
          } @else if (form.engineClass === 'volume_copy') {
          <p class="mt-1 text-xs text-muted-foreground">
            Keeps 7 daily and 4 weekly snapshots. To protect every app at once, use "Protect this cluster".
          </p>
          }
        </label>
        <label class="block">
          <span class="text-sm font-medium">Scope</span>
          <select
            [(ngModel)]="form.scope"
            [disabled]="perApp()"
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
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
        } @if (form.scope === 'applications') {
        <label class="block">
          <span class="text-sm font-medium">
            {{ perApp() ? 'Application ID' : 'Application IDs (comma-separated)' }}
          </span>
          <input
            [(ngModel)]="applicationIds"
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
            placeholder="8b2b8f1a-0398-45fc-9ffd-143830cf722e"
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
        @if (form.engineClass === 'volume_copy') {
        <label class="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" [(ngModel)]="pauseDuringCopy" />
          Stop the app during each copy
        </label>
        }
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
            placeholder="0 3 * * *  (empty: the default nightly time)"
          />
        </label>
        @if (form.engineClass === 'volume_copy') {
        <label class="inline-flex items-center gap-2 text-sm" title="Two more months of history for about 30% more space">
          <input type="checkbox" [(ngModel)]="keepMonthly" />
          Also keep 3 monthly snapshots
        </label>
        } @else {
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
        }
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
              [ngModel]="d.destinationId"
              (ngModelChange)="setDestinationField(i, 'destinationId', $event)"
              class="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="">— Select destination —</option>
              @for (dst of backup.destinations(); track dst.id) {
              <option [value]="dst.id">{{ dst.name }} ({{ dst.provider }})</option>
              }
            </select>
            <select
              [ngModel]="d.role"
              (ngModelChange)="setDestinationField(i, 'role', $event)"
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
          @if (form.engineClass !== 'database' || destinations().length === 0) {
          <button
            type="button"
            class="text-sm text-primary hover:underline"
            (click)="addDestination()"
          >
            + Add destination
          </button>
          }
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
          <div><span class="text-muted-foreground">Engine:</span> {{ engineLabel(form.engineClass) }}</div>
          <div><span class="text-muted-foreground">Scope:</span> {{ form.scope }}</div>
          @if (form.scope === 'applications') {
          <div><span class="text-muted-foreground">Applications:</span> {{ applicationIds || '—' }}</div>
          }
          <div><span class="text-muted-foreground">Schedule:</span> {{ form.cronSchedule || 'default nightly time' }}</div>
          @if (form.engineClass === 'volume_copy') {
          <div><span class="text-muted-foreground">Keeps:</span> 7 daily, 4 weekly{{ keepMonthly ? ', 3 monthly' : '' }}</div>
          } @else {
          <div><span class="text-muted-foreground">Retention:</span> {{ form.retentionDays }}d / {{ form.retentionMaxCopies || '∞' }} copies</div>
          }
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
  private readonly route = inject(ActivatedRoute);

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
  pauseDuringCopy = false;
  keepMonthly = false;

  form: CreateBackupPolicyDto = {
    name: '',
    clusterId: '',
    scope: 'applications' as BackupScope,
    engineClass: 'volume_copy',
    cronSchedule: '',
    retentionDays: 30,
    retentionMaxCopies: 14,
    profile: 'single' as BackupPolicyProfile,
    destinations: [],
  };

  readonly engineLabel = policyEngineLabel;

  /** Database and volume backups protect exactly one application. */
  perApp(): boolean {
    return this.form.engineClass === 'database' || this.form.engineClass === 'volume_copy';
  }

  onEngineClassChange(engineClass: CreateBackupPolicyDto.EngineClassEnum): void {
    if (engineClass === 'database' || engineClass === 'volume_copy') {
      this.form.scope = 'applications' as BackupScope;
    }
    if (engineClass === 'database') {
      this.destinations.update((list) => list.slice(0, 1).map((d) => ({ ...d, role: 'primary' as const })));
    }
  }

  readonly inferredProfile = computed(() => inferProfile(this.destinations()));
  readonly validationError = computed(() => {
    const list = this.destinations()
      .filter((d) => d.destinationId)
      .map<PolicyDestinationInputDto>((d, i) => ({
        destinationId: d.destinationId,
        role: d.role,
        priority: i,
      }));
    const base = validatePolicyDestinations(list);
    if (base) return base;
    if (this.form.engineClass === 'database' && list.length > 1) {
      return 'A database-class policy supports only a single (primary) destination.';
    }
    return null;
  });

  ngOnInit(): void {
    this.prefillFromLink();
    void (async () => {
      await Promise.all([this.clusterService.loadClusters(), this.backup.loadDestinations()]);
    })();
  }

  /** "Protect" from the home opens this with the cluster and the app already chosen. */
  private prefillFromLink(): void {
    const params = this.route.snapshot.queryParamMap;
    const clusterId = params.get('clusterId');
    const applicationId = params.get('applicationId');
    if (clusterId) this.form.clusterId = clusterId;
    if (params.get('engineClass') === 'database') {
      this.form.engineClass = 'database';
      this.onEngineClassChange('database');
    }
    if (applicationId) {
      this.form.scope = 'applications' as BackupScope;
      this.applicationIds = applicationId;
      if (!this.form.name) this.form.name = `protect-${applicationId.slice(0, 8)}`;
    }
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
    if (this.step() === 1) {
      if (!this.form.name || !this.form.clusterId) return false;
      if (this.form.scope === 'applications' && !this.applicationIds.trim()) return false;
      if (this.perApp() && this.applicationIds.split(',').filter((s) => s.trim()).length !== 1) return false;
      return true;
    }
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

  /**
   * Mutating `d.destinationId` in place (the old [(ngModel)] binding) never
   * marks the `destinations` signal dirty, so `validationError` — a
   * `computed()` — never recomputes and Step 3 stays stuck on "at least one
   * destination is required" forever. Replace, don't mutate.
   */
  setDestinationField(i: number, field: 'destinationId' | 'role', value: string): void {
    this.destinations.update((list) =>
      list.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)),
    );
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
    if (this.form.engineClass === 'volume_copy') {
      delete (dto as any).retentionMaxCopies;
      const metadata = {
        ...(this.pauseDuringCopy ? { pauseDuringCopy: true } : {}),
        ...(this.keepMonthly ? { keepMonthly: true } : {}),
      };
      if (Object.keys(metadata).length) dto.metadata = metadata;
    }

    if (this.form.scope === 'namespaces') {
      const ns = this.namespacesText.split(',').map((s) => s.trim()).filter(Boolean);
      dto.scopeSelector = { namespaces: ns };
    } else if (this.form.scope === 'label_selector') {
      dto.scopeSelector = { labelSelector: this.labelSelector };
    } else if (this.form.scope === 'applications') {
      const ids = this.applicationIds.split(',').map((s) => s.trim()).filter(Boolean);
      dto.scopeSelector = { applicationIds: ids };
    }

    const created =
      this.form.engineClass === 'database'
        ? await this.backup.enableDatabase(dto)
        : await this.backup.createPolicy(dto);
    this.submitting.set(false);
    if (!created) {
      this.submitError.set(this.backup.error() ?? 'Creation failed');
      return;
    }
    this.router.navigate(['/management/backup/policies', created.id]);
  }
}
