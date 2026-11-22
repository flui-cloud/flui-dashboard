import { Component, input } from '@angular/core';
import { RemovalPreview } from '../../model/scaling-section.models';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';

/**
 * Which machine a lower floor or target gives back and what runs on it, shown
 * where the person confirms. Flui's own parts are marked, because losing track
 * of one of them is how a dashboard goes dark.
 */
@Component({
  selector: 'app-removal-preview-note',
  imports: [FlStatus, FlTag],
  host: { class: 'block' },
  template: `
    @if (preview(); as p) {
      <div class="flex flex-col gap-1.5 text-fl-caption" data-testid="removal-preview">
        @if (p.proceeds) {
          <span class="text-fl-ink" data-testid="removal-preview-sentence">
            {{ p.moves.length ? p.headline : p.sentence }}
          </span>
        } @else {
          <fl-status
            class="whitespace-normal"
            tone="warning"
            [label]="p.sentence"
            data-testid="removal-preview-sentence"
          />
        }
        @if (p.proceeds && p.moves.length) {
          <span class="flex flex-wrap gap-1" data-testid="removal-preview-moves">
            @for (move of p.moves; track move.what) {
              <fl-tag
                class="fl-mono"
                [attr.title]="move.system ? 'Part of Flui itself' : 'An app you deployed'"
              >
                {{ move.what }}
                @if (move.system) {
                  · Flui
                }
              </fl-tag>
            }
          </span>
        }
        @for (reason of p.waitsFor; track reason.kind) {
          <span class="text-fl-ink-muted" data-testid="removal-preview-wait"
            >{{ reason.title }}: {{ reason.fix }}</span
          >
        }
      </div>
    }
  `,
})
export class RemovalPreviewNoteComponent {
  readonly preview = input<RemovalPreview | null>(null);
}
