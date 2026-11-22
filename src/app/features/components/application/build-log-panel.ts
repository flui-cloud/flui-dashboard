import { Component, ElementRef, afterRenderEffect, input, output, viewChild } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCopy } from '@ng-icons/lucide';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-build-log-panel',
  imports: [FlPanel, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideCopy })],
  template: `
    <fl-panel title="Log">
      <button
        panelActions
        flButton="ghost"
        size="sm"
        type="button"
        [disabled]="!lines().length"
        (click)="copied.emit()"
      >
        <fl-icon name="lucideCopy" />
        Copy log
      </button>
      <div
        #logContainer
        class="fl-mono h-80 overflow-auto whitespace-pre-wrap break-all rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3 text-fl-ink"
      >
        @for (line of lines(); track $index) {
          <div [class.text-fl-ink-secondary]="line.startsWith('[stderr]')">{{ line }}</div>
        }
        @if (!lines().length) {
          @if (waiting()) {
            <div class="fl-row text-fl-ink-muted">
              <fl-spinner label="Waiting for output" />
              Waiting for output
            </div>
          } @else {
            <div class="text-fl-ink-muted">No output yet</div>
          }
        }
      </div>
    </fl-panel>
  `,
})
export class BuildLogPanel {
  readonly lines = input.required<readonly string[]>();
  readonly waiting = input(false);
  readonly copied = output<void>();

  private readonly container = viewChild<ElementRef<HTMLDivElement>>('logContainer');

  constructor() {
    afterRenderEffect(() => {
      this.lines();
      const el = this.container()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
