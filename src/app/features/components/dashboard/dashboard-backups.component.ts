import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
import {
  BackupOverallStatus,
  BackupStatusAlert,
  STATUS_BANNER_TONE,
  STATUS_TEXT_TONE,
  alertCtaLabel,
  alertCtaPath,
  alertMessage,
} from '../../model/backup.models';

const REFRESH_INTERVAL_MS = 60_000;

@Component({
  selector: 'app-dashboard-backups',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
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
  template: `
    @if (loading() && !status()) {
    <div class="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-4">
      <div class="h-8 w-8 rounded-lg bg-muted animate-pulse"></div>
      <div class="flex-1 space-y-1.5">
        <div class="h-3 w-32 rounded bg-muted animate-pulse"></div>
        <div class="h-3 w-48 rounded bg-muted animate-pulse"></div>
      </div>
    </div>
    } @else {
    @if (status(); as s) {
    <div
      class="rounded-lg border px-4 py-3 flex flex-col md:flex-row md:items-center gap-3 md:gap-5 group transition-colors cursor-pointer"
      [class]="banner()"
      (click)="navigateTo('/management/backup')"
    >
      <!-- Title block -->
      <div class="flex items-center gap-2.5 md:min-w-[180px]">
        <div class="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <ng-icon [name]="iconName()" class="h-4 w-4" [class]="textTone()" />
        </div>
        <div class="min-w-0">
          <h2 class="font-semibold text-foreground text-sm">Backups</h2>
          <p class="text-xs text-muted-foreground">{{ subtitle() }}</p>
        </div>
      </div>

      <!-- Inline stats -->
      <div class="flex items-center gap-5 text-sm">
        <div class="flex items-baseline gap-1.5">
          <span class="font-semibold tabular-nums">{{ s.summary.clustersWithBackups }}<span class="text-muted-foreground font-normal">/{{ s.summary.clustersTotal }}</span></span>
          <span class="text-[10px] text-muted-foreground uppercase tracking-wide">protected</span>
        </div>
        <span class="text-border">·</span>
        <div class="flex items-baseline gap-1.5">
          <span class="font-semibold tabular-nums">{{ s.summary.activePolicies }}</span>
          <span class="text-[10px] text-muted-foreground uppercase tracking-wide">policies</span>
        </div>
        <span class="text-border hidden sm:inline">·</span>
        <div class="hidden sm:flex items-baseline gap-1.5">
          <span class="font-semibold tabular-nums">{{ s.summary.totalArtifactsLast30d }}</span>
          <span class="text-[10px] text-muted-foreground uppercase tracking-wide">backups / 30d</span>
        </div>
      </div>

      <!-- Alert / status message -->
      <div class="flex-1 min-w-0 text-xs">
        @if (s.alerts.length > 0) {
        <div class="flex items-start gap-1.5">
          <ng-icon [name]="alertIcon(s.alerts[0].severity)" class="h-3.5 w-3.5 mt-0.5 flex-shrink-0" [class]="alertText(s.alerts[0].severity)" />
          <span class="text-foreground truncate">{{ alertMessage(s.alerts[0]) }}</span>
        </div>
        } @else if (s.lastSuccessfulBackupAt) {
        <span class="text-muted-foreground">
          Last backup {{ s.lastSuccessfulBackupAt | date : 'short' }}
        </span>
        } @else {
        <span class="text-muted-foreground">No backups yet.</span>
        }
      </div>

      <!-- CTA -->
      @if (s.alerts.length > 0 || s.cta) {
      <button
        type="button"
        class="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 flex-shrink-0"
        (click)="$event.stopPropagation(); navigateTo(resolveCtaPath(s))"
      >
        {{ ctaLabel(s) }}
        <ng-icon name="lucideArrowRight" class="h-3 w-3" />
      </button>
      }
      @if (!s.alerts.length && !s.cta) {
      <ng-icon
        name="lucideArrowRight"
        class="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
      />
      }
    </div>
    }
    }
  `,
})
export class DashboardBackupsComponent implements OnInit, OnDestroy {
  private readonly backup = inject(BackupService);
  private readonly router = inject(Router);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  protected readonly status = this.backup.status;
  protected readonly loading = this.backup.statusLoading;

  protected readonly banner = computed(() => {
    const overall = this.status()?.overall ?? 'info';
    return `${STATUS_BANNER_TONE[overall]} hover:border-primary/30`;
  });

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

  protected ctaLabel(s: { alerts: { code: string; ctaLabel?: string }[]; cta?: { label: string } }): string {
    const first = s.alerts[0];
    if (first) {
      const mapped = alertCtaLabel(first as any);
      if (mapped) return mapped;
    }
    // Fallback: backend-provided CTA may be localized — neutral English fallback.
    return s.cta?.label && /^[\x00-\x7F]*$/.test(s.cta.label) && !/[àèéìòù]/i.test(s.cta.label)
      ? s.cta.label
      : 'Take action';
  }
}
