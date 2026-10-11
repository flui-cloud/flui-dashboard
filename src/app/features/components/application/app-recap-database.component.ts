import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AppMetricsDto } from '../../../core/api/model/appMetricsDto';
import { Application } from '../../model/application.models';
import { DbConnectionInfo } from '../../model/db-console.models';
import type { AppProtection } from '../../service/fleet.service';
import { AppDbConnectCardComponent } from './app-db-connect-card.component';
import { dbData, dbLastBackup, dbSubtitle, roleOf } from './app-recap-bundle';
import { TONE_TEXT } from './app-recap-view';
import { RouterLink } from '@angular/router';
import { accessOf } from '../../model/app-access';
import { databaseEngineOf } from '../../model/db-engine';

@Component({
  selector: 'app-recap-database',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDbConnectCardComponent, RouterLink],
  host: { class: 'block' },
  template: `
    @let db = app();
    @if (!readOnly() || sqlReader()) {
    <section class="card-surface space-y-4 p-5" [attr.data-testid]="'recap-database-' + db.id">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="font-semibold text-foreground">{{ heading() }}</h2>
        <span class="text-xs text-muted-foreground">{{ subtitle() }}</span>
      </div>
      <div class="grid gap-3" [class.grid-cols-2]="!readOnly()">
        <div class="rounded-lg bg-muted/40 px-3 py-2.5">
          <p class="text-lg font-semibold text-foreground">{{ data().value }}</p>
          <p class="text-label">{{ data().label }}</p>
        </div>
        @if (!readOnly()) {
          <div class="rounded-lg bg-muted/40 px-3 py-2.5">
            <p class="text-lg font-semibold" [class]="text[lastBackup().tone]">{{ lastBackup().value }}</p>
            <p class="text-label">Last backup</p>
          </div>
        }
      </div>
      @if (!readOnly()) {
        <app-db-connect-card [app]="db" [connInfo]="connInfo()" variant="block" />
      } @else if (sqlReader()) {
        <a
          [routerLink]="['/db-console', db.id]"
          class="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >Open SQL Console</a
        >
      }
    </section>
    }
  `,
})
export class AppRecapDatabaseComponent {
  readonly app = input.required<Application>();
  readonly named = input(false);
  readonly metrics = input<AppMetricsDto | undefined>(undefined);
  readonly protection = input<AppProtection | undefined>(undefined);
  readonly connInfo = input<DbConnectionInfo | null>(null);

  protected readonly heading = computed(() => (this.named() ? `Database · ${roleOf(this.app())}` : 'Database'));
  protected readonly subtitle = computed(() => dbSubtitle(this.app()));
  protected readonly data = computed(() => dbData(this.metrics()));
  protected readonly lastBackup = computed(() => dbLastBackup(this.protection()));
  protected readonly text = TONE_TEXT;
  /** A reader gets no backup posture and no connection details. */
  protected readonly readOnly = computed(() => !!accessOf(this.app())?.readOnly);
  /** Postgres only: the console a reader may open runs as a role that can only SELECT. */
  protected readonly sqlReader = computed(() => databaseEngineOf(this.app()) === 'postgres');
}
