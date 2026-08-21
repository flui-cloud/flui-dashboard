import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideClock, lucideTriangleAlert } from '@ng-icons/lucide';
import {
  SandboxService,
  formatCountdown,
} from '../../../core/services/sandbox.service';
import { SandboxSaveActionComponent } from './sandbox-save-action.component';

@Component({
  selector: 'app-sandbox-banner',
  standalone: true,
  imports: [NgIcon, SandboxSaveActionComponent],
  providers: [provideIcons({ lucideClock, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sandbox.inSandbox()) {
      <div
        role="status"
        class="flex items-center gap-2 px-3 py-1.5 text-xs border-b"
        [class]="tone()"
      >
        <ng-icon [name]="icon()" class="h-3.5 w-3.5 flex-shrink-0" />

        @if (sandbox.expired()) {
          <span class="font-medium">This sandbox has expired.</span>
          <span class="opacity-80">
            Everything in it is being deleted. Nothing here can be recovered.
          </span>
        } @else {
          <span class="font-medium">Guest sandbox</span>
          <span class="opacity-80">
            — everything here is deleted in
            <span class="font-semibold tabular-nums">{{ remaining() }}</span
            >, and there is no way to extend it.
          </span>
        }

        @if (!sandbox.expired()) {
          <span class="ml-auto hidden sm:inline">
            <app-sandbox-save-action />
          </span>
        }
        <span class="opacity-70 hidden lg:inline" [class.ml-auto]="sandbox.expired()">
          Shared cluster, with quotas. Flui is alpha.
        </span>
      </div>
    }
  `,
})
export class SandboxBannerComponent {
  protected readonly sandbox = inject(SandboxService);

  protected readonly remaining = computed(() =>
    formatCountdown(this.sandbox.secondsRemaining()),
  );

  protected readonly icon = computed(() =>
    this.sandbox.urgent() ? 'lucideTriangleAlert' : 'lucideClock',
  );

  protected readonly tone = computed(() => {
    if (this.sandbox.expired()) {
      return 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900/50';
    }
    if (this.sandbox.urgent()) {
      return 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/50';
    }
    return 'bg-muted/50 text-foreground/80 border-border';
  });
}
