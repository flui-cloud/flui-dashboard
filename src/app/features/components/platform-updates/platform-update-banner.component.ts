import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { PlatformUpdateService } from '../../service/platform-update.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

const DISMISSED_KEY = 'flui-update-banner-dismissed';

@Component({
  selector: 'app-platform-update-banner',
  imports: [RouterLink, FlAlert, FlButton, FlIcon],
  providers: [provideIcons({ lucideX })],
  host: { class: 'contents' },
  template: `
    @if (visible()) {
      <fl-alert tone="info" [title]="'Flui ' + updates.availableVersion() + ' is available'">
        {{ summary() }}
        <ng-container alertActions>
          <a flButton="primary" size="sm" routerLink="/management/updates">Review update</a>
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [iconOnly]="true"
            aria-label="Hide until the next release"
            title="Hide until the next release"
            (click)="dismiss()"
          >
            <fl-icon name="lucideX" />
          </button>
        </ng-container>
      </fl-alert>
    }
  `,
})
export class PlatformUpdateBannerComponent {
  protected readonly updates = inject(PlatformUpdateService);

  private readonly dismissed = signal<string | null>(this.readDismissed());

  protected readonly visible = computed(() => {
    const version = this.updates.availableVersion();
    return !!version && !this.updates.running() && this.dismissed() !== version;
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
      parts.push(`${status.migrations} database migration${status.migrations === 1 ? '' : 's'}`);
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
      return;
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
