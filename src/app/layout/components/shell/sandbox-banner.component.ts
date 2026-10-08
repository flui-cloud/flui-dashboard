import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideClock, lucideTriangleAlert } from '@ng-icons/lucide';
import { SandboxService } from '../../../core/services/sandbox.service';

@Component({
  selector: 'app-sandbox-banner',
  standalone: true,
  imports: [NgIcon],
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

        @if (!sandbox.hasArea()) {
          <span class="font-medium">Demo guest</span>
          <span class="opacity-80">
            You are looking around. Deploy something to get a space of your
            own.
          </span>
        } @else if (sandbox.expired()) {
          <span class="font-medium">Your demo space has expired.</span>
          <span class="opacity-80">
            Everything in it is being deleted. Nothing here can be recovered.
          </span>
        } @else {
          <span class="font-medium">Your demo space</span>
          <span class="opacity-80">
            Your apps are removed after a day without activity.
          </span>
          <button
            type="button"
            class="rounded border border-current/30 px-2 py-0.5 font-medium hover:bg-foreground/5 disabled:opacity-50"
            [disabled]="keeping()"
            (click)="keep()"
          >
            {{ kept() ? 'Kept' : 'Keep my apps' }}
          </button>
        }

        <span class="opacity-70 hidden lg:inline ml-auto">
          Shared cluster, with quotas. Flui is alpha.
        </span>
      </div>
    }
  `,
})
export class SandboxBannerComponent {
  protected readonly sandbox = inject(SandboxService);
  protected readonly keeping = signal(false);
  protected readonly kept = signal(false);

  protected keep(): void {
    this.keeping.set(true);
    this.sandbox.keep().subscribe((ok) => {
      this.keeping.set(false);
      this.kept.set(ok);
    });
  }

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
