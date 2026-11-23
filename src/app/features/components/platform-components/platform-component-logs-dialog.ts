import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX } from '@ng-icons/lucide';
import { PlatformComponentsService } from '../../service/platform-components.service';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import type { AppLogEntryDto } from '../../service/application-logs.service';
import { LogTableComponent } from '../application/log-table.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlIcon } from '../../../ui/primitives/icon';
import { filterLogEntries, parseLogText } from './platform-component-logs';

@Component({
  selector: 'app-platform-component-logs-dialog',
  imports: [CdkTrapFocus, FormsModule, LogTableComponent, FlAlert, FlLoadingState, FlIcon],
  providers: [provideIcons({ lucideSearch, lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
      (click)="closed.emit()"
      (keydown.escape)="closed.emit()"
    >
      <div
        class="fl-dialog fl-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-logs-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <div class="flex min-w-0 flex-col">
            <h2 class="fl-dialog__title" id="platform-logs-title">Pod logs</h2>
            <span class="fl-mono truncate text-fl-ink-muted">{{ podName() }}</span>
          </div>
          <button type="button" class="fl-dialog__close" aria-label="Close" (click)="closed.emit()">
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-dialog__body">
          @if (maskMode.enabled()) {
            <fl-alert
              tone="warning"
              title="Mask mode cannot protect log content"
              data-testid="mask-mode-log-banner"
              >Do not share this screen.</fl-alert
            >
          }
          @if (loading()) {
            <fl-loading-state [rows]="6" />
          } @else {
            <div class="fl-row justify-between">
              <label class="fl-input grow">
                <fl-icon name="lucideSearch" [size]="14" />
                <span class="fl-sr">Filter logs</span>
                <input
                  type="search"
                  placeholder="Filter across all fields"
                  [ngModel]="search()"
                  (ngModelChange)="search.set($event)"
                />
              </label>
              <span class="fl-toolbar__info fl-num"
                >{{ filtered().length }} / {{ entries().length }}</span
              >
            </div>
            <app-log-table [entries]="filtered()" [error]="parseError()" />
          }
        </div>
      </div>
    </div>
  `,
})
export class PlatformComponentLogsDialog implements OnInit {
  protected readonly maskMode = inject(MaskModeService);
  private readonly service = inject(PlatformComponentsService);

  readonly clusterId = input.required<string>();
  readonly componentKey = input.required<string>();
  readonly podName = input.required<string>();
  readonly containerName = input<string | undefined>(undefined);
  readonly closed = output<void>();

  protected readonly entries = signal<AppLogEntryDto[]>([]);
  protected readonly parseError = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly search = signal('');
  protected readonly filtered = computed(() => filterLogEntries(this.entries(), this.search()));

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const result = await this.service.getPodLogs(
      this.clusterId(),
      this.componentKey(),
      this.podName(),
      this.containerName(),
    );
    this.loading.set(false);
    if (result) {
      const parsed = parseLogText(result.logs, this.podName());
      this.entries.set(parsed.entries);
      this.parseError.set(parsed.parseError);
    }
  }
}
