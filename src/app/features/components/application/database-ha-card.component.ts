import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideShieldCheck,
  lucideShieldAlert,
  lucideLoader,
} from '@ng-icons/lucide';
import { ApplicationResponseDto } from '../../../core/api';
import { databaseEngineOf } from '../../model/db-engine';
import { DbHaService, DatabaseHaView } from '../../service/db-ha.service';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';

@Component({
  selector: 'app-database-ha-card',
  standalone: true,
  imports: [NgIconComponent, ConfirmationDialogComponent],
  providers: [
    provideIcons({ lucideShieldCheck, lucideShieldAlert, lucideLoader }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isPostgres() && view(); as v) {
      <div
        class="flex items-start justify-between gap-3 rounded-lg border px-4 py-2.5"
        [class]="
          v.state?.state === 'active'
            ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30'
            : 'border-border bg-muted/30'
        "
      >
        <div class="flex items-start gap-3">
          <ng-icon
            [name]="
              v.state?.state === 'copying'
                ? 'lucideLoader'
                : v.state?.state === 'active'
                  ? 'lucideShieldCheck'
                  : 'lucideShieldAlert'
            "
            class="mt-0.5 h-4 w-4 flex-shrink-0"
            [class.animate-spin]="v.state?.state === 'copying'"
          />
          <div class="text-sm">
            <div class="font-medium">{{ title() }}</div>
            <div class="mt-0.5 text-xs text-muted-foreground">
              {{ subtitle() }}
            </div>
            @if (placementLine()) {
              <div
                class="mt-0.5 text-xs text-muted-foreground"
                data-testid="database-ha-placement"
              >
                {{ placementLine() }}
              </div>
            }
          </div>
        </div>
        @if (!v.state || v.state.state === 'failed') {
          <button
            type="button"
            class="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            (click)="dialog().open()"
          >
            Make highly available
          </button>
        }
      </div>
      @if (error()) {
        <p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ error() }}</p>
      }
      <app-confirmation-dialog
        title="Make this database highly available"
        message="Flui builds an instance in each of the cluster's three locations and moves the database to them. Writes pause for a few seconds."
        confirmText="Make it highly available"
        cancelText="Not now"
        variant="info"
        [details]="details"
        (confirmed)="enable()"
      />
    }
  `,
})
export class DatabaseHaCardComponent {
  private readonly ha = inject(DbHaService);

  readonly app = input.required<ApplicationResponseDto | null>();
  readonly view = signal<DatabaseHaView | null>(null);
  readonly error = signal<string | null>(null);
  readonly dialog = viewChild.required(ConfirmationDialogComponent);

  readonly isPostgres = computed(
    () => databaseEngineOf(this.app()) === 'postgres',
  );
  readonly active = computed(() => this.view()?.state?.state === 'active');

  readonly details = [
    'The copies stream from the running database until they have caught up; the application keeps working meanwhile.',
    'Then writes stop for a few seconds while the copy in a close location takes over, and the application moves to it. A write waits for whichever copy answers first.',
    'No confirmed write is lost. The single instance is kept, stopped, with its data, as the way back.',
    'The cluster must be highly available across three locations; otherwise the request is refused with the reason.',
  ];

  readonly title = computed(() => {
    const s = this.view()?.state;
    if (!s) return 'Single instance';
    if (s.state === 'active')
      return `Highly available: ${s.instances} instances, one per location`;
    if (s.state === 'copying') return 'Being made highly available';
    return 'Making it highly available stopped';
  });

  readonly subtitle = computed(() => {
    const s = this.view()?.state;
    if (!s)
      return 'If its server is lost, the database stops until it returns.';
    if (s.state === 'active')
      return 'Losing a server or a location loses no confirmed write.';
    if (s.state === 'copying')
      return 'The copy is catching up; the single instance still serves.';
    return s.detail ?? 'No detail recorded.';
  });

  /** Where the primary is, and how far behind each copy is. */
  readonly placementLine = computed(() => {
    const p = this.view()?.placement;
    if (!p?.primary) return '';
    const copies = p.copies.map((c) => {
      const where = c.zone ?? c.instance;
      if (!c.ready) return `${where} not ready`;
      if (!c.confirms) return `${where} not streaming`;
      return c.flushLagMs === null
        ? `${where} up to date`
        : `${where} ${c.flushLagMs} ms behind`;
    });
    return `Primary in ${p.primary.zone ?? p.primary.instance}. Copies: ${copies.join(', ')}.`;
  });

  constructor() {
    effect(() => {
      const app = this.app();
      if (app && this.isPostgres()) this.load(app.id);
    });
  }

  private load(appId: string): void {
    this.ha.get(appId).subscribe({
      next: (v) => this.view.set(v),
      error: () => this.view.set(null),
    });
  }

  enable(): void {
    const app = this.app();
    if (!app) return;
    this.error.set(null);
    this.dialog().setProcessing(true);
    this.ha.enable(app.id).subscribe({
      next: () => {
        this.dialog().close();
        this.load(app.id);
      },
      error: (e: { error?: { message?: string } }) => {
        this.dialog().close();
        this.error.set(e?.error?.message ?? 'The request was refused.');
      },
    });
  }
}
