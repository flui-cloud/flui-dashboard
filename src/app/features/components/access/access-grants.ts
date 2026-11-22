import { Component, inject, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideTrash2 } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlTag } from '../../../ui/primitives/tag';
import { CanDirective } from '../../../core/directives/can.directive';
import { IamService } from '../../service/iam.service';
import { AccessBinding, GrantEnd, GrantRecord, formatWhen, grantEnd } from '../../model/iam.model';
import { GrantBuilderComponent } from './grant-builder.component';

@Component({
  selector: 'app-access-grants',
  imports: [
    FlAlert,
    FlPanel,
    FlEmptyState,
    FlTable,
    FlButton,
    FlIcon,
    FlTag,
    CanDirective,
    GrantBuilderComponent,
  ],
  providers: [provideIcons({ lucideTrash2 })],
  host: { class: 'fl-stack' },
  template: `
    <app-grant-builder *fluiCan="'iam:assign-role'" />
    @if (!canManage() && !readOnly()) {
      <fl-alert tone="info" title="Read only">
        You can see who has access here, but not change it.
      </fl-alert>
    }

    <fl-panel title="Grants made in Flui" [count]="iam.grants().length" [flush]="true">
      @if (identityProvider()) {
        <p class="border-b border-fl-border px-4 py-3 text-fl-body-sm text-fl-ink-muted">
          Only the grants conferred here. A role conferred in your identity provider also grants
          access and is not listed.
        </p>
      }
      @if (iam.grants().length) {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Who</th>
                <th scope="col">Role</th>
                <th scope="col">What</th>
                <th scope="col">Applies to</th>
                <th scope="col">Ends</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (g of iam.grants(); track g.id) {
                <tr [class.opacity-60]="endOf(g) === 'ended'" data-testid="grant-row">
                  <td class="whitespace-normal">
                    <div class="fl-cell-name flex flex-col gap-0.5">
                      <span>{{ iam.principalDisplay(g.binding.principal) }}</span>
                      @if (g.grantedBy) {
                        <span class="text-fl-caption text-fl-ink-muted"
                          >granted by {{ g.grantedBy }}</span
                        >
                      }
                    </div>
                  </td>
                  <td>
                    <fl-tag>{{ iam.roleName(g.binding.role) }}</fl-tag>
                  </td>
                  <td class="text-fl-ink-secondary">{{ scopeText()(g.binding) }}</td>
                  <td class="text-fl-ink-secondary">{{ appliesTo(g.binding) }}</td>
                  <td class="text-fl-ink-secondary" data-testid="grant-end">
                    @switch (endOf(g)) {
                      @case ('active') {
                        until {{ when(g.expiresAt) }}
                      }
                      @case ('ended') {
                        ended {{ when(g.expiresAt) }}
                      }
                    }
                  </td>
                  <td class="is-fit">
                    @if (iam.isRevocable(g.binding.role)) {
                      <button
                        *fluiCan="'iam:assign-role'"
                        flButton="ghost"
                        size="sm"
                        type="button"
                        [iconOnly]="true"
                        title="Remove grant"
                        [attr.aria-label]="
                          'Remove grant of ' + iam.principalDisplay(g.binding.principal)
                        "
                        (click)="remove.emit(g)"
                      >
                        <fl-icon name="lucideTrash2" [size]="14" />
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <fl-empty-state
          [compact]="true"
          title="No grants yet"
          body="A member reaches nothing until a grant names them or one of their groups."
        />
      }
    </fl-panel>
  `,
})
export class AccessGrantsComponent {
  protected readonly iam = inject(IamService);

  readonly identityProvider = input(false);
  readonly canManage = input(false);
  readonly readOnly = input(false);
  readonly scopeText = input.required<(b: AccessBinding) => string>();
  readonly remove = output<GrantRecord>();

  protected endOf(g: GrantRecord): GrantEnd {
    return grantEnd(g);
  }

  protected when(value: string | null | undefined): string {
    return value ? formatWhen(value) : '';
  }

  protected appliesTo(b: AccessBinding): string {
    if (b.scope.type === 'section') return 'portal section';
    const n = this.iam.matchApps(b.scope).length;
    return `${n} app${n === 1 ? '' : 's'}`;
  }
}
