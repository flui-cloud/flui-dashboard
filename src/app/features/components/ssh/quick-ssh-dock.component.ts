import { Component, inject } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideMaximize2, lucideTerminal, lucideX } from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { QuickSshService } from '../../service/quick-ssh.service';

@Component({
  selector: 'app-quick-ssh-dock',
  imports: [FlButton, FlIcon, FlStatus],
  providers: [provideIcons({ lucideTerminal, lucideMaximize2, lucideX })],
  host: { class: 'contents' },
  template: `
    @if (sshService.isMinimized()) {
      <div
        class="fl-panel fixed bottom-4 right-4 z-50 flex cursor-pointer items-center gap-2 py-1 pl-3 pr-1 hover:bg-fl-surface-hover"
        (click)="sshService.restore()"
      >
        <fl-icon name="lucideTerminal" [size]="14" class="text-fl-ink-muted" />

        @if (sshService.activeSession(); as session) {
          <span class="max-w-40 truncate text-fl-body-sm font-medium text-fl-ink">{{
            session.serverName
          }}</span>
          <fl-status tone="success" label="Connected" />
        } @else {
          <span class="text-fl-body-sm font-medium text-fl-ink">SSH terminal</span>
        }

        <div class="flex items-center">
          <button
            flButton="ghost"
            size="sm"
            [iconOnly]="true"
            type="button"
            aria-label="Restore"
            title="Restore"
            (click)="$event.stopPropagation(); sshService.restore()"
          >
            <fl-icon name="lucideMaximize2" />
          </button>
          <button
            flButton="ghost"
            size="sm"
            [iconOnly]="true"
            type="button"
            aria-label="Close"
            title="Close"
            (click)="$event.stopPropagation(); sshService.close()"
          >
            <fl-icon name="lucideX" />
          </button>
        </div>
      </div>
    }
  `,
})
export class QuickSshDockComponent {
  protected readonly sshService = inject(QuickSshService);
}
