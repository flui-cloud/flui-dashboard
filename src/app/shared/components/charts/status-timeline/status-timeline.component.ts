import { Component, input, computed, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlIcon } from '../../../../ui/primitives/icon';

import {
  StatusTimelineConfig,
  StatusTimelineData,
  DEFAULT_TIMELINE_CONFIG,
  TimelineStatus,
  TimelineEvent,
} from '../chart.models';

/**
 * Status Timeline Component
 * Displays uptime/downtime history in a visual timeline (GitHub-style)
 *
 * @example
 * ```html
 * <app-status-timeline
 *   [data]="{
 *     title: 'Uptime History',
 *     uptimePercentage: 99.95,
 *     events: [
 *       { timestamp: new Date('2024-01-01'), status: 'up' },
 *       { timestamp: new Date('2024-01-02'), status: 'down', duration: 3600000, message: 'Server crash' }
 *     ]
 *   }"
 *   [config]="{daysToShow: 90}"
 * />
 * ```
 */
@Component({
  selector: 'app-status-timeline',
  imports: [FlIcon],
  providers: [provideIcons({ lucideX })],
  template: `
    <div class="flex flex-col gap-4 rounded-fl-lg border border-fl-border bg-fl-surface p-4">
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <h3 class="m-0 text-fl-section-title text-fl-ink">{{ data().title }}</h3>
          @if (data().subtitle) {
            <p class="m-0 text-fl-caption text-fl-ink-muted">{{ data().subtitle }}</p>
          }
        </div>

        @if (config().showUptimePercentage && data().uptimePercentage !== undefined) {
          <div class="flex flex-col items-end">
            <span class="fl-num text-fl-metric text-fl-ink">{{ data().uptimePercentage }}%</span>
            <span class="text-fl-caption text-fl-ink-muted">Uptime</span>
          </div>
        }
      </div>

      <div class="timeline-grid" [class.compact]="config().compact">
        @for (day of timelineDays(); track day.date) {
          @if (day.event && day.status !== 'up') {
            <button
              type="button"
              class="timeline-block"
              [class]="getBlockClass(day.status)"
              [title]="getBlockTooltip(day)"
              [attr.aria-label]="getBlockTooltip(day)"
              (click)="onBlockClick(day)"
            ></button>
          } @else {
            <div
              class="timeline-block"
              role="img"
              [class]="getBlockClass(day.status)"
              [title]="getBlockTooltip(day)"
              [attr.aria-label]="getBlockTooltip(day)"
            ></div>
          }
        }
      </div>

      <div class="flex flex-wrap items-center gap-4 text-fl-caption text-fl-ink-muted">
        <span class="flex items-center gap-1.5"
          ><span class="timeline-key status-up"></span>Up</span
        >
        <span class="flex items-center gap-1.5"
          ><span class="timeline-key status-down"></span>Down</span
        >
        <span class="flex items-center gap-1.5"
          ><span class="timeline-key status-degraded"></span>Degraded</span
        >
        <span class="flex items-center gap-1.5"
          ><span class="timeline-key status-maintenance"></span>Maintenance</span
        >
        <span class="ml-auto">Last {{ config().daysToShow }} days</span>
      </div>

      @if (selectedIncident(); as incident) {
        <div
          class="flex items-start justify-between gap-3 rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3"
        >
          <div class="flex flex-col gap-1">
            <span class="text-fl-body-sm font-semibold text-fl-ink">
              {{ formatDate(incident.timestamp) }}
            </span>
            @if (incident.message) {
              <p class="m-0 text-fl-body-sm text-fl-ink-secondary">{{ incident.message }}</p>
            }
            @if (incident.duration) {
              <p class="m-0 font-mono text-fl-caption text-fl-ink-muted">
                Duration: {{ formatDuration(incident.duration) }}
              </p>
            }
          </div>
          <button
            type="button"
            class="fl-dialog__close"
            aria-label="Close"
            (click)="clearSelection()"
          >
            <fl-icon name="lucideX" />
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .timeline-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(12px, 1fr));
        gap: 3px;
        max-width: 100%;
      }

      .timeline-grid.compact {
        grid-template-columns: repeat(auto-fill, minmax(8px, 1fr));
        gap: 2px;
      }

      .timeline-block {
        aspect-ratio: 1;
        border-radius: 2px;
        cursor: pointer;
        outline-offset: 1px;
      }

      button.timeline-block {
        padding: 0;
        border: 0;
      }

      .timeline-block:focus-visible {
        outline: 2px solid var(--fl-accent);
      }

      .timeline-block:hover {
        outline: 1px solid var(--fl-ink-muted);
      }

      .timeline-key {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 2px;
      }

      .status-up {
        background-color: var(--fl-success);
      }

      .status-down {
        background-color: var(--fl-danger);
      }

      .status-degraded {
        background-color: var(--fl-warning-fill);
      }

      .status-maintenance {
        background-color: var(--fl-accent);
      }

      .status-unknown {
        background-color: var(--fl-track);
      }
    `,
  ],
})
export class StatusTimelineComponent {
  data = input.required<StatusTimelineData>();
  config = input<StatusTimelineConfig>({});

  selectedIncident = computed(() => this._selectedIncident());
  private readonly _selectedIncident = signal<TimelineEvent | null>(null);

  private readonly mergedConfig = computed(() => ({
    ...DEFAULT_TIMELINE_CONFIG,
    ...this.config(),
  }));

  timelineDays = computed(() => {
    const daysToShow = this.mergedConfig().daysToShow;
    const events = this.data().events;
    const days: Array<{ date: Date; status: TimelineStatus; event?: TimelineEvent }> = [];

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToShow);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const dayEvent = events.find((e) => {
        const eventDate = typeof e.timestamp === 'number' ? new Date(e.timestamp) : e.timestamp;
        return eventDate >= dayStart && eventDate <= dayEnd;
      });

      days.push({
        date: new Date(d),
        status: dayEvent?.status || 'up',
        event: dayEvent,
      });
    }

    return days;
  });

  getBlockClass(status: TimelineStatus): string {
    return `status-${status}`;
  }

  getBlockTooltip(day: { date: Date; status: TimelineStatus; event?: TimelineEvent }): string {
    const dateStr = this.formatDate(day.date);
    const statusStr = day.status.charAt(0).toUpperCase() + day.status.slice(1);

    if (day.event?.message) {
      return `${dateStr}\nStatus: ${statusStr}\n${day.event.message}`;
    }

    return `${dateStr}\nStatus: ${statusStr}`;
  }

  onBlockClick(day: { date: Date; status: TimelineStatus; event?: TimelineEvent }): void {
    if (day.event && day.status !== 'up') {
      this._selectedIncident.set(day.event);
    }
  }

  clearSelection(): void {
    this._selectedIncident.set(null);
  }

  formatDate(timestamp: Date | number): string {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${seconds}s`;
  }
}
