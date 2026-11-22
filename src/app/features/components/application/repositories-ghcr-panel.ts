import { Component, computed, input, output } from '@angular/core';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import { PackagesPatStatus } from '../../../core/services/github-app-oauth.service';
import { GhcrPatModalMode } from './ghcr-pat-modal.component';
import { formatDay, patStatusLabel, patStatusTone } from './repositories-format';

@Component({
  selector: 'app-repositories-ghcr-panel',
  imports: [FlPanel, FlKeyValue, FlKvItem, FlLoadingState, FlButton, FlStatus],
  template: `
    <fl-panel title="GHCR registry token">
      <ng-container panelActions>
        @if (pat(); as p) {
          @if (p.configured) {
            <button flButton size="sm" type="button" (click)="edit.emit('update-expiry')">
              Update expiry
            </button>
            <button flButton size="sm" type="button" (click)="edit.emit('rotate')">Rotate</button>
            <button flButton size="sm" type="button" (click)="remove.emit()">Remove</button>
          } @else {
            <button flButton size="sm" type="button" (click)="edit.emit('create')">
              Add token
            </button>
          }
        }
      </ng-container>

      @if (pat(); as p) {
        <fl-key-value>
          <fl-kv-item key="Status">
            <fl-status [tone]="tone()" [label]="label()" />
          </fl-kv-item>
          @if (p.configured) {
            <fl-kv-item key="Expires">
              @if (p.expiresAt) {
                {{ day(p.expiresAt) }}
                @if (p.daysUntilExpiry != null && p.daysUntilExpiry >= 0) {
                  <span class="text-fl-ink-muted">(in {{ p.daysUntilExpiry }}d)</span>
                }
              } @else {
                Not set
              }
            </fl-kv-item>
          } @else {
            <fl-kv-item key="Used for">Pulling private container images from GHCR</fl-kv-item>
          }
        </fl-key-value>
      } @else {
        <fl-loading-state [rows]="1" />
      }
    </fl-panel>
  `,
})
export class RepositoriesGhcrPanel {
  readonly pat = input<PackagesPatStatus | null>(null);
  readonly edit = output<GhcrPatModalMode>();
  readonly remove = output<void>();

  protected readonly label = computed(() => patStatusLabel(this.pat()));
  protected readonly tone = computed(() => patStatusTone(this.pat()));
  protected readonly day = formatDay;
}
