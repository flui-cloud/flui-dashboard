import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo } from '@ng-icons/lucide';
import { SparkLineComponent } from '../spark-line/spark-line.component';
import { StatTileData, StatTileNote } from '../chart.models';

/**
 * Stat Tile Component
 * One headline figure — label, value, change over the window, trend mark.
 * Five of these across the top of a page give the pulse of a cluster without
 * a single chart being read.
 *
 * @example
 * ```html
 * <app-stat-tile [data]="{ label: 'CPU media', value: '15.0', unit: '%', spark: cpuTrend() }" />
 * ```
 */
@Component({
  selector: 'app-stat-tile',
  standalone: true,
  imports: [SparkLineComponent, NgIcon],
  providers: [provideIcons({ lucideInfo })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="card-surface p-4 flex flex-col gap-2 h-full">
      <div class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-sub">
        {{ data().label }}
        @if (data().hint; as hint) {
          <ng-icon
            name="lucideInfo"
            class="h-3 w-3 shrink-0 normal-case"
            tabindex="0"
            role="img"
            data-testid="stat-tile-hint"
            [attr.title]="hint"
            [attr.aria-label]="hint"
          />
        }
      </div>

      <div class="flex items-baseline gap-1.5">
        <span class="text-2xl font-semibold text-foreground tracking-tight">{{ data().value }}</span>
        @if (data().unit) {
          <span class="text-xs text-sub">{{ data().unit }}</span>
        }
        @if (data().delta) {
          <span
            class="ml-auto text-[11px] font-semibold"
            [class]="deltaClass()"
            [attr.title]="data().deltaHint"
            [attr.aria-label]="data().delta + ' ' + (data().deltaHint ?? '')"
          >
            {{ data().delta }}
          </span>
        }
      </div>

      @for (note of data().notes ?? []; track note.text) {
        @if (note.kind === 'chip') {
          <span
            class="self-start inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-sub"
            data-testid="stat-tile-note"
            [attr.title]="note.hint"
          >
            @if (note.tone !== 'muted') {
              <span class="h-1.5 w-1.5 shrink-0 rounded-full" [class]="dotClass(note.tone)" data-testid="stat-tile-note-dot"></span>
            }
            {{ note.text }}
          </span>
        } @else {
          <p class="m-0 flex items-start gap-1.5 text-[11px] leading-snug text-sub" data-testid="stat-tile-note">
            @if (note.tone !== 'muted') {
              <span class="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" [class]="dotClass(note.tone)" data-testid="stat-tile-note-dot"></span>
            }
            <span>{{ note.text }}</span>
            @if (note.hint) {
              <ng-icon
                name="lucideInfo"
                class="mt-px h-3 w-3 shrink-0"
                tabindex="0"
                role="img"
                [attr.title]="note.hint"
                [attr.aria-label]="note.hint"
              />
            }
          </p>
        }
      }

      <div class="mt-auto flex flex-col gap-1">
        @if (spark().length > 1) {
          <app-spark-line
            [values]="spark()"
            [color]="color()"
            [width]="sparkWidth()"
            [height]="30"
            [ariaLabel]="data().label + ': trend over the selected window'"
          />
        } @else if (data().spark !== undefined) {
          <span class="text-[10px] text-sub">no history yet</span>
        }
        @if (data().footnote; as footnote) {
          <span class="truncate text-[10px] text-sub" [attr.title]="footnote" data-testid="stat-tile-footnote">{{ footnote }}</span>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class StatTileComponent {
  readonly data = input.required<StatTileData>();
  readonly sparkWidth = input<number>(120);

  readonly spark = computed(() => this.data().spark ?? []);
  readonly color = computed(() => this.data().color ?? '#2259F1');

  readonly deltaClass = computed(() => 'text-sub');

  dotClass(tone: StatTileNote['tone']): string {
    return tone === 'bad' ? 'bg-destructive' : 'bg-amber-500';
  }
}
