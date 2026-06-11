import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideAlertTriangle, lucideCheck, lucideX } from '@ng-icons/lucide';
import { PendingAction } from '../../service/assistant.service';

interface ActionGroup {
  label: string;
  tier: 'write' | 'destructive';
  toolCallIds: string[];
  args: Record<string, unknown>;
}

@Component({
  selector: 'app-assistant-confirm-card',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideAlertTriangle, lucideCheck, lucideX })],
  template: `
    <div class="mx-4 mb-3 rounded-xl border overflow-hidden text-sm"
      [class]="isDestructive()
        ? 'border-destructive/30 bg-destructive/5'
        : 'border-amber-500/30 bg-amber-500/5'">

      <div class="flex items-center gap-2 px-3 py-2 border-b"
        [class]="isDestructive()
          ? 'border-destructive/20 bg-destructive/10'
          : 'border-amber-500/20 bg-amber-500/10'">
        <ng-icon name="lucideAlertTriangle" class="h-3.5 w-3.5 shrink-0"
          [class]="isDestructive() ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'" />
        <p class="text-xs font-semibold"
          [class]="isDestructive() ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'">
          {{ isDestructive() ? 'Destructive action — confirm carefully' : 'Confirm action' }}
        </p>
      </div>

      <div class="p-3 space-y-3">
        @for (group of groups(); track group.toolCallIds[0]) {
          <div class="space-y-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                [class]="group.tier === 'destructive'
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'">
                {{ group.tier }}
              </span>
              <span class="font-medium text-foreground text-xs">{{ group.label }}</span>
              @if (group.toolCallIds.length > 1) {
                <span class="text-[10px] text-muted-foreground">({{ group.toolCallIds.length }} components)</span>
              }
            </div>

            @if (group.toolCallIds.length === 1 && argEntries(group.args).length > 0) {
              <div class="rounded-lg bg-muted/60 px-3 py-2 font-mono text-[11px] space-y-0.5">
                @for (entry of argEntries(group.args); track entry[0]) {
                  <div class="flex gap-2">
                    <span class="text-muted-foreground shrink-0">{{ entry[0] }}:</span>
                    <span class="text-foreground break-all">{{ entry[1] }}</span>
                  </div>
                }
              </div>
            }
          </div>
        }

        <div class="flex gap-2 pt-1">
          <button type="button" (click)="deny()"
            class="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
            <ng-icon name="lucideX" class="h-3 w-3" />
            Deny
          </button>
          <button type="button" (click)="approve()"
            class="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            [class]="isDestructive()
              ? 'bg-destructive shadow-sm shadow-destructive/30'
              : 'bg-gradient-to-r from-blue-500 to-blue-700 shadow-sm shadow-blue-500/30'">
            <ng-icon name="lucideCheck" class="h-3 w-3" />
            {{ isDestructive() ? 'Confirm delete' : 'Approve' }}
          </button>
        </div>
      </div>
    </div>
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
      } else {
        map.set(key, {
          label: action.label ?? this.fallbackLabel(action.name, action.arguments),
          tier: action.tier,
          toolCallIds: [action.toolCallId],
          args: action.arguments,
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
      case 'app_deploy': return `Redeploy application${suffix}`;
      case 'app_delete': return `Delete application${suffix}`;
      default: return name.replaceAll('_', ' ');
    }
  }

  protected argEntries(args: Record<string, unknown>): [string, string][] {
    return Object.entries(args).map(([k, v]) => [
      k,
      typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v),
    ]);
  }
}
