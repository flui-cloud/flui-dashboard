import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlField } from '../../../ui/patterns/field';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { DbPitrService, DbPitrStatus } from '../../service/db-pitr.service';

/**
 * Point-in-time recovery for a database app's snapshots tab. Renders only when
 * continuous backup is enabled (a database-class policy ships WAL). Shows the
 * recoverable window and restores as-of an instant into a NEW install
 * (non-destructive — the live database is untouched). Drop-in via `[appId]`.
 */
@Component({
  selector: 'app-db-pitr',
  imports: [FormsModule, FlPanel, FlKeyValue, FlKvItem, FlField, FlAlert, FlButton, FlSpinner],
  host: { class: 'block' },
  template: `
    @if (status(); as s) {
      @if (s.continuousBackupEnabled || s.backupCount > 0) {
        @let dumps = s.pointInTime === false;
        <fl-panel
          [title]="dumps ? 'Scheduled dumps' : 'Point-in-time recovery'"
          data-testid="db-pitr"
        >
          @if (!open()) {
            <button panelActions flButton size="sm" type="button" (click)="open.set(true)">
              {{ dumps ? 'Restore the latest dump…' : 'Restore to a point in time…' }}
            </button>
          }
          <div class="flex flex-col gap-4">
            <p class="text-fl-body-sm text-fl-ink-muted">
              @if (dumps) {
                This database's image cannot back up continuously, so it is dumped on a schedule. A
                restore brings back the latest dump into a new install; changes after it are not
                kept.
              } @else if (s.continuousBackupEnabled) {
                Continuous backup is on.
              } @else {
                Continuous backup is off. You can still recover from the
                {{ s.backupCount }} existing backup(s).
              }
              @if (!dumps) {
                Restore this database as of an instant into a new install; the live database is
                untouched.
              }
            </p>

            <fl-key-value class="fl-kv--compact">
              <fl-kv-item [key]="dumps ? 'Oldest dump' : 'Recoverable from'">{{
                fmt(s.window?.oldest)
              }}</fl-kv-item>
              <fl-kv-item [key]="dumps ? 'Newest dump' : 'Up to'">
                {{ fmt(s.window?.newest) }}
                @if (!dumps) {
                  <span class="text-fl-caption text-fl-ink-muted">(last change archived)</span>
                }
              </fl-kv-item>
              <fl-kv-item [key]="dumps ? 'Dumps' : 'Base backups'">{{ s.backupCount }}</fl-kv-item>
            </fl-key-value>

            @if (open()) {
              <div class="flex flex-col gap-3">
                <fl-field label="New install name" for="pitr-name">
                  <div class="fl-input fl-input--lg">
                    <input
                      id="pitr-name"
                      type="text"
                      [ngModel]="name()"
                      (ngModelChange)="name.set($event)"
                      placeholder="orders-db-restored"
                    />
                  </div>
                </fl-field>
                @if (!dumps) {
                  <fl-field
                    label="Recover to"
                    for="pitr-at"
                    hint="Leave empty for the latest recoverable point."
                  >
                    <div class="fl-input fl-input--lg">
                      <input
                        id="pitr-at"
                        type="datetime-local"
                        [ngModel]="at()"
                        (ngModelChange)="at.set($event)"
                      />
                    </div>
                  </fl-field>
                }
                <div class="fl-row">
                  <button
                    flButton
                    size="sm"
                    type="button"
                    (click)="submit()"
                    [disabled]="restoring() || !name().trim()"
                  >
                    @if (restoring()) {
                      <fl-spinner label="Starting" />
                    }
                    {{ restoring() ? 'Starting…' : 'Restore' }}
                  </button>
                  <button
                    flButton="ghost"
                    size="sm"
                    type="button"
                    (click)="cancel()"
                    [disabled]="restoring()"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            }

            @if (ok(); as m) {
              <fl-alert tone="info" title="Restore started">{{ m }}</fl-alert>
            }
            @if (error(); as e) {
              <fl-alert tone="error" title="Restore failed">{{ e }}</fl-alert>
            }
          </div>
        </fl-panel>
      }
    }
  `,
})
export class DbPitrComponent {
  private readonly svc = inject(DbPitrService);

  readonly appId = input<string | null>(null);

  readonly status = signal<DbPitrStatus | null>(null);
  readonly open = signal(false);
  readonly name = signal('');
  readonly at = signal('');
  readonly restoring = signal(false);
  readonly error = signal<string | null>(null);
  readonly ok = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.appId();
      this.reset();
      this.status.set(null);
      if (!id) return;
      this.svc.status(id).subscribe({
        next: (s) => this.status.set(s),
        error: () => this.status.set(null),
      });
    });
  }

  submit(): void {
    const id = this.appId();
    const name = this.name().trim();
    if (!id || !name) return;
    this.restoring.set(true);
    this.error.set(null);
    this.ok.set(null);
    const local = this.at().trim();
    const recoveryTargetTime = local ? new Date(local).toISOString() : undefined;
    this.svc.restore(id, { name, recoveryTargetTime }).subscribe({
      next: (r) => {
        this.restoring.set(false);
        this.open.set(false);
        this.ok.set(
          `Restoring into "${name}" (job ${r.id.slice(0, 8)}). It provisions in the background.`,
        );
      },
      error: (e) => {
        this.restoring.set(false);
        this.error.set(this.msg(e));
      },
    });
  }

  cancel(): void {
    this.open.set(false);
    this.error.set(null);
  }

  fmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB');
  }

  private reset(): void {
    this.open.set(false);
    this.name.set('');
    this.at.set('');
    this.error.set(null);
    this.ok.set(null);
    this.restoring.set(false);
  }

  private msg(e: unknown): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message ?? err?.message ?? 'Request failed';
  }
}
