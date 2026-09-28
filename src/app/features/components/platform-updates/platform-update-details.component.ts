import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo, lucideTriangleAlert } from '@ng-icons/lucide';
import {
  PlatformComponentUpdate,
  PlatformUpdateStatus,
} from '../../service/platform-update.service';

@Component({
  selector: 'app-platform-update-details',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideInfo, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div
      class="grid grid-cols-[180px_1fr_220px_110px] gap-3 border-t border-border bg-muted px-5 py-2 text-label"
    >
      <div>Component</div>
      <div>Role</div>
      <div>Version</div>
      <div>Change</div>
    </div>
    @for (component of status().components; track component.key) {
      <div
        class="grid grid-cols-[180px_1fr_220px_110px] items-center gap-3 border-t border-border px-5 py-3"
        [class.opacity-60]="!component.changed || !component.installed"
      >
        <div class="font-mono text-sm font-medium">
          {{ component.deploymentName }}
        </div>
        <div class="text-xs text-muted-foreground">
          {{ component.role }}
          @if (component.restartsControlPlane) {
            · restarts once
          }
        </div>
        <div class="font-mono text-xs">
          @if (!component.installed) {
            <span class="font-sans text-muted-foreground">Not installed</span>
          } @else {
            @if (component.changed) {
              <span class="text-muted-foreground">{{
                component.installedVersion
              }}</span>
              <span class="mx-1.5 text-muted-foreground/50">&rarr;</span>
            }
            <span class="font-semibold">{{
              component.targetVersion ?? component.installedVersion ?? '—'
            }}</span>
            @if (!component.installedIsRelease && !component.changed) {
              <span
                class="ml-1.5 font-sans text-[11px] text-amber-600 dark:text-amber-400"
                >build</span
              >
            }
            @if (!component.observed) {
              <span class="ml-1.5 font-sans text-[11px] text-muted-foreground"
                >pinned, not read from the cluster</span
              >
            }
          }
        </div>
        <div>
          <span
            class="badge"
            [class]="
              component.changed
                ? 'bg-primary/10 text-primary'
                : 'badge-in-progress'
            "
          >
            {{ changeLabel(component, status().availableVersion) }}
          </span>
        </div>
      </div>
    }

    @if (status().advisories.length > 0) {
      <div class="grid gap-3 border-t border-border p-5 sm:grid-cols-2">
        @for (advisory of status().advisories; track advisory.title) {
          <div class="flex items-start gap-2.5">
            <ng-icon
              [name]="
                advisory.level === 'info' ? 'lucideInfo' : 'lucideTriangleAlert'
              "
              class="mt-0.5 h-4 w-4 shrink-0"
              [class]="
                advisory.level === 'blocker'
                  ? 'text-destructive'
                  : 'text-amber-600 dark:text-amber-400'
              "
            />
            <div>
              <p class="text-sm">{{ advisory.title }}</p>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ advisory.detail }}
              </p>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class PlatformUpdateDetailsComponent {
  readonly status = input.required<PlatformUpdateStatus>();

  /** "Unchanged" is a comparison; without a release there was none to make. */
  protected changeLabel(
    component: PlatformComponentUpdate,
    availableVersion: string | null,
  ): string {
    if (!component.installed) return 'Absent';
    if (!availableVersion) return 'Not compared';
    return component.changed ? 'Will update' : 'Unchanged';
  }
}
