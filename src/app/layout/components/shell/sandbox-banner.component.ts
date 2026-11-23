import { Component, computed, inject, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideGithub, lucideStar } from '@ng-icons/lucide';
import { SandboxService } from '../../../core/services/sandbox.service';
import { FLUI_CORE_REPO_URL, INSTALL_FLUI_URL } from '../../../core/utils/install-flui';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

@Component({
  selector: 'app-sandbox-banner',
  imports: [FlButton, FlIcon, FlStatus],
  providers: [provideIcons({ lucideGithub, lucideStar })],
  template: `
    @if (sandbox.inSandbox()) {
      <div
        role="status"
        class="fl-row border-b border-fl-border bg-fl-surface px-4 py-1.5 text-fl-body-sm"
      >
        @if (sandbox.visitor() || !sandbox.hasArea()) {
          <fl-status [tone]="tone()" [label]="sandbox.visitor() ? 'Visitor' : 'Demo guest'" />
          <span class="text-fl-ink-secondary">You are looking around a read-only demo.</span>
          <a
            flButton
            size="sm"
            [href]="installUrl"
            target="_blank"
            rel="noopener"
            data-testid="install-flui"
          >
            Install Flui
          </a>
        } @else if (sandbox.expired()) {
          <fl-status [tone]="tone()" label="Your demo space has expired." />
          <span class="text-fl-ink-secondary">
            Everything in it is being deleted. Nothing here can be recovered.
          </span>
        } @else {
          <fl-status [tone]="tone()" label="Your demo space" />
          <span class="text-fl-ink-secondary">
            Your apps are removed after a day without activity.
          </span>
          <button flButton size="sm" type="button" [disabled]="keeping()" (click)="keep()">
            {{ kept() ? keptLabel() : 'Keep my apps' }}
          </button>
        }

        <a
          flButton="ghost"
          size="sm"
          [href]="repoUrl"
          target="_blank"
          rel="noopener"
          aria-label="Star Flui on GitHub"
          data-testid="star-on-github"
        >
          <fl-icon name="lucideGithub" />
          <fl-icon name="lucideStar" />
          <span>Star<span class="hidden sm:inline"> on GitHub</span></span>
        </a>

        <span class="ml-auto hidden text-fl-caption text-fl-ink-muted lg:inline">
          Shared cluster, with quotas. Flui is alpha.
        </span>
      </div>
    }
  `,
})
export class SandboxBannerComponent {
  protected readonly sandbox = inject(SandboxService);
  protected readonly installUrl = INSTALL_FLUI_URL;
  protected readonly repoUrl = FLUI_CORE_REPO_URL;
  protected readonly keeping = signal(false);
  protected readonly kept = signal(false);

  protected readonly keptLabel = computed(() => {
    const until = this.sandbox.appsKeptUntil();
    if (!until) return 'Kept';
    const at = new Date(until);
    return `Kept until ${at.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`;
  });

  protected keep(): void {
    this.keeping.set(true);
    this.sandbox.keep().subscribe((ok) => {
      this.keeping.set(false);
      this.kept.set(ok);
    });
  }

  protected readonly tone = computed<StatusTone>(() => {
    if (this.sandbox.expired()) return 'error';
    if (this.sandbox.urgent()) return 'warning';
    return 'neutral';
  });
}
