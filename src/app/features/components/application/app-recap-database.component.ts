import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AppMetricsDto } from '../../../core/api/model/appMetricsDto';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { accessOf } from '../../model/app-access';
import { Application } from '../../model/application.models';
import { DbConnectionInfo } from '../../model/db-console.models';
import { databaseEngineOf } from '../../model/db-engine';
import type { AppProtection } from '../../service/fleet.service';
import { statusToneOf } from '../dashboard/home-state';
import { AppDbConnectCardComponent } from './app-db-connect-card.component';
import { dbData, dbInternalHost, dbLastBackup, dbSubtitle, roleOf } from './app-recap-bundle';

@Component({
  selector: 'app-recap-database',
  imports: [
    RouterLink,
    FlPanel,
    FlKeyValue,
    FlKvItem,
    FlUsageBar,
    FlCopyId,
    FlButton,
    FlStatus,
    AppDbConnectCardComponent,
  ],
  host: { class: 'block' },
  template: `
    @let db = app();
    @if (!readOnly() || sqlReader()) {
      <fl-panel [title]="heading()" [attr.data-testid]="'recap-database-' + db.id">
        <span panelActions class="text-fl-body-sm text-fl-ink-muted">{{ subtitle() }}</span>
        <div class="flex flex-col gap-5">
          <fl-key-value class="fl-kv--compact">
            <fl-kv-item [key]="data().label">{{ data().value }}</fl-kv-item>
            @if (!readOnly()) {
              <fl-kv-item key="Last backup">
                <fl-status [tone]="lastBackupTone()" [label]="lastBackup().value" />
              </fl-kv-item>
            }
          </fl-key-value>
          @let percent = diskPercent();
          @if (percent !== null) {
            <fl-usage-bar [percent]="percent" label="Volume used" aside="of the volume" />
          }
          @if (!readOnly()) {
            @if (connInfo(); as ci) {
              <div class="flex flex-col gap-2">
                <span class="text-fl-caption text-fl-ink-muted">Connection</span>
                <fl-key-value class="fl-kv--compact">
                  <fl-kv-item key="Internal host">
                    <fl-copy-id [value]="internalHost()" label="internal host" />
                  </fl-kv-item>
                  <fl-kv-item key="Port" [mono]="true">{{ ci.remotePort }}</fl-kv-item>
                  <fl-kv-item key="Database" [mono]="true">{{ ci.database }}</fl-kv-item>
                  <fl-kv-item key="User" [mono]="true">{{ ci.user }}</fl-kv-item>
                </fl-key-value>
              </div>
            }
            <app-db-connect-card [app]="db" [connInfo]="connInfo()" variant="block" />
          } @else {
            <a flButton class="w-fit" [routerLink]="['/db-console', db.id]">Open SQL console</a>
          }
        </div>
      </fl-panel>
    }
  `,
})
export class AppRecapDatabaseComponent {
  readonly app = input.required<Application>();
  readonly named = input(false);
  readonly metrics = input<AppMetricsDto | undefined>(undefined);
  readonly protection = input<AppProtection | undefined>(undefined);
  readonly connInfo = input<DbConnectionInfo | null>(null);

  protected readonly heading = computed(() =>
    this.named() ? `Database · ${roleOf(this.app())}` : 'Database',
  );
  protected readonly subtitle = computed(() => dbSubtitle(this.app()));
  protected readonly data = computed(() => dbData(this.metrics()));
  protected readonly lastBackup = computed(() => dbLastBackup(this.protection()));
  protected readonly lastBackupTone = computed<StatusTone>(() =>
    statusToneOf(this.lastBackup().tone),
  );
  protected readonly diskPercent = computed(
    () => this.metrics()?.volume?.utilization_percent ?? null,
  );
  protected readonly internalHost = computed(() =>
    dbInternalHost(this.app(), this.connInfo()?.namespace),
  );
  /** A reader gets no backup posture and no connection details. */
  protected readonly readOnly = computed(() => !!accessOf(this.app())?.readOnly);
  /** Postgres only: the console a reader may open runs as a role that can only SELECT. */
  protected readonly sqlReader = computed(() => databaseEngineOf(this.app()) === 'postgres');
}
