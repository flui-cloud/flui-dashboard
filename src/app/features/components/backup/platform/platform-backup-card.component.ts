import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideCircleCheck,
  lucideCircleX,
  lucideClock,
  lucideFingerprint,
  lucideHeartPulse,
  lucideShieldCheck,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { ToastService } from '../../../../shared/services/toast.service';
import {
  PlatformBackupJob,
  PlatformBackupPolicy,
  PlatformBackupService,
} from '../../../service/platform-backup.service';

type Freshness = 'fresh' | 'stale' | 'unknown';

/** Fresh ≤ 45 min; beyond that the dead-man's switch withholds its heartbeat. */
const FRESH_THRESHOLD_MIN = 45;
const INSECURE_SSH_KEY = 'SSH_KEY_ENCRYPTION_KEY';

const FRESHNESS_CLASSES: Record<Freshness, string> = {
  fresh: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  stale: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  unknown: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/30',
};

const FRESHNESS_LABEL: Record<Freshness, string> = {
  fresh: 'Fresh',
  stale: "Stale — dead-man's switch will alarm",
  unknown: 'No run yet',
};

@Component({
  selector: 'app-platform-backup-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, NgIcon, BackupStatusBadgeComponent],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideCircleCheck,
      lucideCircleX,
      lucideClock,
      lucideFingerprint,
      lucideHeartPulse,
      lucideShieldCheck,
      lucideTriangleAlert,
    }),
  ],
  template: `
    <section class="space-y-2">
      <div class="flex items-center gap-2">
        <ng-icon name="lucideShieldCheck" class="h-4 w-4 text-primary" />
        <h2 class="text-sm font-semibold">Platform resilience (DR)</h2>
      </div>
      <p class="text-xs text-muted-foreground">
        Off-provider backup of the Flui control plane itself (Flui DB + key material), sealed to an
        operator-held recipient so it can be rebuilt on another provider.
      </p>

      <div class="rounded-lg border border-border bg-card p-5">
        @if (loading()) {
        <p class="text-sm text-muted-foreground">Loading platform backup status…</p>
        } @else if (!policy()) {
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-sm font-medium">
            <ng-icon name="lucideCircleAlert" class="h-4 w-4 text-muted-foreground" />
            Platform backup not initialized
          </div>
          <p class="text-sm text-muted-foreground">
            No platform (control-plane DR) policy exists yet. Initialize it from the CLI — the
            operator's private age identity is generated offline and must never touch a
            server-reachable surface.
          </p>
          <code class="inline-block rounded bg-muted px-2 py-1 text-xs">flui backup platform init</code>
        </div>
        } @else {
        <div class="space-y-5">
          <!-- Recovery status -->
          <div class="space-y-3">
            <!-- Operator recipient -->
            @if (hasRecipient()) {
            <div class="flex items-start gap-2 text-sm">
              <ng-icon name="lucideCircleCheck" class="mt-0.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <div>
                <div class="font-medium">Operator recipient configured</div>
                <div class="font-mono text-xs text-muted-foreground">{{ recipientPrefix() }}…</div>
              </div>
            </div>
            } @else {
            <div class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <ng-icon name="lucideCircleX" class="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div class="font-medium">No operator recipient — platform backup cannot run</div>
                <div class="mt-1 text-xs">
                  Set it from the CLI:
                  <code class="rounded bg-destructive/10 px-1 py-0.5">flui backup platform init</code>
                </div>
              </div>
            </div>
            }

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <!-- Heartbeat -->
              <div class="flex items-start gap-2 text-sm">
                <ng-icon name="lucideHeartPulse" class="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div class="text-xs text-muted-foreground">Dead-man's switch</div>
                  <div>{{ heartbeatConfigured() ? 'Heartbeat URL configured' : 'Not configured' }}</div>
                </div>
              </div>

              <!-- Schedule -->
              <div class="flex items-start gap-2 text-sm">
                <ng-icon name="lucideClock" class="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div class="text-xs text-muted-foreground">Schedule</div>
                  <div class="font-mono text-xs">{{ policy()?.cronSchedule || '—' }}</div>
                </div>
              </div>
            </div>

            <!-- Last backup -->
            <div class="rounded-md border border-border bg-background p-3">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs text-muted-foreground">Last backup</span>
                @if (lastJob(); as j) {
                <app-backup-status-badge kind="job" [value]="j.status" />
                <span
                  class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                  [class]="freshnessClasses()"
                >
                  {{ freshnessLabel() }}
                </span>
                } @else {
                <span class="text-sm text-muted-foreground">No runs yet</span>
                }
              </div>
              @if (lastJob(); as j) {
              <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div class="text-xs text-muted-foreground">Finished</div>
                  <div>{{ j.finishedAt || '—' }}</div>
                </div>
                <div>
                  <div class="text-xs text-muted-foreground">Age</div>
                  <div>{{ ageLabel() }}</div>
                </div>
              </div>
              }
            </div>

            <!-- Zitadel / identity coverage -->
            @if (zitadelKnown()) {
            @if (zitadelCovered()) {
            <div class="flex items-start gap-2 text-sm">
              <ng-icon name="lucideFingerprint" class="mt-0.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <div>Identity data (Zitadel) covered</div>
            </div>
            } @else {
            <div class="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              <ng-icon name="lucideFingerprint" class="mt-0.5 h-4 w-4 shrink-0" />
              <div>Identity data not covered — Zitadel reverts to fresh on rebuild.</div>
            </div>
            }
            }

            <!-- Insecure default key material -->
            @if (sshKeyInsecure()) {
            <div class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div class="font-medium">Insecure default: SSH key encryption key</div>
                <div class="mt-1 text-xs">
                  <code class="rounded bg-destructive/10 px-1 py-0.5">{{ insecureSshKey }}</code>
                  is still a built-in default. Anyone holding the platform backup can decrypt SSH key
                  material — rotate it before relying on this DR path.
                </div>
              </div>
            </div>
            }
          </div>

          <!-- Heartbeat URL form -->
          <div class="space-y-2 border-t border-border pt-4">
            <label for="platform-heartbeat-url" class="text-sm font-medium">
              Dead-man's-switch heartbeat URL
            </label>
            <p class="text-xs text-muted-foreground">
              The master POSTs here every 5 min and withholds it when the last backup is stale — point
              it at your operator monitor (e.g. a healthchecks.io ping URL).
            </p>
            <div class="flex flex-col gap-2 sm:flex-row">
              <input
                id="platform-heartbeat-url"
                type="url"
                [(ngModel)]="heartbeatUrlInput"
                [disabled]="!hasRecipient() || saving()"
                placeholder="https://…"
                class="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              />
              <button
                type="button"
                class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                [disabled]="!hasRecipient() || saving()"
                (click)="saveHeartbeat()"
              >
                {{ saving() ? 'Saving…' : 'Save' }}
              </button>
            </div>
            @if (!hasRecipient()) {
            <p class="text-xs text-muted-foreground">
              Configure the operator recipient via the CLI first.
            </p>
            }
          </div>

          <!-- CLI note -->
          <p class="border-t border-border pt-4 text-xs text-muted-foreground">
            The operator recipient (<code class="rounded bg-muted px-1">age1…</code>) is set with
            <code class="rounded bg-muted px-1">flui backup platform init</code>. The matching private
            identity stays offline with the operator — the master can never decrypt its own backup, so
            it is never generated in the browser.
          </p>
        </div>
        }

        @if (error()) {
        <div class="mt-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {{ error() }}
        </div>
        }
      </div>
    </section>
  `,
})
export class PlatformBackupCardComponent implements OnInit {
  private readonly service = inject(PlatformBackupService);
  private readonly toast = inject(ToastService);

  protected readonly insecureSshKey = INSECURE_SSH_KEY;

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly policy = signal<PlatformBackupPolicy | null>(null);
  protected readonly lastJob = signal<PlatformBackupJob | null>(null);
  protected readonly now = signal(Date.now());

  protected heartbeatUrlInput = '';

  protected readonly recipient = computed(
    () => this.policy()?.metadata?.platform?.recipient ?? null,
  );
  protected readonly hasRecipient = computed(() => !!this.recipient());
  protected readonly recipientPrefix = computed(() => this.recipient()?.slice(0, 18) ?? '');
  protected readonly heartbeatConfigured = computed(
    () => !!this.policy()?.metadata?.platform?.heartbeat?.url,
  );

  protected readonly ageMinutes = computed<number | null>(() => {
    const finished = this.lastJob()?.finishedAt;
    if (!finished) return null;
    const t = new Date(finished).getTime();
    if (Number.isNaN(t)) return null;
    return (this.now() - t) / 60000;
  });

  protected readonly freshness = computed<Freshness>(() => {
    const age = this.ageMinutes();
    if (age == null) return 'unknown';
    return age <= FRESH_THRESHOLD_MIN ? 'fresh' : 'stale';
  });
  protected readonly freshnessClasses = computed(() => FRESHNESS_CLASSES[this.freshness()]);
  protected readonly freshnessLabel = computed(() => FRESHNESS_LABEL[this.freshness()]);

  protected readonly zitadelCovered = computed(
    () => this.lastJob()?.metadata?.zitadelCovered === true,
  );
  protected readonly zitadelKnown = computed(
    () => typeof this.lastJob()?.metadata?.zitadelCovered === 'boolean',
  );
  protected readonly sshKeyInsecure = computed(
    () => this.lastJob()?.metadata?.insecureDefaults?.includes(INSECURE_SSH_KEY) ?? false,
  );

  ngOnInit(): void {
    void this.load();
  }

  protected ageLabel(): string {
    const age = this.ageMinutes();
    if (age == null) return '—';
    const m = Math.round(age);
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m ago`;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const policies = await this.service.listPlatformPolicies();
      const policy = policies[0] ?? null;
      this.policy.set(policy);
      this.heartbeatUrlInput = policy?.metadata?.platform?.heartbeat?.url ?? '';
      this.now.set(Date.now());
      if (policy) {
        this.lastJob.set(await this.service.lastPlatformJob([policy.id]));
      }
    } catch (err: unknown) {
      this.error.set(this.errorMessage(err, 'Failed to load platform backup status'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async saveHeartbeat(): Promise<void> {
    const policy = this.policy();
    const recipient = this.recipient();
    if (!policy || !recipient) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const updated = await this.service.setPlatformConfig(policy.id, {
        recipient,
        heartbeatUrl: this.heartbeatUrlInput.trim() || undefined,
      });
      this.policy.set(updated);
      this.heartbeatUrlInput = updated.metadata?.platform?.heartbeat?.url ?? '';
      this.toast.showSuccess('Heartbeat URL updated');
    } catch (err: unknown) {
      const message = this.errorMessage(err, 'Failed to update heartbeat URL');
      this.error.set(message);
      this.toast.showError(message);
    } finally {
      this.saving.set(false);
    }
  }

  private errorMessage(err: unknown, fallback: string): string {
    if (typeof err === 'object' && err !== null) {
      const e = err as { error?: { message?: string }; message?: string };
      return e.error?.message ?? e.message ?? fallback;
    }
    return fallback;
  }
}
