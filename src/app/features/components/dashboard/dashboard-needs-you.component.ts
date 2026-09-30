import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideCircleCheckBig,
  lucideGithub,
  lucideLoaderCircle,
  lucideRefreshCw,
  lucideShieldAlert,
  lucideTriangleAlert,
  lucideArchive,
  lucideKeyRound,
} from '@ng-icons/lucide';
import { FleetService, NeedsYouItem, NeedsYouLevel } from '../../service/fleet.service';
import { DashboardDnsService } from '../../service/dashboard-dns.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CERT_ACTION_KEY } from './dashboard-certs.component';

interface Row {
  id: string;
  level: NeedsYouLevel;
  title: string;
  detail: string;
  icon: string;
  spin: boolean;
  path: string | null;
  opensDnsWizard: boolean;
  apps: Array<{ id: string; name: string; protectPath: string | null }>;
}

const APPS_LISTED = 4;

const TONE: Record<NeedsYouLevel, { box: string; icon: string }> = {
  critical: { box: 'bg-destructive/10', icon: 'text-destructive' },
  warning: { box: 'bg-amber-50 dark:bg-amber-900/15', icon: 'text-amber-600 dark:text-amber-400' },
  info: { box: 'brand-soft', icon: '' },
};

function iconOf(item: NeedsYouItem): { icon: string; spin: boolean } {
  if (item.kind === 'cluster_operation') return { icon: 'lucideLoaderCircle', spin: true };
  if (item.kind === 'apps_without_backup') return { icon: 'lucideArchive', spin: false };
  if (item.kind === 'credential') {
    const github = item.credential?.kind === 'github_app' || item.credential?.kind === 'github_pat';
    return { icon: github ? 'lucideGithub' : 'lucideKeyRound', spin: false };
  }
  return { icon: item.level === 'critical' ? 'lucideCircleAlert' : 'lucideTriangleAlert', spin: false };
}

@Component({
  selector: 'app-dashboard-needs-you',
  standalone: true,
  imports: [RouterLink, NgIconComponent, NgTemplateOutlet],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideCircleCheckBig,
      lucideGithub,
      lucideLoaderCircle,
      lucideRefreshCw,
      lucideShieldAlert,
      lucideTriangleAlert,
      lucideArchive,
      lucideKeyRound,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (fleet.needsYouState() !== 'forbidden') {
      <section class="card-surface p-5 flex flex-col gap-3" data-testid="needs-you">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-foreground">Needs you</h2>
          @if (count() > 0) {
            <span class="rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground" data-testid="needs-you-count">{{ count() }}</span>
          }
        </div>

        @if (fleet.needsYouState() === 'loading' || fleet.needsYouState() === 'idle') {
          @for (_ of [1, 2]; track _) {
            <div class="h-14 rounded-lg skeleton"></div>
          }
        } @else if (fleet.needsYouState() === 'error' && rows().length === 0) {
          <div class="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3" data-testid="needs-you-error">
            <span class="text-sm text-muted-foreground">Could not check what needs you</span>
            <button type="button" class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" (click)="retry()">
              <ng-icon name="lucideRefreshCw" class="h-3 w-3" />
              Retry
            </button>
          </div>
        } @else if (rows().length === 0) {
          <div class="flex items-center gap-2.5 py-1" data-testid="needs-you-empty">
            <ng-icon name="lucideCircleCheckBig" class="h-4 w-4 text-green-600 dark:text-green-400" />
            <span class="text-sm text-muted-foreground">Nothing needs you right now</span>
          </div>
        } @else {
          @for (row of rows(); track row.id) {
            <ng-template #body>
              <ng-icon [name]="row.icon" class="h-[18px] w-[18px] flex-shrink-0 mt-0.5" [class]="iconTone(row)" [class.animate-spin]="row.spin" />
              <div class="flex flex-col gap-0.5 min-w-0">
                <span class="text-sm font-semibold text-foreground">{{ row.title }}</span>
                @if (row.detail) {
                  <span class="text-xs text-muted-foreground">{{ row.detail }}</span>
                }
              </div>
            </ng-template>
            @if (row.opensDnsWizard) {
              <button type="button" class="flex gap-3 rounded-lg p-3 text-left hover:opacity-90 transition-opacity" [class]="boxTone(row)" (click)="openDnsWizard()" [attr.data-testid]="'needs-you-' + row.id">
                <ng-container [ngTemplateOutlet]="body" />
              </button>
            } @else if (row.apps.length) {
              <div class="flex flex-col gap-2 rounded-lg p-3" [class]="boxTone(row)" [attr.data-testid]="'needs-you-' + row.id">
                <div class="flex gap-3">
                  <ng-container [ngTemplateOutlet]="body" />
                </div>
                <ul class="flex flex-col gap-1 pl-[30px]">
                  @for (app of row.apps; track app.id) {
                    <li class="flex items-center justify-between gap-2 text-xs">
                      <span class="truncate text-foreground">{{ app.name }}</span>
                      @if (app.protectPath) {
                        <a [routerLink]="pathOf(app.protectPath)" [queryParams]="queryOf(app.protectPath)" class="shrink-0 font-medium text-primary hover:underline" [attr.data-testid]="'needs-you-protect-' + app.id">Protect</a>
                      }
                    </li>
                  }
                </ul>
                @if (row.path) {
                  <a [routerLink]="pathOf(row.path)" [queryParams]="queryOf(row.path)" class="pl-[30px] text-xs font-medium text-primary hover:underline">Open backups</a>
                }
              </div>
            } @else if (row.path) {
              <a [routerLink]="pathOf(row.path)" [queryParams]="queryOf(row.path)" class="flex gap-3 rounded-lg p-3 hover:opacity-90 transition-opacity" [class]="boxTone(row)" [attr.data-testid]="'needs-you-' + row.id">
                <ng-container [ngTemplateOutlet]="body" />
              </a>
            } @else {
              <div class="flex gap-3 rounded-lg p-3" [class]="boxTone(row)" [attr.data-testid]="'needs-you-' + row.id">
                <ng-container [ngTemplateOutlet]="body" />
              </div>
            }
          }
        }
      </section>
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
      icon: 'lucideShieldAlert',
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
      ...iconOf(item),
      path: item.action?.path ?? null,
      opensDnsWizard: false,
      apps: (item.applications ?? []).slice(0, APPS_LISTED).map((a) => ({
        id: a.applicationId,
        name: a.name,
        protectPath: a.protect?.path ?? null,
      })),
    }));
    const dns = this.dnsRow();
    if (!dns) return api;
    const firstNonCritical = api.findIndex((r) => r.level !== 'critical');
    const at = firstNonCritical === -1 ? api.length : firstNonCritical;
    return [...api.slice(0, at), dns, ...api.slice(at)];
  });

  readonly count = computed(() => (this.fleet.needsYou()?.count ?? 0) + (this.dnsRow() ? 1 : 0));

  protected boxTone(row: Row): string {
    return TONE[row.level].box;
  }

  protected iconTone(row: Row): string {
    return TONE[row.level].icon;
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
