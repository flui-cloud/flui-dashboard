import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideClock,
  lucideHistory,
  lucideLoader,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { DbPitrService, DbPitrStatus } from '../../service/db-pitr.service';

/**
 * Point-in-time recovery for a database app's snapshots tab. Renders only when
 * continuous backup is enabled (a database-class policy ships WAL). Shows the
 * recoverable window and restores as-of an instant into a NEW install
 * (non-destructive — the live database is untouched). Drop-in via `[appId]`.
 */
@Component({
  selector: 'app-db-pitr',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIcon],
  providers: [
    provideIcons({
      lucideClock,
      lucideHistory,
      lucideLoader,
      lucideTriangleAlert,
    }),
  ],
  template: `
    @if (status(); as s) {
      @if (s.continuousBackupEnabled || s.backupCount > 0) {
        <div class="rounded-lg border border-border bg-card p-4">
          <div class="flex items-start gap-2">
            <ng-icon name="lucideHistory" class="mt-0.5 h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <div class="min-w-0 flex-1">
              <h3 class="text-base font-semibold">Point-in-time recovery</h3>
              <p class="mt-0.5 text-sm text-muted-foreground">
                @if (s.continuousBackupEnabled) {
                  Continuous backup is on.
                } @else {
                  Continuous backup is currently off — you can still recover from the {{ s.backupCount }} existing backup(s).
                }
                Restore this database as of an instant into a
                <span class="font-medium">new install</span> — the live database is untouched.
              </p>

              <dl class="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt class="text-xs text-muted-foreground">Recoverable from</dt>
                  <dd>{{ fmt(s.window?.oldest) }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">up to</dt>
                  <dd>{{ fmt(s.window?.newest) }} <span class="text-xs text-muted-foreground">(≈ now)</span></dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">Base backups</dt>
                  <dd>{{ s.backupCount }}</dd>
                </div>
              </dl>

              @if (!open()) {
                <button
                  type="button"
                  (click)="open.set(true)"
                  class="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
                >
                  <ng-icon name="lucideClock" class="h-4 w-4" /> Restore to a point in time…
                </button>
              } @else {
                <div class="mt-3 space-y-3 rounded-md border border-border bg-muted/40 p-3">
                  <div>
                    <label class="block text-xs font-medium text-muted-foreground" for="pitr-name">New install name</label>
                    <input
                      id="pitr-name"
                      type="text"
                      [ngModel]="name()"
                      (ngModelChange)="name.set($event)"
                      placeholder="e.g. orders-db-restored"
                      class="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-muted-foreground" for="pitr-at">
                      Recover to (leave empty for the latest recoverable point)
                    </label>
                    <input
                      id="pitr-at"
                      type="datetime-local"
                      [ngModel]="at()"
                      (ngModelChange)="at.set($event)"
                      class="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    />
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      (click)="submit()"
                      [disabled]="restoring() || !name().trim()"
                      class="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <ng-icon [name]="restoring() ? 'lucideLoader' : 'lucideHistory'" class="h-4 w-4" [class.animate-spin]="restoring()" />
                      {{ restoring() ? 'Starting…' : 'Restore' }}
                    </button>
                    <button
                      type="button"
                      (click)="cancel()"
                      [disabled]="restoring()"
                      class="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              }

              @if (ok(); as m) {
                <p class="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{{ m }}</p>
              }
              @if (error(); as e) {
                <p class="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                  <ng-icon name="lucideTriangleAlert" class="h-3.5 w-3.5" /> {{ e }}
                </p>
              }
            </div>
          </div>
        </div>
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
      // status 4xx (not a DB / no backup) → leave hidden.
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
    // datetime-local is a local wall-clock string; send an absolute instant.
    const local = this.at().trim();
    const recoveryTargetTime = local
      ? new Date(local).toISOString()
      : undefined;
    this.svc.restore(id, { name, recoveryTargetTime }).subscribe({
      next: (r) => {
        this.restoring.set(false);
        this.open.set(false);
        this.ok.set(
          `Restore started into "${name}" (job ${r.id.slice(0, 8)}). It provisions in the background.`,
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
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
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
