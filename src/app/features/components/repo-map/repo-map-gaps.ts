import { Component, input } from '@angular/core';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlTag } from '../../../ui/primitives/tag';
import { MapQuestion, Obstacle, longOptionCount, shortOptions } from './repo-map-view';

@Component({
  selector: 'app-repo-map-gaps',
  imports: [FlAlert, FlTag],
  host: { class: 'fl-stack' },
  template: `
    @if (obstacles().length > 0) {
      <fl-alert tone="error" title="In the way">
        <ul class="m-0 mt-1 flex flex-col gap-2 p-0">
          @for (o of obstacles(); track $index) {
            <li class="flex flex-col gap-0.5">
              <span class="text-fl-ink">
                {{ o.summary }}
                @if (o.unit) {
                  <span class="fl-mono text-fl-ink-muted">({{ o.unit }})</span>
                }
              </span>
              @if (o.remedy) {
                <span>Fix: {{ o.remedy }}</span>
              }
            </li>
          }
        </ul>
      </fl-alert>
    }

    @if (questions().length > 0) {
      <fl-alert tone="warning" title="We could not tell">
        <ul class="m-0 mt-1 flex flex-col gap-2 p-0">
          @for (q of questions(); track q.id) {
            <li class="fl-row">
              <span class="text-fl-ink">{{ q.question }}</span>
              @for (opt of short(q.options); track opt) {
                <fl-tag class="font-mono">{{ opt }}</fl-tag>
              }
              @if (more(q.options) > 0) {
                <span class="text-fl-ink-muted">{{ more(q.options) }} more in the raw map</span>
              }
            </li>
          }
        </ul>
      </fl-alert>
    }
  `,
})
export class RepoMapGaps {
  readonly obstacles = input<readonly Obstacle[]>([]);
  readonly questions = input<readonly MapQuestion[]>([]);

  protected short(options: string[]): string[] {
    return shortOptions(options);
  }

  protected more(options: string[]): number {
    return longOptionCount(options);
  }
}
