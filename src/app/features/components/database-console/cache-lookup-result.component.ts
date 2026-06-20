import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTrash2 } from '@ng-icons/lucide';
import { CacheEntry } from '../../model/cache-console.models';
import { CacheConsoleStateService } from './cache-console-state.service';
import { bytes, formatValue, isJson } from './cache-format';

@Component({
  selector: 'app-cache-lookup-result',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ lucideTrash2 })],
  template: `
    @if (s.looked()) {
      @if (s.entry(); as e) {
        <div class="rounded-md border border-border">
          <div
            class="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5 text-xs text-muted-foreground"
          >
            <span class="truncate font-mono text-foreground">{{ e.key }}</span>
            <span class="flex shrink-0 items-center gap-1.5">
              @if (json(e)) {
                <span
                  class="rounded bg-muted px-1 py-0.5 text-[10px] font-medium uppercase"
                  >JSON</span
                >
              }
              <span>{{ size(e.sizeBytes) }} · flags {{ e.flags }}</span>
              <button
                type="button"
                (click)="removeRequest.emit(e.key)"
                [disabled]="s.readOnly() || s.deleting()"
                title="Delete key"
                class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
              >
                <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
          <pre
            class="max-h-72 overflow-auto whitespace-pre-wrap break-words p-2 font-mono text-xs text-foreground"
            >{{ value(e) }}</pre
          >
          @if (e.encoding === 'base64') {
            <span class="block px-2 pb-1.5 text-[10px] text-muted-foreground"
              >(base64 — binary value)</span
            >
          }
        </div>
      } @else {
        <p class="text-xs text-muted-foreground">
          No value stored for that key.
        </p>
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
