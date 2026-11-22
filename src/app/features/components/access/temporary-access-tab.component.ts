import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronRight, lucideCirclePlus } from '@ng-icons/lucide';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlTag } from '../../../ui/primitives/tag';
import { IamService } from '../../service/iam.service';
import { AuditService } from '../../service/audit.service';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { CanDirective } from '../../../core/directives/can.directive';
import { GrantBuilderComponent } from './grant-builder.component';
import { AuditEventListComponent } from './audit-event-list.component';
import {
  AccessBinding,
  GrantRecord,
  PLATFORM_OPERATOR_ROLE,
  formatWhen,
  temporaryGrants,
  timeLeft,
} from '../../model/iam.model';
import { AuditEvent } from '../../model/audit.model';

interface ActivityState {
  loading: boolean;
  error: boolean;
  events: AuditEvent[];
}

@Component({
  selector: 'app-temporary-access-tab',
  imports: [
    NgTemplateOutlet,
    FlPanel,
    FlEmptyState,
    FlLoadingState,
    FlTable,
    FlButton,
    FlIcon,
    FlTag,
    CanDirective,
    GrantBuilderComponent,
    AuditEventListComponent,
  ],
  providers: [provideIcons({ lucideChevronDown, lucideChevronRight, lucideCirclePlus })],
  host: { class: 'fl-stack' },
  template: `
    @if (showBuilder()) {
      <app-grant-builder
        *fluiCan="'iam:assign-role'"
        [presetRole]="platformOperator"
        presetDuration="1d"
      />
    }

    <fl-panel title="Active" [count]="split().active.length" [flush]="true">
      @if (split().active.length && !showBuilder()) {
        <button
          *fluiCan="'iam:assign-role'"
          panelActions
          flButton
          size="sm"
          type="button"
          (click)="showBuilder.set(true)"
        >
          <fl-icon name="lucideCirclePlus" [size]="14" />
          Give temporary access
        </button>
      }
      @if (split().active.length) {
        <ng-container
          *ngTemplateOutlet="table; context: { $implicit: split().active, ended: false }"
        />
      } @else {
        <fl-empty-state
          [compact]="true"
          title="Nobody has temporary access right now."
          body="A temporary grant ends on its own, so nobody has to remember to take it back."
          data-testid="temporary-empty"
        >
          @if (!showBuilder()) {
            <button
              *fluiCan="'iam:assign-role'"
              flButton="primary"
              size="sm"
              type="button"
              (click)="showBuilder.set(true)"
            >
              <fl-icon name="lucideCirclePlus" [size]="14" />
              Give temporary access
            </button>
          }
        </fl-empty-state>
      }
    </fl-panel>

    @if (split().ended.length) {
      <fl-panel [flush]="true">
        <div class="px-4 py-3">
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [attr.aria-expanded]="showEnded()"
            (click)="showEnded.set(!showEnded())"
          >
            Ended ({{ split().ended.length }})
            <fl-icon
              [name]="showEnded() ? 'lucideChevronDown' : 'lucideChevronRight'"
              [size]="14"
            />
          </button>
        </div>
        @if (showEnded()) {
          <div class="border-t border-fl-border">
            <ng-container
              *ngTemplateOutlet="table; context: { $implicit: split().ended, ended: true }"
            />
          </div>
        }
      </fl-panel>
    }

    <ng-template #table let-grants let-ended="ended">
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col" class="is-fit"><span class="fl-sr">Activity</span></th>
              <th scope="col">Who</th>
              <th scope="col">Role</th>
              <th scope="col">What</th>
              <th scope="col">Ends</th>
              <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
            </tr>
          </thead>
          @for (g of asGrants(grants); track g.id) {
            <tbody
              class="border-t border-fl-border-subtle"
              [class.opacity-60]="ended"
              data-testid="temporary-row"
            >
              <tr>
                <td class="is-fit">
                  @if (g.binding.principal.type === 'user') {
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      [iconOnly]="true"
                      [attr.aria-expanded]="expanded().has(g.id)"
                      [attr.aria-label]="
                        'Recent activity of ' + iam.principalDisplay(g.binding.principal)
                      "
                      (click)="toggle(g)"
                    >
                      <fl-icon
                        [name]="expanded().has(g.id) ? 'lucideChevronDown' : 'lucideChevronRight'"
                        [size]="14"
                      />
                    </button>
                  }
                </td>
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
                <td class="text-fl-ink-secondary">
                  @if (ended) {
                    ended {{ when(g.expiresAt) }}
                  } @else {
                    ends in {{ left(g.expiresAt) }} · {{ when(g.expiresAt) }}
                  }
                </td>
                <td class="is-fit">
                  @if (!ended && iam.isRevocable(g.binding.role)) {
                    <button
                      *fluiCan="'iam:assign-role'"
                      flButton="ghost"
                      size="sm"
                      type="button"
                      (click)="revoke.emit(g)"
                    >
                      Revoke
                    </button>
                  }
                </td>
              </tr>
              @if (expanded().has(g.id)) {
                <tr>
                  <td colspan="6" class="whitespace-normal bg-fl-surface-subtle">
                    @let state = activity()[g.id];
                    @if (!state || state.loading) {
                      <fl-loading-state [rows]="2" />
                    } @else if (state.error) {
                      <p class="text-fl-body-sm text-fl-ink-muted">Activity could not be read.</p>
                    } @else {
                      <app-audit-event-list
                        [events]="state.events"
                        [showWho]="false"
                        emptyText="No recorded activity."
                      />
                    }
                  </td>
                </tr>
              }
            </tbody>
          }
        </table>
      </div>
    </ng-template>
  `,
})
export class TemporaryAccessTabComponent {
  protected readonly iam = inject(IamService);
  private readonly audit = inject(AuditService);
  private readonly maskMode = inject(MaskModeService);

  readonly scopeText = input.required<(b: AccessBinding) => string>();
  readonly revoke = output<GrantRecord>();

  protected readonly platformOperator = PLATFORM_OPERATOR_ROLE;

  readonly showBuilder = signal(false);
  readonly showEnded = signal(false);
  readonly expanded = signal<Set<string>>(new Set());
  readonly activity = signal<Record<string, ActivityState>>({});

  readonly split = computed(() => temporaryGrants(this.iam.grants()));

  constructor() {
    let first = true;
    effect(() => {
      this.maskMode.enabled();
      if (first) {
        first = false;
        return;
      }
      this.expanded.set(new Set());
      this.activity.set({});
    });
  }

  when(value: string | null | undefined): string {
    return value ? formatWhen(value) : '';
  }

  protected asGrants(value: unknown): GrantRecord[] {
    return value as GrantRecord[];
  }

  left(value: string | null | undefined): string {
    return value ? timeLeft(value) : '';
  }

  toggle(g: GrantRecord): void {
    const open = new Set(this.expanded());
    if (open.has(g.id)) {
      open.delete(g.id);
      this.expanded.set(open);
      return;
    }
    open.add(g.id);
    this.expanded.set(open);
    this.loadActivity(g);
  }

  private loadActivity(g: GrantRecord): void {
    const id = g.id;
    this.activity.update((a) => ({
      ...a,
      [id]: { loading: true, error: false, events: [] },
    }));
    this.audit.list({ email: g.binding.principal.ref, limit: 20 }).subscribe({
      next: (events) =>
        this.activity.update((a) => ({
          ...a,
          [id]: { loading: false, error: false, events },
        })),
      error: () =>
        this.activity.update((a) => ({
          ...a,
          [id]: { loading: false, error: true, events: [] },
        })),
    });
  }
}
