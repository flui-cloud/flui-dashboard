import { Component, inject, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideTrash2 } from '@ng-icons/lucide';
import { CacheEntry } from '../../model/cache-console.models';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlTag } from '../../../ui/primitives/tag';
import { CacheConsoleStateService } from './cache-console-state.service';
import { bytes, formatValue, isJson } from './cache-format';

@Component({
  selector: 'app-cache-lookup-result',
  imports: [FlButton, FlIcon, FlTag],
  providers: [provideIcons({ lucideTrash2 })],
  template: `
    @if (s.looked()) {
      @if (s.entry(); as e) {
        <div class="rounded-fl-md border border-fl-border">
          <div
            class="flex items-center justify-between gap-2 border-b border-fl-border bg-fl-surface-subtle px-3 py-1.5"
          >
            <span class="truncate font-mono text-fl-mono-sm text-fl-ink">{{ e.key }}</span>
            <span class="flex shrink-0 items-center gap-2 text-fl-caption text-fl-ink-muted">
              @if (json(e)) {
                <fl-tag>JSON</fl-tag>
              }
              <span class="fl-num">{{ size(e.sizeBytes) }} · flags {{ e.flags }}</span>
              <button
                flButton="ghost"
                size="sm"
                [iconOnly]="true"
                type="button"
                (click)="removeRequest.emit(e.key)"
                [disabled]="s.readOnly() || s.deleting()"
                aria-label="Delete key"
                title="Delete key"
              >
                <fl-icon name="lucideTrash2" [size]="14" />
              </button>
            </span>
          </div>
          <pre
            class="m-0 max-h-72 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-fl-mono-sm text-fl-ink"
            >{{ value(e) }}</pre>
          @if (e.encoding === 'base64') {
            <p class="m-0 px-3 pb-2 text-fl-caption text-fl-ink-muted">
              Binary value, base64 encoded
            </p>
          }
        </div>
      } @else {
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">No value stored for that key.</p>
      }
    }
  `,
})
export class CacheLookupResultComponent {
  protected readonly s = inject(CacheConsoleStateService);

  readonly removeRequest = output<string>();

  protected json(e: CacheEntry): boolean {
    return isJson(e);
  }

  protected value(e: CacheEntry): string {
    return formatValue(e);
  }

  protected size(n: number): string {
    return bytes(n);
  }
}
