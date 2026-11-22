import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { poll } from '../../../core/state/poll';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { BackupService } from '../../service/backup.service';
import { FleetService } from '../../service/fleet.service';
import {
  BackupOverallStatus,
  BackupStatus,
  BackupStatusAlert,
  alertCtaLabel,
  alertCtaPath,
  alertMessage,
} from '../../model/backup-status.models';

const REFRESH_INTERVAL_MS = 60_000;

const OVERALL: Record<BackupOverallStatus, { tone: StatusTone; label: string }> = {
  ok: { tone: 'success', label: 'Protected' },
  warning: { tone: 'warning', label: 'Needs attention' },
  critical: { tone: 'error', label: 'Action required' },
  info: { tone: 'neutral', label: 'Not configured' },
};

@Component({
  selector: 'app-dashboard-backups',
  imports: [DatePipe, RouterLink, FlPanel, FlStatus, FlKeyValue, FlKvItem, FlLoadingState],
  template: `
    @if (loading() && !status()) {
      <fl-panel title="Backups"><fl-loading-state [rows]="3" /></fl-panel>
    } @else {
      @if (status(); as s) {
        <fl-panel title="Backups" data-testid="backups-card">
          <a panelActions class="fl-link text-fl-body-sm" routerLink="/management/backup"
            >Open backups</a
          >
          <div class="flex flex-col gap-4">
            <fl-status [tone]="overall().tone" [label]="overall().label" />
            @if (isEmpty(s)) {
              <p class="text-fl-body-sm text-fl-ink-muted" data-testid="backups-empty">
                No backups yet.
              </p>
            } @else {
              <fl-key-value class="fl-kv--compact">
                <fl-kv-item key="Clusters protected"
                  >{{ s.summary.clustersWithBackups }} of {{ s.summary.clustersTotal }}</fl-kv-item
                >
                <fl-kv-item key="Policies">{{ s.summary.activePolicies }}</fl-kv-item>
                <fl-kv-item key="Backups, last 30 days">{{
                  s.summary.totalArtifactsLast30d
                }}</fl-kv-item>
              </fl-key-value>
              @if (s.alerts.length > 0) {
                <div class="flex flex-col gap-1.5">
                  <fl-status
                    [tone]="alertTone(s.alerts[0].severity)"
                    [label]="alertMessage(s.alerts[0])"
                  />
                  @if (s.alerts[0].items?.length) {
                    <ul
                      class="flex flex-col gap-0.5 pl-5 text-fl-body-sm"
                      data-testid="backups-alert-items"
                    >
                      @for (item of s.alerts[0].items!.slice(0, ITEMS_LISTED); track item.id) {
                        <li class="truncate">
                          <a class="fl-link" [routerLink]="item.path">{{ item.name }}</a>
                        </li>
                      }
                      @if (s.alerts[0].items!.length > ITEMS_LISTED) {
                        <li class="text-fl-ink-muted">
                          and {{ s.alerts[0].items!.length - ITEMS_LISTED }} more
                        </li>
                      }
                    </ul>
                  }
                </div>
              } @else if (s.lastSuccessfulBackupAt) {
                <span class="text-fl-body-sm text-fl-ink-muted"
                  >Last backup {{ s.lastSuccessfulBackupAt | date: 'd MMM y, HH:mm' }}</span
                >
              }
              @if (coverageLine(); as line) {
                <span class="text-fl-body-sm text-fl-ink-muted" data-testid="backups-coverage">{{
                  line
                }}</span>
              }
            }
            @if (s.alerts.length > 0 || s.cta) {
              <a
                class="fl-link text-fl-body-sm"
                [routerLink]="pathOf(resolveCtaPath(s))"
                [queryParams]="queryOf(resolveCtaPath(s))"
                >{{ ctaLabel(s) }}</a
              >
            } @else if (isEmpty(s)) {
              <a class="fl-link text-fl-body-sm" routerLink="/management/backup/policies/new"
                >Set up a backup policy</a
              >
            }
          </div>
        </fl-panel>
      }
    }
  `,
})
export class DashboardBackupsComponent {
  private readonly backup = inject(BackupService);
  private readonly fleet = inject(FleetService);

  protected readonly ITEMS_LISTED = 3;
  protected readonly status = this.backup.status;
  protected readonly loading = this.backup.statusLoading;

  /** Only when the fleet read answered: a guest refused it sees the card without this line. */
  protected readonly coverageLine = computed(() => {
    if (this.fleet.coverageState() !== 'ready') return null;
    const withData = (this.fleet.coverage()?.applications ?? []).filter((a) => a.holdsData);
    if (withData.length === 0) return null;
    const byChoice = withData.filter((a) => a.coverage === 'not_backed_up_by_choice').length;
    const counted = withData.length - byChoice;
    const protectedApps = withData.filter((a) => a.coverage === 'protected').length;
    const line = `${protectedApps} of ${counted} apps with data protected`;
    return byChoice ? `${line}, ${byChoice} not backed up by choice` : line;
  });

  protected isEmpty(s: BackupStatus): boolean {
    return (
      !s.lastSuccessfulBackupAt &&
      s.summary.activePolicies === 0 &&
      s.summary.totalArtifactsLast30d === 0
    );
  }

  protected readonly overall = computed(() => OVERALL[this.status()?.overall ?? 'info']);

  resolveCtaPath(s: { alerts: BackupStatusAlert[]; cta?: { path: string } }): string {
    if (s.alerts.length > 0) return alertCtaPath(s.alerts[0]);
    return s.cta?.path ?? '/management/backup';
  }

  protected pathOf(path: string): string {
    return path.split('?')[0];
  }

  protected queryOf(path: string): Record<string, string> | null {
    const query = path.split('?')[1];
    return query ? Object.fromEntries(new URLSearchParams(query)) : null;
  }

  constructor() {
    poll(() => void this.backup.loadStatus(), REFRESH_INTERVAL_MS, { immediate: true });
  }

  protected alertTone(severity: BackupOverallStatus): StatusTone {
    return OVERALL[severity].tone;
  }

  protected readonly alertMessage = alertMessage;

  protected ctaLabel(s: {
    alerts: { code: string; severity?: string; ctaLabel?: string }[];
    cta?: { label: string };
  }): string {
    const first = s.alerts[0];
    if (!first || !['warning', 'critical'].includes(first.severity ?? '')) {
      return 'Open backups';
    }
    const mapped = alertCtaLabel(first as any);
    if (mapped) return mapped;
    // Fallback: backend-provided CTA may be localized — neutral English fallback.
    return s.cta?.label && /^[\x00-\x7F]*$/.test(s.cta.label) && !/[àèéìòù]/i.test(s.cta.label)
      ? s.cta.label
      : 'Take action';
  }
}
