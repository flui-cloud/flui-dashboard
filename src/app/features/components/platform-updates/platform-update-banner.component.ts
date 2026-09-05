import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideDownload, lucideX } from '@ng-icons/lucide';
import { PlatformUpdateService } from '../../service/platform-update.service';

const DISMISSED_KEY = 'flui-update-banner-dismissed';

// Dismissal is per release, not permanent — hiding 0.14.0 should not hide 0.15.0.
@Component({
  selector: 'app-platform-update-banner',
  standalone: true,
  imports: [NgIconComponent, RouterLink],
  providers: [provideIcons({ lucideDownload, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (visible()) {
      <div class="card-surface border-primary flex flex-wrap items-center gap-3 p-4">
        <div class="step-icon bg-primary/10 text-primary">
          <ng-icon name="lucideDownload" class="h-4 w-4" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold">Flui {{ updates.availableVersion() }} is available</p>
          <p class="text-xs text-muted-foreground mt-0.5">{{ summary() }}</p>
        </div>
        <a routerLink="/management/updates"
           class="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
          Review update
        </a>
        <button type="button" (click)="dismiss()" class="p-1 text-muted-foreground hover:text-foreground"
                title="Hide until the next release">
          <ng-icon name="lucideX" class="h-4 w-4" />
        </button>
      </div>
    }
  `,
})
export class PlatformUpdateBannerComponent {
  protected readonly updates = inject(PlatformUpdateService);

  private readonly dismissed = signal<string | null>(this.readDismissed());

  protected readonly visible = computed(() => {
    const version = this.updates.availableVersion();
    return (
      !!version && !this.updates.running() && this.dismissed() !== version
    );
  });

  protected summary(): string {
    const status = this.updates.status();
    if (!status) return '';
    const changed = status.components.filter((c) => c.changed);
    const parts = [
      `You are on ${status.installedVersion}`,
      `${changed.map((c) => c.key).join(' and ')} change`,
    ];
    if (status.migrations > 0) {
      parts.push(
        `${status.migrations} database migration${status.migrations === 1 ? '' : 's'}`,
      );
    }
    return parts.join(' · ');
  }

  protected dismiss(): void {
    const version = this.updates.availableVersion();
    if (!version) return;
    this.dismissed.set(version);
    try {
      localStorage.setItem(DISMISSED_KEY, version);
    } catch {
      // A browser refusing storage only means the banner comes back.
    }
  }

  private readDismissed(): string | null {
    try {
      return localStorage.getItem(DISMISSED_KEY);
    } catch {
      return null;
    }
  }
}
