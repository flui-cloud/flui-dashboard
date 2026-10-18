import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { HopCheck, PathHop, requestPath } from './topology-drills';

const CHECK: Record<HopCheck, { color: string; mark: string }> = {
  ok: { color: 'hsl(var(--ok))', mark: '✓' },
  warn: { color: 'hsl(var(--warn))', mark: '!' },
  fail: { color: 'hsl(var(--destructive))', mark: '✕' },
};

/** The way in to an app, hop by hop, each with what Flui can check about it. */
@Component({
  selector: 'app-topology-request-path',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card-surface space-y-4 p-4" aria-label="Request path">
      <header class="space-y-1">
        <button type="button" class="text-sub hover:underline" (click)="back.emit()">← Map</button>
        @if (path(); as p) {
          <h2 class="flex flex-wrap items-center gap-2 text-base font-semibold text-foreground">
            Request path · {{ p.app.displayName }}
          </h2>
          @if (p.hosts.length) {
            <p class="font-mono text-sm text-foreground">{{ p.hosts.join(' · ') }}</p>
          }
        }
      </header>
      @if (path(); as p) {
        <ol class="flex flex-col gap-3 lg:flex-row lg:items-stretch">
          @for (hop of p.hops; track hop.step; let last = $last) {
            <li class="flex flex-1 items-center gap-3">
              <ng-container *ngTemplateOutlet="card; context: { $implicit: hop }" />
              <span class="hidden text-muted-foreground lg:block" aria-hidden="true">→</span>
            </li>
          }
          <li class="flex flex-1 flex-col gap-2">
            @for (hop of p.data; track hop.title) {
              <ng-container *ngTemplateOutlet="card; context: { $implicit: hop }" />
            } @empty {
              <p class="text-sub rounded-lg border border-dashed border-border p-3">Talks to no other app Flui knows of.</p>
            }
          </li>
        </ol>
        <p class="text-sub">Name resolution and 24 hour traffic are not part of this view yet.</p>
      } @else {
        <p class="text-sub">This app is not in the map any more.</p>
      }
    </section>

    <ng-template #card let-hop>
      <div class="flex min-h-[8rem] w-full flex-col gap-1 rounded-lg border border-border bg-card p-3">
        @if (hop.step) { <span class="text-label">{{ hop.step }}</span> }
        <span class="text-sm font-semibold text-foreground">{{ hop.title }}</span>
        @for (line of hop.lines; track $index) {
          <span class="truncate font-mono text-[11px] text-muted-foreground">{{ line }}</span>
        }
        <span class="mt-auto text-xs font-medium" [style.color]="checkOf(hop).color">{{ checkOf(hop).mark }} {{ hop.checkText }}</span>
      </div>
    </ng-template>
  `,
})
export class TopologyRequestPathComponent {
  readonly snapshot = input.required<TopologyResponseDto>();
  readonly appId = input.required<string>();
  readonly back = output<void>();

  protected readonly path = computed(() => requestPath(this.snapshot(), this.appId()));

  protected checkOf(hop: PathHop) {
    return CHECK[hop.check];
  }
}
