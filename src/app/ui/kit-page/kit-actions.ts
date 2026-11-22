import { Component, inject, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideRefreshCw } from '@ng-icons/lucide';
import { ConfirmService } from '../overlays/confirm';
import { FlActionsMenu, MenuAction } from '../overlays/actions-menu';
import { FlToast } from '../overlays/toast';
import { FlPanel } from '../patterns/panel';
import { FlButton } from '../primitives/button';
import { FlIcon } from '../primitives/icon';
import { FlSpinner } from '../primitives/spinner';
import { FlStatus } from '../primitives/status';
import { FlTag } from '../primitives/tag';

@Component({
  selector: 'fl-kit-actions',
  host: { class: 'fl-stack' },
  imports: [FlPanel, FlButton, FlIcon, FlStatus, FlTag, FlSpinner, FlActionsMenu, FlToast],
  providers: [provideIcons({ lucidePlus, lucideRefreshCw })],
  template: `
    <fl-panel title="Buttons">
      <div class="fl-row">
        <button flButton="primary" type="button">
          <fl-icon name="lucidePlus" />Create cluster
        </button>
        <button flButton type="button">Back up now</button>
        <button flButton="ghost" type="button">Cancel</button>
        <button flButton size="sm" type="button">Small</button>
        <button flButton [iconOnly]="true" type="button" aria-label="Refresh">
          <fl-icon name="lucideRefreshCw" />
        </button>
        <button flButton type="button" disabled>Disabled</button>
        <fl-actions-menu [items]="actions" (action)="onAction($event)" />
      </div>
      @if (lastAnswer()) {
        <p class="mt-3 text-fl-caption text-fl-ink-muted">
          Confirmation answered: {{ lastAnswer() }}
        </p>
      }
    </fl-panel>
    <fl-panel title="Status and tags">
      <div class="fl-row gap-5">
        <fl-status tone="success" label="Healthy" />
        <fl-status tone="warning" label="Out of date" />
        <fl-status tone="error" label="Failed" />
        <fl-status tone="neutral" label="Stopped" />
        <fl-status tone="progress" label="Deploying" />
        <fl-spinner />
        <fl-tag>control plane</fl-tag>
        <fl-tag>v1.31.2</fl-tag>
      </div>
    </fl-panel>
    <fl-panel title="Toasts">
      <div class="flex max-w-sm flex-col gap-2">
        <fl-toast tone="success" title="Backup completed" body="postgres-main · 2.1 GB in 41 s" />
        <fl-toast tone="error" title="Deploy failed" body="Image pull refused by the registry." />
      </div>
    </fl-panel>
  `,
})
export class KitActions {
  private readonly confirm = inject(ConfirmService);
  protected readonly lastAnswer = signal('');
  protected readonly actions: readonly MenuAction[] = [
    { id: 'restart', label: 'Restart' },
    { id: 'edit', label: 'Edit settings' },
    { id: 'delete', label: 'Delete cluster', danger: true, separatorBefore: true },
  ];

  protected onAction(id: string): void {
    if (id === 'delete') void this.confirmDelete();
  }

  protected async confirmDelete(): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Delete cluster',
      body: 'The cluster prod-eu-1, its 3 nodes and their disks are deleted. Backups are kept.',
      confirmLabel: 'Delete cluster',
      destructive: true,
      typeToConfirm: 'prod-eu-1',
    });
    this.lastAnswer.set(ok ? 'confirmed' : 'cancelled');
  }
}
