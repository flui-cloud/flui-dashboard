import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, merge } from 'rxjs';
import { FlAlert } from '../../ui/patterns/alert';

@Component({
  selector: 'app-network-status-banner',
  imports: [FlAlert],
  template: `
    @if (offline()) {
      <div
        class="fixed bottom-4 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4"
        aria-live="polite"
      >
        <fl-alert tone="warning" title="You are offline" />
      </div>
    }
  `,
})
export class NetworkStatusBannerComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly offline = signal(
    typeof navigator !== 'undefined' && navigator.onLine === false,
  );

  ngOnInit(): void {
    merge(fromEvent(globalThis.window, 'online'), fromEvent(globalThis.window, 'offline'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.offline.set(!navigator.onLine));
  }
}
