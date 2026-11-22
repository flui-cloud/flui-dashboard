import { Component, input, output } from '@angular/core';
import { Tone, statusToneOf } from '../dashboard/home-state';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { ListRow } from './applications-list-rows';

@Component({
  selector: 'tr[app-application-list-row]',
  imports: [FlStatus, FlTag, FlUsageBar],
  host: {
    '[attr.data-testid]': "'app-row-' + row().id",
    '[class.is-attention]': "row().tone === 'danger'",
    '(click)': 'open.emit(row().id)',
  },
  template: `
    @let r = row();
    <td class="whitespace-normal">
      <div class="fl-cell-name flex flex-col gap-0.5">
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            class="fl-link text-left"
            (click)="$event.stopPropagation(); open.emit(r.id)"
          >
            {{ r.name }}
          </button>
          @if (r.bundle) {
            <fl-tag>{{ r.bundle }}</fl-tag>
          }
          @if (r.tool) {
            <fl-tag data-testid="app-row-tool">tool</fl-tag>
          }
          @if (r.partOf; as bundle) {
            <span class="text-fl-caption text-fl-ink-muted" data-testid="app-row-part-of">
              part of
              <button
                type="button"
                class="fl-link"
                (click)="$event.stopPropagation(); open.emit(bundle.id)"
              >
                {{ bundle.name }}
              </button>
            </span>
          }
        </div>
        @if (r.subtitle.href) {
          <a
            [href]="r.subtitle.href"
            target="_blank"
            rel="noopener noreferrer"
            class="fl-mono truncate text-fl-ink-muted hover:text-fl-accent"
            data-testid="app-row-endpoint"
            (click)="$event.stopPropagation()"
            >{{ r.subtitle.text }}</a
          >
        } @else {
          <span
            class="fl-mono truncate text-fl-ink-muted"
            [title]="r.subtitle.text"
            data-testid="app-row-subtitle"
            >{{ r.subtitle.text }}</span
          >
        }
      </div>
    </td>
    <td><fl-status [tone]="tone(r.tone)" [label]="r.statusLabel" /></td>
    <td [title]="r.cluster.provider">
      <span class="fl-cell-clip">{{ r.cluster.name }}</span>
    </td>
    <td>{{ r.project?.name ?? '—' }}</td>
    <td class="is-num" [title]="r.ready.title" data-testid="app-row-ready">{{ r.ready.text }}</td>
    <td data-testid="app-row-origin">{{ r.origin }}</td>
    <td [title]="r.usageTitle" data-testid="app-row-usage">
      @if (r.cpu === null && r.memory === null) {
        <span class="text-fl-ink-muted">—</span>
      } @else {
        <div class="flex flex-col gap-2">
          <fl-usage-bar [percent]="bar(r.cpu)" aside="CPU" [label]="r.name + ' CPU of the limit'" />
          <fl-usage-bar
            [percent]="bar(r.memory)"
            aside="Memory"
            [label]="r.name + ' memory of the limit'"
          />
        </div>
      }
    </td>
    <td [title]="r.backup.title" data-testid="app-row-backup">
      @if (r.backup.label === '—') {
        <span class="text-fl-ink-muted">—</span>
      } @else {
        <fl-status [tone]="tone(r.backup.tone)" [label]="r.backup.label" />
      }
    </td>
    <td class="is-num" [title]="r.released.title">{{ r.released.text }}</td>
  `,
})
export class ApplicationListRowComponent {
  readonly row = input.required<ListRow>();
  readonly open = output<string>();

  protected tone(tone: Tone): StatusTone {
    return statusToneOf(tone);
  }

  protected bar(v: number | null): number {
    if (v == null) return 0;
    return Math.min(100, Math.max(0, v));
  }
}
