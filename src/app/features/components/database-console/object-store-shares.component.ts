import { Component, inject, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { ShareRecord } from '../../model/object-store-console.models';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlField } from '../../../ui/patterns/field';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { ObjectStoreConsoleStateService } from './object-store-console-state.service';
import { FlDialogFocus } from '../../../ui/overlays/dialog-focus';

const SHARE_TONE: Record<ShareRecord['status'], StatusTone> = {
  active: 'success',
  expired: 'neutral',
  revoked: 'neutral',
};

const SHARE_LABEL: Record<ShareRecord['status'], string> = {
  active: 'Active',
  expired: 'Expired',
  revoked: 'Revoked',
};

@Component({
  selector: 'app-object-store-shares',
  imports: [
    FlDialogFocus,
    DatePipe,
    FlButton,
    FlCopyId,
    FlEmptyState,
    FlField,
    FlIcon,
    FlPanel,
    FlStatus,
    FlTable,
  ],
  providers: [provideIcons({ lucideX })],
  host: { class: 'block' },
  template: `
    <fl-panel title="Shared links" [count]="s.shares().length || null" [flush]="true">
      <button
        panelActions
        flButton="ghost"
        size="sm"
        type="button"
        [attr.aria-expanded]="s.showShares()"
        (click)="s.toggleShares()"
      >
        {{ s.showShares() ? 'Hide' : 'Show' }}
      </button>

      @if (s.showShares()) {
        @if (s.shares().length === 0) {
          <fl-empty-state
            [compact]="true"
            title="No share links yet"
            body="Use the share action on a file to create one."
          />
        } @else {
          <div class="fl-table-wrap relative">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Object</th>
                  <th scope="col">Bucket</th>
                  <th scope="col">Status</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Last accessed</th>
                  <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (rec of s.shares(); track rec.id) {
                  <tr>
                    <td class="fl-cell-name">
                      <fl-copy-id [value]="rec.key" label="key" />
                    </td>
                    <td class="fl-mono text-fl-ink-muted">{{ rec.bucket }}</td>
                    <td><fl-status [tone]="tone(rec)" [label]="label(rec)" /></td>
                    <td class="fl-mono">{{ rec.expiresAt | date: 'short' }}</td>
                    <td class="fl-mono text-fl-ink-muted">
                      {{ rec.lastAccessedAt ? (rec.lastAccessedAt | date: 'short') : '—' }}
                    </td>
                    <td class="is-fit">
                      @if (rec.status === 'active') {
                        <button
                          flButton="ghost"
                          size="sm"
                          type="button"
                          (click)="revokeRequest.emit(rec)"
                        >
                          Revoke
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </fl-panel>

    @if (s.shareFor(); as sk) {
      <div
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="s.closeShare()"
      >
        <div
          class="fl-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-link-title"
          flDialogFocus
          (dismissed)="s.closeShare()"
          (click)="$event.stopPropagation()"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" id="share-link-title">Share link</h2>
            <button
              type="button"
              class="fl-dialog__close"
              aria-label="Close"
              (click)="s.closeShare()"
            >
              <fl-icon name="lucideX" />
            </button>
          </header>
          <div class="fl-dialog__body">
            <p class="fl-mono truncate text-fl-ink-muted">{{ sk }}</p>
            <fl-field label="Expires in" for="share-ttl">
              <div id="share-ttl" class="fl-segmented" role="group" aria-label="Expires in">
                @for (t of s.ttls; track t.seconds) {
                  <button
                    type="button"
                    [attr.aria-pressed]="s.shareTtl() === t.seconds"
                    (click)="s.shareTtl.set(t.seconds)"
                  >
                    {{ t.label }}
                  </button>
                }
              </div>
            </fl-field>
            @if (s.shareLink(); as link) {
              <fl-field
                label="Link"
                for="share-link"
                hint="Anyone with this link can open the file until it expires. No Flui account needed."
              >
                <fl-copy-id id="share-link" class="break-all" [value]="link" label="link" />
              </fl-field>
            }
          </div>
          <footer class="fl-dialog__footer">
            <button flButton="ghost" type="button" (click)="s.closeShare()">Close</button>
            <button
              flButton="primary"
              type="button"
              [disabled]="s.busy()"
              (click)="s.generateShare()"
            >
              {{ s.shareLink() ? 'Generate again' : 'Generate' }}
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class ObjectStoreSharesComponent {
  protected readonly s = inject(ObjectStoreConsoleStateService);

  readonly revokeRequest = output<ShareRecord>();

  protected tone(rec: ShareRecord): StatusTone {
    return SHARE_TONE[rec.status];
  }

  protected label(rec: ShareRecord): string {
    return SHARE_LABEL[rec.status];
  }
}
