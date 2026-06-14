import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationResponseDto } from '../../../core/api/model/models';

@Component({
  selector: 'app-components-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (components().length > 0) {
      <section class="rounded-2xl border border-border bg-card p-6">
        <h2 class="mb-3 text-sm font-semibold text-foreground">
          Components
          <span class="ml-1 text-xs font-normal text-muted-foreground">({{ components().length }})</span>
        </h2>
        <div class="flex flex-col gap-1.5">
          @for (c of components(); track c.id) {
            <a
              [routerLink]="['/apps/applications', c.id]"
              class="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 transition-colors hover:bg-muted"
            >
              <span [class]="dotClass(c.status)" class="flex-shrink-0"></span>
              <div class="min-w-0 flex-1">
                <span class="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                  {{ role(c) }}
                  @if (c.id === primaryComponentId()) {
                    <span class="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-900/20 dark:text-sky-400">primary</span>
                  }
                </span>
                <span class="block truncate font-mono text-xs text-muted-foreground">{{ c.slug }}</span>
              </div>
              <span class="hidden flex-shrink-0 font-mono text-xs text-muted-foreground sm:block">{{ c.exposure }}</span>
              <span class="flex-shrink-0 text-xs capitalize text-muted-foreground">{{ c.status }}</span>
            </a>
          }
        </div>
      </section>
    }
  `,
})
export class AppComponentsListComponent {
  readonly components = input.required<ApplicationResponseDto[]>();
  readonly primaryComponentId = input<string | undefined>(undefined);

  role(c: ApplicationResponseDto): string {
    const labels = c.labels as Record<string, string> | undefined;
    return labels?.['flui.cloud/composed-component'] ?? c.name;
  }

  dotClass(status: string): string {
    const base = 'h-2.5 w-2.5 rounded-full';
    switch (status) {
      case 'running':
        return `${base} bg-green-500`;
      case 'provisioning':
      case 'updating':
      case 'awaiting_build':
        return `${base} bg-blue-500 animate-pulse`;
      case 'failed':
        return `${base} bg-red-500`;
      case 'degraded':
        return `${base} bg-orange-500`;
      case 'deleting':
        return `${base} bg-gray-400 animate-pulse`;
      case 'stopped':
      case 'deleted':
        return `${base} bg-gray-400`;
      default:
        return `${base} bg-yellow-500`;
    }
  }
}
