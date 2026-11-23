import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideArrowRight } from '@ng-icons/lucide';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { PathHop, requestPath } from './topology-drills';
import { checkTone } from './topology-kit';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';

/** The way in to an app, hop by hop, each with what Flui can check about it. */
@Component({
  selector: 'app-topology-request-path',
  imports: [NgTemplateOutlet, FlPanel, FlEmptyState, FlButton, FlIcon, FlStatus],
  providers: [provideIcons({ lucideArrowLeft, lucideArrowRight })],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel [title]="path() ? 'Request path · ' + path()!.app.displayName : 'Request path'">
      <button panelActions flButton="ghost" size="sm" type="button" (click)="back.emit()">
        <fl-icon name="lucideArrowLeft" />
        Map
      </button>
      @if (path(); as p) {
        <div class="flex flex-col gap-4">
          @if (p.hosts.length) {
            <p class="fl-mono text-fl-ink">{{ p.hosts.join(' · ') }}</p>
          }
          <ol class="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            @for (hop of p.hops; track hop.step) {
              <li class="flex flex-1 items-center gap-3">
                <ng-container *ngTemplateOutlet="card; context: { $implicit: hop }" />
                <fl-icon
                  class="hidden flex-none text-fl-ink-muted lg:block"
                  name="lucideArrowRight"
                />
              </li>
            }
            <li class="flex flex-1 flex-col gap-2">
              @for (hop of p.data; track hop.title) {
                <ng-container *ngTemplateOutlet="card; context: { $implicit: hop }" />
              } @empty {
                <p
                  class="rounded-fl-md border border-dashed border-fl-border p-3 text-fl-body-sm text-fl-ink-muted"
                >
                  Talks to no other app Flui knows of.
                </p>
              }
            </li>
          </ol>
          <p class="text-fl-caption text-fl-ink-muted">
            Name resolution and 24 hour traffic are not part of this view yet.
          </p>
        </div>
      } @else {
        <fl-empty-state [compact]="true" title="This app is not in the map any more" />
      }
    </fl-panel>

    <ng-template #card let-hop>
      <div
        class="flex min-h-32 w-full min-w-0 flex-col gap-1 rounded-fl-md border border-fl-border bg-fl-surface p-3"
      >
        @if (hop.step) {
          <span class="text-fl-caption text-fl-ink-muted">{{ hop.step }}</span>
        }
        <span class="text-fl-body-sm font-semibold text-fl-ink">{{ hop.title }}</span>
        @for (line of hop.lines; track $index) {
          <span class="truncate font-mono text-fl-caption text-fl-ink-muted">{{ line }}</span>
        }
        <fl-status class="mt-auto" [tone]="toneOf(hop)" [label]="hop.checkText" />
      </div>
    </ng-template>
  `,
})
export class TopologyRequestPathComponent {
  readonly snapshot = input.required<TopologyResponseDto>();
  readonly appId = input.required<string>();
  readonly back = output<void>();

  protected readonly path = computed(() => requestPath(this.snapshot(), this.appId()));

  protected toneOf(hop: PathHop) {
    return checkTone(hop.check);
  }
}
