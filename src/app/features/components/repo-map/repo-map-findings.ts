import { Component, computed, input } from '@angular/core';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { VerdictDto } from '../../../core/api/model/verdictDto';
import { NeededThing, capacityLine, verdictHeadline } from './repo-map-view';

@Component({
  selector: 'app-repo-map-findings',
  imports: [FlPanel, FlKeyValue, FlKvItem, FlStatus, FlTag],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel>
      <fl-key-value>
        <fl-kv-item key="Verdict">{{ headline() }}</fl-kv-item>
        @if (capacity(); as line) {
          <fl-kv-item key="Capacity">{{ line }}</fl-kv-item>
        }
      </fl-key-value>
    </fl-panel>

    <fl-panel title="What you need to provide">
      @if (needed().length === 0) {
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          No environment values or keys are needed.
        </p>
      } @else {
        <ul class="m-0 flex flex-col gap-2 p-0">
          @for (n of needed(); track n.name) {
            <li class="fl-row text-fl-body-sm">
              <span class="fl-mono text-fl-ink">{{ n.name }}</span>
              @for (t of n.tags; track t) {
                @if (t === 'needed to start') {
                  <fl-status tone="warning" [label]="t" />
                } @else {
                  <fl-tag>{{ t }}</fl-tag>
                }
              }
              @if (n.detail) {
                <span class="fl-mono text-fl-ink-muted">{{ n.detail }}</span>
              }
            </li>
          }
        </ul>
      }
    </fl-panel>
  `,
})
export class RepoMapFindings {
  readonly verdict = input.required<VerdictDto>();
  readonly needed = input<readonly NeededThing[]>([]);

  protected readonly headline = computed(() => verdictHeadline(this.verdict()));
  protected readonly capacity = computed(() => capacityLine(this.verdict()));
}
