import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  InstallLogChunk,
  InstallLogService,
} from '../../service/install-log.service';

const NEAR_END_PX = 24;

/**
 * A node's install log, followed while the node installs: reads from a cursor
 * every few seconds, keeps to the newest line until the person scrolls up, and
 * can be paused. Stops by itself once the operation has finished.
 */
@Component({
  selector: 'app-node-install-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span class="text-gray-300" data-testid="install-log-state">{{
        stateLine()
      }}</span>
      <span class="flex-1"></span>
      @if (!finished()) {
        <button
          type="button"
          class="text-gray-300 underline underline-offset-2"
          (click)="togglePause()"
          data-testid="install-log-pause"
        >
          {{ paused() ? 'Resume' : 'Pause' }}
        </button>
      }
      @if (!stick() && text()) {
        <button
          type="button"
          class="text-gray-300 underline underline-offset-2"
          (click)="jumpToEnd()"
          data-testid="install-log-jump"
        >
          Jump to latest
        </button>
      }
      @if (text()) {
        <button
          type="button"
          class="text-gray-300 underline underline-offset-2"
          (click)="save()"
          data-testid="install-log-download"
        >
          Download
        </button>
      }
    </div>
    @if (failed()) {
      <p class="m-0 mt-2 text-xs text-red-300" data-testid="install-log-error">
        {{ failed() }}
      </p>
    }
    @if (text()) {
      <pre
        #box
        (scroll)="onScroll()"
        class="m-0 mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-green-400"
        data-testid="install-log-text"
        >{{ text() }}</pre>
    }
    @if (note()) {
      <p class="m-0 mt-2 text-xs text-gray-300" data-testid="install-log-note">
        {{ note() }}
      </p>
    }
  `,
})
export class NodeInstallLogComponent implements OnInit {
  private readonly logs = inject(InstallLogService);
  private readonly injector = inject(Injector);

  readonly operationId = input.required<string>();
  readonly intervalMs = input(3000);

  private readonly box = viewChild<ElementRef<HTMLElement>>('box');

  protected readonly text = signal('');
  protected readonly note = signal<string | null>(null);
  protected readonly failed = signal<string | null>(null);
  protected readonly status = signal<InstallLogChunk['status'] | null>(null);
  protected readonly finished = signal(false);
  protected readonly paused = signal(false);
  protected readonly stick = signal(true);
  private readonly loaded = signal(false);

  private cursor = 0;
  private alive = true;
  private reading = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly stateLine = computed(() => {
    if (this.finished()) {
      switch (this.status()) {
        case 'COMPLETED':
          return 'Finished: the node is installed.';
        case 'FAILED':
          return 'The installation failed.';
        case 'CANCELLED':
          return 'The installation was cancelled.';
        default:
          return 'Finished.';
      }
    }
    if (this.paused()) return 'Paused: new lines are not read.';
    if (!this.loaded()) return 'Reading…';
    return `Live: updates every ${Math.round(this.intervalMs() / 1000)} s.`;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.alive = false;
      this.clearTimer();
    });
  }

  ngOnInit(): void {
    void this.read();
  }

  protected togglePause(): void {
    if (this.paused()) {
      this.paused.set(false);
      if (!this.reading) void this.read();
      return;
    }
    this.paused.set(true);
    this.clearTimer();
  }

  protected onScroll(): void {
    const el = this.box()?.nativeElement;
    if (!el) return;
    this.stick.set(
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_END_PX,
    );
  }

  protected jumpToEnd(): void {
    this.stick.set(true);
    this.scrollToEnd();
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

  private async read(): Promise<void> {
    this.clearTimer();
    this.reading = true;
    let retry = true;
    try {
      let chunk: InstallLogChunk;
      do {
        chunk = await firstValueFrom(
          this.logs.readChunk(this.operationId(), this.cursor),
        );
        if (!this.alive) return;
        if (chunk.text) this.append(chunk.text);
        this.cursor = chunk.next;
      } while (chunk.more);
      this.status.set(chunk.status);
      this.note.set(chunk.note);
      this.failed.set(null);
      if (chunk.done) {
        this.finished.set(true);
        retry = false;
      }
    } catch (err: unknown) {
      if (err instanceof HttpErrorResponse && err.status === 404) {
        this.failed.set(
          'The install log could not be read: the operation was not found.',
        );
        retry = false;
      } else {
        this.failed.set(
          'The install log could not be read just now; trying again.',
        );
      }
    } finally {
      this.reading = false;
      this.loaded.set(true);
    }
    if (retry && this.alive && !this.paused()) {
      this.timer = setTimeout(() => void this.read(), this.intervalMs());
    }
  }

  private append(text: string): void {
    this.text.update((current) => current + text);
    if (this.stick()) {
      afterNextRender(() => this.scrollToEnd(), { injector: this.injector });
    }
  }

  private scrollToEnd(): void {
    const el = this.box()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
