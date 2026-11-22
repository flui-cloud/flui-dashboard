import { Component, effect, inject, input, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideTrash2 } from '@ng-icons/lucide';

import { CanDirective } from '../../../core/directives/can.directive';
import {
  ClusterOrphanedClaimsService,
  OrphanedClaim,
  claimRef,
} from '../../service/cluster-orphaned-claims.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'cluster-orphaned-volumes',
  imports: [
    CanDirective,
    FlPanel,
    FlTable,
    FlAlert,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlSpinner,
  ],
  providers: [provideIcons({ lucideTrash2 })],
  host: { class: 'block' },
  template: `
    <fl-panel
      title="Volumes with no application"
      [count]="claims().length || null"
      [flush]="true"
      data-testid="orphaned-volumes"
    >
      @if (claims().length > 0) {
        <span panelActions class="fl-num text-fl-body-sm" data-testid="orphaned-total">
          {{ totalLabel() }} held
        </span>
      }
      <p class="m-0 border-b border-fl-border px-4 py-3 text-fl-body-sm text-fl-ink-muted">
        Storage left behind by applications that were removed before Flui took the volume with them.
        It still costs what it costs. A volume is only listed here when no pod mounts it, no
        StatefulSet could have made it, and no existing application owns it.
      </p>

      @if (loading() && claims().length === 0) {
        <fl-loading-state data-testid="orphaned-loading" [rows]="2" />
      } @else if (error()) {
        <div class="p-4">
          <fl-alert tone="error" title="Could not look for volumes" data-testid="orphaned-error">
            {{ error() }}
          </fl-alert>
        </div>
      } @else if (note()) {
        <div class="p-4">
          <fl-alert tone="warning" title="Not scanned" data-testid="orphaned-note">
            {{ note() }}
          </fl-alert>
        </div>
      } @else if (claims().length === 0) {
        <fl-empty-state
          data-testid="orphaned-empty"
          [compact]="true"
          title="No volumes found"
          body="Nothing abandoned by these rules. A plain unlabelled volume from a third-party chart is never listed, so this is “none found”, not “none exist”."
        />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Volume</th>
                <th scope="col">Left by</th>
                <th scope="col" class="is-num">Size</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (claim of claims(); track ref(claim)) {
                <tr [attr.data-testid]="'orphaned-row-' + ref(claim)">
                  <td>
                    <span class="fl-mono block">{{ claim.name }}</span>
                    <span class="fl-mono block text-fl-caption text-fl-ink-muted">{{
                      claim.namespace
                    }}</span>
                  </td>
                  <td>
                    @if (claim.lastKnownApplication; as app) {
                      <span class="block">{{ app.name }}</span>
                      <span class="block text-fl-caption text-fl-ink-muted">
                        deleted{{ app.deletedAt ? ' ' + formatDate(app.deletedAt) : '' }}
                      </span>
                    } @else {
                      <span class="text-fl-ink-muted">{{ claim.reason }}</span>
                    }
                  </td>
                  <td class="is-num">{{ claim.sizeLabel }}</td>
                  <td class="is-fit">
                    <button
                      *fluiCan="'cluster:manage'"
                      flButton="ghost"
                      size="sm"
                      type="button"
                      [iconOnly]="true"
                      [attr.aria-label]="'Delete ' + ref(claim)"
                      title="Delete this volume permanently"
                      [attr.data-testid]="'orphaned-delete-' + ref(claim)"
                      [disabled]="removing() !== null"
                      (click)="askRemoveClaim(claim)"
                    >
                      <fl-icon name="lucideTrash2" [size]="14" />
                    </button>
                  </td>
                </tr>
                @if (pendingClaim() && ref(pendingClaim()!) === ref(claim)) {
                  <tr>
                    <td colspan="4" class="whitespace-normal">
                      <fl-alert
                        tone="error"
                        title="Delete this volume?"
                        [attr.data-testid]="'orphaned-confirm-' + ref(claim)"
                      >
                        Delete <span class="fl-mono">{{ ref(claim) }}</span> ({{ claim.sizeLabel }})
                        for good? Whatever is inside it goes with it, and nothing brings it back.
                        <ng-container alertActions>
                          <button
                            flButton="ghost"
                            size="sm"
                            type="button"
                            (click)="cancelRemoveClaim()"
                          >
                            Keep it
                          </button>
                          <button
                            flButton="danger"
                            size="sm"
                            type="button"
                            [attr.data-testid]="'orphaned-confirm-delete-' + ref(claim)"
                            [disabled]="removing() !== null"
                            (click)="confirmRemoveClaim(claim)"
                          >
                            @if (removing() === ref(claim)) {
                              <fl-spinner label="Deleting" />
                            }
                            {{ removing() === ref(claim) ? 'Deleting…' : 'Delete permanently' }}
                          </button>
                        </ng-container>
                      </fl-alert>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>
  `,
})
export class ClusterOrphanedVolumesComponent {
  private readonly orphaned = inject(ClusterOrphanedClaimsService);

  readonly clusterId = input<string | null>(null);

  readonly claims = this.orphaned.claims;
  readonly totalLabel = this.orphaned.totalLabel;
  readonly note = this.orphaned.note;
  readonly loading = this.orphaned.loading;
  readonly error = this.orphaned.error;
  readonly removing = this.orphaned.removing;
  readonly pendingClaim = signal<OrphanedClaim | null>(null);

  constructor() {
    effect(() => {
      const id = this.clusterId();
      if (id) void this.orphaned.load(id);
    });
  }

  async reload(): Promise<void> {
    const id = this.clusterId();
    if (id) await this.orphaned.load(id);
  }

  ref(claim: OrphanedClaim): string {
    return claimRef(claim);
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  }

  askRemoveClaim(claim: OrphanedClaim): void {
    this.pendingClaim.set(claim);
  }

  cancelRemoveClaim(): void {
    this.pendingClaim.set(null);
  }

  async confirmRemoveClaim(claim: OrphanedClaim): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    await this.orphaned.remove(id, claim);
    this.pendingClaim.set(null);
  }
}
