import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideExternalLink, lucideX } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { ChatActionRequest, PendingAction } from '../../service/assistant.service';

interface ActionGroup {
  label: string;
  tier: 'write' | 'destructive';
  toolCallIds: string[];
  args: Record<string, unknown>;
  requests: ChatActionRequest[];
}

@Component({
  selector: 'app-assistant-confirm-card',
  imports: [FlAlert, FlButton, FlIcon],
  providers: [provideIcons({ lucideCheck, lucideExternalLink, lucideX })],
  host: { class: 'block' },
  template: `
    <fl-alert
      [tone]="isDestructive() ? 'error' : 'warning'"
      [title]="isDestructive() ? 'Destructive action, confirm carefully' : 'Confirm action'"
    >
      <div class="mt-1 flex flex-col gap-3">
        @for (group of groups(); track group.toolCallIds[0]) {
          <div class="flex flex-col gap-2">
            <div class="fl-row">
              <span class="font-medium text-fl-ink">{{ group.label }}</span>
              <span class="text-fl-caption text-fl-ink-muted">
                {{ group.tier === 'destructive' ? 'Destructive' : 'Write'
                }}{{
                  group.toolCallIds.length > 1
                    ? ', ' + group.toolCallIds.length + ' components'
                    : ''
                }}
              </span>
            </div>

            @if (group.toolCallIds.length === 1 && argEntries(group.args).length > 0) {
              <dl
                class="flex flex-col gap-0.5 rounded-fl-md border border-fl-border-subtle bg-fl-surface px-3 py-2 font-mono text-fl-mono-sm"
              >
                @for (entry of argEntries(group.args); track entry[0]) {
                  <div class="flex gap-2">
                    <dt class="shrink-0 text-fl-ink-muted">{{ entry[0] }}:</dt>
                    <dd class="break-all text-fl-ink">{{ entry[1] }}</dd>
                  </div>
                }
              </dl>
            }

            @for (request of group.requests; track request) {
              <div
                class="flex flex-col gap-1.5 rounded-fl-md border border-fl-border bg-fl-surface px-3 py-2"
                data-testid="cycle-request"
              >
                <span class="text-fl-caption font-semibold text-fl-ink-secondary">
                  Approving here answers this request
                </span>
                <p class="text-fl-ink" data-testid="cycle-sentence">{{ request.sentence }}</p>
                @if (request.estimateNote) {
                  <p class="text-fl-caption text-fl-ink-secondary" data-testid="cycle-estimate">
                    {{ request.estimateNote }}
                  </p>
                }
                @if (request.decideUrl) {
                  <a
                    class="fl-link inline-flex items-center gap-1 text-fl-caption"
                    [href]="request.decideUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="cycle-decide-url"
                  >
                    <fl-icon name="lucideExternalLink" [size]="13" />
                    Open it on the requests page
                  </a>
                }
              </div>
            }
          </div>
        }
      </div>
      <ng-container alertActions>
        <button flButton="ghost" size="sm" type="button" (click)="deny()">
          <fl-icon name="lucideX" />
          Deny
        </button>
        <button
          [flButton]="isDestructive() ? 'danger' : 'primary'"
          size="sm"
          type="button"
          (click)="approve()"
        >
          <fl-icon name="lucideCheck" />
          {{ isDestructive() ? 'Confirm delete' : 'Approve' }}
        </button>
      </ng-container>
    </fl-alert>
  `,
})
export class AssistantConfirmCardComponent {
  readonly pending = input.required<PendingAction[]>();
  readonly decided = output<string[]>();

  protected readonly groups = computed<ActionGroup[]>(() => {
    const map = new Map<string, ActionGroup>();
    for (const action of this.pending()) {
      const key = action.groupKey ?? action.toolCallId;
      const existing = map.get(key);
      if (existing) {
        existing.toolCallIds.push(action.toolCallId);
        if (action.request) existing.requests.push(action.request);
      } else {
        map.set(key, {
          label: action.label ?? this.fallbackLabel(action.name, action.arguments),
          tier: action.tier,
          toolCallIds: [action.toolCallId],
          args: action.arguments,
          requests: action.request ? [action.request] : [],
        });
      }
    }
    return [...map.values()];
  });

  protected readonly isDestructive = computed(() =>
    this.pending().some((a) => a.tier === 'destructive'),
  );

  protected approve(): void {
    this.decided.emit(this.pending().map((a) => a.toolCallId));
  }

  protected deny(): void {
    this.decided.emit([]);
  }

  private fallbackLabel(name: string, args: Record<string, unknown>): string {
    const id = args['id'] ?? args['appId'] ?? args['name'];
    const suffix = typeof id === 'string' || typeof id === 'number' ? ` "${id}"` : '';
    switch (name) {
      case 'app_deploy':
        return `Redeploy application${suffix}`;
      case 'app_delete':
        return `Delete application${suffix}`;
      default:
        return name.replaceAll('_', ' ');
    }
  }

  protected argEntries(args: Record<string, unknown>): [string, string][] {
    return Object.entries(args).map(([k, v]) => [
      k,
      typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v),
    ]);
  }
}
