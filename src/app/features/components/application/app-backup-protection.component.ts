import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../core/services/app-config.service';
import { BackupService } from '../../service/backup.service';

interface ProtectionPolicy {
  policyId: string;
  name: string;
  engineClass: string;
  engine?: string | null;
  schedule: string | null;
  enabled: boolean;
  status: string;
  destination: { id: string; name: string; provider: string } | null;
  lastRun: { status: string; at: string | null; error: string | null } | null;
  nextRunAt: string | null;
}

interface Protection {
  protectedOffCluster: boolean;
  policies: ProtectionPolicy[];
}

/**
 * Whether this application is protected off the cluster, at the top of its
 * Backup tab: copies on the cluster go with the cluster, so they are not the
 * answer to "is this app protected".
 */
@Component({
  selector: 'app-backup-protection',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    @if (protection(); as p) {
      <section
        class="card-surface p-4 space-y-3"
        data-testid="backup-protection"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">
              @if (!hasData()) {
                Nothing to protect
              } @else if (p.protectedOffCluster) {
                Protected off the cluster
              } @else {
                Not protected off the cluster
              }
            </h2>
            @if (!hasData()) {
              <p class="text-sm text-muted-foreground mt-0.5">
                This application keeps no data of its own: redeploying it brings
                it back as it was.
              </p>
            } @else if (!p.protectedOffCluster) {
              <p class="text-sm text-muted-foreground mt-0.5">
                @if (p.policies.length) {
                  Its backups did not reach backup storage — see why below. If
                  the cluster is lost, so is its data.
                } @else {
                  Nothing of this {{ database() ? 'database' : 'application' }}
                  is copied to backup storage. If the cluster is lost, so is its
                  data.
                }
              </p>
            }
          </div>
          @if (
            hasData() &&
            !p.protectedOffCluster &&
            !p.policies.length &&
            !choosing()
          ) {
            <button
              (click)="startProtect()"
              class="shrink-0 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Protect this {{ database() ? 'database' : 'app' }}
            </button>
          }
        </div>

        @for (pol of p.policies; track pol.policyId) {
          <div class="rounded-md border border-border px-3 py-2 text-sm">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-medium">{{ kindLabel(pol.engineClass, pol.engine) }}</span>
              <span
                class="text-xs"
                [class]="
                  pol.enabled ? 'text-muted-foreground' : 'text-amber-600'
                "
              >
                {{
                  pol.enabled
                    ? pol.schedule
                      ? 'on a schedule (' + pol.schedule + ')'
                      : 'on'
                    : 'stopped'
                }}
              </span>
            </div>
            <div class="text-xs text-muted-foreground mt-1">
              To {{ pol.destination?.name ?? 'an unknown destination' }}
              @if (pol.lastRun; as r) {
                · last run {{ r.status.replace('_', ' ')
                }}{{ r.at ? ' at ' + r.at.slice(0, 16).replace('T', ' ') : '' }}
              } @else {
                · no run yet
              }
              @if (pol.nextRunAt) {
                · next {{ pol.nextRunAt.slice(0, 16).replace('T', ' ') }}
              }
            </div>
            @if (pol.lastRun?.error) {
              <div class="text-xs text-red-600 mt-1">
                {{ pol.lastRun?.error }}
              </div>
            }
          </div>
        }

        @if (choosing()) {
          <div class="flex flex-wrap items-end gap-2">
            <label class="block text-sm">
              <span class="text-xs text-muted-foreground">Backup storage</span>
              <select
                [ngModel]="destinationId()"
                (ngModelChange)="destinationId.set($event)"
                class="mt-1 block h-9 px-3 rounded-md border border-input bg-background text-sm"
              >
                @for (d of backup.destinations(); track d.id) {
                  <option [value]="d.id">{{ d.name }}</option>
                }
              </select>
            </label>
            @if (!database()) {
              <label class="flex items-center gap-2 text-sm h-9">
                <input
                  type="checkbox"
                  [ngModel]="pause()"
                  (ngModelChange)="pause.set($event)"
                />
                Stop the app during each copy
              </label>
            }
            <button
              (click)="protect()"
              [disabled]="!destinationId() || working()"
              class="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {{
                working()
                  ? 'Setting up…'
                  : database()
                    ? 'Start backups'
                    : 'Copy every night'
              }}
            </button>
            <button
              (click)="choosing.set(false)"
              class="px-3 py-1.5 text-sm rounded-md hover:bg-muted"
            >
              Cancel
            </button>
          </div>
          @if (!backup.destinations().length) {
            <p class="text-xs text-muted-foreground">
              No backup storage yet: add one under Management → Backup →
              Destinations.
            </p>
          }
        }
        @if (failure()) {
          <p class="text-sm text-red-600">{{ failure() }}</p>
        }
      </section>
    }
  `,
})
export class AppBackupProtectionComponent {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  protected readonly backup = inject(BackupService);

  readonly appId = input<string | null>(null);
  readonly appSlug = input<string>('');
  readonly clusterId = input<string>('');
  readonly database = input(false);
  /** False for an application with no volume: there is nothing to copy. */
  readonly hasData = input(true);

  protected readonly protection = signal<Protection | null>(null);
  protected readonly choosing = signal(false);
  protected readonly working = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly destinationId = signal('');
  protected readonly pause = signal(false);

  constructor() {
    effect(() => {
      const id = this.appId();
      if (id) void this.load(id);
    });
  }

  protected kindLabel(engineClass: string, engine?: string | null): string {
    if (engineClass === 'database') {
      return engine?.endsWith('-dump') ? 'Scheduled dumps' : 'Continuous backup';
    }
    if (engineClass === 'volume_copy') return 'Volume copies to backup storage';
    return 'Cluster backup';
  }

  protected async startProtect(): Promise<void> {
    this.failure.set(null);
    await this.backup.loadDestinations();
    this.destinationId.set(this.backup.destinations()[0]?.id ?? '');
    this.choosing.set(true);
  }

  protected async protect(): Promise<void> {
    const id = this.appId();
    if (!id) return;
    this.working.set(true);
    this.failure.set(null);
    const base = `${this.config.apiBaseUrl}/api/v1/backup-policies`;
    const body = {
      name: `${this.appSlug()}-${this.database() ? 'continuous' : 'volumes'}`,
      clusterId: this.clusterId(),
      engineClass: this.database() ? 'database' : 'volume_copy',
      scope: 'applications',
      scopeSelector: { applicationIds: [id] },
      ...(this.database() ? {} : { cronSchedule: '0 2 * * *' }),
      ...(!this.database() && this.pause()
        ? { metadata: { pauseDuringCopy: true } }
        : {}),
      retentionDays: 30,
      enabled: true,
      destinations: [{ destinationId: this.destinationId(), role: 'primary' }],
      profile: 'single',
    };
    try {
      await firstValueFrom(
        this.http.post(
          this.database() ? `${base}/enable-database` : base,
          body,
        ),
      );
      this.choosing.set(false);
      await this.load(id);
    } catch (err: any) {
      this.failure.set(err?.error?.message ?? 'Could not set up the backup');
    } finally {
      this.working.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    try {
      this.protection.set(
        await firstValueFrom(
          this.http.get<Protection>(
            `${this.config.apiBaseUrl}/api/v1/applications/${encodeURIComponent(id)}/backup-protection`,
          ),
        ),
      );
    } catch {
      this.protection.set(null);
    }
  }
}
