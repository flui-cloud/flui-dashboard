import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader } from '@ng-icons/lucide';
import { KafkaConsoleStateService } from './kafka-console-state.service';
import { formatValue, pretty } from './kafka-format';

@Component({
  selector: 'app-kafka-result',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ lucideLoader })],
  template: `
    @if (state.result(); as r) {
      <div class="mt-3 rounded-md border border-border">
        <div
          class="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-xs"
        >
          <span class="font-mono text-foreground">{{ r.command }}</span>
          @if (r.text) {
            <span class="ml-auto text-muted-foreground">{{ r.text }}</span>
          }
        </div>

        @switch (r.kind) {
          @case ('ack') {
            <p class="px-3 py-3 text-sm text-emerald-600">{{ r.text }}</p>
          }
          @case ('table') {
            <div class="max-h-96 overflow-auto">
              <table class="w-full text-sm">
                <thead class="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    @for (c of r.columns ?? []; track c) {
                      <th class="px-3 py-1.5 text-left font-medium">{{ c }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of r.rows ?? []; track $index) {
                    <tr class="border-t border-border">
                      @for (cell of row; track $index) {
                        <td class="px-3 py-1.5 font-mono text-xs text-foreground">{{ cell }}</td>
                      }
                    </tr>
                  }
                  @if ((r.rows ?? []).length === 0) {
                    <tr><td class="px-3 py-4 text-center text-xs text-muted-foreground" [attr.colspan]="(r.columns ?? []).length || 1">No rows.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
          @case ('messages') {
            <div class="max-h-96 space-y-2 overflow-auto p-3">
              @for (m of r.messages ?? []; track $index) {
                <div class="rounded-md border border-border">
                  <div class="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
                    <span class="font-mono">p{{ m.partition }} · offset {{ m.offset }}</span>
                    @if (m.key) { <span class="font-mono">key: {{ m.key }}</span> }
                    @if (m.timestamp) { <span class="ml-auto">{{ m.timestamp }}</span> }
                  </div>
                  <pre class="overflow-auto px-3 py-2 font-mono text-xs text-foreground">{{ value(m.value) }}</pre>
                </div>
              }
              @if ((r.messages ?? []).length === 0) {
                <div class="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No records in that window.</div>
              }
            </div>
          }
          @case ('detail') {
            <pre class="max-h-96 overflow-auto px-3 py-2 font-mono text-xs text-foreground">{{ detail(r.detail) }}</pre>
          }
        }
      </div>
    } @else if (state.running()) {
      <div class="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" /> Running…
      </div>
    }
  `,
})
export class KafkaResultComponent {
  protected readonly state = inject(KafkaConsoleStateService);

  protected value(v: string | null): string {
    return formatValue(v);
  }

  protected detail(v: unknown): string {
    return pretty(v);
  }
}
