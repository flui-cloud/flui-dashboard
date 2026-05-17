import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, merge } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideWifiOff } from '@ng-icons/lucide';

@Component({
  selector: 'app-network-status-banner',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideWifiOff })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (offline()) {
      <div
        role="status"
        aria-live="polite"
        class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900/90 dark:bg-gray-100/90 text-white dark:text-gray-900 text-xs shadow-lg backdrop-blur-sm"
      >
        <ng-icon name="lucideWifiOff" class="h-3.5 w-3.5" />
        <span>You are offline</span>
      </div>
    }
  `,
})
export class NetworkStatusBannerComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly offline = signal(typeof navigator !== 'undefined' && navigator.onLine === false);

  ngOnInit(): void {
    merge(fromEvent(globalThis.window, 'online'), fromEvent(globalThis.window, 'offline'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.offline.set(!navigator.onLine));
  }
}
