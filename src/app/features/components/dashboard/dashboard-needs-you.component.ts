import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideCircleCheck } from '@ng-icons/lucide';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState, FlErrorState, FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FleetService, NeedsYouLevel } from '../../service/fleet.service';
import { DashboardDnsService } from '../../service/dashboard-dns.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CERT_ACTION_KEY } from './dashboard-certs.component';
import { NeedsYouAppRow, needsYouAppRow } from './needs-you-apps';

interface Row {
  id: string;
  level: NeedsYouLevel;
  title: string;
  detail: string;
  spin: boolean;
  path: string | null;
  opensDnsWizard: boolean;
  apps: NeedsYouAppRow[];
}

const APPS_LISTED = 4;

const SEVERITY: Record<NeedsYouLevel, { tone: StatusTone; label: string }> = {
  critical: { tone: 'error', label: 'Critical' },
  warning: { tone: 'warning', label: 'Warning' },
  info: { tone: 'neutral', label: 'Info' },
};

@Component({
  selector: 'app-dashboard-needs-you',
  providers: [provideIcons({ lucideCircleCheck })],
  imports: [
    RouterLink,
    FlPanel,
    FlTable,
    FlStatus,
    FlButton,
    FlLoadingState,
    FlErrorState,
    FlEmptyState,
  ],
  template: `
    @if (fleet.needsYouState() !== 'forbidden') {
      <fl-panel
        title="Open issues"
        [count]="count() > 0 ? count() : null"
        [flush]="rows().length > 0"
        data-testid="needs-you"
      >
        @if (fleet.needsYouState() === 'loading' || fleet.needsYouState() === 'idle') {
          <fl-loading-state [rows]="2" />
        } @else if (fleet.needsYouState() === 'error' && rows().length === 0) {
          <fl-error-state
            [compact]="true"
            title="Could not check for open issues"
            data-testid="needs-you-error"
            (retry)="retry()"
          />
        } @else if (rows().length === 0) {
          <fl-empty-state
            [compact]="true"
            icon="lucideCircleCheck"
            title="No open issues"
            data-testid="needs-you-empty"
          />
        } @else {
          <div class="fl-table-wrap relative">
            <table flTable>
              <thead>
                <tr>
                  <th scope="col" class="is-fit">Severity</th>
                  <th scope="col">Issue</th>
                  <th scope="col" class="is-fit"><span class="fl-sr">Action</span></th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.id) {
                  <tr [attr.data-testid]="'needs-you-' + row.id">
                    <td>
                      <fl-status [tone]="severityOf(row).tone" [label]="severityOf(row).label" />
                    </td>
                    <td class="whitespace-normal">
                      <div class="flex flex-col gap-0.5">
                        <span class="font-medium">{{ row.title }}</span>
                        @if (row.detail) {
                          <span class="text-fl-caption text-fl-ink-muted">{{ row.detail }}</span>
                        }
                        @if (row.apps.length) {
                          <ul class="mt-2 flex flex-col gap-1.5">
                            @for (app of row.apps; track app.id) {
                              <li class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                <a
                                  class="fl-link"
                                  [routerLink]="app.appPath"
                                  [attr.data-testid]="'needs-you-app-' + app.id"
                                  >{{ app.name }}</a
                                >
                                @if (app.secondary) {
                                  <span class="text-fl-caption text-fl-ink-muted">{{
                                    app.secondary
                                  }}</span>
                                }
                                @if (app.protectPath) {
                                  <a
                                    class="fl-link text-fl-caption"
                                    [routerLink]="pathOf(app.protectPath)"
                                    [queryParams]="queryOf(app.protectPath)"
                                    [attr.data-testid]="'needs-you-protect-' + app.id"
                                    >Protect</a
                                  >
                                } @else {
                                  <a
                                    class="fl-link text-fl-caption"
                                    [routerLink]="app.backupsPath"
                                    [attr.data-testid]="'needs-you-open-' + app.id"
                                    >Open backups</a
                                  >
                                }
                                @if (app.why) {
                                  <span
                                    class="basis-full text-fl-caption text-fl-ink-muted"
                                    [attr.data-testid]="'needs-you-why-' + app.id"
                                    >{{ app.why }}</span
                                  >
                                }
                              </li>
                            }
                          </ul>
                        }
                      </div>
                    </td>
                    <td class="text-right">
                      @if (row.opensDnsWizard) {
                        <button flButton size="sm" type="button" (click)="openDnsWizard()">
                          Set up
                        </button>
                      } @else if (row.path) {
                        <a
                          class="fl-link"
                          [routerLink]="pathOf(row.path)"
                          [queryParams]="queryOf(row.path)"
                          >{{ row.apps.length ? 'Open backups' : 'Review' }}</a
                        >
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </fl-panel>
    }
  `,
})
export class DashboardNeedsYouComponent {
  protected readonly fleet = inject(FleetService);
  private readonly dns = inject(DashboardDnsService);
  private readonly notifications = inject(NotificationService);

  private readonly dnsRow = computed<Row | null>(() => {
    if (!this.dns.hasStatus() || !this.dns.needsSetup()) return null;
    return {
      id: 'dns',
      level: 'warning',
      title: 'Set up DNS & certificates',
      detail: 'Apps are not reachable from the internet yet',
      spin: false,
      path: null,
      opensDnsWizard: true,
      apps: [],
    };
  });

  readonly rows = computed<Row[]>(() => {
    const api = (this.fleet.needsYou()?.items ?? []).map<Row>((item) => ({
      id: item.id,
      level: item.level,
      title: item.title,
      detail: item.detail,
      spin: item.kind === 'cluster_operation',
      path: item.action?.path ?? null,
      opensDnsWizard: false,
      apps: (item.applications ?? []).slice(0, APPS_LISTED).map(needsYouAppRow),
    }));
    const dns = this.dnsRow();
    if (!dns) return api;
    const firstNonCritical = api.findIndex((r) => r.level !== 'critical');
    const at = firstNonCritical === -1 ? api.length : firstNonCritical;
    return [...api.slice(0, at), dns, ...api.slice(at)];
  });

  readonly count = computed(() => (this.fleet.needsYou()?.count ?? 0) + (this.dnsRow() ? 1 : 0));

  protected severityOf(row: Row): { tone: StatusTone; label: string } {
    if (row.spin) return { tone: 'progress', label: 'In progress' };
    return SEVERITY[row.level];
  }

  protected pathOf(path: string): string {
    return path.split('?')[0];
  }

  protected queryOf(path: string): Record<string, string> | null {
    const query = path.split('?')[1];
    return query ? Object.fromEntries(new URLSearchParams(query)) : null;
  }

  protected openDnsWizard(): void {
    this.notifications.triggerAction(CERT_ACTION_KEY);
  }

  protected retry(): void {
    void this.fleet.loadNeedsYou();
  }
}
