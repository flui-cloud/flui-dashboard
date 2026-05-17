import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideTriangleAlert,
  lucideCircleAlert,
  lucideCircleCheck,
  lucideArrowRight,
  lucideX,
} from '@ng-icons/lucide';
import {
  GithubAppOAuthService,
  CredentialsStatusResponse,
  CredentialItem,
  CredentialStatus,
} from '../../../core/services/github-app-oauth.service';

@Component({
  selector: 'app-dashboard-credentials-banner',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideTriangleAlert,
      lucideCircleAlert,
      lucideCircleCheck,
      lucideArrowRight,
      lucideX,
    }),
  ],
  template: `
    @if (visible() && attentionItems().length > 0) {
      <div [class]="containerClass()">
        <div class="flex items-start gap-3 p-4">
          <ng-icon [name]="icon()" [class]="iconClass()" class="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold" [class]="titleClass()">{{ title() }}</div>
            <ul class="mt-1 space-y-1">
              @for (item of attentionItems(); track item.kind + '-' + (item.providerId ?? '')) {
                <li class="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2 flex-wrap">
                  <span class="font-medium">{{ item.label }}</span>
                  <span class="text-slate-500 dark:text-slate-400">·</span>
                  <span [class]="statusTextClass(item.status)">{{ statusLabel(item.status) }}</span>
                  @if (item.expiresAt) {
                    <span class="text-slate-500 dark:text-slate-400">
                      · expires {{ formatDate(item.expiresAt) }}
                      @if (item.daysUntilExpiry != null && item.daysUntilExpiry >= 0) {
                        ({{ item.daysUntilExpiry }}d)
                      }
                    </span>
                  }
                  @if (item.actionUrl) {
                    <a
                      [href]="item.actionUrl"
                      (click)="navigate($event, item.actionUrl)"
                      class="ml-auto inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Manage
                      <ng-icon name="lucideArrowRight" class="h-3 w-3" />
                    </a>
                  }
                </li>
              }
            </ul>
          </div>
          <button
            (click)="visible.set(false)"
            class="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Dismiss"
          >
            <ng-icon name="lucideX" class="h-4 w-4" />
          </button>
        </div>
      </div>
    }
  `,
})
export class DashboardCredentialsBannerComponent implements OnInit {
  private readonly api = inject(GithubAppOAuthService);
  private readonly router = inject(Router);

  readonly visible = signal(true);
  readonly response = signal<CredentialsStatusResponse | null>(null);

  readonly attentionItems = computed<CredentialItem[]>(() =>
    (this.response()?.items ?? []).filter(i =>
      i.status === 'EXPIRING_SOON' ||
      i.status === 'EXPIRED' ||
      i.status === 'INVALID' ||
      i.status === 'UNKNOWN_EXPIRY' ||
      i.status === 'MISSING',
    ),
  );

  readonly overall = computed<CredentialStatus>(() =>
    this.response()?.overallStatus ?? 'VALID',
  );

  readonly containerClass = computed(() => {
    switch (this.overall()) {
      case 'EXPIRED':
      case 'INVALID':
        return 'rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10';
      case 'EXPIRING_SOON':
      case 'UNKNOWN_EXPIRY':
      case 'MISSING':
        return 'rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10';
      default:
        return 'rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40';
    }
  });

  readonly icon = computed(() => {
    switch (this.overall()) {
      case 'EXPIRED':
      case 'INVALID':
        return 'lucideCircleAlert';
      case 'EXPIRING_SOON':
      case 'UNKNOWN_EXPIRY':
      case 'MISSING':
        return 'lucideTriangleAlert';
      default:
        return 'lucideCircleCheck';
    }
  });

  readonly iconClass = computed(() => {
    switch (this.overall()) {
      case 'EXPIRED':
      case 'INVALID':
        return 'text-red-600 dark:text-red-400';
      case 'EXPIRING_SOON':
      case 'UNKNOWN_EXPIRY':
      case 'MISSING':
        return 'text-amber-600 dark:text-amber-400';
      default:
        return 'text-emerald-600 dark:text-emerald-400';
    }
  });

  readonly titleClass = computed(() => {
    switch (this.overall()) {
      case 'EXPIRED':
      case 'INVALID':
        return 'text-red-900 dark:text-red-200';
      case 'EXPIRING_SOON':
      case 'UNKNOWN_EXPIRY':
      case 'MISSING':
        return 'text-amber-900 dark:text-amber-200';
      default:
        return 'text-slate-900 dark:text-slate-100';
    }
  });

  readonly title = computed(() => {
    switch (this.overall()) {
      case 'EXPIRED': return 'Credentials expired — action required';
      case 'INVALID': return 'Credentials invalid — action required';
      case 'EXPIRING_SOON': return 'Credentials expiring soon';
      case 'UNKNOWN_EXPIRY': return 'Credentials missing expiration date';
      case 'MISSING': return 'Credentials not configured';
      default: return 'Credentials';
    }
  });

  ngOnInit(): void {
    void (async () => {
      try {
        const res = await this.api.getCredentialsStatus();
        this.response.set(res);
      } catch {
        this.response.set(null);
      }
    })();
  }

  statusLabel(s: CredentialStatus): string {
    switch (s) {
      case 'VALID': return 'Valid';
      case 'EXPIRING_SOON': return 'Expiring soon';
      case 'EXPIRED': return 'Expired';
      case 'INVALID': return 'Invalid';
      case 'UNKNOWN_EXPIRY': return 'Expiration unknown';
      case 'MISSING': return 'Not configured';
    }
  }

  statusTextClass(s: CredentialStatus): string {
    switch (s) {
      case 'EXPIRED':
      case 'INVALID':
        return 'text-red-700 dark:text-red-300';
      case 'EXPIRING_SOON':
      case 'UNKNOWN_EXPIRY':
      case 'MISSING':
        return 'text-amber-700 dark:text-amber-300';
      default:
        return 'text-emerald-700 dark:text-emerald-300';
    }
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
  }

  navigate(event: MouseEvent, url: string): void {
    if (url.startsWith('/')) {
      event.preventDefault();
      this.router.navigateByUrl(url);
    }
  }
}
