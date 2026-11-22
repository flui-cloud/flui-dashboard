import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlMetric, FlMetricStrip, MetricTone } from '../../../ui/patterns/metric-strip';
import { ApplicationCategoryEnum, ApplicationStatusEnum } from '../../model/application.models';
import { ApplicationService } from '../../service/application.service';
import { BackupService } from '../../service/backup.service';
import { DashboardDnsService } from '../../service/dashboard-dns.service';
import { DashboardService } from '../../service/dashboard.service';

interface Cell {
  readonly label: string;
  readonly value: string;
  readonly caption: string;
  readonly tone: MetricTone;
  readonly link: string;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

@Component({
  selector: 'app-dashboard-health-strip',
  imports: [RouterLink, FlMetricStrip, FlMetric],
  template: `
    <fl-metric-strip aria-label="Platform health" data-testid="health-strip">
      @for (cell of cells(); track cell.label) {
        <a
          fl-metric
          [routerLink]="cell.link"
          [label]="cell.label"
          [value]="cell.value"
          [caption]="cell.caption"
          [tone]="cell.tone"
        ></a>
      }
    </fl-metric-strip>
  `,
})
export class DashboardHealthStrip {
  private readonly dashboard = inject(DashboardService);
  private readonly applications = inject(ApplicationService);
  private readonly dns = inject(DashboardDnsService);
  private readonly backup = inject(BackupService);

  private readonly clusters = computed<Cell>(() => {
    const total = this.dashboard.totalClusters();
    const unhealthy = this.dashboard.unhealthyClusters();
    const cell: Cell = {
      label: 'Clusters',
      value: String(total),
      caption: 'None yet',
      tone: 'default',
      link: '/cluster',
    };
    if (unhealthy > 0) return { ...cell, caption: `${unhealthy} need attention`, tone: 'warning' };
    if (total > 0) return { ...cell, caption: 'Healthy', tone: 'success' };
    return cell;
  });

  private readonly workloads = computed<Cell>(() => {
    const groups = this.applications
      .applicationGroups()
      .filter((g) => g.category !== ApplicationCategoryEnum.System);
    const running = groups.filter((g) => g.status === ApplicationStatusEnum.Running).length;
    const failed = groups.filter((g) => g.status === ApplicationStatusEnum.Failed).length;
    return {
      label: 'Workloads',
      value: String(groups.length),
      caption: `${running} running · ${failed} failed`,
      tone: failed > 0 ? 'warning' : 'default',
      link: '/apps/applications',
    };
  });

  private readonly certificates = computed<Cell | null>(() => {
    const status = this.dns.status();
    if (!status) return null;
    if (this.dns.needsSetup()) {
      return {
        label: 'Certificates',
        value: 'None',
        caption: 'DNS not configured',
        tone: 'warning',
        link: '/infrastructure/domains',
      };
    }
    const apps = [status.fluiApi, status.fluiWeb, status.zitadel].filter((a) => !!a);
    const valid = apps.filter((a) => a!.isComplete).length;
    return {
      label: 'Certificates',
      value: `${valid} of ${apps.length}`,
      caption: valid === apps.length ? 'Valid' : `${apps.length - valid} not valid`,
      tone: valid === apps.length ? 'success' : 'warning',
      link: '/infrastructure/domains',
    };
  });

  private readonly backups = computed<Cell | null>(() => {
    const status = this.backup.status();
    if (!status) return null;
    const issues = status.alerts.filter(
      (a) => a.severity === 'warning' || a.severity === 'critical',
    ).length;
    const { clustersWithBackups, clustersTotal } = status.summary;
    return {
      label: 'Backups',
      value: issues > 0 ? plural(issues, 'issue') : 'No issues',
      caption: `${clustersWithBackups} of ${clustersTotal} clusters protected`,
      tone: issues > 0 ? 'warning' : 'success',
      link: '/management/backup',
    };
  });

  protected readonly cells = computed(() =>
    [this.clusters(), this.workloads(), this.certificates(), this.backups()].filter(
      (c): c is Cell => c !== null,
    ),
  );
}
