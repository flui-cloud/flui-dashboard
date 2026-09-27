import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InstallLogService } from '../../service/install-log.service';

/** The install log of a purchase, opened in place: reading it is the point, the file is secondary. */
@Component({
  selector: 'app-purchase-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="text-[13px] font-medium underline underline-offset-2 disabled:opacity-50"
      [disabled]="loading()"
      (click)="toggle()"
      data-testid="purchase-log"
    >
      {{ loading() ? 'Loading…' : open() ? 'Hide install log' : 'Install log' }}
    </button>
    @if (open()) {
      <div
        class="mt-2 w-full basis-full rounded-md bg-gray-900 p-3 dark:bg-black"
        data-testid="purchase-log-panel"
      >
        @if (failed()) {
          <p class="m-0 text-xs text-red-300">{{ failed() }}</p>
        } @else if (text()) {
          <pre
            class="m-0 max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-green-400"
            >{{ text() }}</pre>
          <button
            type="button"
            class="mt-2 text-xs text-gray-300 underline underline-offset-2"
            (click)="save()"
            data-testid="purchase-log-download"
          >
            Download
          </button>
        } @else {
          <p class="m-0 text-xs text-gray-300">
            Nothing captured yet: the node writes its log once it can be
            reached.
          </p>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class PurchaseLogComponent {
  private readonly logs = inject(InstallLogService);

  readonly operationId = input.required<string>();

  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly text = signal('');
  protected readonly failed = signal<string | null>(null);

  protected async toggle(): Promise<void> {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.loading.set(true);
    try {
      const blob = await firstValueFrom(this.logs.download(this.operationId()));
      this.text.set(await blob.text());
      this.failed.set(null);
    } catch {
      this.failed.set('The install log could not be read.');
    } finally {
      this.loading.set(false);
      this.open.set(true);
    }
  }

  protected save(): void {
    const url = URL.createObjectURL(
      new Blob([this.text()], { type: 'text/plain' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `install-${this.operationId()}.log`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
