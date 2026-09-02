
import { Component, effect, inject, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideLoader, lucideTrash2 } from '@ng-icons/lucide';

import { CanDirective } from '../../../core/directives/can.directive';
import {
  ClusterOrphanedClaimsService,
  OrphanedClaim,
  claimRef,
} from '../../service/cluster-orphaned-claims.service';

@Component({
  selector: 'cluster-orphaned-volumes',
  standalone: true,
  imports: [NgIconComponent, CanDirective],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideLoader,
      lucideTrash2,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="card-inner p-4" data-testid="orphaned-volumes">
      <div class="flex items-start justify-between gap-4">
        <div>
          <span class="text-label flex items-center gap-2">
            <ng-icon name="lucideCircleAlert" class="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Volumes with no application
          </span>
          <p class="text-xs text-muted-foreground mt-1 max-w-2xl">
            Storage left behind by applications that were removed before Flui took the volume with them.
            It still costs what it costs. A volume is only listed here when no pod mounts it, no StatefulSet
            could have made it, and no existing application owns it.
          </p>
        </div>
        @if (claims().length > 0) {
          <span class="text-sm font-medium whitespace-nowrap" data-testid="orphaned-total">
            {{ totalLabel() }} held
          </span>
        }
      </div>

      @if (loading() && claims().length === 0) {
        <div class="flex items-center gap-2 text-sm text-muted-foreground py-3" data-testid="orphaned-loading">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Looking for volumes with no application…
        </div>
      } @else if (error()) {
        <p class="text-sm text-red-700 dark:text-red-300 mt-3" data-testid="orphaned-error">{{ error() }}</p>
      } @else if (note()) {
        <p class="text-sm text-amber-700 dark:text-amber-300 mt-3" data-testid="orphaned-note">
          {{ note() }}
        </p>
      } @else if (claims().length === 0) {
        <p class="text-sm text-muted-foreground mt-3" data-testid="orphaned-empty">
          Nothing abandoned by these rules. A plain unlabelled volume from a third-party chart is never
          listed, so this is “none found”, not “none exist”.
        </p>
      } @else {
        <div class="overflow-x-auto mt-3">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-muted-foreground border-b border-border">
                <th class="py-2 font-normal">Volume</th>
                <th class="py-2 font-normal">Left by</th>
                <th class="py-2 font-normal text-right">Size</th>
                <th class="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              @for (claim of claims(); track ref(claim)) {
                <tr class="border-b border-border/50 last:border-0" [attr.data-testid]="'orphaned-row-' + ref(claim)">
                  <td class="py-2">
                    <div class="font-mono text-xs">{{ claim.name }}</div>
                    <div class="text-[11px] text-muted-foreground font-mono">{{ claim.namespace }}</div>
                  </td>
                  <td class="py-2">
                    @if (claim.lastKnownApplication; as app) {
                      <span class="text-foreground">{{ app.name }}</span>
                      <span class="text-[11px] text-muted-foreground block">
                        deleted{{ app.deletedAt ? ' ' + formatDate(app.deletedAt) : '' }}
                      </span>
                    } @else {
                      <span class="text-muted-foreground">{{ claim.reason }}</span>
                    }
                  </td>
                  <td class="py-2 text-right font-medium">{{ claim.sizeLabel }}</td>
                  <td class="py-2 text-right">
                    <button *fluiCan="'cluster:manage'" type="button"
                      [attr.data-testid]="'orphaned-delete-' + ref(claim)"
                      [disabled]="removing() !== null"
                      (click)="askRemoveClaim(claim)"
                      class="text-muted-foreground hover:text-destructive disabled:opacity-40"
                      title="Delete this volume permanently">
                      <ng-icon name="lucideTrash2" class="h-4 w-4" />
                    </button>
                  </td>
                </tr>
                @if (pendingClaim() && ref(pendingClaim()!) === ref(claim)) {
                  <tr class="border-b border-border/50">
                    <td colspan="4" class="py-3">
                      <div class="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3"
                        [attr.data-testid]="'orphaned-confirm-' + ref(claim)">
                        <p class="text-sm text-red-900 dark:text-red-200">
                          Delete <span class="font-mono">{{ ref(claim) }}</span> ({{ claim.sizeLabel }}) for good?
                          Whatever is inside it goes with it, and nothing brings it back.
                        </p>
                        <div class="flex items-center gap-2 mt-3">
                          <button type="button" (click)="cancelRemoveClaim()"
                            class="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted">
                            Keep it
                          </button>
                          <button type="button"
                            [attr.data-testid]="'orphaned-confirm-delete-' + ref(claim)"
                            [disabled]="removing() !== null"
                            (click)="confirmRemoveClaim(claim)"
                            class="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                            {{ removing() === ref(claim) ? 'Deleting…' : 'Delete permanently' }}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </div>
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
