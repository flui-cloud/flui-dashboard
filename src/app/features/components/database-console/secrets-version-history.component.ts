import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideClock, lucideUndo2 } from '@ng-icons/lucide';
import { SecretRead } from '../../model/secrets-console.models';
import { SecretsConsoleStateService } from './secrets-console-state.service';

@Component({
  selector: 'app-secrets-version-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ lucideClock, lucideUndo2 })],
  template: `
    @if (!s.isNew() && s.selected(); as sec) {
      @if (sec.versions.length) {
        <div class="border-t border-border px-4 py-3">
          <div
            class="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <ng-icon name="lucideClock" class="h-3.5 w-3.5" /> Version history
          </div>
          <div class="space-y-1">
            @for (v of reversed(sec.versions); track v.version) {
              <div
                class="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/50"
              >
                <button
                  type="button"
                  (click)="s.changeVersion(v.version)"
                  class="font-mono"
                  [class.font-semibold]="s.viewVersion() === v.version"
                  [class.text-foreground]="s.viewVersion() === v.version"
                  [class.text-muted-foreground]="s.viewVersion() !== v.version"
                >
                  v{{ v.version }}
                </button>
                <span class="truncate text-muted-foreground">{{
                  v.createdTime
                }}</span>
                @if (v.destroyed) {
                  <span class="text-destructive">destroyed</span>
                } @else if (v.deleted) {
                  <span class="text-amber-600">deleted</span>
                  <button
                    type="button"
                    (click)="s.undelete(v.version)"
                    [disabled]="s.readOnly()"
                    class="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <ng-icon name="lucideUndo2" class="h-3.5 w-3.5" />
                    Undelete
                  </button>
                }
              </div>
            }
          </div>
        </div>
      }
    }
  `,
})
export class SecretsVersionHistoryComponent {
  protected readonly s = inject(SecretsConsoleStateService);

  reversed(versions: SecretRead['versions']): SecretRead['versions'] {
    return [...versions].reverse();
  }
}
