import { Component, OnDestroy, OnInit, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideArchive,
  lucideArrowRight,
  lucideCheckCircle,
  lucideCircleAlert,
  lucideShieldOff,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { BackupService } from '../../service/backup.service';
import { FleetService } from '../../service/fleet.service';
import {
  BackupOverallStatus,
  BackupStatus,
  BackupStatusAlert,
  STATUS_BANNER_TONE,
  STATUS_TEXT_TONE,
  alertCtaLabel,
  alertCtaPath,
  alertMessage,
} from '../../model/backup-status.models';

const REFRESH_INTERVAL_MS = 60_000;

@Component({
  selector: 'app-dashboard-backups',
  standalone: true,
  imports: [CommonModule, NgIconComponent, RouterLink],
  providers: [
    provideIcons({
      lucideArchive,
      lucideArrowRight,
      lucideCheckCircle,
      lucideCircleAlert,
      lucideShieldOff,
      lucideTriangleAlert,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (loading() && !status()) {
    <div class="card-surface p-5 h-full flex flex-col gap-4">
      <div class="flex items-center gap-2.5">
        <div class="h-8 w-8 rounded-lg bg-muted animate-pulse"></div>
        <div class="flex-1 space-y-1.5">
          <div class="h-3 w-24 rounded bg-muted animate-pulse"></div>
          <div class="h-3 w-32 rounded bg-muted animate-pulse"></div>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2">
        @for (_ of [1, 2, 3]; track _) {
          <div class="h-14 rounded-lg bg-muted animate-pulse"></div>
        }
      </div>
    </div>
    } @else {
    @if (status(); as s) {
    <section
      class="card-surface p-5 h-full flex flex-col gap-4 cursor-pointer transition-colors hover:border-primary/30"
      [class]="banner()"
      (click)="navigateTo('/management/backup')"
      data-testid="backups-card"
    >
      <div class="flex items-center gap-2.5">
        <div class="icon-chip icon-chip-sm bg-muted">
          <ng-icon [name]="iconName()" class="h-4 w-4" [class]="textTone()" />
        </div>
        <div class="min-w-0">
          <h2 class="font-semibold text-foreground">Backups</h2>
          <p class="text-xs text-muted-foreground">{{ subtitle() }}</p>
        </div>
      </div>

      @if (isEmpty(s)) {
        <p class="text-sm text-muted-foreground" data-testid="backups-empty">No backups yet.</p>
      } @else {
        <div class="grid grid-cols-3 gap-2">
          <div class="card-inner rounded-lg px-2.5 py-2.5 flex flex-col gap-0.5">
            <span class="text-xl font-semibold tabular-nums">{{ s.summary.clustersWithBackups }}<span class="text-sm text-muted-foreground font-normal">/{{ s.summary.clustersTotal }}</span></span>
            <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" title="Clusters with a recent backup">Protected</span>
          </div>
          <div class="card-inner rounded-lg px-2.5 py-2.5 flex flex-col gap-0.5">
            <span class="text-xl font-semibold tabular-nums">{{ s.summary.activePolicies }}</span>
            <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Policies</span>
          </div>
          <div class="card-inner rounded-lg px-2.5 py-2.5 flex flex-col gap-0.5">
            <span class="text-xl font-semibold tabular-nums">{{ s.summary.totalArtifactsLast30d }}</span>
            <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Backups / 30d</span>
          </div>
        </div>

        <div class="flex flex-col gap-1.5 text-xs">
          @if (s.alerts.length > 0) {
          <div class="flex items-start gap-1.5">
            <ng-icon [name]="alertIcon(s.alerts[0].severity)" class="h-3.5 w-3.5 mt-0.5 flex-shrink-0" [class]="alertText(s.alerts[0].severity)" />
            <span class="text-foreground">{{ alertMessage(s.alerts[0]) }}</span>
          </div>
          @if (s.alerts[0].items?.length) {
          <ul class="flex flex-col gap-0.5 pl-5" data-testid="backups-alert-items">
            @for (item of s.alerts[0].items!.slice(0, ITEMS_LISTED); track item.id) {
            <li class="truncate">
              <a [routerLink]="item.path" (click)="$event.stopPropagation()" class="font-medium text-primary hover:underline">{{ item.name }}</a>
            </li>
            }
            @if (s.alerts[0].items!.length > ITEMS_LISTED) {
            <li class="text-muted-foreground">and {{ s.alerts[0].items!.length - ITEMS_LISTED }} more</li>
            }
          </ul>
          }
          } @else if (s.lastSuccessfulBackupAt) {
          <span class="text-muted-foreground">Last backup {{ s.lastSuccessfulBackupAt | date : 'short' }}</span>
          }
          @if (coverageLine(); as line) {
          <span class="text-muted-foreground" data-testid="backups-coverage">{{ line }}</span>
          }
        </div>
      }

      <div class="mt-auto">
        @if (s.alerts.length > 0 || s.cta) {
        <button
          type="button"
          class="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
          (click)="$event.stopPropagation(); navigateTo(resolveCtaPath(s))"
        >
          {{ ctaLabel(s) }}
          <ng-icon name="lucideArrowRight" class="h-3 w-3" />
        </button>
        } @else if (isEmpty(s)) {
        <button
          type="button"
          class="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
          (click)="$event.stopPropagation(); navigateTo('/management/backup/policies/new')"
        >
          Set up a backup policy
          <ng-icon name="lucideArrowRight" class="h-3 w-3" />
        </button>
        } @else {
        <span class="text-xs font-semibold text-primary inline-flex items-center gap-1">
          Open backups
          <ng-icon name="lucideArrowRight" class="h-3 w-3" />
        </span>
        }
      </div>
    </section>
    }
    }
  `,
})
export class DashboardBackupsComponent implements OnInit, OnDestroy {
  private readonly backup = inject(BackupService);
  private readonly router = inject(Router);
  private readonly fleet = inject(FleetService);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  protected readonly ITEMS_LISTED = 3;
  protected readonly status = this.backup.status;
  protected readonly loading = this.backup.statusLoading;

  protected readonly banner = computed(() => STATUS_BANNER_TONE[this.status()?.overall ?? 'info']);

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
    return !s.lastSuccessfulBackupAt && s.summary.activePolicies === 0 && s.summary.totalArtifactsLast30d === 0;
  }

  protected readonly textTone = computed(() => {
    return STATUS_TEXT_TONE[this.status()?.overall ?? 'info'];
  });

  protected readonly iconName = computed(() => {
    switch (this.status()?.overall) {
      case 'ok':
        return 'lucideCheckCircle';
      case 'critical':
        return 'lucideShieldOff';
      case 'warning':
        return 'lucideTriangleAlert';
      default:
        return 'lucideArchive';
    }
  });

  protected readonly subtitle = computed(() => {
    const s = this.status();
    if (!s) return 'Data protection';
    switch (s.overall) {
      case 'ok':
        return 'All good';
      case 'warning':
        return 'Needs attention';
      case 'critical':
        return 'Action required';
      default:
        return 'Data protection';
    }
  });

  resolveCtaPath(s: { alerts: BackupStatusAlert[]; cta?: { path: string } }): string {
    if (s.alerts.length > 0) return alertCtaPath(s.alerts[0]);
    return s.cta?.path ?? '/management/backup';
  }

  navigateTo(path: string): void {
    this.router.navigateByUrl(path);
  }

  ngOnInit(): void {
    void (async () => {
      await this.backup.loadStatus();
      this.intervalId = setInterval(() => this.backup.loadStatus(), REFRESH_INTERVAL_MS);
    })();
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  protected alertIcon(severity: BackupOverallStatus): string {
    switch (severity) {
      case 'ok':
        return 'lucideCheckCircle';
      case 'critical':
        return 'lucideShieldOff';
      case 'warning':
        return 'lucideTriangleAlert';
      default:
        return 'lucideCircleAlert';
    }
  }

  protected alertText(severity: BackupOverallStatus): string {
    return STATUS_TEXT_TONE[severity];
  }

  protected readonly alertMessage = alertMessage;

  protected ctaLabel(s: { alerts: { code: string; severity?: string; ctaLabel?: string }[]; cta?: { label: string } }): string {
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
