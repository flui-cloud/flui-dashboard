import { Component, OnInit, computed, inject, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideRotateCcw } from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { storeConsoleCrumbs, storeNameOf } from './store-console-crumbs';

export type StoreConsoleConn = 'connecting' | 'connected' | 'error';

const CONN: Record<StoreConsoleConn, { tone: StatusTone; label: string }> = {
  connecting: { tone: 'progress', label: 'Connecting' },
  connected: { tone: 'success', label: 'Connected' },
  error: { tone: 'error', label: 'Not connected' },
};

@Component({
  selector: 'app-store-console-header',
  imports: [FlPageHeader, FlCopyId, FlButton, FlIcon, FlStatus],
  providers: [provideIcons({ lucideRotateCcw })],
  host: { class: 'block' },
  template: `
    <fl-page-header [title]="title()" [breadcrumb]="crumbs()">
      <fl-status headerStatus [tone]="status().tone" [label]="status().label" />
      <ng-container headerMeta>
        <ng-content select="[consoleMeta]" />
        @if (appId(); as id) {
          <fl-copy-id [value]="id" label="application ID" />
        }
      </ng-container>
      <ng-container headerActions>
        <ng-content select="[consoleActions]" />
        @if (conn() === 'error') {
          <button flButton type="button" (click)="retry.emit()" data-testid="console-retry">
            <fl-icon name="lucideRotateCcw" [size]="14" /> Retry
          </button>
        }
      </ng-container>
    </fl-page-header>
  `,
})
export class StoreConsoleHeader implements OnInit {
  private readonly applications = inject(ApplicationService);

  readonly title = input.required<string>();
  readonly appId = input<string | null>(null);
  readonly conn = input.required<StoreConsoleConn>();

  readonly retry = output<void>();

  ngOnInit(): void {
    if (!this.applications.selectedApplication() && this.applications.applications().length === 0) {
      void this.applications.loadApplications();
    }
  }

  protected readonly status = computed(() => CONN[this.conn()]);
  protected readonly crumbs = computed(() =>
    storeConsoleCrumbs(this.appId(), storeNameOf(this.applications, this.appId())),
  );
}
