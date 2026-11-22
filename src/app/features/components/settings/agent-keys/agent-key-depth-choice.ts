import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideLock } from '@ng-icons/lucide';
import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';
import { FlIcon } from '../../../../ui/primitives/icon';
import { DEPTH_WORD } from './agent-key-scopes-edit';

@Component({
  selector: 'app-agent-key-depth-choice',
  imports: [FlIcon],
  providers: [provideIcons({ lucideLock })],
  host: { class: 'fl-segmented', role: 'group', '[attr.aria-label]': 'label()' },
  template: `
    <button
      type="button"
      [attr.aria-pressed]="!chosen()"
      [disabled]="disabled()"
      (click)="choose.emit(null)"
    >
      None
    </button>
    @for (g of groups(); track g.key) {
      <button
        type="button"
        class="inline-flex items-center gap-1"
        [attr.data-testid]="testIdPrefix() + g.key"
        [attr.aria-pressed]="picked().has(g.key)"
        [disabled]="!g.grantable || disabled()"
        [title]="g.grantable ? (hint() === 'summary' ? g.summary : g.label) : 'Not yours to grant'"
        (click)="choose.emit(g.key)"
      >
        @if (!g.grantable) {
          <fl-icon name="lucideLock" [size]="13" />
        }
        {{ depthWord(g.depth) }}
      </button>
    }
  `,
})
export class AgentKeyDepthChoice {
  readonly label = input.required<string>();
  readonly groups = input.required<PermissionGroupDto[]>();
  readonly picked = input.required<ReadonlySet<string>>();
  readonly disabled = input(false);
  readonly testIdPrefix = input.required<string>();
  readonly hint = input<'label' | 'summary'>('label');
  readonly choose = output<string | null>();

  protected readonly chosen = computed(() => {
    const picked = this.picked();
    return this.groups().some((g) => picked.has(g.key));
  });

  protected depthWord(depth: string): string {
    return DEPTH_WORD[depth] ?? depth;
  }
}
