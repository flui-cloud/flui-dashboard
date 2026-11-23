import { Component, input, computed } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleX, lucideInfo, lucideTriangleAlert } from '@ng-icons/lucide';
import { SparkLineComponent } from '../spark-line/spark-line.component';
import { StatTileData, StatTileNote } from '../chart.models';
import { cssColor } from '../chart-colors';

@Component({
  selector: 'app-stat-tile',
  imports: [SparkLineComponent, NgIcon],
  providers: [provideIcons({ lucideInfo, lucideTriangleAlert, lucideCircleX })],
  template: `
    <div class="fl-metric h-full rounded-fl-lg border border-fl-border">
      <div class="fl-metric__label flex items-center gap-1">
        {{ data().label }}
        @if (data().hint; as hint) {
          <ng-icon
            name="lucideInfo"
            size="12px"
            class="shrink-0"
            tabindex="0"
            role="img"
            data-testid="stat-tile-hint"
            [attr.title]="hint"
            [attr.aria-label]="hint"
          />
        }
      </div>

      <div class="flex items-baseline gap-1.5">
        <span class="fl-metric__value">{{ data().value }}</span>
        @if (data().unit) {
          <span class="text-fl-caption text-fl-ink-muted">{{ data().unit }}</span>
        }
        @if (data().delta) {
          <span
            class="fl-num ml-auto text-fl-caption font-medium"
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
            class="fl-tag gap-1 self-start"
            data-testid="stat-tile-note"
            [attr.title]="note.hint"
          >
            @if (note.tone !== 'muted') {
              <span [class]="markClass(note.tone)" data-testid="stat-tile-note-dot">
                <ng-icon [name]="markIcon(note.tone)" size="12px" />
              </span>
            }
            {{ note.text }}
          </span>
        } @else {
          <p
            class="m-0 flex items-start gap-1.5 text-fl-caption text-fl-ink-muted"
            data-testid="stat-tile-note"
          >
            @if (note.tone !== 'muted') {
              <span [class]="markClass(note.tone)" data-testid="stat-tile-note-dot">
                <ng-icon [name]="markIcon(note.tone)" size="12px" />
              </span>
            }
            <span>{{ note.text }}</span>
            @if (note.hint) {
              <ng-icon
                name="lucideInfo"
                size="12px"
                class="mt-0.5 shrink-0"
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
          <span class="fl-metric__caption">no history yet</span>
        }
        @if (data().footnote; as footnote) {
          <span
            class="fl-metric__caption truncate"
            [attr.title]="footnote"
            data-testid="stat-tile-footnote"
            >{{ footnote }}</span
          >
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class StatTileComponent {
  readonly data = input.required<StatTileData>();
  readonly sparkWidth = input<number>(120);

  readonly spark = computed(() => this.data().spark ?? []);
  readonly color = computed(() => this.data().color ?? cssColor('--fl-accent'));

  readonly deltaClass = computed(() => 'text-fl-ink-muted');

  markClass(tone: StatTileNote['tone']): string {
    return tone === 'bad'
      ? 'fl-status fl-status--error mt-0.5 shrink-0'
      : 'fl-status fl-status--warning mt-0.5 shrink-0';
  }

  markIcon(tone: StatTileNote['tone']): string {
    return tone === 'bad' ? 'lucideCircleX' : 'lucideTriangleAlert';
  }
}
