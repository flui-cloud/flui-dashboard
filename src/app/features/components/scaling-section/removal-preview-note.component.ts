import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RemovalPreview } from '../../model/scaling-section.models';

/**
 * Which machine a lower floor or target gives back and what runs on it, shown
 * where the person confirms. Flui's own parts are marked, because losing track
 * of one of them is how a dashboard goes dark.
 */
@Component({
  selector: 'app-removal-preview-note',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (preview(); as p) {
      <div class="flex flex-col gap-1.5 text-[12px] leading-relaxed" data-testid="removal-preview">
        <span [class]="p.proceeds ? 'text-foreground' : 'text-amber-700 dark:text-amber-400'" data-testid="removal-preview-sentence">
          {{ p.proceeds && p.moves.length ? p.headline : p.sentence }}
        </span>
        @if (p.proceeds && p.moves.length) {
          <span class="flex flex-wrap gap-1" data-testid="removal-preview-moves">
            @for (move of p.moves; track move.what) {
              <span
                class="rounded border px-1.5 py-0.5 font-mono text-[11px]"
                [class]="move.system ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-border text-sub'"
                [title]="move.system ? 'Part of Flui itself' : 'An app you deployed'"
              >
                {{ move.what }}@if (move.system) { · Flui }
              </span>
            }
          </span>
        }
        @for (reason of p.waitsFor; track reason.kind) {
          <span class="text-sub" data-testid="removal-preview-wait">{{ reason.title }}: {{ reason.fix }}</span>
        }
      </div>
    }
  `,
  styles: [`:host { display: block; }`],
})
export class RemovalPreviewNoteComponent {
  readonly preview = input<RemovalPreview | null>(null);
}
