import { Component, computed, input, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronRight, lucideLock } from '@ng-icons/lucide';
import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlStatus } from '../../../../ui/primitives/status';
import { AgentKeyDepthChoice } from './agent-key-depth-choice';

@Component({
  selector: 'app-agent-key-area-row',
  imports: [FlIcon, FlStatus, AgentKeyDepthChoice],
  providers: [provideIcons({ lucideChevronDown, lucideChevronRight, lucideLock })],
  host: { class: 'flex flex-col gap-2 py-3' },
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="m-0 text-fl-body-sm font-medium">{{ label() }}</p>
        <p class="m-0 text-fl-caption text-fl-ink-muted">{{ chosenLabel() }}</p>
      </div>
      <app-agent-key-depth-choice
        [label]="label()"
        [groups]="groups()"
        [picked]="picked()"
        [disabled]="disabled()"
        testIdPrefix="check-"
        (choose)="choose.emit($event)"
      />
    </div>
    <button
      type="button"
      class="fl-link inline-flex items-center gap-1 self-start text-fl-caption"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="'Details for ' + label()"
      (click)="open.set(!open())"
    >
      <fl-icon [name]="open() ? 'lucideChevronDown' : 'lucideChevronRight'" [size]="13" />
      Details
    </button>
    <div class="flex flex-col gap-3" [class.hidden]="!open()">
      @for (g of groups(); track g.key) {
        <div
          class="flex flex-col gap-1"
          [attr.data-testid]="'group-' + g.key"
          [attr.data-grantable]="g.grantable"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-fl-body-sm font-medium" [class.fl-muted]="!g.grantable">{{
              g.label
            }}</span>
            @if (!g.grantable) {
              <fl-status tone="neutral" label="Not yours to grant" />
            }
          </div>
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">{{ g.summary }}</p>
          @if (!g.grantable) {
            <p
              class="m-0 text-fl-caption text-fl-ink-muted"
              [attr.data-testid]="'blocked-' + g.key"
            >
              A key is never worth more than the person who issued it, and this one would be: your
              own permissions do not cover
              <span class="fl-mono">{{ g.blockedScopes.join(' · ') }}</span>.
            </p>
          }
          <p class="m-0 fl-mono fl-muted break-all">{{ g.scopes.join(' · ') }}</p>
        </div>
      }
    </div>
  `,
})
export class AgentKeyAreaRow {
  readonly label = input.required<string>();
  readonly groups = input.required<PermissionGroupDto[]>();
  readonly picked = input.required<ReadonlySet<string>>();
  readonly disabled = input(false);
  readonly choose = output<string | null>();

  protected readonly open = signal(false);
  protected readonly chosenLabel = computed(() => {
    const picked = this.picked();
    return this.groups().find((g) => picked.has(g.key))?.label ?? 'Nothing in this area';
  });
}
